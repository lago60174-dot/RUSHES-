"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const C = {
  bg: "#07090F", surface: "#0F1623", card: "#192338",
  border: "#1E2D45", textPrimary: "#EEF2FF", textSecondary: "#7B8DB0",
  textMuted: "#3D4F6E", violet: "#7C3AED", violetLight: "#A78BFA",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function handleLogin() {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
    setLoading(false);
    if (!error) setSent(true);
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, padding: 40, width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${C.violet}, #4F1D96)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 900 }}>R</span>
          </div>
          <div>
            <div style={{ color: C.textPrimary, fontWeight: 700, fontSize: "1rem", letterSpacing: "0.1em" }}>RUSHES</div>
            <div style={{ color: C.textMuted, fontSize: "0.75rem" }}>Studio contenu</div>
          </div>
        </div>

        {sent ? (
          <div>
            <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>✉️</div>
            <div style={{ color: C.textPrimary, fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>Lien envoyé !</div>
            <div style={{ color: C.textSecondary, fontSize: "0.875rem", lineHeight: 1.6 }}>
              Ouvre ton email à <strong style={{ color: C.violetLight }}>{email}</strong> et clique sur le lien magique pour accéder à RUSHES.
            </div>
          </div>
        ) : (
          <>
            <div style={{ color: C.textPrimary, fontWeight: 600, fontSize: "1.1rem", marginBottom: 4 }}>Connexion</div>
            <div style={{ color: C.textSecondary, fontSize: "0.8rem", marginBottom: 28 }}>
              Pas de mot de passe — un lien sécurisé t'est envoyé par email.
            </div>

            <label style={{ display: "block", color: C.textMuted, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="toi@exemple.com"
              style={{
                display: "block", width: "100%", marginBottom: 16,
                background: C.card, border: `1px solid ${C.border}`,
                color: C.textPrimary, borderRadius: 12, padding: "12px 16px",
                fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
              }}
            />
            <button
              onClick={handleLogin}
              disabled={loading || !email.trim()}
              style={{
                width: "100%", background: `linear-gradient(135deg, ${C.violet}, #4F1D96)`,
                color: "#fff", border: "none", borderRadius: 12, padding: "13px 0",
                fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
                opacity: loading || !email.trim() ? 0.6 : 1, fontFamily: "inherit",
              }}
            >
              {loading ? "Envoi…" : "Envoyer le lien magique →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
