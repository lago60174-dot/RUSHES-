"use client";
import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const C = {
  bg: "#14141A",
  surface: "#1C1C24",
  surfaceRaised: "#24242E",
  border: "#32323D",
  textPrimary: "#EDEAE2",
  textSecondary: "#9A98A8",
  textMuted: "#6E6C7A",
  amber: "#F0A93E",
  amberSoft: "rgba(240,169,62,0.15)",
  coral: "#E2685A",
};

const FONT_DISPLAY = "'Space Grotesk', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'SFMono-Regular', monospace";

const PLATFORMS = {
  tiktok: { label: "TikTok", short: "TT", color: "#4DD9D2" },
  instagram: { label: "Instagram", short: "IG", color: "#D6457D" },
  youtube: { label: "YouTube Shorts", short: "YT", color: "#E25555" },
  facebook: { label: "Facebook", short: "FB", color: "#5B8DEF" },
};

const MIN_VIDEOS_FOR_ANALYSIS = 5;

type Video = {
  id: string;
  platform: string;
  title: string;
  hashtags: string;
  notes: string;
  status: "planned" | "published";
  scheduledDate?: string;
  scheduledTime?: string;
  publishedDate?: string;
  publishedTime?: string;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  newFollowers: number;
  avgWatchTime: number;
  completionRate: number;
  // Phase 3 — Zernio
  zernioPostId?: string;
  zernioAccountId?: string;
  zernioSyncedAt?: string;
  videoUrl?: string;
};

type ZernioAccount = {
  _id: string;
  platform: string;
  name: string;
  username: string;
};


const inputStyle = {
  background: C.surfaceRaised,
  border: `1px solid ${C.border}`,
  color: C.textPrimary,
  outline: "none",
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatNum(n) {
  const num = Number(n);
  if (!num || isNaN(num)) return "0";
  return num.toLocaleString("fr-FR");
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dayDiff(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function getBucket(video) {
  const diff = dayDiff(video.scheduledDate);
  if (diff < 0) return "retard";
  if (diff === 0) return "aujourdhui";
  if (diff === 1) return "demain";
  if (diff <= 7) return "semaine";
  return "plus_tard";
}

function hourBucket(timeStr) {
  if (!timeStr) return null;
  const h = parseInt(timeStr.split(":")[0], 10);
  if (isNaN(h)) return null;
  if (h >= 6 && h < 12) return "Matin";
  if (h >= 12 && h < 18) return "Après-midi";
  if (h >= 18 && h < 22) return "Soir";
  return "Nuit";
}

function emptyForm() {
  return {
    id: null,
    platform: "tiktok",
    title: "",
    hashtags: "",
    notes: "",
    entryType: "planned",
    scheduledDate: todayStr(),
    scheduledTime: "18:00",
    publishedDate: todayStr(),
    publishedTime: "",
    durationSeconds: "",
    views: "",
    likes: "",
    comments: "",
    shares: "",
    saves: "",
    newFollowers: "",
    avgWatchTime: "",
    completionRate: "",
  };
}

const TABS = [
  { key: "calendar", label: "Calendrier" },
  { key: "dashboard", label: "Tableau de bord" },
  { key: "history", label: "Historique" },
  { key: "ai", label: "Analyse IA" },
  { key: "clips", label: "✂ Découpage" },
];

export default function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("calendar");
  const [modalMode, setModalMode] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortKey, setSortKey] = useState("publishedDate");
  const [sortDir, setSortDir] = useState("desc");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiMeta, setAiMeta] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  // Phase 3 — Zernio
  const [zernioAccounts, setZernioAccounts] = useState<ZernioAccount[]>([]);
  const [publishModal, setPublishModal] = useState<Video | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/videos");
        const data = await res.json();
        if (mounted) setVideos(Array.isArray(data) ? data : []);
      } catch (e) {
        if (mounted) setVideos([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/analyse/cache");
        if (res.ok) {
          const data = await res.json();
          setAiAnalysis(data.result || null);
          setAiMeta({ generatedAt: data.generatedAt, videoCount: data.videoCount });
        }
      } catch (e) {
        // no cached analysis yet
      }
    })();
  }, []);

  useEffect(() => {
    fetch("/api/zernio/accounts")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setZernioAccounts(data))
      .catch(() => {});
  }, []);

  async function persist(next: Video[]) {
    setVideos(next);
  }

  async function saveVideo(record: Video, isNew: boolean) {
    if (isNew) {
      await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    } else {
      await fetch(`/api/videos/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    }
  }

  async function deleteVideo(id: string) {
    await fetch(`/api/videos/${id}`, { method: "DELETE" });
  }

  function openAdd() {
    setForm(emptyForm());
    setModalMode("add");
  }

  function openEdit(video) {
    setForm({ ...emptyForm(), ...video, entryType: video.status });
    setModalMode("edit");
  }

  function openPublish(video) {
    setForm({
      ...emptyForm(),
      ...video,
      entryType: "published",
      publishedDate: todayStr(),
      publishedTime: video.scheduledTime || "",
    });
    setModalMode("publish");
  }

  function closeModal() {
    setModalMode(null);
    setForm(emptyForm());
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    const isPublished = form.entryType === "published";

    let completion = form.completionRate;
    if (!completion && form.durationSeconds && form.avgWatchTime) {
      const c =
        (Number(form.avgWatchTime) / Number(form.durationSeconds)) * 100;
      completion = isFinite(c) ? c.toFixed(1) : "";
    }

    const base = {
      platform: form.platform,
      title: form.title.trim(),
      hashtags: form.hashtags.trim(),
      notes: form.notes.trim(),
      status: isPublished ? "published" : "planned",
    };

    let record;
    if (isPublished) {
      record = {
        ...base,
        scheduledDate: form.scheduledDate || "",
        scheduledTime: form.scheduledTime || "",
        publishedDate: form.publishedDate || todayStr(),
        publishedTime: form.publishedTime || "",
        durationSeconds: Number(form.durationSeconds) || 0,
        views: Number(form.views) || 0,
        likes: Number(form.likes) || 0,
        comments: Number(form.comments) || 0,
        shares: Number(form.shares) || 0,
        saves: Number(form.saves) || 0,
        newFollowers: Number(form.newFollowers) || 0,
        avgWatchTime: Number(form.avgWatchTime) || 0,
        completionRate: Number(completion) || 0,
      };
    } else {
      record = {
        ...base,
        scheduledDate: form.scheduledDate || todayStr(),
        scheduledTime: form.scheduledTime || "00:00",
      };
    }

    const isNew = modalMode === "add";
    let next: Video[];
    if (isNew) {
      const newVideo = { id: uid(), ...record } as Video;
      next = [...videos, newVideo];
      persist(next);
      await saveVideo(newVideo, true);
    } else {
      next = videos.map((v) => (v.id === form.id ? { ...v, ...record } as Video : v));
      persist(next);
      await saveVideo({ ...form, ...record } as Video, false);
    }
    setSaving(false);
    closeModal();
  }

  function handleDelete(id: string) {
    persist(videos.filter((v) => v.id !== id));
    deleteVideo(id);
    closeModal();
  }

  async function syncStats(videoId: string) {
    setSyncingId(videoId);
    try {
      const res = await fetch(`/api/zernio/sync/${videoId}`);
      const data = await res.json();
      if (res.ok && data.stats) {
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId
              ? { ...v, ...data.stats, zernioSyncedAt: new Date().toISOString() }
              : v
          )
        );
      }
    } finally {
      setSyncingId(null);
    }
  }

  async function runAnalysis() {
    const published = videos.filter((v) => v.status === "published");
    if (published.length < MIN_VIDEOS_FOR_ANALYSIS) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: published }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAiAnalysis(data.result);
      setAiMeta({ generatedAt: data.generatedAt, videoCount: data.videoCount });
    } catch (e) {
      setAiError("L'analyse n'a pas pu être générée. Réessaie dans un instant.");
    } finally {
      setAiLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div
        style={{ background: C.bg, color: C.textSecondary, minHeight: 400 }}
        className="flex items-center justify-center p-10"
      >
        <div style={{ fontFamily: FONT_MONO }} className="text-sm">
          Chargement…
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ background: C.bg, color: C.textPrimary, minHeight: "100vh", fontFamily: FONT_DISPLAY }}
      className="p-4 sm:p-6"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        input::placeholder, textarea::placeholder { color: ${C.textMuted}; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
      `}</style>

      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div
            className="text-sm font-semibold"
            style={{ color: C.amber, letterSpacing: "0.15em" }}
          >
            RUSHES
          </div>
          <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>
            Centre de contrôle contenu
          </div>
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="text-sm px-3 py-1.5 rounded-lg whitespace-nowrap"
              style={{
                background: activeTab === t.key ? C.surfaceRaised : "transparent",
                color: activeTab === t.key ? C.textPrimary : C.textSecondary,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={openAdd}
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: C.amber, color: C.bg }}
        >
          + Ajouter une vidéo
        </button>
      </div>

      {activeTab === "calendar" && (
        <CalendarView
          videos={videos}
          onPublish={openPublish}
          onEdit={openEdit}
          zernioAccounts={zernioAccounts}
          onZernioPublish={(v) => setPublishModal(v)}
        />
      )}
      {activeTab === "dashboard" && (
        <DashboardView
          videos={videos}
          platformFilter={platformFilter}
          setPlatformFilter={setPlatformFilter}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortDir={sortDir}
          setSortDir={setSortDir}
          onEdit={openEdit}
          syncingId={syncingId}
          onSync={syncStats}
        />
      )}
      {activeTab === "history" && <HistoryView videos={videos} />}
      {activeTab === "ai" && (
        <AIAnalysisView
          videos={videos}
          analysis={aiAnalysis}
          meta={aiMeta}
          loading={aiLoading}
          error={aiError}
          onRun={runAnalysis}
        />
      )}
      {activeTab === "clips" && (
        <ClipsView
          zernioAccounts={zernioAccounts}
          onVideoPublished={(video) => {
            setVideos((prev) => [...prev, video]);
          }}
        />
      )}

      {publishModal && (
        <ZernioPublishModal
          video={publishModal}
          accounts={zernioAccounts}
          onClose={() => setPublishModal(null)}
          onSuccess={(videoId, postId) => {
            setVideos((prev) =>
              prev.map((v) =>
                v.id === videoId ? { ...v, zernioPostId: postId, status: "published" } : v
              )
            );
            setPublishModal(null);
          }}
        />
      )}

      {modalMode && (
        <VideoModal
          mode={modalMode}
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={closeModal}
          saving={saving}
        />
      )}
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-xl py-16 text-center" style={{ border: `1px dashed ${C.border}` }}>
      <div className="text-lg mb-2" style={{ fontFamily: FONT_DISPLAY }}>
        {title}
      </div>
      <div className="text-sm max-w-sm mx-auto" style={{ color: C.textSecondary }}>
        {text}
      </div>
    </div>
  );
}

function CalendarView({ videos, onPublish, onEdit, zernioAccounts, onZernioPublish }) {
  const planned = videos.filter((v) => v.status === "planned");
  if (planned.length === 0) {
    return (
      <EmptyState
        title="Rien de planifié pour l'instant"
        text="Ajoute ta prochaine vidéo pour commencer à organiser ton calendrier de publication."
      />
    );
  }

  const buckets = { retard: [], aujourdhui: [], demain: [], semaine: [], plus_tard: [] };
  planned.forEach((v) => buckets[getBucket(v)].push(v));
  Object.keys(buckets).forEach((k) =>
    buckets[k].sort((a, b) =>
      (a.scheduledDate + a.scheduledTime).localeCompare(b.scheduledDate + b.scheduledTime)
    )
  );

  const order = [
    ["retard", "En retard"],
    ["aujourdhui", "Aujourd'hui"],
    ["demain", "Demain"],
    ["semaine", "Cette semaine"],
    ["plus_tard", "Plus tard"],
  ];

  return (
    <div className="space-y-8">
      {order.map(([key, label]) =>
        buckets[key].length > 0 ? (
          <div key={key}>
            <div className="flex items-center gap-2 mb-3">
              {key === "retard" && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.coral }} />
              )}
              <h2
                className="text-sm uppercase"
                style={{
                  color: key === "retard" ? C.coral : C.textSecondary,
                  fontFamily: FONT_DISPLAY,
                  letterSpacing: "0.12em",
                }}
              >
                {label}
              </h2>
              <span style={{ fontFamily: FONT_MONO, color: C.textMuted }} className="text-xs">
                ({buckets[key].length})
              </span>
            </div>
            <div className="grid gap-2">
              {buckets[key].map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onPublish={onPublish}
                  onEdit={onEdit}
                  hasZernio={zernioAccounts.some((a) => a.platform === v.platform)}
                  onZernioPublish={onZernioPublish}
                />
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

function VideoCard({ video, onPublish, onEdit, hasZernio, onZernioPublish }) {
  const p = PLATFORMS[video.platform];
  return (
    <div
      className="flex items-center gap-3 rounded-lg p-3"
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${p.color}` }}
    >
      <div className="text-sm shrink-0 w-14" style={{ fontFamily: FONT_MONO, color: C.textSecondary }}>
        {video.scheduledTime}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: C.surfaceRaised, color: p.color, fontFamily: FONT_MONO }}
          >
            {p.short}
          </span>
          <div className="truncate font-medium" style={{ fontFamily: FONT_DISPLAY }}>
            {video.title}
          </div>
        </div>
        {video.hashtags && (
          <div className="text-xs mt-1 truncate" style={{ color: C.textMuted }}>
            {video.hashtags}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        <button
          onClick={() => onEdit(video)}
          className="text-xs px-2 py-1 rounded"
          style={{ color: C.textSecondary, border: `1px solid ${C.border}` }}
        >
          Modifier
        </button>
        {hasZernio && (
          <button
            onClick={() => onZernioPublish(video)}
            className="text-xs px-2.5 py-1 rounded font-medium"
            style={{ background: "#4DD9D2", color: C.bg }}
          >
            ↑ Publier via Zernio
          </button>
        )}
        <button
          onClick={() => onPublish(video)}
          className="text-xs px-2.5 py-1 rounded font-medium"
          style={{ background: C.amber, color: C.bg }}
        >
          Marquer publiée
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, suffix = "" }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="text-2xl" style={{ fontFamily: FONT_MONO, color: C.amber }}>
        {typeof value === "number" ? formatNum(value) : value}
        {suffix || ""}
      </div>
      <div className="text-xs mt-1 uppercase" style={{ color: C.textSecondary }}>
        {label}
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label, color = undefined }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5"
      style={{
        background: active ? C.amberSoft : "transparent",
        color: active ? C.amber : C.textSecondary,
        border: `1px solid ${active ? C.amber : C.border}`,
      }}
    >
      {color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />}
      {label}
    </button>
  );
}

const DASHBOARD_COLUMNS = [
  ["platform", "Plat."],
  ["title", "Titre"],
  ["publishedDate", "Date"],
  ["views", "Vues"],
  ["likes", "Likes"],
  ["comments", "Comm."],
  ["shares", "Partages"],
  ["saves", "Favoris"],
  ["newFollowers", "Abonnés"],
  ["avgWatchTime", "T. moyen"],
  ["completionRate", "Complét."],
  ["sync", ""],
];

function DashboardView({
  videos,
  platformFilter,
  setPlatformFilter,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
  onEdit,
  syncingId,
  onSync,
}) {
  const published = videos.filter((v) => v.status === "published");

  if (published.length === 0) {
    return (
      <EmptyState
        title="Pas encore de vidéo publiée"
        text="Marque une vidéo planifiée comme publiée, ou ajoute directement une vidéo déjà en ligne pour commencer à suivre ses performances."
      />
    );
  }

  const filtered = platformFilter === "all" ? published : published.filter((v) => v.platform === platformFilter);
  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortKey];
    let bv = b[sortKey];
    if (typeof av === "string") {
      av = av || "";
      bv = bv || "";
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    av = Number(av) || 0;
    bv = Number(bv) || 0;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const totals = published.reduce(
    (acc, v) => ({
      views: acc.views + (v.views || 0),
      followers: acc.followers + (v.newFollowers || 0),
      count: acc.count + 1,
      completionSum: acc.completionSum + (v.completionRate || 0),
    }),
    { views: 0, followers: 0, count: 0, completionSum: 0 }
  );
  const avgCompletion = totals.count ? (totals.completionSum / totals.count).toFixed(1) : "0";

  const chartData = Object.entries(PLATFORMS).map(([key, p]) => ({
    name: p.short,
    views: published.filter((v) => v.platform === key).reduce((s, v) => s + (v.views || 0), 0),
    color: p.color,
  }));

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Vidéos publiées" value={totals.count} />
        <SummaryCard label="Vues totales" value={totals.views} />
        <SummaryCard label="Nouveaux abonnés" value={totals.followers} />
        <SummaryCard label="Complétion moyenne" value={avgCompletion} suffix="%" />
      </div>

      <div className="rounded-xl p-4 mb-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="text-xs uppercase mb-3" style={{ color: C.textSecondary }}>
          Vues par plateforme
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: C.textSecondary, fontSize: 12 }} stroke={C.border} />
            <YAxis tick={{ fill: C.textSecondary, fontSize: 12 }} stroke={C.border} />
            <Tooltip
              contentStyle={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 8 }}
              labelStyle={{ color: C.textSecondary }}
              itemStyle={{ color: C.amber }}
              formatter={(v) => formatNum(v)}
            />
            <Bar dataKey="views" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <FilterPill active={platformFilter === "all"} onClick={() => setPlatformFilter("all")} label="Toutes" />
        {Object.entries(PLATFORMS).map(([key, p]) => (
          <FilterPill
            key={key}
            active={platformFilter === key}
            onClick={() => setPlatformFilter(key)}
            label={p.label}
            color={p.color}
          />
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${C.border}` }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.surface }}>
              {DASHBOARD_COLUMNS.map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="px-3 py-2 text-left cursor-pointer select-none whitespace-nowrap"
                  style={{
                    color: C.textSecondary,
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {label}
                  {sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr
                key={v.id}
                onClick={() => onEdit(v)}
                className="cursor-pointer"
                style={{ borderTop: `1px solid ${C.border}` }}
              >
                <td className="px-3 py-2">
                  <span style={{ color: PLATFORMS[v.platform].color, fontFamily: FONT_MONO, fontSize: "0.75rem" }}>
                    {PLATFORMS[v.platform].short}
                  </span>
                </td>
                <td className="px-3 py-2 truncate" style={{ maxWidth: 200 }}>
                  <span>{v.title}</span>
                  {v.zernioPostId && (
                    <span
                      className="ml-1.5 text-xs px-1 py-0.5 rounded"
                      style={{ background: "rgba(77,217,210,0.12)", color: "#4DD9D2", fontFamily: FONT_MONO }}
                    >
                      Z
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap" style={{ fontFamily: FONT_MONO, color: C.textSecondary, fontSize: "0.8rem" }}>
                  {v.publishedDate}
                </td>
                <td className="px-3 py-2 text-right" style={{ fontFamily: FONT_MONO }}>{formatNum(v.views)}</td>
                <td className="px-3 py-2 text-right" style={{ fontFamily: FONT_MONO }}>{formatNum(v.likes)}</td>
                <td className="px-3 py-2 text-right" style={{ fontFamily: FONT_MONO }}>{formatNum(v.comments)}</td>
                <td className="px-3 py-2 text-right" style={{ fontFamily: FONT_MONO }}>{formatNum(v.shares)}</td>
                <td className="px-3 py-2 text-right" style={{ fontFamily: FONT_MONO }}>{formatNum(v.saves)}</td>
                <td className="px-3 py-2 text-right" style={{ fontFamily: FONT_MONO }}>{formatNum(v.newFollowers)}</td>
                <td className="px-3 py-2 text-right" style={{ fontFamily: FONT_MONO }}>{v.avgWatchTime}s</td>
                <td className="px-3 py-2 text-right" style={{ fontFamily: FONT_MONO }}>{v.completionRate}%</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  {v.zernioPostId && (
                    <button
                      onClick={() => onSync(v.id)}
                      disabled={syncingId === v.id}
                      title={v.zernioSyncedAt ? `Synced ${new Date(v.zernioSyncedAt).toLocaleString("fr-FR")}` : "Sync stats"}
                      className="text-xs px-2 py-1 rounded whitespace-nowrap"
                      style={{
                        color: "#4DD9D2",
                        border: "1px solid rgba(77,217,210,0.3)",
                        opacity: syncingId === v.id ? 0.5 : 1,
                      }}
                    >
                      {syncingId === v.id ? "…" : "⟳ Sync"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsightCard({ label, value, detail }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="text-xs uppercase mb-2" style={{ color: C.textSecondary }}>
        {label}
      </div>
      {value ? (
        <>
          <div className="text-lg" style={{ fontFamily: FONT_DISPLAY }}>
            {value}
          </div>
          <div className="text-xs mt-1" style={{ fontFamily: FONT_MONO, color: C.amber }}>
            {detail}
          </div>
        </>
      ) : (
        <div className="text-sm italic" style={{ color: C.textMuted }}>
          {detail}
        </div>
      )}
    </div>
  );
}

function HistoryView({ videos }) {
  const published = videos.filter((v) => v.status === "published");

  if (published.length === 0) {
    return (
      <EmptyState
        title="Pas encore d'historique"
        text="Une fois que tu auras marqué quelques vidéos comme publiées, ton classement et tes tendances apparaîtront ici."
      />
    );
  }

  const top10 = [...published].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);

  const byPlatform = {};
  published.forEach((v) => {
    byPlatform[v.platform] = byPlatform[v.platform] || { sum: 0, count: 0 };
    byPlatform[v.platform].sum += v.views || 0;
    byPlatform[v.platform].count += 1;
  });
  const platformAvgs = Object.entries(byPlatform).map(([key, d]: [string, {sum: number; count: number}]) => ({ key, avg: d.sum / d.count }));
  const bestPlatform = platformAvgs.length >= 2 ? platformAvgs.sort((a, b) => b.avg - a.avg)[0] : null;

  const byHour = {};
  published.forEach((v) => {
    const hb = hourBucket(v.publishedTime);
    if (!hb) return;
    byHour[hb] = byHour[hb] || { sum: 0, count: 0 };
    byHour[hb].sum += v.views || 0;
    byHour[hb].count += 1;
  });
  const hourAvgs = Object.entries(byHour).map(([key, d]: [string, {sum: number; count: number}]) => ({ key, avg: d.sum / d.count }));
  const bestHour = hourAvgs.length >= 2 ? hourAvgs.sort((a, b) => b.avg - a.avg)[0] : null;

  const withDuration = published.filter((v) => v.durationSeconds > 0);
  const top3 = [...withDuration].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3);
  const avgDurAll = withDuration.length
    ? withDuration.reduce((s, v) => s + v.durationSeconds, 0) / withDuration.length
    : 0;
  const avgDurTop3 = top3.length ? top3.reduce((s, v) => s + v.durationSeconds, 0) / top3.length : 0;
  const enoughDurationData = withDuration.length >= 5;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm uppercase mb-3" style={{ color: C.textSecondary, letterSpacing: "0.12em" }}>
          Top 10
        </h2>
        <div className="space-y-1">
          {top10.map((v, i) => (
            <div
              key={v.id}
              className="flex items-center gap-4 rounded-lg px-3 py-2.5"
              style={{ background: i < 3 ? C.surfaceRaised : C.surface, border: `1px solid ${C.border}` }}
            >
              <div
                className="text-xl w-8 text-right"
                style={{ fontFamily: FONT_MONO, color: i === 0 ? C.amber : C.textMuted }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ color: PLATFORMS[v.platform].color, fontFamily: FONT_MONO, fontSize: "0.7rem" }}>
                    {PLATFORMS[v.platform].short}
                  </span>
                  <div className="truncate">{v.title}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div style={{ fontFamily: FONT_MONO, color: C.amber }}>{formatNum(v.views)}</div>
                <div className="text-xs" style={{ color: C.textMuted }}>
                  +{formatNum(v.newFollowers)} abonnés
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm uppercase mb-3" style={{ color: C.textSecondary, letterSpacing: "0.12em" }}>
          Aperçus
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <InsightCard
            label="Meilleure plateforme"
            value={bestPlatform ? PLATFORMS[bestPlatform.key].label : null}
            detail={
              bestPlatform
                ? `${formatNum(Math.round(bestPlatform.avg))} vues / vidéo en moyenne`
                : "Publie sur au moins 2 plateformes pour comparer"
            }
          />
          <InsightCard
            label="Meilleur créneau"
            value={bestHour ? bestHour.key : null}
            detail={
              bestHour
                ? `${formatNum(Math.round(bestHour.avg))} vues / vidéo en moyenne`
                : "Renseigne l'heure de publication pour activer ce calcul"
            }
          />
          <InsightCard
            label="Durée du top 3"
            value={enoughDurationData ? `${Math.round(avgDurTop3)}s` : null}
            detail={
              enoughDurationData
                ? `vs ${Math.round(avgDurAll)}s en moyenne générale`
                : "Ajoute la durée de tes vidéos pour activer ce calcul"
            }
          />
        </div>
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 text-sm px-3 py-2 rounded-lg"
      style={{
        background: active ? C.amberSoft : "transparent",
        border: `1px solid ${active ? C.amber : C.border}`,
        color: active ? C.amber : C.textSecondary,
      }}
    >
      {label}
    </button>
  );
}

function StatField({ label, value, onChange, placeholder = "" }) {
  return (
    <div>
      <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "0"}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ ...inputStyle, fontFamily: FONT_MONO }}
      />
    </div>
  );
}

function VideoModal({ mode, form, setForm, onSave, onDelete, onClose, saving }) {
  const isPublish = mode === "publish";
  const isPublished = form.entryType === "published";

  function set(key, val) {
    setForm({ ...form, [key]: val });
  }

  const title = mode === "add" ? "Ajouter une vidéo" : mode === "edit" ? "Modifier la vidéo" : "Marquer comme publiée";

  let saveLabel;
  if (isPublish) saveLabel = "Marquer comme publiée";
  else if (!isPublished) saveLabel = mode === "add" ? "Ajouter au calendrier" : "Enregistrer";
  else saveLabel = "Enregistrer";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: "rgba(10,10,13,0.7)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl p-5"
        style={{ background: C.surface, border: `1px solid ${C.border}`, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg" style={{ fontFamily: FONT_DISPLAY }}>
            {title}
          </h3>
          <button onClick={onClose} style={{ color: C.textSecondary }}>
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase block mb-2" style={{ color: C.textSecondary }}>
              Plateforme
            </label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(PLATFORMS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => set("platform", key)}
                  className="text-xs px-3 py-1.5 rounded-full"
                  style={{
                    background: form.platform === key ? C.amberSoft : "transparent",
                    border: `1px solid ${form.platform === key ? C.amber : C.border}`,
                    color: form.platform === key ? C.amber : C.textSecondary,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
              Titre
            </label>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex : 3 erreurs qui ruinent ta croissance"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
              Hashtags
            </label>
            <input
              value={form.hashtags}
              onChange={(e) => set("hashtags", e.target.value)}
              placeholder="#growth #entrepreneur"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ ...inputStyle, fontFamily: FONT_MONO }}
            />
          </div>

          {!isPublish && (
            <div className="flex gap-2">
              <ToggleButton active={!isPublished} onClick={() => set("entryType", "planned")} label="Planifiée" />
              <ToggleButton active={isPublished} onClick={() => set("entryType", "published")} label="Déjà publiée" />
            </div>
          )}

          {!isPublished ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
                  Date
                </label>
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => set("scheduledDate", e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ ...inputStyle, colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
                  Heure
                </label>
                <input
                  type="time"
                  value={form.scheduledTime}
                  onChange={(e) => set("scheduledTime", e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ ...inputStyle, colorScheme: "dark", fontFamily: FONT_MONO }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
                    Date de publication
                  </label>
                  <input
                    type="date"
                    value={form.publishedDate}
                    onChange={(e) => set("publishedDate", e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ ...inputStyle, colorScheme: "dark" }}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
                    Heure (optionnel)
                  </label>
                  <input
                    type="time"
                    value={form.publishedTime}
                    onChange={(e) => set("publishedTime", e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ ...inputStyle, colorScheme: "dark", fontFamily: FONT_MONO }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatField label="Durée (s)" value={form.durationSeconds} onChange={(v) => set("durationSeconds", v)} />
                <StatField label="Vues" value={form.views} onChange={(v) => set("views", v)} />
                <StatField label="Likes" value={form.likes} onChange={(v) => set("likes", v)} />
                <StatField label="Commentaires" value={form.comments} onChange={(v) => set("comments", v)} />
                <StatField label="Partages" value={form.shares} onChange={(v) => set("shares", v)} />
                <StatField label="Favoris" value={form.saves} onChange={(v) => set("saves", v)} />
                <StatField label="Nouveaux abonnés" value={form.newFollowers} onChange={(v) => set("newFollowers", v)} />
                <StatField label="Temps moyen (s)" value={form.avgWatchTime} onChange={(v) => set("avgWatchTime", v)} />
                <StatField
                  label="Complétion (%)"
                  value={form.completionRate}
                  onChange={(v) => set("completionRate", v)}
                  placeholder="auto"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Hook utilisé, idée à retester..."
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          {mode === "edit" ? (
            <button onClick={() => onDelete(form.id)} className="text-xs" style={{ color: C.coral }}>
              Supprimer
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg"
              style={{ color: C.textSecondary, border: `1px solid ${C.border}` }}
            >
              Annuler
            </button>
            <button
              onClick={onSave}
              disabled={saving || !form.title.trim()}
              className="text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: C.amber, color: C.bg, opacity: saving || !form.title.trim() ? 0.6 : 1 }}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIListSection({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="text-xs uppercase mb-3" style={{ color: C.textSecondary, letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2.5 text-sm" style={{ color: C.textPrimary }}>
            <span style={{ color: C.amber, fontFamily: FONT_MONO, flexShrink: 0 }}>—</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIAnalysisView({ videos, analysis, meta, loading, error, onRun }) {
  const published = videos.filter((v) => v.status === "published");

  if (published.length < MIN_VIDEOS_FOR_ANALYSIS) {
    return (
      <EmptyState
        title="Pas encore assez de données"
        text={`Il faut au moins ${MIN_VIDEOS_FOR_ANALYSIS} vidéos publiées avec leurs statistiques pour qu'une analyse soit fiable. Tu en as actuellement ${published.length}.`}
      />
    );
  }

  const dataChanged = meta && meta.videoCount !== published.length;
  const formattedDate = meta
    ? new Date(meta.generatedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="space-y-6">
      <div
        className="rounded-xl p-4 flex items-center justify-between flex-wrap gap-3"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <div>
          <div className="text-sm" style={{ fontFamily: FONT_DISPLAY }}>
            Analyse basée sur tes {published.length} vidéos publiées
          </div>
          {meta ? (
            <div className="text-xs mt-1" style={{ color: C.textMuted }}>
              Dernière analyse le {formattedDate} · {meta.videoCount} vidéos à ce moment-là
              {dataChanged ? " — tes données ont changé depuis, relance pour mettre à jour." : ""}
            </div>
          ) : (
            <div className="text-xs mt-1" style={{ color: C.textMuted }}>
              Aucune analyse générée pour le moment.
            </div>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={loading}
          className="text-sm px-4 py-2 rounded-lg font-medium whitespace-nowrap"
          style={{ background: C.amber, color: C.bg, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Analyse en cours…" : analysis ? "Relancer l'analyse" : "Lancer l'analyse"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: C.surface, border: `1px solid ${C.coral}`, color: C.coral }}>
          {error}
        </div>
      )}

      {analysis && !loading && (
        <div className="grid gap-4">
          <AIListSection label="Tendances observées" items={analysis.patterns} />
          <AIListSection label="Recommandations" items={analysis.recommendations} />
          <AIListSection label="Idées à tester" items={analysis.next_ideas} />
        </div>
      )}
    </div>
  );
}
function ZernioPublishModal({
  video,
  accounts,
  onClose,
  onSuccess,
}: {
  video: Video;
  accounts: ZernioAccount[];
  onClose: () => void;
  onSuccess: (videoId: string, postId: string) => void;
}) {
  const platformAccounts = accounts.filter((a) => a.platform === video.platform);
  const [accountId, setAccountId] = React.useState(platformAccounts[0]?._id || "");
  const [caption, setCaption] = React.useState(
    [video.title, video.hashtags].filter(Boolean).join("\n\n")
  );
  const [videoUrl, setVideoUrl] = React.useState(video.videoUrl || "");
  const [scheduleMode, setScheduleMode] = React.useState(false);
  const [scheduledFor, setScheduledFor] = React.useState(
    video.scheduledDate && video.scheduledTime
      ? `${video.scheduledDate}T${video.scheduledTime}`
      : ""
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSubmit() {
    if (!accountId || !caption.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/zernio/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          caption: caption.trim(),
          accountId,
          platform: video.platform,
          videoUrl: videoUrl.trim() || undefined,
          scheduledFor: scheduleMode && scheduledFor ? scheduledFor : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSuccess(video.id, data.postId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const p = PLATFORMS[video.platform];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: "rgba(10,10,13,0.8)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl p-5"
        style={{ background: C.surface, border: `1px solid ${C.border}`, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: FONT_MONO, fontSize: "0.75rem", color: p.color }}>{p.short}</span>
              <h3 className="text-base font-medium" style={{ fontFamily: FONT_DISPLAY }}>
                Publier via Zernio
              </h3>
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: C.textMuted, maxWidth: 300 }}>
              {video.title}
            </div>
          </div>
          <button onClick={onClose} style={{ color: C.textSecondary }}>✕</button>
        </div>

        <div className="space-y-4">
          {platformAccounts.length === 0 ? (
            <div className="rounded-lg p-4 text-sm" style={{ background: C.surfaceRaised, color: C.textSecondary }}>
              Aucun compte {p.label} connecté à Zernio. Connecte ton compte sur{" "}
              <a href="https://zernio.com" target="_blank" rel="noreferrer" style={{ color: C.amber }}>
                zernio.com
              </a>{" "}
              puis rafraîchis la page.
            </div>
          ) : (
            <>
              {platformAccounts.length > 1 && (
                <div>
                  <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
                    Compte
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.textPrimary }}
                  >
                    {platformAccounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        @{a.username} · {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
                  Légende
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.textPrimary, outline: "none", resize: "vertical" }}
                />
              </div>

              <div>
                <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
                  URL de la vidéo <span style={{ color: C.textMuted }}>(optionnel si déjà dans Zernio)</span>
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://drive.google.com/... ou lien direct .mp4"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.textPrimary, outline: "none" }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="schedule-toggle"
                  checked={scheduleMode}
                  onChange={(e) => setScheduleMode(e.target.checked)}
                  style={{ accentColor: C.amber }}
                />
                <label htmlFor="schedule-toggle" className="text-sm" style={{ color: C.textSecondary }}>
                  Programmer plutôt que publier maintenant
                </label>
              </div>

              {scheduleMode && (
                <div>
                  <label className="text-xs uppercase block mb-1" style={{ color: C.textSecondary }}>
                    Date et heure (heure locale)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.textPrimary, colorScheme: "dark", outline: "none", fontFamily: FONT_MONO }}
                  />
                </div>
              )}

              {error && (
                <div className="text-sm rounded-lg p-3" style={{ background: C.surfaceRaised, color: C.coral }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ color: C.textSecondary, border: `1px solid ${C.border}` }}
          >
            Annuler
          </button>
          {platformAccounts.length > 0 && (
            <button
              onClick={handleSubmit}
              disabled={loading || !caption.trim() || !accountId}
              className="text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: "#4DD9D2", color: C.bg, opacity: loading || !caption.trim() ? 0.6 : 1 }}
            >
              {loading ? "Envoi…" : scheduleMode ? "Programmer" : "Publier maintenant"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ClipsView — Phase 4 ───────────────────────────────────────────────────────
function ClipsView({ zernioAccounts, onVideoPublished }) {
  const [jobs, setJobs] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [activeJob, setActiveJob] = React.useState(null);
  const [pollingId, setPollingId] = React.useState(null);
  const fileInputRef = React.useRef(null);

  // Load jobs on mount
  React.useEffect(() => {
    fetch("/api/clips/jobs").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setJobs(data);
    }).catch(() => {});
  }, []);

  // Poll active job
  React.useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/clips/jobs/${pollingId}`);
        const data = await res.json();
        if (data.status === "done" || data.status === "error") {
          setJobs(prev => prev.map(j => j.id === pollingId ? { ...j, ...data } : j));
          setActiveJob(data);
          setPollingId(null);
        } else {
          setJobs(prev => prev.map(j => j.id === pollingId ? { ...j, status: data.status } : j));
        }
      } catch (_) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [pollingId]);

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      alert("Fichier trop lourd (max 500 MB). Compresse la vidéo d'abord.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Get Supabase session for direct upload
      const sessionRes = await fetch("/api/storage/token");
      const { url, key, userId } = await sessionRes.json();
      const { createClient: create } = await import("@supabase/supabase-js");
      const sb = create(url, key);

      const ext = file.name.split(".").pop();
      const storagePath = `${userId}/${Date.now()}.${ext}`;

      // Upload with progress tracking via XMLHttpRequest
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const buf = ev.target.result;
         const { error } = await sb.storage.from("videos").upload(storagePath, buf, {
  contentType: file.type || "video/mp4",
});
setUploadProgress(100);
         if (error) reject(error); else resolve(undefined);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      // Create job and trigger worker
      const jobRes = await fetch("/api/clips/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath: storagePath, videoName: file.name, maxClips: 5 }),
      });
      const { jobId } = await jobRes.json();

      const newJob = { id: jobId, status: "processing", video_name: file.name, clips: null, created_at: new Date().toISOString() };
      setJobs(prev => [newJob, ...prev]);
      setActiveJob(newJob);
      setPollingId(jobId);
    } catch (err) {
      alert("Erreur lors de l'upload : " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div
        className="rounded-xl p-8 text-center cursor-pointer"
        style={{ border: `2px dashed ${C.border}`, background: C.surface }}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
        {uploading ? (
          <div>
            <div className="text-sm mb-3" style={{ color: C.textSecondary }}>
              Upload en cours… {uploadProgress}%
            </div>
            <div className="rounded-full h-2 mx-auto" style={{ background: C.surfaceRaised, maxWidth: 300 }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%`, background: C.amber }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-3">✂</div>
            <div className="font-medium mb-1" style={{ fontFamily: FONT_DISPLAY }}>
              Dépose ta vidéo longue ici
            </div>
            <div className="text-sm" style={{ color: C.textSecondary }}>
              MP4, MOV, AVI — max 500 MB · L'IA sélectionne les meilleurs moments et génère les clips 9:16 avec sous-titres
            </div>
          </>
        )}
      </div>

      {/* Active job status */}
      {activeJob && activeJob.status !== "done" && (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: activeJob.status === "error" ? C.coral : C.amber,
              animation: activeJob.status === "processing" ? "pulse 2s infinite" : "none",
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{activeJob.video_name}</div>
            <div className="text-xs mt-0.5" style={{ color: C.textSecondary }}>
              {activeJob.status === "pending" && "En attente — démarrage du worker (peut prendre 30s)…"}
              {activeJob.status === "processing" && "Transcription + découpage en cours… (2-10 min selon la durée)"}
              {activeJob.status === "error" && `Erreur : ${activeJob.error}`}
            </div>
          </div>
          {activeJob.status === "processing" && (
            <div style={{ fontFamily: FONT_MONO, color: C.textMuted, fontSize: "0.75rem" }}>
              polling…
            </div>
          )}
        </div>
      )}

      {/* Clips preview */}
      {activeJob?.status === "done" && Array.isArray(activeJob.clips) && (
        <ClipsPreview
          clips={activeJob.clips}
          zernioAccounts={zernioAccounts}
          onPublished={onVideoPublished}
        />
      )}

      {/* Jobs history */}
      {jobs.filter(j => j.id !== activeJob?.id && j.status === "done").length > 0 && (
        <div>
          <h2 className="text-xs uppercase mb-3" style={{ color: C.textSecondary, letterSpacing: "0.12em" }}>
            Traitements précédents
          </h2>
          <div className="space-y-1">
            {jobs.filter(j => j.id !== activeJob?.id).map(job => (
              <button
                key={job.id}
                onClick={() => setActiveJob(job)}
                className="w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-3"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <span style={{ color: job.status === "error" ? C.coral : C.textMuted, fontFamily: FONT_MONO, fontSize: "0.7rem" }}>
                  {job.status === "done" ? `${Array.isArray(job.clips) ? job.clips.length : 0} clips` : job.status}
                </span>
                <span className="flex-1 text-sm truncate">{job.video_name}</span>
                <span className="text-xs" style={{ color: C.textMuted }}>
                  {new Date(job.created_at).toLocaleDateString("fr-FR")}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClipsPreview({ clips, zernioAccounts, onPublished }) {
  const [selectedPlatform, setSelectedPlatform] = React.useState("tiktok");
  const [publishingClip, setPublishingClip] = React.useState(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm uppercase" style={{ color: C.textSecondary, letterSpacing: "0.12em" }}>
          {clips.length} clips générés
        </h2>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          {Object.entries(PLATFORMS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => setSelectedPlatform(key)}
              className="text-xs px-2.5 py-1 rounded-md"
              style={{
                background: selectedPlatform === key ? C.surfaceRaised : "transparent",
                color: selectedPlatform === key ? p.color : C.textSecondary,
              }}
            >
              {p.short}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {clips.map((clip, i) => (
          <div key={i} className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex gap-4 p-4">
              {/* Video preview */}
              <div className="shrink-0" style={{ width: 90 }}>
                <video
                  src={clip.url}
                  controls
                  style={{ width: 90, borderRadius: 8, background: C.bg, aspectRatio: "9/16" }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: C.surfaceRaised, color: C.amber, fontFamily: FONT_MONO }}>
                    {Math.round(clip.duration)}s
                  </span>
                  <span className="text-xs" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
                    {Math.round(clip.startTime)}s → {Math.round(clip.endTime)}s
                  </span>
                </div>

                <div className="text-sm font-medium mb-1" style={{ fontFamily: FONT_DISPLAY }}>
                  {clip.hook}
                </div>
                <div className="text-xs mb-3" style={{ color: C.textSecondary }}>
                  {clip.reason}
                </div>

                {clip.captions?.[selectedPlatform] && (
                  <div className="rounded-lg p-3" style={{ background: C.surfaceRaised }}>
                    <div className="text-xs mb-1" style={{ color: C.textSecondary }}>
                      Légende {PLATFORMS[selectedPlatform]?.label}
                    </div>
                    <div className="text-sm mb-1">{clip.captions[selectedPlatform].caption}</div>
                    <div className="text-xs" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
                      {clip.captions[selectedPlatform].hashtags}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className="flex items-center justify-end gap-2 px-4 py-3"
              style={{ borderTop: `1px solid ${C.border}` }}
            >
              <span className="text-xs" style={{ color: C.textMuted }}>
                Publier sur {PLATFORMS[selectedPlatform]?.label}
              </span>
              {zernioAccounts.some(a => a.platform === selectedPlatform) ? (
                <button
                  onClick={() => setPublishingClip({ clip, platform: selectedPlatform })}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: "#4DD9D2", color: C.bg }}
                >
                  ↑ Publier via Zernio
                </button>
              ) : (
                <span className="text-xs" style={{ color: C.textMuted }}>
                  (Connecte un compte {PLATFORMS[selectedPlatform]?.label} dans Zernio)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {publishingClip && (
        <ClipPublishModal
          clip={publishingClip.clip}
          platform={publishingClip.platform}
          accounts={zernioAccounts.filter(a => a.platform === publishingClip.platform)}
          onClose={() => setPublishingClip(null)}
          onSuccess={(video) => { onPublished(video); setPublishingClip(null); }}
        />
      )}
    </div>
  );
}

function ClipPublishModal({ clip, platform, accounts, onClose, onSuccess }) {
  const p = PLATFORMS[platform];
  const [accountId, setAccountId] = React.useState(accounts[0]?._id || "");
  const [caption, setCaption] = React.useState(
    [clip.captions?.[platform]?.caption, clip.captions?.[platform]?.hashtags].filter(Boolean).join("\n\n")
  );
  const [scheduleMode, setScheduleMode] = React.useState(false);
  const [scheduledFor, setScheduledFor] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handlePublish() {
    setLoading(true); setError("");
    try {
      // Create video record first, then publish
      const uid = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const videoRecord = {
        id: uid,
        platform,
        title: clip.hook || caption.split("\n")[0].slice(0, 80),
        hashtags: clip.captions?.[platform]?.hashtags || "",
        notes: `Clip généré automatiquement · ${Math.round(clip.duration)}s`,
        status: scheduleMode ? "planned" : "published",
        publishedDate: scheduleMode ? undefined : new Date().toISOString().slice(0, 10),
        publishedTime: scheduleMode ? undefined : new Date().toTimeString().slice(0, 5),
        scheduledDate: scheduleMode ? scheduledFor?.slice(0, 10) : undefined,
        scheduledTime: scheduleMode ? scheduledFor?.slice(11, 16) : undefined,
        durationSeconds: clip.duration || 0,
        views: 0, likes: 0, comments: 0, shares: 0, saves: 0, newFollowers: 0, avgWatchTime: 0, completionRate: 0,
        videoUrl: clip.url,
      };

      // Save to RUSHES
      await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(videoRecord) });

      // Publish via Zernio
      const res = await fetch("/api/zernio/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: uid, caption: caption.trim(), accountId, platform, videoUrl: clip.url, scheduledFor: scheduleMode && scheduledFor ? scheduledFor : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSuccess({ ...videoRecord, zernioPostId: data.postId });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "rgba(10,10,13,0.85)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium" style={{ fontFamily: FONT_DISPLAY }}>
            Publier sur <span style={{ color: p?.color }}>{p?.label}</span>
          </h3>
          <button onClick={onClose} style={{ color: C.textSecondary }}>✕</button>
        </div>
        <div className="space-y-3">
          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={4} className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.textPrimary, outline: "none", resize: "vertical" }} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="sched2" checked={scheduleMode} onChange={e => setScheduleMode(e.target.checked)} style={{ accentColor: C.amber }} />
            <label htmlFor="sched2" className="text-sm" style={{ color: C.textSecondary }}>Programmer</label>
          </div>
          {scheduleMode && (
            <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.textPrimary, colorScheme: "dark", outline: "none", fontFamily: FONT_MONO }} />
          )}
          {error && <div className="text-xs rounded-lg p-2" style={{ color: C.coral, background: C.surfaceRaised }}>{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-sm px-3 py-2 rounded-lg" style={{ color: C.textSecondary, border: `1px solid ${C.border}` }}>Annuler</button>
          <button onClick={handlePublish} disabled={loading || !caption.trim()} className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: "#4DD9D2", color: C.bg, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Envoi…" : scheduleMode ? "Programmer" : "Publier"}
          </button>
        </div>
      </div>
    </div>
  );
}
