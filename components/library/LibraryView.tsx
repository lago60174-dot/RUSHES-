"use client";
import React from "react";
import { C, FONT_MONO } from "../ui/constants";

type LibraryItem = {
  path: string;
  name: string;
  size: number | null;
  mimetype: string | null;
  createdAt: string | null;
  url: string | null;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${(bytes / 1024).toFixed(0)} Ko`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LibraryView() {
  const [items, setItems] = React.useState<LibraryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [deletingPath, setDeletingPath] = React.useState<string | null>(null);
  const [playingPath, setPlayingPath] = React.useState<string | null>(null);

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

  if (loading) {
    return <div className="text-sm" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>Chargement…</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl p-4 text-sm" style={{ background: C.coralBg, color: C.coral }}>
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="text-2xl mb-2">🎞</div>
        <div className="text-sm" style={{ color: C.textSecondary }}>
          Aucune vidéo uploadée pour le moment. Les fichiers que tu envoies via le découpage IA
          ou la publication apparaîtront ici.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="text-xs" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>{items.length} vidéo{items.length > 1 ? "s" : ""}</div>
        <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg font-semibold"
          style={{ background: C.card, color: C.textSecondary, border: `1px solid ${C.border}` }}>
          ↻ Rafraîchir
        </button>
      </div>

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
    </div>
  );
}
