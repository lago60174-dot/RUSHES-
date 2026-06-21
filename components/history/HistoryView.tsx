"use client";
import { C, FONT_DISPLAY, FONT_MONO, PLATFORMS } from "../ui/constants";
import { Video } from "../ui/types";
import { EmptyState } from "../ui/EmptyState";

function formatNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("fr-FR");
}

function hourBucket(timeStr?: string) {
  if (!timeStr) return null;
  const h = parseInt(timeStr.split(":")[0], 10);
  if (isNaN(h)) return null;
  if (h >= 6 && h < 12)  return "Matin (6h–12h)";
  if (h >= 12 && h < 18) return "Après-midi (12h–18h)";
  if (h >= 18 && h < 22) return "Soir (18h–22h)";
  return "Nuit";
}

const MEDALS = ["🥇", "🥈", "🥉"];

function InsightCard({ icon, label, value, detail, accent = C.violetLight }: {
  icon: string; label: string; value: string | null; detail: string; accent?: string;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <div className="text-xs uppercase tracking-widest" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>{label}</div>
      </div>
      {value ? (
        <>
          <div className="text-xl font-bold mb-1" style={{ color: accent, fontFamily: FONT_DISPLAY }}>{value}</div>
          <div className="text-xs" style={{ color: C.textSecondary }}>{detail}</div>
        </>
      ) : (
        <div className="text-sm italic" style={{ color: C.textMuted }}>{detail}</div>
      )}
    </div>
  );
}

export function HistoryView({ videos }: { videos: Video[] }) {
  const published = videos.filter((v) => v.status === "published");
  if (published.length === 0) {
    return <EmptyState icon="🏆" title="Pas encore d'historique" text="Marque des vidéos comme publiées pour voir ton classement ici." />;
  }

  const top10 = [...published].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);

  const byPlatform: Record<string, { sum: number; count: number }> = {};
  published.forEach((v) => {
    byPlatform[v.platform] = byPlatform[v.platform] || { sum: 0, count: 0 };
    byPlatform[v.platform].sum += v.views || 0;
    byPlatform[v.platform].count += 1;
  });
  const platformAvgs = Object.entries(byPlatform).map(([key, d]: [string, { sum: number; count: number }]) => ({ key, avg: d.sum / d.count }));
  const bestPlatform = platformAvgs.length >= 2 ? [...platformAvgs].sort((a, b) => b.avg - a.avg)[0] : null;

  const byHour: Record<string, { sum: number; count: number }> = {};
  published.forEach((v) => {
    const hb = hourBucket(v.publishedTime);
    if (!hb) return;
    byHour[hb] = byHour[hb] || { sum: 0, count: 0 };
    byHour[hb].sum += v.views || 0;
    byHour[hb].count += 1;
  });
  const hourAvgs = Object.entries(byHour).map(([key, d]: [string, { sum: number; count: number }]) => ({ key, avg: d.sum / d.count }));
  const bestHour = hourAvgs.length >= 2 ? [...hourAvgs].sort((a, b) => b.avg - a.avg)[0] : null;

  const withDuration = published.filter((v) => v.durationSeconds > 0);
  const top3dur = [...withDuration].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3);
  const avgDurAll = withDuration.length ? withDuration.reduce((s, v) => s + v.durationSeconds, 0) / withDuration.length : 0;
  const avgDurTop3 = top3dur.length ? top3dur.reduce((s, v) => s + v.durationSeconds, 0) / top3dur.length : 0;

  // Engagement rate per platform
  const platformEngagement = Object.entries(byPlatform).map(([key, _]) => {
    const pvids = published.filter((v) => v.platform === key);
    const totalViews = pvids.reduce((s, v) => s + (v.views || 0), 0);
    const totalEng = pvids.reduce((s, v) => s + (v.likes || 0) + (v.comments || 0) + (v.shares || 0), 0);
    return { key, rate: totalViews > 0 ? ((totalEng / totalViews) * 100).toFixed(2) : "0" };
  });

  return (
    <div className="space-y-8">
      {/* Top 10 */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
            Classement
          </span>
          <div className="flex-1 h-px" style={{ background: C.border }} />
        </div>
        <div className="space-y-2">
          {top10.map((v, i) => {
            const p = PLATFORMS[v.platform];
            const isTop3 = i < 3;
            return (
              <div
                key={v.id}
                className="flex items-center gap-4 rounded-xl px-4 py-3"
                style={{
                  background: isTop3 ? C.card : C.surface,
                  border: `1px solid ${isTop3 ? C.border : C.border + "80"}`,
                  borderLeft: isTop3 ? `3px solid ${p.color}` : `3px solid transparent`,
                }}
              >
                <div className="w-8 text-center text-xl shrink-0">
                  {i < 3 ? MEDALS[i] : (
                    <span style={{ fontFamily: FONT_MONO, color: C.textMuted, fontSize: "0.8rem" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-xs px-1.5 py-0.5 rounded font-bold" style={{ color: p.color, background: `${p.color}15`, fontFamily: FONT_MONO }}>
                  {p.short}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium" style={{ color: C.textPrimary }}>{v.title}</div>
                  <div className="text-xs" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>{v.publishedDate}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold" style={{ fontFamily: FONT_MONO, color: i === 0 ? C.violetLight : C.textPrimary }}>
                    {formatNum(v.views || 0)}
                  </div>
                  <div className="text-xs" style={{ color: C.emerald, fontFamily: FONT_MONO }}>
                    +{formatNum(v.newFollowers || 0)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Engagement par plateforme */}
      {platformEngagement.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-bold uppercase tracking-widest" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
              Engagement par plateforme
            </span>
            <div className="flex-1 h-px" style={{ background: C.border }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {platformEngagement.map(({ key, rate }) => {
              const p = PLATFORMS[key];
              return (
                <div key={key} className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <div className="text-xs mb-2 font-bold" style={{ color: p.color, fontFamily: FONT_MONO }}>{p.label}</div>
                  <div className="text-2xl font-bold" style={{ fontFamily: FONT_MONO, color: C.textPrimary }}>{rate}%</div>
                  <div className="text-xs" style={{ color: C.textMuted }}>taux d'engagement</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insights */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
            Aperçus
          </span>
          <div className="flex-1 h-px" style={{ background: C.border }} />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <InsightCard
            icon="🏆"
            label="Meilleure plateforme"
            value={bestPlatform ? PLATFORMS[bestPlatform.key]?.label : null}
            detail={bestPlatform ? `${formatNum(Math.round(bestPlatform.avg))} vues / vidéo` : "Publie sur 2+ plateformes pour comparer"}
            accent={C.violetLight}
          />
          <InsightCard
            icon="⏰"
            label="Meilleur créneau"
            value={bestHour ? bestHour.key : null}
            detail={bestHour ? `${formatNum(Math.round(bestHour.avg))} vues / vidéo` : "Renseigne l'heure de publication"}
            accent={C.cyan}
          />
          <InsightCard
            icon="⏱"
            label="Durée optimale"
            value={withDuration.length >= 5 ? `${Math.round(avgDurTop3)}s` : null}
            detail={withDuration.length >= 5 ? `vs ${Math.round(avgDurAll)}s en moyenne générale` : "Ajoute 5+ vidéos avec durée"}
            accent={C.emerald}
          />
        </div>
      </div>
    </div>
  );
}
