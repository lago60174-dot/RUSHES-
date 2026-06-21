"use client";
import { C, FONT_DISPLAY, FONT_MONO, PLATFORMS } from "../ui/constants";
import { Video, ZernioAccount } from "../ui/types";

export function VideoCard({
  video, onPublish, onEdit, hasZernio, onZernioPublish,
}: {
  video: Video;
  onPublish: (v: Video) => void;
  onEdit: (v: Video) => void;
  hasZernio: boolean;
  onZernioPublish: (v: Video) => void;
}) {
  const p = PLATFORMS[video.platform];
  return (
    <div
      className="flex items-center gap-4 rounded-xl p-4 group transition-all"
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${p.color}`,
      }}
    >
      {/* Time */}
      <div className="shrink-0 text-center" style={{ minWidth: 48 }}>
        <div style={{ fontFamily: FONT_MONO, color: p.color, fontSize: "0.8rem", fontWeight: 600 }}>
          {video.scheduledTime?.slice(0, 5) || "--:--"}
        </div>
      </div>

      {/* Platform badge */}
      <div
        className="shrink-0 px-2 py-1 rounded-lg text-xs font-semibold"
        style={{ background: `${p.color}18`, color: p.color, fontFamily: FONT_MONO }}
      >
        {p.short}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate" style={{ fontFamily: FONT_DISPLAY, color: C.textPrimary }}>
          {video.title}
        </div>
        {video.hashtags && (
          <div className="text-xs mt-0.5 truncate" style={{ color: C.textMuted, fontFamily: FONT_MONO }}>
            {video.hashtags}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onEdit(video)}
          className="text-xs px-3 py-1.5 rounded-lg transition-all"
          style={{ color: C.textSecondary, border: `1px solid ${C.border}`, background: "transparent" }}
        >
          Modifier
        </button>
        {hasZernio && (
          <button
            onClick={() => onZernioPublish(video)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
            style={{ background: C.cyanBg, color: C.cyan, border: `1px solid ${C.cyan}40` }}
          >
            ↑ Zernio
          </button>
        )}
        <button
          onClick={() => onPublish(video)}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
          style={{ background: C.violetBg, color: C.violetLight, border: `1px solid ${C.violet}40` }}
        >
          ✓ Publier
        </button>
      </div>
    </div>
  );
}
