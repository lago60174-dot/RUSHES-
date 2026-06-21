"use client";
import React from "react";
import { C, FONT_DISPLAY, FONT_MONO, PLATFORMS } from "../ui/constants";
import { ZernioAccount, ClipJob, Clip } from "../ui/types";
import { Video } from "../ui/types";

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── ClipPublishModal ──────────────────────────────────────────────────────────
function ClipPublishModal({ clip, platform, accounts, onClose, onSuccess }: {
  clip: Clip; platform: string; accounts: ZernioAccount[];
  onClose: () => void; onSuccess: (v: Video) => void;
}) {
  const p = PLATFORMS[platform];
  const [accountId, setAccountId] = React.useState(accounts[0]?._id || "");
  const [caption, setCaption] = React.useState([clip.captions?.[platform]?.caption, clip.captions?.[platform]?.hashtags].filter(Boolean).join("\n\n"));
  const [scheduleMode, setScheduleMode] = React.useState(false);
  const [scheduledFor, setScheduledFor] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handlePublish() {
    setLoading(true); setError("");
    try {
      const id = uid();
      const videoRecord: Video = {
        id, platform,
        title: clip.hook || caption.split("\n")[0].slice(0, 80),
        hashtags: clip.captions?.[platform]?.hashtags || "",
        notes: `Clip IA · ${Math.round(clip.duration)}s`,
        status: scheduleMode ? "planned" : "published",
        publishedDate: scheduleMode ? undefined : new Date().toISOString().slice(0, 10),
        publishedTime: scheduleMode ? undefined : new Date().toTimeString().slice(0, 5),
        scheduledDate: scheduleMode ? scheduledFor?.slice(0, 10) : undefined,
        scheduledTime: scheduleMode ? scheduledFor?.slice(11, 16) : undefined,
        durationSeconds: clip.duration || 0,
        views: 0, likes: 0, comments: 0, shares: 0, saves: 0, newFollowers: 0, avgWatchTime: 0, completionRate: 0,
        videoUrl: clip.url,
      };
      await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(videoRecord) });
      const res = await fetch("/api/zernio/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: id, caption: caption.trim(), accountId, platform, videoUrl: clip.url, scheduledFor: scheduleMode && scheduledFor ? scheduledFor : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSuccess({ ...videoRecord, zernioPostId: data.postId });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "rgba(4,6,11,0.9)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-6" style={{ background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="font-semibold" style={{ color: C.textPrimary }}>Publier sur <span style={{ color: p?.color }}>{p?.label}</span></div>
            <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>via Zernio</div>
          </div>
          <button onClick={onClose} style={{ color: C.textSecondary, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div className="space-y-3">
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} className="w-full rounded-xl px-4 py-3 text-sm"
            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.textPrimary, outline: "none", resize: "vertical" }} />
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.textSecondary }}>
            <input type="checkbox" checked={scheduleMode} onChange={(e) => setScheduleMode(e.target.checked)} style={{ accentColor: C.violet }} />
            Programmer plutôt que publier maintenant
          </label>
          {scheduleMode && (
            <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: C.textPrimary, colorScheme: "dark", outline: "none", fontFamily: FONT_MONO }} />
          )}
          {error && <div className="text-xs rounded-xl p-3" style={{ color: C.coral, background: C.coralBg }}>{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl" style={{ color: C.textSecondary, border: `1px solid ${C.border}` }}>Annuler</button>
          <button onClick={handlePublish} disabled={loading || !caption.trim()} className="text-sm px-5 py-2 rounded-xl font-semibold"
            style={{ background: `linear-gradient(135deg, ${C.violet}, #5B21B6)`, color: "#fff", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Envoi…" : scheduleMode ? "Programmer" : "Publier"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ClipsPreview ──────────────────────────────────────────────────────────────
function ClipsPreview({ clips, zernioAccounts, onPublished }: {
  clips: Clip[]; zernioAccounts: ZernioAccount[]; onPublished: (v: Video) => void;
}) {
  const [selectedPlatform, setSelectedPlatform] = React.useState("tiktok");
  const [publishingClip, setPublishingClip] = React.useState<{ clip: Clip; platform: string } | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="font-semibold" style={{ color: C.textPrimary }}>{clips.length} clips générés</div>
          <div className="text-xs mt-0.5" style={{ color: C.textSecondary }}>Sélectionne une plateforme pour voir la légende adaptée</div>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          {Object.entries(PLATFORMS).map(([key, p]) => (
            <button key={key} onClick={() => setSelectedPlatform(key)} className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
              style={{ background: selectedPlatform === key ? `${p.color}20` : "transparent", color: selectedPlatform === key ? p.color : C.textSecondary }}>
              {p.short}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {clips.map((clip, i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex gap-5 p-5">
              <div className="shrink-0">
                <video src={clip.url} controls style={{ width: 80, borderRadius: 12, background: C.bg, aspectRatio: "9/16" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ background: C.violetBg, color: C.violetLight, fontFamily: FONT_MONO }}>
                    {Math.round(clip.duration)}s
                  </span>
                  <span className="text-xs" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
                    {Math.round(clip.startTime)}s → {Math.round(clip.endTime)}s
                  </span>
                </div>
                <div className="font-semibold mb-1" style={{ color: C.textPrimary, fontFamily: FONT_DISPLAY }}>{clip.hook}</div>
                <div className="text-sm mb-4" style={{ color: C.textSecondary }}>{clip.reason}</div>
                {clip.captions?.[selectedPlatform] && (
                  <div className="rounded-xl p-3" style={{ background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
                    <div className="text-xs mb-1.5 font-bold" style={{ color: PLATFORMS[selectedPlatform]?.color, fontFamily: FONT_MONO }}>
                      {PLATFORMS[selectedPlatform]?.label}
                    </div>
                    <div className="text-sm mb-1.5" style={{ color: C.textPrimary }}>{clip.captions[selectedPlatform].caption}</div>
                    <div className="text-xs" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>{clip.captions[selectedPlatform].hashtags}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
              {zernioAccounts.some((a) => a.platform === selectedPlatform) ? (
                <button onClick={() => setPublishingClip({ clip, platform: selectedPlatform })}
                  className="text-xs px-4 py-2 rounded-xl font-semibold"
                  style={{ background: `linear-gradient(135deg, ${C.violet}, #5B21B6)`, color: "#fff" }}>
                  ↑ Publier via Zernio
                </button>
              ) : (
                <span className="text-xs" style={{ color: C.textMuted }}>Connecte {PLATFORMS[selectedPlatform]?.label} dans Zernio</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {publishingClip && (
        <ClipPublishModal
          clip={publishingClip.clip}
          platform={publishingClip.platform}
          accounts={zernioAccounts.filter((a) => a.platform === publishingClip.platform)}
          onClose={() => setPublishingClip(null)}
          onSuccess={(video) => { onPublished(video); setPublishingClip(null); }}
        />
      )}
    </div>
  );
}

// ── ClipsView (main) ──────────────────────────────────────────────────────────
export function ClipsView({ zernioAccounts, onVideoPublished }: {
  zernioAccounts: ZernioAccount[]; onVideoPublished: (v: Video) => void;
}) {
  const [jobs, setJobs] = React.useState<ClipJob[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [activeJob, setActiveJob] = React.useState<ClipJob | null>(null);
  const [pollingId, setPollingId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragRef = React.useRef(false);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/clips/jobs").then((r) => r.json()).then((data) => Array.isArray(data) && setJobs(data)).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/clips/jobs/${pollingId}`);
        const data = await res.json();
        if (data.status === "done" || data.status === "error") {
          setJobs((prev) => prev.map((j) => j.id === pollingId ? { ...j, ...data } : j));
          setActiveJob(data);
          setPollingId(null);
        }
      } catch (_) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [pollingId]);

  async function processFile(file: File) {
    if (file.size > 500 * 1024 * 1024) { alert("Max 500 MB"); return; }
    setUploading(true); setUploadProgress(0);
    try {
      const sessionRes = await fetch("/api/storage/token");
      const { url, key, userId } = await sessionRes.json();
      const { createClient: create } = await import("@supabase/supabase-js");
      const sb = create(url, key);
      const ext = file.name.split(".").pop();
      const storagePath = `${userId}/${Date.now()}.${ext}`;
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const buf = ev.target?.result;
          setUploadProgress(50);
          const { error } = await sb.storage.from("videos").upload(storagePath, buf as ArrayBuffer, { contentType: file.type || "video/mp4" });
          setUploadProgress(100);
          if (error) reject(error); else resolve(undefined);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      const jobRes = await fetch("/api/clips/process", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath: storagePath, videoName: file.name, maxClips: 5 }),
      });
      const { jobId } = await jobRes.json();
      const newJob: ClipJob = { id: jobId, status: "processing", video_name: file.name, clips: null, created_at: new Date().toISOString() };
      setJobs((prev) => [newJob, ...prev]);
      setActiveJob(newJob);
      setPollingId(jobId);
    } catch (err: unknown) {
      alert("Erreur : " + (err as Error).message);
    } finally {
      setUploading(false); setUploadProgress(0);
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className="rounded-2xl p-12 text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragging ? C.violet : C.border}`,
          background: dragging ? C.violetBg : C.surface,
        }}
      >
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} />
        {uploading ? (
          <div className="max-w-xs mx-auto">
            <div className="text-sm mb-4" style={{ color: C.textSecondary }}>Upload en cours… {uploadProgress}%</div>
            <div className="rounded-full h-1.5" style={{ background: C.card }}>
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%`, background: `linear-gradient(90deg, ${C.violet}, ${C.cyan})` }} />
            </div>
          </div>
        ) : (
          <>
            <div className="text-5xl mb-4 opacity-50">✂</div>
            <div className="font-semibold text-lg mb-2" style={{ color: C.textPrimary, fontFamily: FONT_DISPLAY }}>
              Dépose ta vidéo longue ici
            </div>
            <div className="text-sm" style={{ color: C.textSecondary }}>
              MP4, MOV, AVI · max 500 MB<br />
              <span style={{ color: C.textMuted }}>L'IA découpe, recadre en 9:16 et génère les sous-titres automatiquement</span>
            </div>
          </>
        )}
      </div>

      {/* Active job */}
      {activeJob && activeJob.status !== "done" && (
        <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: activeJob.status === "error" ? C.coral : C.violet, animation: activeJob.status === "processing" ? "pulse 2s infinite" : "none" }} />
          <div className="flex-1">
            <div className="font-medium text-sm" style={{ color: C.textPrimary }}>{activeJob.video_name}</div>
            <div className="text-xs mt-0.5" style={{ color: C.textSecondary }}>
              {activeJob.status === "pending" && "Démarrage du worker Render… (peut prendre 30s)"}
              {activeJob.status === "processing" && "Whisper transcrit · Mistral sélectionne les moments · ffmpeg découpe…"}
              {activeJob.status === "error" && `Erreur : ${activeJob.error}`}
            </div>
          </div>
          {activeJob.status === "processing" && (
            <div className="text-xs" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>polling…</div>
          )}
        </div>
      )}

      {activeJob?.status === "done" && Array.isArray(activeJob.clips) && (
        <ClipsPreview clips={activeJob.clips} zernioAccounts={zernioAccounts} onPublished={onVideoPublished} />
      )}

      {/* History */}
      {jobs.filter((j) => j.id !== activeJob?.id).length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>Traitements précédents</span>
            <div className="flex-1 h-px" style={{ background: C.border }} />
          </div>
          <div className="space-y-2">
            {jobs.filter((j) => j.id !== activeJob?.id).map((job) => (
              <button key={job.id} onClick={() => setActiveJob(job)} className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
                style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <span className="text-xs font-bold" style={{ color: job.status === "error" ? C.coral : C.cyan, fontFamily: FONT_MONO }}>
                  {job.status === "done" ? `${Array.isArray(job.clips) ? job.clips.length : 0} clips` : job.status}
                </span>
                <span className="flex-1 text-sm truncate" style={{ color: C.textPrimary }}>{job.video_name}</span>
                <span className="text-xs" style={{ color: C.textMuted }}>{new Date(job.created_at).toLocaleDateString("fr-FR")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
