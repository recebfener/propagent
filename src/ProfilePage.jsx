import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { useAuth } from "./contexts/AuthContext";

const lbl = { fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" };
const inp = { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" };

export default function ProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", company: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setForm({ first_name: data.first_name || "", last_name: data.last_name || "", phone: data.phone || "", company: data.company || "" });
        setLoading(false);
      });
  }, [user]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
      company: form.company,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) setMessage({ type: "error", text: "Kayıt hatası: " + error.message });
    else setMessage({ type: "success", text: "Profil başarıyla kaydedildi." });
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontSize: 14 }}>
      Yükleniyor...
    </div>
  );

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>Profil Ayarları</h2>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>{user.email}</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "1.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={lbl}>Ad</label>
            <input
              value={form.first_name}
              onChange={e => set("first_name", e.target.value)}
              placeholder="Ahmet"
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>Soyad</label>
            <input
              value={form.last_name}
              onChange={e => set("last_name", e.target.value)}
              placeholder="Yılmaz"
              style={inp}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Telefon numarası</label>
          <input
            value={form.phone}
            onChange={e => set("phone", e.target.value)}
            placeholder="+90 555 000 0000"
            style={inp}
            type="tel"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={lbl}>Şirket adı</label>
          <input
            value={form.company}
            onChange={e => set("company", e.target.value)}
            placeholder="ABC Gayrimenkul Ltd."
            style={inp}
          />
        </div>

        {message.text && (
          <div style={{
            marginBottom: 16, padding: "11px 14px", borderRadius: 9,
            background: message.type === "error" ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${message.type === "error" ? "#fecaca" : "#bbf7d0"}`,
            color: message.type === "error" ? "#b91c1c" : "#15803d",
            fontSize: 13, fontWeight: 500,
          }}>
            {message.text}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="btn-primary"
          style={{
            background: saving ? "#93c5fd" : "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            color: "#fff", border: "none", padding: "11px 28px",
            borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            boxShadow: saving ? "none" : "0 2px 8px rgba(37,99,235,0.3)",
          }}
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      <div style={{ marginTop: "1.5rem", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "1.25rem 1.75rem" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Hesap bilgileri</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          <span style={{ fontWeight: 600 }}>E-posta: </span>{user.email}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
          E-posta adresi değiştirilemez.
        </div>
      </div>
    </div>
  );
}
