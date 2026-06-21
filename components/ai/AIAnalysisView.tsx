"use client";
import { C, FONT_DISPLAY, FONT_MONO, MIN_VIDEOS_FOR_ANALYSIS } from "../ui/constants";
import { Video, AIAnalysis, AIMeta } from "../ui/types";
import { EmptyState } from "../ui/EmptyState";

const SECTION_CONFIG = [
  { key: "patterns",        label: "Tendances observées", icon: "📈", accent: C.cyan },
  { key: "recommendations", label: "Recommandations",     icon: "🎯", accent: C.violetLight },
  { key: "next_ideas",      label: "Idées à tester",      icon: "💡", accent: C.emerald },
];

function AnalysisSection({ icon, label, items, accent }: { icon: string; label: string; items: string[]; accent: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-4">
        <span>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent, fontFamily: FONT_MONO }}>
          {label}
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex gap-3 text-sm">
            <div
              className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ background: `${accent}20`, color: accent, fontFamily: FONT_MONO }}
            >
              {i + 1}
            </div>
            <span style={{ color: C.textPrimary, lineHeight: 1.6 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AIAnalysisView({
  videos, analysis, meta, loading, error, onRun,
}: {
  videos: Video[];
  analysis: AIAnalysis | null;
  meta: AIMeta | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
}) {
  const published = videos.filter((v) => v.status === "published");

  if (published.length < MIN_VIDEOS_FOR_ANALYSIS) {
    return (
      <EmptyState
        icon="✦"
        title="Pas encore assez de données"
        text={`Il faut au moins ${MIN_VIDEOS_FOR_ANALYSIS} vidéos publiées. Tu en as ${published.length} pour l'instant.`}
      />
    );
  }

  const dataChanged = meta && meta.videoCount !== published.length;
  const formattedDate = meta ? new Date(meta.generatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : null;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.violetLight, fontFamily: FONT_MONO }}>
                ✦ Powered by Mistral AI
              </span>
            </div>
            <div className="text-sm" style={{ color: C.textSecondary }}>
              {published.length} vidéos analysées
              {formattedDate && (
                <span style={{ color: C.textMuted }}> · Dernière analyse le {formattedDate}</span>
              )}
            </div>
            {dataChanged && (
              <div className="text-xs mt-1" style={{ color: C.amber }}>
                ⚠ Nouvelles vidéos depuis la dernière analyse — relance pour mettre à jour
              </div>
            )}
          </div>
          <button
            onClick={onRun}
            disabled={loading}
            className="text-sm px-5 py-2.5 rounded-xl font-semibold transition-all"
            style={{
              background: loading ? C.violetBg : `linear-gradient(135deg, ${C.violet}, #5B21B6)`,
              color: C.textPrimary,
              opacity: loading ? 0.7 : 1,
              border: `1px solid ${C.violet}60`,
            }}
          >
            {loading ? "Analyse en cours…" : analysis ? "✦ Relancer" : "✦ Lancer l'analyse"}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: C.violetLight,
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
              <span className="text-sm" style={{ color: C.textSecondary }}>
                Mistral analyse tes données…
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl p-4 text-sm" style={{ background: C.coralBg, border: `1px solid ${C.coral}40`, color: C.coral }}>
          ⚠ {error}
        </div>
      )}

      {analysis && !loading && (
        <div className="grid gap-4">
          {SECTION_CONFIG.map(({ key, label, icon, accent }) => (
            <AnalysisSection
              key={key}
              icon={icon}
              label={label}
              items={analysis[key as keyof AIAnalysis] as string[]}
              accent={accent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
