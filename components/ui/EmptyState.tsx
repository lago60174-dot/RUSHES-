"use client";
import { C, FONT_DISPLAY } from "./constants";

export function EmptyState({ icon = "○", title, text }: { icon?: string; title: string; text: string }) {
  return (
    <div
      className="rounded-2xl py-20 text-center"
      style={{ border: `1px dashed ${C.border}`, background: C.surface }}
    >
      <div className="text-4xl mb-4 opacity-30">{icon}</div>
      <div className="text-base font-semibold mb-2" style={{ fontFamily: FONT_DISPLAY, color: C.textPrimary }}>
        {title}
      </div>
      <div className="text-sm max-w-xs mx-auto" style={{ color: C.textSecondary }}>
        {text}
      </div>
    </div>
  );
}
