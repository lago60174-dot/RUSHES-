"use client";
import React from "react";
import { C, FONT_MONO, PLATFORMS } from "../ui/constants";
import { Video } from "../ui/types";
import { compressVideoFile, inspectVideo, MAX_VIDEO_SIZE_MB, MAX_VIDEO_SIZE_BYTES, MAX_VIDEO_DURATION_SECONDS } from "../../lib/videoCompression";

type LibraryItem = {
  path: string;
  name: string;
  size: number | null;
  mimetype: string | null;
  createdAt: string | null;
  url: string | null;
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${(bytes / 1024).toFixed(0)} Ko`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── AddVideoModal : confirme titre/plateforme avant upload + création de fiche ──
function AddVideoModal({
  file, onClose, onDone,
}: {
  file: File;
  onClose: () => void;
  onDone: (item: LibraryItem, videoRecords: Video[]) => void;
}) {
  const defaultTitle = file.name.replace(/\.[^/.]+$/, "");
  const [title, setTitle] = React.useState(defaultTitle);
  const [platforms, setPlatforms] = React.useState<string[]>(["tiktok"]);
  const [scheduledDate, setScheduledDate] = React.useState(todayStr());
  const [scheduledTime, setScheduledTime] = React.useState("18:00");
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [stage, setStage] = React.useState<"idle" | "compressing" | "uploading">("idle");
  const [error, setError] = React.useState("");
  const [checking, setChecking] = React.useState(true);
  const [needsCompression, setNeedsCompression] = React.useState(false);
  const [fileInfo, setFileInfo] = React.useState<{ sizeMB: number; duration: number } | null>(null);

  React.useEffect(() => {
    inspectVideo(file).then((info) => {
      setNeedsCompression(info.needed);
      setFileInfo({ sizeMB: info.originalSizeMB, duration: info.originalDuration });
      setChecking(false);
    }).catch(() => setChecking(false));
  }, [file]);

  const inputStyle: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary,
    outline: "none", borderRadius: 12, padding: "10px 14px", width: "100%", fontSize: "0.875rem",
  };

  function togglePlatform(key: string) {
    setPlatforms((prev) => {
      if (prev.includes(key)) return prev.length > 1 ? prev.filter((p) => p !== key) : prev;
      return [...prev, key];
    });
  }

  async function handleConfirm() {
    if (!title.trim()) return;
    setUploading(true); setProgress(0); setError("");
    try {
      let uploadFile: File = file;
      if (needsCompression) {
        setStage("compressing");
        uploadFile = await compressVideoFile(file, (pct) => setProgress(pct));
        if (uploadFile.size > MAX_VIDEO_SIZE_BYTES) {
          throw new Error(`Le fichier compressé dépasse encore ${MAX_VIDEO_SIZE_MB} Mo (${(uploadFile.size / (1024 * 1024)).toFixed(1)} Mo). Essaie une vidéo plus courte.`);
        }
      }

      setStage("uploading"); setProgress(0);
      const sessionRes = await fetch("/api/storage/token");
      const { url, key, userId } = await sessionRes.json();
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(url, key);
      const ext = uploadFile.name.split(".").pop();
      const storagePath = `${userId}/${Date.now()}.${ext}`;

      const signedUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const buf = ev.target?.result;
          setProgress(50);
          const { error: uploadError } = await sb.storage.from("videos").upload(storagePath, buf as ArrayBuffer, { contentType: uploadFile.type || "video/mp4" });
          if (uploadError) { reject(uploadError); return; }
          const { data: signed, error: signError } = await sb.storage.from("videos").createSignedUrl(storagePath, 60 * 60);
          setProgress(100);
          if (signError || !signed) { reject(signError || new Error("Échec de génération de l'URL")); return; }
          resolve(signed.signedUrl);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(uploadFile);
      });

      // Crée automatiquement une fiche vidéo par plateforme sélectionnée
      const videoRecords: Video[] = platforms.map((platform) => ({
        id: uid(), platform, title: title.trim(), hashtags: "", notes: "",
        status: "planned", scheduledDate, scheduledTime,
        durationSeconds: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
        newFollowers: 0, avgWatchTime: 0, completionRate: 0, videoUrl: signedUrl,
      }));
      await Promise.all(videoRecords.map(async (videoRecord) => {
        const res = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(videoRecord) });
        if (!res.ok) throw new Error((await res.json()).error);
      }));

      onDone({
        path: storagePath, name: storagePath.split("/").pop() || uploadFile.name,
        size: uploadFile.size, mimetype: uploadFile.type, createdAt: new Date().toISOString(), url: signedUrl,
      }, videoRecords);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false); setProgress(0); setStage("idle");
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "rgba(4,6,11,0.92)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl" style={{ background: C.surfaceAlt, border: `1px solid ${C.borderLight}` }}>
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="font-semibold" style={{ color: C.textPrimary }}>Ajouter une vidéo</div>
          <button onClick={onClose} className="text-xl w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: C.textSecondary, background: C.surface }}>✕</button>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="text-xs truncate" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>{file.name} · {formatSize(file.size)}</div>

          {!checking && needsCompression && fileInfo && (
            <div className="text-xs rounded-xl p-3" style={{ background: C.violetBg, color: C.violetLight }}>
              ⚙️ Cette vidéo ({fileInfo.sizeMB.toFixed(1)} Mo, {Math.round(fileInfo.duration)}s) dépasse les limites
              ({MAX_VIDEO_SIZE_MB} Mo / {MAX_VIDEO_DURATION_SECONDS}s). Elle sera automatiquement compressée et
              tronquée avant l'envoi.
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>Plateformes (sélection multiple)</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(PLATFORMS).map(([key, p]) => {
                const active = platforms.includes(key);
                return (
                  <button key={key} onClick={() => togglePlatform(key)} className="text-xs px-3 py-2 rounded-xl font-semibold transition-all flex items-center gap-1.5"
                    style={{
                      background: active ? `${p.color}20` : C.surface,
                      color: active ? p.color : C.textSecondary,
                      border: `1px solid ${active ? p.color + "60" : C.border}`,
                    }}>
                    <span style={{ opacity: active ? 1 : 0.4 }}>{active ? "☑" : "☐"}</span>
                    {p.label}
                  </button>
                );
              })}
            </div>
            {platforms.length > 1 && (
              <div className="text-xs mt-2" style={{ color: C.textMuted }}>
                Une fiche distincte sera créée pour chaque plateforme sélectionnée.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>Date planifiée</label>
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>Heure</label>
              <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} style={{ ...inputStyle, colorScheme: "dark", fontFamily: FONT_MONO }} />
            </div>
          </div>

          {error && <div className="text-xs rounded-xl p-3" style={{ color: C.coral, background: C.coralBg }}>{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl" style={{ color: C.textSecondary, border: `1px solid ${C.border}`, background: C.surface }}>Annuler</button>
          <button onClick={handleConfirm} disabled={uploading || checking || !title.trim()}
            className="text-sm px-5 py-2 rounded-xl font-semibold"
            style={{ background: `linear-gradient(135deg, ${C.violet}, #5B21B6)`, color: "#fff", opacity: uploading || checking || !title.trim() ? 0.6 : 1 }}>
            {checking ? "Analyse…" : stage === "compressing" ? `Compression… ${progress}%` : stage === "uploading" ? `Upload… ${progress}%` : platforms.length > 1 ? `Ajouter à ${platforms.length} réseaux` : "Ajouter au calendrier"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LibraryView({ onVideoAdded }: { onVideoAdded: (videos: Video[]) => void }) {
  const [items, setItems] = React.useState<LibraryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [deletingPath, setDeletingPath] = React.useState<string | null>(null);
  const [playingPath, setPlayingPath] = React.useState<string | null>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/storage/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, []);

  async function handleDelete(path: string) {
    if (!confirm("Supprimer définitivement cette vidéo du stockage ?")) return;
    setDeletingPath(path);
    try {
      const res = await fetch("/api/storage/delete", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setItems((prev) => prev.filter((i) => i.path !== path));
      if (playingPath === path) setPlayingPath(null);
    } catch (e) {
      alert("Erreur : " + (e as Error).message);
    } finally {
      setDeletingPath(null);
    }
  }

  function copyLink(url: string) {
    navigator.clipboard?.writeText(url);
  }

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(f); e.target.value = ""; }} />

      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="text-xs" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
          {loading ? "Chargement…" : `${items.length} vidéo${items.length > 1 ? "s" : ""}`}
        </div>
        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: `linear-gradient(135deg, ${C.violet}, #4F1D96)`, color: "#fff" }}>
            + Ajouter une vidéo
          </button>
          <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: C.card, color: C.textSecondary, border: `1px solid ${C.border}` }}>
            ↻ Rafraîchir
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-sm mb-4" style={{ background: C.coralBg, color: C.coral }}>
          {error}
        </div>
      )}

      {!loading && items.length === 0 && !error ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="text-2xl mb-2">🎞</div>
          <div className="text-sm" style={{ color: C.textSecondary }}>
            Aucune vidéo uploadée pour le moment. Clique sur « + Ajouter une vidéo » pour en envoyer une.
          </div>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {items.map((item) => (
            <div key={item.path} className="rounded-2xl overflow-hidden flex flex-col" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="relative" style={{ background: C.bg, aspectRatio: "9/16" }}>
                {item.url && playingPath === item.path ? (
                  <video src={item.url} controls autoPlay style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <button onClick={() => setPlayingPath(item.path)} disabled={!item.url}
                    className="absolute inset-0 flex items-center justify-center w-full h-full"
                    style={{ color: C.violetLight, fontSize: "2rem", background: "rgba(124,58,237,0.08)" }}>
                    ▶
                  </button>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col gap-1">
                <div className="text-xs font-medium truncate" style={{ color: C.textPrimary }} title={item.name}>{item.name}</div>
                <div className="text-xs" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>{formatSize(item.size)} · {formatDate(item.createdAt)}</div>
              </div>
              <div className="flex gap-1.5 p-3 pt-0">
                <button onClick={() => item.url && copyLink(item.url)} disabled={!item.url}
                  className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                  style={{ background: C.violetBg, color: C.violetLight, border: `1px solid ${C.violet}40` }}>
                  Copier le lien
                </button>
                <button onClick={() => handleDelete(item.path)} disabled={deletingPath === item.path}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                  style={{ background: C.coralBg, color: C.coral, border: `1px solid ${C.coral}40`, opacity: deletingPath === item.path ? 0.6 : 1 }}>
                  {deletingPath === item.path ? "…" : "🗑"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingFile && (
        <AddVideoModal file={pendingFile} onClose={() => setPendingFile(null)}
          onDone={(item, videoRecords) => {
            setItems((prev) => [item, ...prev]);
            setPendingFile(null);
            onVideoAdded(videoRecords);
          }} />
      )}
    </div>
  );
}
