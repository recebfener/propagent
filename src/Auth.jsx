import { useState } from "react";
import { useAuth } from "./contexts/AuthContext";

function AuthLogo() {
  return (
    <svg width="52" height="52" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="10" fill="url(#authgrad)"/>
      <path d="M18 7.5L7.5 15v14h7.5v-7.5h6V29H28.5V15L18 7.5z" fill="white" fillOpacity="0.97"/>
      <rect x="13.5" y="18" width="3.5" height="3.5" rx="0.8" fill="#1e3a8a" fillOpacity="0.35"/>
      <rect x="19" y="18" width="3.5" height="3.5" rx="0.8" fill="#1e3a8a" fillOpacity="0.35"/>
      <defs>
        <linearGradient id="authgrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e3a8a"/>
          <stop offset="1" stopColor="#3b82f6"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email || !password) return setError("E-posta ve şifre zorunlu.");
    if (password.length < 6) return setError("Şifre en az 6 karakter olmalı.");
    setLoading(true);
    try {
      if (mode === "login") {
        const { error: err } = await signIn(email, password);
        if (err) setError(err.message);
      } else {
        const { error: err } = await signUp(email, password);
        if (err) setError(err.message);
        else setInfo("Kayıt başarılı! E-postanızı onaylayın, ardından giriş yapabilirsiniz.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inp = { width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", marginBottom: 12 }}><AuthLogo /></div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111" }}>PropAgent</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 3 }}>Emlak yatırım platformu</div>
        </div>

        {/* Kart */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "2rem" }}>
          {/* Tab */}
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: "1.5rem" }}>
            {["login", "register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); setInfo(""); }}
                style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: mode === m ? 700 : 400, background: mode === m ? "#fff" : "transparent", color: mode === m ? "#111" : "#6b7280", cursor: "pointer", boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
                {m === "login" ? "Giriş Yap" : "Kayıt Ol"}
              </button>
            ))}
          </div>

          <form onSubmit={handle}>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>E-posta</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@email.com" style={inp} autoComplete="email" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Şifre</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#b91c1c", marginBottom: 14 }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#15803d", marginBottom: 14 }}>
                {info}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "11px", background: loading ? "#93c5fd" : "#1e3a5f", color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading
                ? <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Yükleniyor...</>
                : mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: "1rem" }}>
          Verileriniz Supabase ile güvenle saklanır.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
