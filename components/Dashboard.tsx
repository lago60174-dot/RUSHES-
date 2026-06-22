"use client";
import React, { useState, useEffect } from "react";
import { C, FONT_DISPLAY, FONT_MONO, PLATFORMS, TABS, MIN_VIDEOS_FOR_ANALYSIS } from "./ui/constants";
import { Video, ZernioAccount, AIMeta, AIAnalysis } from "./ui/types";
import { CalendarView } from "./calendar/CalendarView";
import { DashboardView } from "./dashboard/DashboardView";
import { HistoryView } from "./history/HistoryView";
import { AIAnalysisView } from "./ai/AIAnalysisView";
import { LibraryView } from "./library/LibraryView";
import { VideoModal, ZernioPublishModal } from "./modals/Modals";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

const BOTTOM_NAV_LABELS: Record<string, string> = {
  calendar: "Calendrier", dashboard: "Stats", history: "Historique",
  ai: "IA", library: "Médias",
};
function emptyForm(): Record<string, string> {
  return {
    id: "", platform: "tiktok", platforms: "tiktok", title: "", hashtags: "", notes: "", entryType: "planned",
    scheduledDate: todayStr(), scheduledTime: "18:00", publishedDate: todayStr(), publishedTime: "",
    durationSeconds: "", views: "", likes: "", comments: "", shares: "", saves: "",
    newFollowers: "", avgWatchTime: "", completionRate: "",
  };
}

export default function Dashboard() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("calendar");
  const [modalMode, setModalMode] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortKey, setSortKey] = useState("publishedDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiMeta, setAiMeta] = useState<AIMeta | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [zernioAccounts, setZernioAccounts] = useState<ZernioAccount[]>([]);
  const [publishModal, setPublishModal] = useState<Video | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/videos").then(r => r.json())
      .then(data => { if (mounted) setVideos(Array.isArray(data) ? data : []); })
      .catch(() => {}).finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    fetch("/api/analyse/cache").then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setAiAnalysis(data.result); setAiMeta({ generatedAt: data.generatedAt, videoCount: data.videoCount }); } })
      .catch(() => {});
    fetch("/api/zernio/accounts").then(r => r.json())
      .then(data => Array.isArray(data) && setZernioAccounts(data)).catch(() => {});
  }, []);

  async function persist(next: Video[]) { setVideos(next); }

  async function handleSave() {
    if (!form.title?.trim()) return;
    setSaving(true);
    const isPublished = form.entryType === "published";
    let completion = form.completionRate;
    if (!completion && form.durationSeconds && form.avgWatchTime) {
      const c = (Number(form.avgWatchTime) / Number(form.durationSeconds)) * 100;
      completion = isFinite(c) ? c.toFixed(1) : "";
    }
    const base = {
      platform: form.platform, title: form.title.trim(),
      hashtags: form.hashtags.trim(), notes: form.notes.trim(),
      status: isPublished ? "published" as const : "planned" as const,
    };
    const record = isPublished ? {
      ...base, scheduledDate: form.scheduledDate, scheduledTime: form.scheduledTime,
      publishedDate: form.publishedDate || todayStr(), publishedTime: form.publishedTime || "",
      durationSeconds: Number(form.durationSeconds) || 0, views: Number(form.views) || 0,
      likes: Number(form.likes) || 0, comments: Number(form.comments) || 0,
      shares: Number(form.shares) || 0, saves: Number(form.saves) || 0,
      newFollowers: Number(form.newFollowers) || 0, avgWatchTime: Number(form.avgWatchTime) || 0,
      completionRate: Number(completion) || 0,
    } : {
      ...base, scheduledDate: form.scheduledDate || todayStr(), scheduledTime: form.scheduledTime || "00:00",
      durationSeconds: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
      newFollowers: 0, avgWatchTime: 0, completionRate: 0,
    };

    const isNew = modalMode === "add";
    if (isNew) {
      const platformList = (form.platforms || form.platform || "tiktok")
        .split(",").map(p => p.trim()).filter(Boolean);
      const newVideos = (platformList.length ? platformList : [form.platform]).map(platform => ({
        id: uid(), ...record, platform,
      })) as Video[];
      persist([...videos, ...newVideos]);
      await Promise.all(newVideos.map(v =>
        fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) })
      ));
    } else {
      const next = videos.map(v => v.id === form.id ? { ...v, ...record } as Video : v);
      persist(next);
      await fetch(`/api/videos/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...record }) });
    }
    setSaving(false);
    setModalMode(null);
    setForm(emptyForm());
  }

  function handleDelete(id: string) {
    persist(videos.filter(v => v.id !== id));
    fetch(`/api/videos/${id}`, { method: "DELETE" });
    setModalMode(null);
    setForm(emptyForm());
  }

  async function syncStats(videoId: string) {
    setSyncingId(videoId);
    try {
      const res = await fetch(`/api/zernio/sync/${videoId}`);
      const data = await res.json();
      if (res.ok && data.stats) setVideos(prev => prev.map(v => v.id === videoId ? { ...v, ...data.stats, zernioSyncedAt: new Date().toISOString() } : v));
    } finally { setSyncingId(null); }
  }

  async function runAnalysis() {
    const published = videos.filter(v => v.status === "published");
    if (published.length < MIN_VIDEOS_FOR_ANALYSIS) return;
    setAiLoading(true); setAiError(null);
    try {
      const res = await fetch("/api/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videos: published }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiAnalysis(data.result);
      setAiMeta({ generatedAt: data.generatedAt, videoCount: data.videoCount });
    } catch { setAiError("L'analyse n'a pas pu être générée. Réessaie."); }
    finally { setAiLoading(false); }
  }

  function openEdit(v: Video) {
    setForm({
      ...emptyForm(), ...v as unknown as Record<string, string>, id: v.id, entryType: v.status,
      durationSeconds: String(v.durationSeconds || ""), views: String(v.views || ""),
      likes: String(v.likes || ""), comments: String(v.comments || ""),
      shares: String(v.shares || ""), saves: String(v.saves || ""),
      newFollowers: String(v.newFollowers || ""), avgWatchTime: String(v.avgWatchTime || ""),
      completionRate: String(v.completionRate || ""),
    });
    setModalMode("edit");
  }

  function openPublish(v: Video) {
    setForm({ ...emptyForm(), ...v as unknown as Record<string, string>, id: v.id, entryType: "published", publishedDate: todayStr(), publishedTime: v.scheduledTime || "" });
    setModalMode("publish");
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (isLoading) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }} className="flex items-center justify-center">
        <div style={{ fontFamily: FONT_MONO, color: C.textMuted, fontSize: "0.8rem" }}>Chargement…</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.textPrimary, minHeight: "100vh", fontFamily: FONT_DISPLAY }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: ${C.textMuted}; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        textarea, select, input { font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
      `}</style>

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen"
          style={{ background: C.bgAlt, borderRight: `1px solid ${C.border}` }}>
          <div className="p-6 pb-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${C.violet}, #4F1D96)` }}>
                <span style={{ color: "#fff", fontSize: "1rem", fontWeight: 900, fontFamily: FONT_DISPLAY }}>R</span>
              </div>
              <div>
                <div className="font-bold tracking-wider text-sm" style={{ color: C.textPrimary, letterSpacing: "0.1em" }}>RUSHES</div>
                <div className="text-xs" style={{ color: C.textMuted }}>Studio contenu</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 space-y-0.5">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: activeTab === t.key ? C.violetBg : "transparent",
                  color: activeTab === t.key ? C.violetLight : C.textSecondary,
                  border: `1px solid ${activeTab === t.key ? C.violet + "40" : "transparent"}`,
                }}>
                <span style={{ fontSize: "1rem" }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="p-4 pb-6 space-y-2">
            <button onClick={() => { setForm(emptyForm()); setModalMode("add"); }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: `linear-gradient(135deg, ${C.violet}, #4F1D96)`, color: "#fff" }}>
              + Ajouter une vidéo
            </button>
            <button onClick={handleLogout}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: C.card, color: C.textSecondary, border: `1px solid ${C.border}` }}>
              ⏻ Déconnexion
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center justify-between p-4 sticky top-0 z-10"
            style={{ background: C.bg + "F0", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${C.violet}, #4F1D96)` }}>
                <span style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 900 }}>R</span>
              </div>
              <span className="font-bold text-sm tracking-wider" style={{ color: C.textPrimary }}>RUSHES</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setForm(emptyForm()); setModalMode("add"); }}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: `linear-gradient(135deg, ${C.violet}, #4F1D96)`, color: "#fff" }}>
                + Ajouter
              </button>
              <button onClick={handleLogout} aria-label="Déconnexion"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm"
                style={{ background: C.card, color: C.textSecondary, border: `1px solid ${C.border}` }}>
                ⏻
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 pb-24 lg:pb-6">
            <div className="max-w-5xl">
              <div className="mb-7">
                <h1 className="text-2xl font-bold" style={{ color: C.textPrimary }}>
                  {TABS.find(t => t.key === activeTab)?.icon}{" "}
                  {TABS.find(t => t.key === activeTab)?.label}
                </h1>
              </div>

              {activeTab === "calendar" && (
                <CalendarView videos={videos} onPublish={openPublish} onEdit={openEdit}
                  zernioAccounts={zernioAccounts} onZernioPublish={v => setPublishModal(v)} />
              )}
              {activeTab === "dashboard" && (
                <DashboardView videos={videos} platformFilter={platformFilter}
                  setPlatformFilter={setPlatformFilter} sortKey={sortKey} setSortKey={setSortKey}
                  sortDir={sortDir} setSortDir={setSortDir} onEdit={openEdit}
                  syncingId={syncingId} onSync={syncStats} />
              )}
              {activeTab === "history" && <HistoryView videos={videos} />}
              {activeTab === "ai" && (
                <AIAnalysisView videos={videos} analysis={aiAnalysis} meta={aiMeta}
                  loading={aiLoading} error={aiError} onRun={runAnalysis} />
              )}
              {activeTab === "library" && <LibraryView onVideoAdded={vs => setVideos(prev => [...prev, ...vs])} />}
            </div>
          </div>
        </main>
      </div>

      {/* Bottom navbar mobile (style application) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 flex"
        style={{
          background: C.bgAlt + "F8", backdropFilter: "blur(12px)",
          borderTop: `1px solid ${C.border}`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 px-0.5"
            style={{ color: activeTab === t.key ? C.violetLight : C.textMuted }}>
            <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>{t.icon}</span>
            <span className="truncate w-full text-center" style={{ fontSize: "0.58rem", fontWeight: activeTab === t.key ? 700 : 500 }}>
              {BOTTOM_NAV_LABELS[t.key] || t.label}
            </span>
          </button>
        ))}
      </nav>

      {publishModal && (
        <ZernioPublishModal video={publishModal} accounts={zernioAccounts}
          onClose={() => setPublishModal(null)}
          onSuccess={(videoId, postId) => {
            setVideos(prev => prev.map(v => v.id === videoId ? { ...v, zernioPostId: postId, status: "published" } : v));
            setPublishModal(null);
          }} />
      )}

      {modalMode && (
        <VideoModal mode={modalMode} form={form} setForm={setForm}
          onSave={handleSave} onDelete={handleDelete}
          onClose={() => { setModalMode(null); setForm(emptyForm()); }}
          saving={saving} />
      )}
    </div>
  );
}
