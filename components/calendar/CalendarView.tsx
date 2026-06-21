"use client";
import { C, FONT_DISPLAY, FONT_MONO, PLATFORMS } from "../ui/constants";
import { Video, ZernioAccount } from "../ui/types";
import { VideoCard } from "./VideoCard";
import { EmptyState } from "../ui/EmptyState";

function dayDiff(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function getBucket(video: Video) {
  const diff = dayDiff(video.scheduledDate || "");
  if (diff < 0)  return "retard";
  if (diff === 0) return "aujourdhui";
  if (diff === 1) return "demain";
  if (diff <= 7)  return "semaine";
  return "plus_tard";
}

const BUCKET_CONFIG = {
  retard:     { label: "En retard",    color: "#F43F5E" },
  aujourdhui: { label: "Aujourd'hui",  color: "#7C3AED" },
  demain:     { label: "Demain",       color: "#06B6D4" },
  semaine:    { label: "Cette semaine", color: "#10B981" },
  plus_tard:  { label: "Plus tard",    color: "#475569" },
};

export function CalendarView({
  videos, onPublish, onEdit, zernioAccounts, onZernioPublish,
}: {
  videos: Video[];
  onPublish: (v: Video) => void;
  onEdit: (v: Video) => void;
  zernioAccounts: ZernioAccount[];
  onZernioPublish: (v: Video) => void;
}) {
  const planned = videos.filter((v) => v.status === "planned");
  if (planned.length === 0) {
    return (
      <EmptyState
        icon="📅"
        title="Rien de planifié"
        text="Ajoute ta prochaine vidéo pour commencer à organiser ton calendrier de publication."
      />
    );
  }

  const buckets: Record<string, Video[]> = { retard: [], aujourdhui: [], demain: [], semaine: [], plus_tard: [] };
  planned.forEach((v) => buckets[getBucket(v)].push(v));
  Object.values(buckets).forEach((arr) =>
    arr.sort((a, b) => ((a.scheduledDate || "") + (a.scheduledTime || "")).localeCompare((b.scheduledDate || "") + (b.scheduledTime || "")))
  );

  return (
    <div className="space-y-8">
      {Object.entries(BUCKET_CONFIG).map(([key, cfg]) =>
        buckets[key].length > 0 ? (
          <div key={key}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: cfg.color, fontFamily: FONT_MONO }}
              >
                {cfg.label}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: `${cfg.color}15`, color: cfg.color, fontFamily: FONT_MONO }}
              >
                {buckets[key].length}
              </span>
              <div className="flex-1 h-px" style={{ background: `${cfg.color}20` }} />
            </div>
            <div className="space-y-2">
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
