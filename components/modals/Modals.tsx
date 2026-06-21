"use client";
import React from "react";
import { C, FONT_DISPLAY, FONT_MONO, PLATFORMS } from "../ui/constants";
import { Video, ZernioAccount } from "../ui/types";

const inputStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  color: C.textPrimary,
  outline: "none",
  borderRadius: 12,
  padding: "10px 14px",
  width: "100%",
  fontSize: "0.875rem",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function StatInput({ label, value, onChange, placeholder = "0" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: C.textSecondary }}>{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputStyle, fontFamily: FONT_MONO }} />
    </div>
  );
}

// ── VideoModal ────────────────────────────────────────────────────────────────
export function VideoModal({
  mode, form, setForm, onSave, onDelete, onClose, saving,
}: {
  mode: string;
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const isPublish = mode === "publish";
  const isPublished = form.entryType === "published";
  function set(key: string, val: string) { setForm({ ...form, [key]: val }); }

  const titles: Record<string, string> = { add: "Ajouter une vidéo", edit: "Modifier", publish: "Marquer publiée" };
  const saveLabels: Record<string, string> = {
    publish: "Marquer publiée",
    add: isPublished ? "Ajouter" : "Ajouter au calendrier",
    edit: "Enregistrer",
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "rgba(4,6,11,0.92)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl"
        style={{ background: C.surfaceAlt, border: `1px solid ${C.borderLight}`, maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="font-semibold text-lg" style={{ color: C.textPrimary, fontFamily: FONT_DISPLAY }}>{titles[mode]}</div>
          <button onClick={onClose} className="text-xl w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: C.textSecondary, background: C.card }}>✕</button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Platform */}
          <Field label="Plateforme">
            <div className="flex gap-2 flex-wrap">
              {Object.entries(PLATFORMS).map(([key, p]) => (
                <button key={key} onClick={() => set("platform", key)}
                  className="text-xs px-3 py-2 rounded-xl font-semibold transition-all"
                  style={{
                    background: form.platform === key ? `${p.color}20` : C.card,
                    color: form.platform === key ? p.color : C.textSecondary,
                    border: `1px solid ${form.platform === key ? p.color + "60" : C.border}`,
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Titre">
            <input value={form.title} onChange={(e) => set("title", e.target.value)}
              placeholder="Ex : 3 erreurs qui ruinent ta croissance" style={inputStyle} />
          </Field>

          <Field label="Hashtags">
            <input value={form.hashtags} onChange={(e) => set("hashtags", e.target.value)}
              placeholder="#growth #entrepreneur" style={{ ...inputStyle, fontFamily: FONT_MONO }} />
          </Field>

          {/* Toggle planifié / publié */}
          {!isPublish && (
            <div className="flex gap-2">
              {[["planned", "📅 Planifiée"], ["published", "✓ Déjà publiée"]].map(([val, label]) => (
                <button key={val} onClick={() => set("entryType", val)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: form.entryType === val ? C.violetBg : C.card,
                    color: form.entryType === val ? C.violetLight : C.textSecondary,
                    border: `1px solid ${form.entryType === val ? C.violet + "60" : C.border}`,
                  }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {!isPublished ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input type="date" value={form.scheduledDate} onChange={(e) => set("scheduledDate", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
              </Field>
              <Field label="Heure">
                <input type="time" value={form.scheduledTime} onChange={(e) => set("scheduledTime", e.target.value)} style={{ ...inputStyle, colorScheme: "dark", fontFamily: FONT_MONO }} />
              </Field>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date de publication">
                  <input type="date" value={form.publishedDate} onChange={(e) => set("publishedDate", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
                </Field>
                <Field label="Heure (optionnel)">
                  <input type="time" value={form.publishedTime} onChange={(e) => set("publishedTime", e.target.value)} style={{ ...inputStyle, colorScheme: "dark", fontFamily: FONT_MONO }} />
                </Field>
              </div>
              <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>Statistiques</div>
                <div className="grid grid-cols-2 gap-3">
                  <StatInput label="Durée (s)" value={form.durationSeconds} onChange={(v) => set("durationSeconds", v)} />
                  <StatInput label="Vues" value={form.views} onChange={(v) => set("views", v)} />
                  <StatInput label="Likes" value={form.likes} onChange={(v) => set("likes", v)} />
                  <StatInput label="Commentaires" value={form.comments} onChange={(v) => set("comments", v)} />
                  <StatInput label="Partages" value={form.shares} onChange={(v) => set("shares", v)} />
                  <StatInput label="Favoris" value={form.saves} onChange={(v) => set("saves", v)} />
                  <StatInput label="Nouveaux abonnés" value={form.newFollowers} onChange={(v) => set("newFollowers", v)} />
                  <StatInput label="Temps moyen (s)" value={form.avgWatchTime} onChange={(v) => set("avgWatchTime", v)} />
                  <StatInput label="Complétion (%)" value={form.completionRate} onChange={(v) => set("completionRate", v)} placeholder="auto" />
                </div>
              </div>
            </>
          )}

          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              placeholder="Hook utilisé, idée à retester…"
              style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
          {mode === "edit" ? (
            <button onClick={() => onDelete(form.id)} className="text-xs font-medium" style={{ color: C.coral }}>Supprimer</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl" style={{ color: C.textSecondary, border: `1px solid ${C.border}`, background: C.card }}>Annuler</button>
            <button onClick={onSave} disabled={saving || !form.title?.trim()}
              className="text-sm px-5 py-2 rounded-xl font-semibold"
              style={{ background: `linear-gradient(135deg, ${C.violet}, #5B21B6)`, color: "#fff", opacity: saving || !form.title?.trim() ? 0.6 : 1 }}>
              {saveLabels[mode] || "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ZernioPublishModal ────────────────────────────────────────────────────────
export function ZernioPublishModal({
  video, accounts, onClose, onSuccess,
}: {
  video: Video;
  accounts: ZernioAccount[];
  onClose: () => void;
  onSuccess: (videoId: string, postId: string) => void;
}) {
  // Comptes disponibles groupés par plateforme
  const accountsByPlatform = React.useMemo(() => {
    const map: Record<string, ZernioAccount[]> = {};
    for (const a of accounts) (map[a.platform] ||= []).push(a);
    return map;
  }, [accounts]);

  // Sélection multi-plateforme : platform -> accountId (vide = décoché)
  const [selected, setSelected] = React.useState<Record<string, string>>(() => {
    const firstForVideoPlatform = accountsByPlatform[video.platform]?.[0]?._id;
    return firstForVideoPlatform ? { [video.platform]: firstForVideoPlatform } : {};
  });

  const [caption, setCaption] = React.useState([video.title, video.hashtags].filter(Boolean).join("\n\n"));
  const [videoUrl, setVideoUrl] = React.useState(video.videoUrl || "");
  const [scheduleMode, setScheduleMode] = React.useState(false);
  const [scheduledFor, setScheduledFor] = React.useState(video.scheduledDate && video.scheduledTime ? `${video.scheduledDate}T${video.scheduledTime}` : "");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function togglePlatform(platformKey: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[platformKey]) delete next[platformKey];
      else next[platformKey] = accountsByPlatform[platformKey]?.[0]?._id || "";
      return next;
    });
  }

  function setAccountForPlatform(platformKey: string, accountId: string) {
    setSelected((prev) => ({ ...prev, [platformKey]: accountId }));
  }

  async function handleFileUpload(file: File) {
    if (file.size > 500 * 1024 * 1024) { setError("Le fichier dépasse 500 Mo"); return; }
    setUploading(true); setUploadProgress(0); setError("");
    try {
      const sessionRes = await fetch("/api/storage/token");
      const { url, key, userId } = await sessionRes.json();
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(url, key);
      const ext = file.name.split(".").pop();
      const storagePath = `${userId}/${Date.now()}.${ext}`;
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const buf = ev.target?.result;
          setUploadProgress(50);
          const { error: uploadError } = await sb.storage.from("videos").upload(storagePath, buf as ArrayBuffer, { contentType: file.type || "video/mp4" });
          if (uploadError) { reject(uploadError); return; }
          const { data: signed, error: signError } = await sb.storage.from("videos").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
          setUploadProgress(100);
          if (signError || !signed) { reject(signError || new Error("Échec de génération de l'URL")); return; }
          setVideoUrl(signed.signedUrl);
          resolve(undefined);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    } catch (e) {
      setError("Échec de l'upload : " + (e as Error).message);
    } finally {
      setUploading(false); setUploadProgress(0);
    }
  }

  const targets = Object.entries(selected)
    .filter(([, accountId]) => accountId)
    .map(([platform, accountId]) => ({ platform, accountId }));

  async function handleSubmit() {
    if (targets.length === 0 || !caption.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/zernio/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id, caption: caption.trim(), targets, videoUrl: videoUrl.trim() || undefined, scheduledFor: scheduleMode && scheduledFor ? scheduledFor : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSuccess(video.id, data.postId);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "rgba(4,6,11,0.92)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl"
        style={{ background: C.surfaceAlt, border: `1px solid ${C.borderLight}`, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <div className="font-semibold" style={{ color: C.textPrimary }}>Publier sur plusieurs réseaux</div>
            <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>{video.title}</div>
          </div>
          <button onClick={onClose} className="text-xl w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: C.textSecondary, background: C.card }}>✕</button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {accounts.length === 0 ? (
            <div className="rounded-xl p-4 text-sm" style={{ background: C.card, color: C.textSecondary }}>
              Aucun compte connecté à Zernio. Va sur{" "}
              <a href="https://zernio.com" target="_blank" rel="noreferrer" style={{ color: C.violetLight }}>zernio.com</a>{" "}
              pour connecter tes comptes.
            </div>
          ) : (
            <>
              {/* Cases à cocher multi-plateforme */}
              <Field label="Plateformes">
                <div className="space-y-2">
                  {Object.entries(PLATFORMS).map(([key, p]) => {
                    const platformAccounts = accountsByPlatform[key] || [];
                    const checked = !!selected[key];
                    return (
                      <div key={key} className="rounded-xl p-3" style={{ background: C.card, border: `1px solid ${checked ? p.color + "60" : C.border}` }}>
                        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: platformAccounts.length ? C.textPrimary : C.textMuted }}>
                          <input type="checkbox" checked={checked} disabled={platformAccounts.length === 0}
                            onChange={() => togglePlatform(key)} style={{ accentColor: p.color }} />
                          <span style={{ color: p.color, fontWeight: 600 }}>{p.label}</span>
                          {platformAccounts.length === 0 && <span className="text-xs" style={{ color: C.textMuted }}>(non connecté)</span>}
                        </label>
                        {checked && platformAccounts.length > 1 && (
                          <select value={selected[key]} onChange={(e) => setAccountForPlatform(key, e.target.value)}
                            className="mt-2" style={{ ...inputStyle, padding: "6px 10px", fontSize: "0.8rem" }}>
                            {platformAccounts.map((a) => <option key={a._id} value={a._id}>@{a.username} · {a.name}</option>)}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Field>

              <Field label="Légende">
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4}
                  style={{ ...inputStyle, resize: "vertical" }} />
              </Field>

              {/* Upload vidéo */}
              <Field label="Vidéo">
                <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="text-xs px-3 py-2 rounded-lg font-semibold shrink-0"
                    style={{ background: C.violetBg, color: C.violetLight, border: `1px solid ${C.violet}60`, opacity: uploading ? 0.6 : 1 }}>
                    {uploading ? `Upload… ${uploadProgress}%` : "📤 Choisir un fichier"}
                  </button>
                  <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="ou colle une URL .mp4" style={{ ...inputStyle, background: "transparent", border: "none", padding: "4px 0" }} />
                </div>
                {videoUrl && (
                  <div className="text-xs mt-1.5 truncate" style={{ color: C.textMuted }}>✓ {videoUrl.startsWith("http") ? "Vidéo prête" : videoUrl}</div>
                )}
              </Field>

              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.textSecondary }}>
                <input type="checkbox" checked={scheduleMode} onChange={(e) => setScheduleMode(e.target.checked)} style={{ accentColor: C.violet }} />
                Programmer plutôt que publier maintenant
              </label>
              {scheduleMode && (
                <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
                  style={{ ...inputStyle, colorScheme: "dark", fontFamily: FONT_MONO }} />
              )}
              {error && <div className="text-xs rounded-xl p-3" style={{ color: C.coral, background: C.coralBg }}>{error}</div>}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl" style={{ color: C.textSecondary, border: `1px solid ${C.border}`, background: C.card }}>Annuler</button>
          {accounts.length > 0 && (
            <button onClick={handleSubmit} disabled={loading || uploading || !caption.trim() || targets.length === 0}
              className="text-sm px-5 py-2 rounded-xl font-semibold"
              style={{ background: `linear-gradient(135deg, ${C.violet}, #5B21B6)`, color: "#fff", opacity: loading || !caption.trim() || targets.length === 0 ? 0.6 : 1 }}>
              {loading ? "Envoi…" : scheduleMode ? "Programmer" : `Publier sur ${targets.length || ""} réseau${targets.length > 1 ? "x" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
