"use client";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { C, FONT_DISPLAY, FONT_MONO, PLATFORMS } from "../ui/constants";
import { Video } from "../ui/types";
import { EmptyState } from "../ui/EmptyState";

function formatNum(n: number | string) {
  const num = Number(n);
  if (!num || isNaN(num)) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "k";
  return num.toLocaleString("fr-FR");
}

function StatCard({ label, value, sub, accent = C.violetLight }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: C.card, border: `1px solid ${C.border}` }}
    >
      <div className="text-xs uppercase tracking-widest mb-3" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
        {label}
      </div>
      <div className="text-3xl font-bold" style={{ fontFamily: FONT_MONO, color: accent }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: C.textSecondary }}>{sub}</div>}
    </div>
  );
}

const COLS = ["platform","title","publishedDate","views","likes","comments","shares","saves","newFollowers","completionRate","sync"];
const COL_LABELS: Record<string, string> = {
  platform: "Plat.", title: "Titre", publishedDate: "Date",
  views: "Vues", likes: "Likes", comments: "Comm.", shares: "Partages",
  saves: "Favoris", newFollowers: "Abonnés", completionRate: "Complét.", sync: "",
};

export function DashboardView({
  videos, platformFilter, setPlatformFilter, sortKey, setSortKey, sortDir, setSortDir, onEdit, syncingId, onSync,
}: {
  videos: Video[];
  platformFilter: string;
  setPlatformFilter: (v: string) => void;
  sortKey: string;
  setSortKey: (v: string) => void;
  sortDir: "asc" | "desc";
  setSortDir: (v: "asc" | "desc") => void;
  onEdit: (v: Video) => void;
  syncingId: string | null;
  onSync: (id: string) => void;
}) {
  const published = videos.filter((v) => v.status === "published");
  if (published.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="Pas encore de vidéo publiée"
        text="Marque une vidéo comme publiée pour commencer à suivre tes performances."
      />
    );
  }

  const filtered = platformFilter === "all" ? published : published.filter((v) => v.platform === platformFilter);
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey as keyof Video] ?? "";
    const bv = b[sortKey as keyof Video] ?? "";
    if (typeof av === "string") return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const totals = published.reduce((acc, v) => ({
    views: acc.views + (v.views || 0),
    followers: acc.followers + (v.newFollowers || 0),
    count: acc.count + 1,
    completionSum: acc.completionSum + (v.completionRate || 0),
    likesSum: acc.likesSum + (v.likes || 0),
    commentsSum: acc.commentsSum + (v.comments || 0),
    sharesSum: acc.sharesSum + (v.shares || 0),
  }), { views: 0, followers: 0, count: 0, completionSum: 0, likesSum: 0, commentsSum: 0, sharesSum: 0 });

  const avgCompletion = totals.count ? (totals.completionSum / totals.count).toFixed(1) : "0";
  const engagementRate = totals.views > 0
    ? (((totals.likesSum + totals.commentsSum + totals.sharesSum) / totals.views) * 100).toFixed(2)
    : "0";

  const chartData = Object.entries(PLATFORMS).map(([key, p]) => ({
    name: p.short,
    vues: published.filter((v) => v.platform === key).reduce((s, v) => s + (v.views || 0), 0),
    color: p.color,
  }));

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Vidéos publiées" value={String(totals.count)} accent={C.violetLight} />
        <StatCard label="Vues totales" value={formatNum(totals.views)} accent={C.cyanLight} />
        <StatCard label="Nouveaux abonnés" value={formatNum(totals.followers)} accent={C.emerald} />
        <StatCard label="Complétion moy." value={`${avgCompletion}%`} sub={`Engagement ${engagementRate}%`} accent={C.amber} />
      </div>

      {/* Chart */}
      <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm font-semibold" style={{ color: C.textPrimary }}>Vues par plateforme</div>
          <div className="text-xs" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
            {published.length} vidéos
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={40}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: C.textSecondary, fontSize: 12, fontFamily: FONT_MONO }} stroke="transparent" />
            <YAxis tick={{ fill: C.textSecondary, fontSize: 11 }} stroke="transparent" tickFormatter={formatNum} />
            <Tooltip
              contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12 }}
              labelStyle={{ color: C.textSecondary, fontFamily: FONT_MONO }}
              itemStyle={{ color: C.violetLight }}
              formatter={(v: number) => [formatNum(v), "vues"]}
            />
            <Bar dataKey="vues" radius={[8, 8, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color} opacity={0.9} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Platform filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[["all", "Toutes", C.violetLight], ...Object.entries(PLATFORMS).map(([k, p]) => [k, p.label, p.color])].map(([key, label, color]) => (
          <button
            key={key}
            onClick={() => setPlatformFilter(key)}
            className="text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5"
            style={{
              background: platformFilter === key ? `${color}20` : "transparent",
              color: platformFilter === key ? color : C.textSecondary,
              border: `1px solid ${platformFilter === key ? color + "60" : C.border}`,
            }}
          >
            {key !== "all" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />}
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.surfaceAlt }}>
                {COLS.map((key) => (
                  <th
                    key={key}
                    onClick={() => key !== "sync" && toggleSort(key)}
                    className="px-4 py-3 text-left select-none whitespace-nowrap"
                    style={{
                      color: sortKey === key ? C.violetLight : C.textMuted,
                      fontSize: "0.7rem", fontFamily: FONT_MONO, textTransform: "uppercase", letterSpacing: "0.1em",
                      cursor: key !== "sync" ? "pointer" : "default",
                    }}
                  >
                    {COL_LABELS[key]}{sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((v, idx) => (
                <tr
                  key={v.id}
                  onClick={() => onEdit(v)}
                  className="cursor-pointer transition-all"
                  style={{ borderTop: `1px solid ${C.border}`, background: idx % 2 === 0 ? "transparent" : C.surface + "80" }}
                >
                  <td className="px-4 py-3">
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ color: PLATFORMS[v.platform]?.color, background: `${PLATFORMS[v.platform]?.color}15`, fontFamily: FONT_MONO }}>
                      {PLATFORMS[v.platform]?.short}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ maxWidth: 200 }}>
                    <div className="truncate" style={{ color: C.textPrimary }}>{v.title}</div>
                    {v.zernioPostId && <span className="text-xs ml-1" style={{ color: C.cyan, fontFamily: FONT_MONO }}>Z</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ fontFamily: FONT_MONO, color: C.textSecondary, fontSize: "0.8rem" }}>{v.publishedDate}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ fontFamily: FONT_MONO, color: C.textPrimary }}>{formatNum(v.views)}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: FONT_MONO, color: C.textSecondary }}>{formatNum(v.likes)}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: FONT_MONO, color: C.textSecondary }}>{formatNum(v.comments)}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: FONT_MONO, color: C.textSecondary }}>{formatNum(v.shares)}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: FONT_MONO, color: C.textSecondary }}>{formatNum(v.saves)}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: FONT_MONO, color: C.emerald }}>{formatNum(v.newFollowers)}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: FONT_MONO, color: v.completionRate >= 50 ? C.emerald : C.textSecondary }}>{v.completionRate}%</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {v.zernioPostId && (
                      <button
                        onClick={() => onSync(v.id)}
                        disabled={syncingId === v.id}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ color: C.cyan, border: `1px solid ${C.cyan}30`, opacity: syncingId === v.id ? 0.5 : 1 }}
                      >
                        {syncingId === v.id ? "…" : "⟳"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
