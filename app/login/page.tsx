"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const C = {
  bg: "#14141A", surface: "#1C1C24", border: "#32323D",
  textPrimary: "#EDEAE2", textSecondary: "#9A98A8", textMuted: "#6E6C7A",
  amber: "#F0A93E",
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
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });
    setLoading(false);
    if (!error) setSent(true);
  }

  return (
    <div
      style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 32, width: "100%", maxWidth: 380,
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <div style={{ color: C.amber, fontSize: 13, fontWeight: 600, letterSpacing: "0.15em", marginBottom: 4 }}>
          RUSHES
        </div>
        <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 28 }}>
          Centre de contrôle contenu
        </div>

        {sent ? (
          <div style={{ color: C.textPrimary, fontSize: 14, lineHeight: 1.6 }}>
            ✓ Lien envoyé à <strong>{email}</strong>.<br />
            Ouvre ton email et clique sur le lien pour accéder à l'application.
          </div>
        ) : (
          <>
            <label style={{ color: C.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="toi@exemple.com"
              style={{
                display: "block", width: "100%", marginTop: 6, marginBottom: 16,
                background: "#24242E", border: `1px solid ${C.border}`,
                color: C.textPrimary, borderRadius: 8, padding: "10px 12px",
                fontSize: 14, outline: "none",
              }}
            />
            <button
              onClick={handleLogin}
              disabled={loading || !email.trim()}
              style={{
                width: "100%", background: C.amber, color: C.bg,
                border: "none", borderRadius: 8, padding: "10px 0",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                opacity: loading || !email.trim() ? 0.6 : 1,
              }}
            >
              {loading ? "Envoi…" : "Connexion par lien magique"}
            </button>
            <div style={{ color: C.textMuted, fontSize: 11, marginTop: 12, textAlign: "center" }}>
              Pas de mot de passe. Un lien sécurisé t'est envoyé par email.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
