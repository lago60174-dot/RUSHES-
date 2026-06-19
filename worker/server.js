import express from "express";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import ffmpegPath from "ffmpeg-static";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";
import fetch from "node-fetch";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Clients ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WORKER_SECRET = process.env.WORKER_SECRET || "change-me";
const TMP = "/tmp/rushes";
const PLATFORMS = ["tiktok", "instagram", "youtube", "facebook"];

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_, res) => res.json({ ok: true, service: "rushes-worker" }));

app.post("/process", (req, res) => {
  if (req.headers["x-worker-secret"] !== WORKER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { jobId, videoPath, userId, maxClips = 5 } = req.body;
  if (!jobId || !videoPath || !userId) {
    return res.status(400).json({ error: "Missing jobId, videoPath or userId" });
  }

  // Respond immediately — process in background
  res.json({ ok: true, jobId });

  processJob({ jobId, videoPath, userId, maxClips }).catch(async (err) => {
    console.error(`[${jobId}] Fatal error:`, err);
    await updateJob(jobId, { status: "error", error: err.message });
  });
});

app.listen(process.env.PORT || 4000, () =>
  console.log(`Rushes worker running on port ${process.env.PORT || 4000}`)
);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function updateJob(jobId, fields) {
  await supabase.from("clip_jobs").update(fields).eq("id", jobId);
}

function log(jobId, msg) {
  console.log(`[${jobId}] ${msg}`);
}

function tmpFile(jobId, name) {
  const dir = path.join(TMP, jobId);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}

function cleanup(jobId) {
  try {
    fs.rmSync(path.join(TMP, jobId), { recursive: true, force: true });
  } catch (_) {}
}

async function ffmpeg(args) {
  const cmd = `"${ffmpegPath}" ${args} -y 2>&1`;
  const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────
async function processJob({ jobId, videoPath, userId, maxClips }) {
  log(jobId, "Starting pipeline");
  await updateJob(jobId, { status: "processing" });

  // 1. Download video from Supabase Storage
  log(jobId, "Downloading video…");
  const { data: signedData, error: signErr } = await supabase.storage
    .from("videos")
    .createSignedUrl(videoPath, 3600);
  if (signErr) throw new Error(`Storage sign error: ${signErr.message}`);

  const videoFile = tmpFile(jobId, "input.mp4");
  const videoRes = await fetch(signedData.signedUrl);
  if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`);
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
  fs.writeFileSync(videoFile, videoBuffer);
  log(jobId, `Downloaded ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB`);

  // 2. Get video duration and dimensions
  const probeOut = await execAsync(
    `"${ffmpegPath}" -i "${videoFile}" 2>&1 | grep -E "Duration|Stream.*Video"`
  ).catch((e) => ({ stdout: e.stdout || "" }));
  const durationMatch = probeOut.stdout.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const totalSeconds = durationMatch
    ? parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseFloat(durationMatch[3])
    : 0;
  log(jobId, `Duration: ${totalSeconds}s`);

  // 3. Extract audio for transcription
  log(jobId, "Extracting audio…");
  const audioFile = tmpFile(jobId, "audio.mp3");
  await ffmpeg(`-i "${videoFile}" -vn -ar 16000 -ac 1 -acodec libmp3lame -q:a 4 "${audioFile}"`);

  // 4. Transcribe with Whisper (word-level timestamps)
  log(jobId, "Transcribing with Whisper…");
  const audioStream = fs.createReadStream(audioFile);
  const transcription = await openai.audio.transcriptions.create({
    file: audioStream,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  const words = transcription.words || [];
  const fullText = transcription.text || "";
  log(jobId, `Transcribed ${words.length} words`);
  await updateJob(jobId, { transcript: fullText });

  // 5. Claude selects the best segments
  log(jobId, "Selecting segments with Claude…");
  const segmentsRaw = await selectSegments(fullText, words, totalSeconds, maxClips);
  const segments = segmentsRaw.slice(0, maxClips);
  log(jobId, `Selected ${segments.length} segments`);
  await updateJob(jobId, { segments });

  // 6. Process each segment: cut + crop + subtitles + upload
  log(jobId, "Processing clips…");
  const clips = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    log(jobId, `Clip ${i + 1}/${segments.length}: ${seg.start}s → ${seg.end}s`);
    try {
      const clip = await processSegment({ jobId, videoFile, seg, index: i, userId, words });
      clips.push(clip);
      await updateJob(jobId, { clips });
    } catch (err) {
      log(jobId, `Clip ${i + 1} failed: ${err.message}`);
    }
  }

  cleanup(jobId);
  await updateJob(jobId, { status: "done", clips });
  log(jobId, "Pipeline complete");
}

// ── Segment selection ─────────────────────────────────────────────────────────
async function selectSegments(transcript, words, totalDuration, maxClips) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: [
      "Tu analyses une transcription vidéo et sélectionnes les meilleurs segments pour des clips courts (30-90 secondes) adaptés aux Reels/Shorts/TikTok.",
      "Critères : accroche forte dans les 3 premières secondes, idée complète et autonome, pas de référence à un contexte manquant, rythme dynamique.",
      "Réponds UNIQUEMENT avec un JSON valide (sans markdown) : [{\"start\":12.5,\"end\":67.3,\"hook\":\"première phrase d'accroche\",\"reason\":\"pourquoi ce segment fonctionne\"}]",
      "Les timestamps doivent être en secondes (float). Sélectionne entre 3 et 5 segments maximum. Ne chevauche pas les segments.",
    ].join(" "),
    messages: [{
      role: "user",
      content: `Durée totale : ${Math.round(totalDuration)}s\n\nTranscription :\n${transcript}`,
    }],
  });

  const text = msg.content.map((c) => c.text || "").join("").trim()
    .replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();

  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed.filter((s) => s.start >= 0 && s.end > s.start) : [];
}

// ── Clip generation ───────────────────────────────────────────────────────────
async function processSegment({ jobId, videoFile, seg, index, userId, words }) {
  const clipName = `clip_${String(index + 1).padStart(2, "0")}.mp4`;
  const clipFile = tmpFile(jobId, clipName);
  const srtFile = tmpFile(jobId, `clip_${index + 1}.srt`);
  const duration = seg.end - seg.start;

  // Generate SRT subtitles for this segment
  const segWords = words.filter((w) => w.start >= seg.start && w.end <= seg.end + 1);
  const srt = generateSRT(segWords, seg.start);
  fs.writeFileSync(srtFile, srt);

  // ffmpeg: cut + vertical 9:16 crop + burn subtitles
  // crop=ih*9/16:ih centers horizontally on the subject
  const subtitleStyle = "FontName=Arial,FontSize=14,Bold=1,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1,Alignment=2,MarginV=60";
  const vf = [
    `crop=ih*9/16:ih:(iw-ih*9/16)/2:0`,
    `scale=1080:1920`,
    `subtitles='${srtFile}':force_style='${subtitleStyle}'`,
  ].join(",");

  await ffmpeg(
    `-ss ${seg.start} -i "${videoFile}" -t ${duration} -vf "${vf}" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k "${clipFile}"`
  );

  // Generate captions and hashtags for each platform
  const captions = await generateCaptions(seg, index);

  // Upload to Supabase Storage
  const storagePath = `${userId}/${jobId}/${clipName}`;
  const clipBuffer = fs.readFileSync(clipFile);
  const { error: upErr } = await supabase.storage
    .from("clips")
    .upload(storagePath, clipBuffer, { contentType: "video/mp4", upsert: true });
  if (upErr) throw new Error(`Upload error: ${upErr.message}`);

  // Get public signed URL (1 week)
  const { data: { signedUrl } } = await supabase.storage
    .from("clips")
    .createSignedUrl(storagePath, 7 * 24 * 3600);

  return {
    path: storagePath,
    url: signedUrl,
    hook: seg.hook || "",
    reason: seg.reason || "",
    startTime: seg.start,
    endTime: seg.end,
    duration: Math.round(duration),
    captions,
  };
}

// ── SRT generation ────────────────────────────────────────────────────────────
function generateSRT(words, offsetStart) {
  if (!words.length) return "";
  const WORDS_PER_CHUNK = 4;
  const chunks = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
    chunks.push(words.slice(i, i + WORDS_PER_CHUNK));
  }

  return chunks
    .map((chunk, i) => {
      const start = chunk[0].start - offsetStart;
      const end = chunk[chunk.length - 1].end - offsetStart;
      const text = chunk.map((w) => w.word).join(" ").trim();
      return `${i + 1}\n${toSRTTime(Math.max(0, start))} --> ${toSRTTime(Math.max(0, end))}\n${text}`;
    })
    .join("\n\n");
}

function toSRTTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

// ── Caption/hashtag generation ────────────────────────────────────────────────
async function generateCaptions(seg, index) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: [
      "Tu génères des légendes et hashtags optimisés par plateforme pour un clip de vidéo courte.",
      "Réponds UNIQUEMENT avec un JSON valide (sans markdown) :",
      '{"tiktok":{"caption":"...","hashtags":"#tag1 #tag2"},"instagram":{"caption":"...","hashtags":"..."},"youtube":{"caption":"...","hashtags":"..."},"facebook":{"caption":"...","hashtags":"..."}}',
      "Chaque légende doit être courte (2-3 phrases max), accrocheuse, adaptée au style de la plateforme. Hashtags : 5-8 pertinents.",
    ].join(" "),
    messages: [{
      role: "user",
      content: `Hook du clip : "${seg.hook}"\nRaison : "${seg.reason}"\nDurée : ${Math.round(seg.end - seg.start)}s`,
    }],
  });

  const text = msg.content.map((c) => c.text || "").join("").trim()
    .replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();

  try { return JSON.parse(text); }
  catch (_) {
    return Object.fromEntries(PLATFORMS.map((p) => [p, { caption: seg.hook || "", hashtags: "" }]));
  }
}
