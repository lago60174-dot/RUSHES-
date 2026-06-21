import express from "express";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import ffmpegPath from "ffmpeg-static";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WORKER_SECRET = process.env.WORKER_SECRET || "change-me";
const TMP = "/tmp/rushes";
const PLATFORMS = ["tiktok", "instagram", "youtube", "facebook"];

// ── Mistral helper ────────────────────────────────────────────────────────────
async function callMistral(system, user, maxTokens = 1000) {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-large-latest",
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "")
    .trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_, res) => res.json({ ok: true, service: "rushes-worker" }));

app.post("/process", (req, res) => {
  if (req.headers["x-worker-secret"] !== WORKER_SECRET)
    return res.status(401).json({ error: "Unauthorized" });
  const { jobId, videoPath, userId, maxClips = 5 } = req.body;
  if (!jobId || !videoPath || !userId)
    return res.status(400).json({ error: "Missing jobId, videoPath or userId" });
  res.json({ ok: true, jobId });
  processJob({ jobId, videoPath, userId, maxClips }).catch(async (err) => {
    console.error(`[${jobId}] Fatal:`, err);
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
function log(jobId, msg) { console.log(`[${jobId}] ${msg}`); }
function tmpFile(jobId, name) {
  const dir = path.join(TMP, jobId);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}
function cleanup(jobId) {
  try { fs.rmSync(path.join(TMP, jobId), { recursive: true, force: true }); } catch (_) {}
}
async function ffmpeg(args) {
  const { stdout } = await execAsync(`"${ffmpegPath}" ${args} -y 2>&1`, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────
async function processJob({ jobId, videoPath, userId, maxClips }) {
  log(jobId, "Starting pipeline");
  await updateJob(jobId, { status: "processing" });

  log(jobId, "Downloading video…");
  const { data: signedData, error: signErr } = await supabase.storage
    .from("videos").createSignedUrl(videoPath, 3600);
  if (signErr) throw new Error(`Storage sign error: ${signErr.message}`);

  const videoFile = tmpFile(jobId, "input.mp4");
  const videoRes = await fetch(signedData.signedUrl);
  if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`);
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
  fs.writeFileSync(videoFile, videoBuffer);
  log(jobId, `Downloaded ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB`);

  const probeOut = await execAsync(`"${ffmpegPath}" -i "${videoFile}" 2>&1 | grep Duration`)
    .catch(e => ({ stdout: e.stdout || "" }));
  const dm = probeOut.stdout.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const totalSeconds = dm ? parseInt(dm[1]) * 3600 + parseInt(dm[2]) * 60 + parseFloat(dm[3]) : 0;
  log(jobId, `Duration: ${totalSeconds}s`);

  log(jobId, "Extracting audio…");
  const audioFile = tmpFile(jobId, "audio.mp3");
  await ffmpeg(`-i "${videoFile}" -vn -ar 16000 -ac 1 -acodec libmp3lame -q:a 4 "${audioFile}"`);

  log(jobId, "Transcribing with Whisper…");
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioFile),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });
  const words = transcription.words || [];
  const fullText = transcription.text || "";
  log(jobId, `Transcribed ${words.length} words`);
  await updateJob(jobId, { transcript: fullText });

  log(jobId, "Selecting segments with Mistral…");
  const segments = await selectSegments(fullText, totalSeconds, maxClips);
  log(jobId, `Selected ${segments.length} segments`);
  await updateJob(jobId, { segments });

  log(jobId, "Processing clips…");
  const clips = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    log(jobId, `Clip ${i + 1}/${segments.length}: ${seg.start}s→${seg.end}s`);
    try {
      const clip = await processSegment({ jobId, videoFile, seg, index: i, userId, words });
      clips.push(clip);
      await updateJob(jobId, { clips });
    } catch (err) { log(jobId, `Clip ${i + 1} failed: ${err.message}`); }
  }

  cleanup(jobId);
  await updateJob(jobId, { status: "done", clips });
  log(jobId, "Pipeline complete");
}

async function selectSegments(transcript, totalDuration, maxClips) {
  const system = `Tu analyses une transcription vidéo et sélectionnes les meilleurs segments pour des clips courts (30-90s) adaptés aux Reels/Shorts/TikTok.
Critères : accroche forte dans les 3 premières secondes, idée complète et autonome, rythme dynamique.
Réponds UNIQUEMENT avec un JSON valide (sans markdown) : [{"start":12.5,"end":67.3,"hook":"première phrase","reason":"pourquoi ce segment fonctionne"}]
Timestamps en secondes (float). Entre 3 et 5 segments max. Ne chevauche pas les segments.`;
  const text = await callMistral(system, `Durée totale : ${Math.round(totalDuration)}s\n\nTranscription :\n${transcript}`);
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed.filter(s => s.start >= 0 && s.end > s.start).slice(0, maxClips) : [];
}

async function processSegment({ jobId, videoFile, seg, index, userId, words }) {
  const clipName = `clip_${String(index + 1).padStart(2, "0")}.mp4`;
  const clipFile = tmpFile(jobId, clipName);
  const srtFile = tmpFile(jobId, `clip_${index + 1}.srt`);
  const duration = seg.end - seg.start;

  const segWords = words.filter(w => w.start >= seg.start && w.end <= seg.end + 1);
  fs.writeFileSync(srtFile, generateSRT(segWords, seg.start));

  const subtitleStyle = "FontName=Arial,FontSize=14,Bold=1,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1,Alignment=2,MarginV=60";
  const vf = [
    `crop=ih*9/16:ih:(iw-ih*9/16)/2:0`,
    `scale=1080:1920`,
    `subtitles='${srtFile}':force_style='${subtitleStyle}'`,
  ].join(",");

  await ffmpeg(`-ss ${seg.start} -i "${videoFile}" -t ${duration} -vf "${vf}" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k "${clipFile}"`);

  const captions = await generateCaptions(seg);

  const storagePath = `${userId}/${jobId}/${clipName}`;
  const clipBuffer = fs.readFileSync(clipFile);
  const { error: upErr } = await supabase.storage.from("clips")
    .upload(storagePath, clipBuffer, { contentType: "video/mp4", upsert: true });
  if (upErr) throw new Error(`Upload error: ${upErr.message}`);

  const { data: { signedUrl } } = await supabase.storage.from("clips")
    .createSignedUrl(storagePath, 7 * 24 * 3600);

  return { path: storagePath, url: signedUrl, hook: seg.hook || "", reason: seg.reason || "",
    startTime: seg.start, endTime: seg.end, duration: Math.round(duration), captions };
}

function generateSRT(words, offsetStart) {
  if (!words.length) return "";
  const WORDS_PER_CHUNK = 4;
  const chunks = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) chunks.push(words.slice(i, i + WORDS_PER_CHUNK));
  return chunks.map((chunk, i) => {
    const start = Math.max(0, chunk[0].start - offsetStart);
    const end = Math.max(0, chunk[chunk.length - 1].end - offsetStart);
    const text = chunk.map(w => w.word).join(" ").trim();
    return `${i + 1}\n${toSRTTime(start)} --> ${toSRTTime(end)}\n${text}`;
  }).join("\n\n");
}

function toSRTTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
}

async function generateCaptions(seg) {
  const system = `Tu génères des légendes et hashtags optimisés par plateforme pour un clip de vidéo courte.
Réponds UNIQUEMENT avec un JSON valide (sans markdown) :
{"tiktok":{"caption":"...","hashtags":"#tag1 #tag2"},"instagram":{"caption":"...","hashtags":"..."},"youtube":{"caption":"...","hashtags":"..."},"facebook":{"caption":"...","hashtags":"..."}}
Chaque légende : 2-3 phrases max, accrocheuse, adaptée au style de la plateforme. Hashtags : 5-8 pertinents.`;
  const user = `Hook du clip : "${seg.hook}"\nRaison : "${seg.reason}"\nDurée : ${Math.round(seg.end - seg.start)}s`;
  try {
    const text = await callMistral(system, user);
    return JSON.parse(text);
  } catch (_) {
    return Object.fromEntries(PLATFORMS.map(p => [p, { caption: seg.hook || "", hashtags: "" }]));
  }
}
