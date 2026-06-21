"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const C = {
  bg: "#07090F", surface: "#0F1623", card: "#192338",
  border: "#1E2D45", textPrimary: "#EEF2FF", textSecondary: "#7B8DB0",
  textMuted: "#3D4F6E", violet: "#7C3AED", violetLight: "#A78BFA",
  error: "#F87171", success: "#34D399",
};

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const supabase = createSupabaseBrowserClient();

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setSuccessMsg("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit() {
    setError("");
    setSuccessMsg("");

    if (!email.trim() || !password) return;

    if (mode === "signup") {
      if (password.length < 6) {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }
    }

    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (error) {
        setError("Email ou mot de passe incorrect.");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (error) {
        if (error.message.includes("already registered")) {
          setError("Cet email est déjà utilisé. Connecte-toi à la place.");
        } else {
          setError(error.message);
        }
      } else {
        setSuccessMsg(
          "Compte créé ! Vérifie ton email pour confirmer ton inscription, puis connecte-toi."
        );
        switchMode("login");
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    background: C.card,
    border: `1px solid ${C.border}`,
    color: C.textPrimary,
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: "0.9rem",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 24,
          padding: 40,
          width: "100%",
          maxWidth: 400,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${C.violet}, #4F1D96)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 900 }}>R</span>
          </div>
          <div>
            <div style={{ color: C.textPrimary, fontWeight: 700, fontSize: "1rem", letterSpacing: "0.1em" }}>
              RUSHES
            </div>
            <div style={{ color: C.textMuted, fontSize: "0.75rem" }}>Studio contenu</div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            background: C.card,
            borderRadius: 12,
            padding: 4,
            marginBottom: 28,
          }}
        >
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
                fontSize: "0.85rem",
                transition: "all 0.15s",
                background: mode === m ? `linear-gradient(135deg, ${C.violet}, #4F1D96)` : "transparent",
                color: mode === m ? "#fff" : C.textSecondary,
              }}
            >
              {m === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>

        {/* Success */}
        {successMsg && (
          <div
            style={{
              background: "#064E3B",
              border: "1px solid #059669",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 20,
              color: C.success,
              fontSize: "0.82rem",
              lineHeight: 1.5,
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#450A0A",
              border: "1px solid #991B1B",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 20,
              color: C.error,
              fontSize: "0.82rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Email */}
        <label style={{ display: "block", color: C.textMuted, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
          Adresse email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="toi@exemple.com"
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        {/* Password */}
        <label style={{ display: "block", color: C.textMuted, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
          Mot de passe
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && mode === "login") handleSubmit(); }}
          placeholder={mode === "signup" ? "Minimum 6 caractères" : "••••••••"}
          style={{ ...inputStyle, marginBottom: mode === "signup" ? 16 : 24 }}
        />

        {/* Confirm password — inscription uniquement */}
        {mode === "signup" && (
          <>
            <label style={{ display: "block", color: C.textMuted, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="••••••••"
              style={{ ...inputStyle, marginBottom: 24 }}
            />
          </>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !email.trim() || !password}
          style={{
            width: "100%",
            background: `linear-gradient(135deg, ${C.violet}, #4F1D96)`,
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "13px 0",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: "pointer",
            opacity: loading || !email.trim() || !password ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          {loading ? "Chargement…" : mode === "login" ? "Se connecter →" : "Créer mon compte →"}
        </button>
      </div>
    </div>
  );
}
