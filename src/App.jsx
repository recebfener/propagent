import { useState, useMemo, useEffect, useCallback } from "react";
import { analyzeMulk } from "./gemini";
import MarketCompare from "./MarketCompare";
import TenantPayments from "./TenantPayments";
import Auth from "./Auth";
import { useAuth } from "./contexts/AuthContext";
import { supabase } from "./lib/supabase";
import "./index.css";

function mapProperty({ property_expenses, ...p }) {
  return { ...p, expenses: property_expenses || [] };
}

function calcAnalysis(p) {
  const monthlyExp = p.expenses.reduce((s, e) =>
    s + (e.frequency === "monthly" ? e.amount : e.frequency === "yearly" ? e.amount / 12 : 0), 0);
  const annualRent = (p.monthly_rent || 0) * 12;
  const annualNet = annualRent - monthlyExp * 12;
  const gross = p.sale_price > 0 ? (annualRent / p.sale_price) * 100 : 0;
  const net = p.sale_price > 0 ? (annualNet / p.sale_price) * 100 : 0;
  const payback = annualNet > 0 ? p.sale_price / annualNet : 0;
  const cashflow = (p.monthly_rent || 0) - monthlyExp;
  const ppm2 = p.net_m2 > 0 ? p.sale_price / p.net_m2 : 0;
  return { gross, net, payback, cashflow, ppm2, monthlyExp };
}

function fmt(n) { return Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 0 }); }

function yieldColor(v) {
  if (v >= 6) return { dot: "#16a34a", bar: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", text: "#14532d" };
  if (v >= 5) return { dot: "#15803d", bar: "#4ade80", bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" };
  if (v >= 4) return { dot: "#ca8a04", bar: "#facc15", bg: "#fefce8", border: "#fef08a", text: "#713f12" };
  if (v >= 3) return { dot: "#ea580c", bar: "#fb923c", bg: "#fff7ed", border: "#fed7aa", text: "#7c2d12" };
  if (v >= 2) return { dot: "#dc2626", bar: "#f87171", bg: "#fef2f2", border: "#fecaca", text: "#7f1d1d" };
  return { dot: "#b91c1c", bar: "#ef4444", bg: "#fef2f2", border: "#fca5a5", text: "#7f1d1d" };
}

function yieldLabel(v) {
  if (v >= 6) return "Mükemmel";
  if (v >= 5) return "İyi";
  if (v >= 4) return "Orta";
  if (v >= 3) return "Zayıf";
  return "Düşük";
}

function YieldPill({ value, size = "sm" }) {
  const c = yieldColor(value);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontSize: size === "lg" ? 13 : 11, fontWeight: 700, padding: size === "lg" ? "5px 12px" : "2px 9px", borderRadius: 99 }}>
      <span style={{ width: size === "lg" ? 8 : 6, height: size === "lg" ? 8 : 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      %{value.toFixed(2)} · {yieldLabel(value)}
    </span>
  );
}

function YieldBar({ value, label }) {
  const c = yieldColor(value);
  const pct = Math.min((value / 10) * 100, 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: c.dot }}>%{value.toFixed(2)}</span>
      </div>
      <div style={{ height: 8, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${c.dot},${c.bar})`, borderRadius: 99, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function StatusPill({ type }) {
  const map = { kiralık: ["#dbeafe", "#1d4ed8"], satılık: ["#fef3c7", "#b45309"], satıldı: ["#dcfce7", "#15803d"], kiralandı: ["#dcfce7", "#15803d"] };
  const [bg, color] = map[type] || ["#f3f4f6", "#374151"];
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{type}</span>;
}

const EMPTY = { id: "", title: "", property_type: "daire", listing_type: "kiralık", city: "İstanbul", district: "", neighborhood: "", gross_m2: "", net_m2: "", room_count: "3+1", floor: "", total_floors: "", building_age: "", sale_price: "", monthly_rent: "", currency: "TRY", tenant_name: "", tenant_status: "vacant", lease_start: "", lease_end: "", expenses: [], notes: "" };

const FL = ({ children }) => <label style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{children}</label>;
const INP = ({ value, onChange, placeholder, type = "text" }) => <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />;
const SEL = ({ value, onChange, options }) => <select value={value} onChange={onChange} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none" }}>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>;

function PropertyForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const addExp = () => set("expenses", [...form.expenses, { type: "aidat", amount: "", frequency: "monthly" }]);
  const rmExp = i => set("expenses", form.expenses.filter((_, j) => j !== i));
  const upExp = (i, k, v) => set("expenses", form.expenses.map((e, j) => j === i ? { ...e, [k]: v } : e));
  const handleSave = () => {
    if (!form.title || !form.district) return alert("Başlık ve ilçe zorunlu.");
    onSave({ ...form, sale_price: Number(form.sale_price) || 0, monthly_rent: Number(form.monthly_rent) || 0, gross_m2: Number(form.gross_m2) || 0, net_m2: Number(form.net_m2) || 0, floor: Number(form.floor) || 0, total_floors: Number(form.total_floors) || 0, building_age: Number(form.building_age) || 0, expenses: form.expenses.map(e => ({ type: e.type, amount: Number(e.amount) || 0, frequency: e.frequency })) });
  };
  const g2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 };
  const g3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 };
  const sec = { borderTop: "1px solid #f3f4f6", paddingTop: 14, marginBottom: 14 };
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", maxWidth: 620, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{form.id ? "Mülkü düzenle" : "Yeni mülk ekle"}</h2>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 22 }}>✕</button>
      </div>
      <div style={{ marginBottom: 14 }}><FL>Başlık *</FL><INP value={form.title} onChange={e => set("title", e.target.value)} placeholder="ör. Kadıköy 3+1 Daire" /></div>
      <div style={g2}><div><FL>Mülk tipi</FL><SEL value={form.property_type} onChange={e => set("property_type", e.target.value)} options={["daire", "villa", "dükkan", "arsa", "ofis"]} /></div><div><FL>İlan durumu</FL><SEL value={form.listing_type} onChange={e => set("listing_type", e.target.value)} options={["satılık", "kiralık", "satıldı", "kiralandı"]} /></div></div>
      <div style={g3}><div><FL>Şehir</FL><INP value={form.city} onChange={e => set("city", e.target.value)} placeholder="İstanbul" /></div><div><FL>İlçe *</FL><INP value={form.district} onChange={e => set("district", e.target.value)} placeholder="Kadıköy" /></div><div><FL>Mahalle</FL><INP value={form.neighborhood} onChange={e => set("neighborhood", e.target.value)} placeholder="Moda" /></div></div>
      <div style={g3}><div><FL>Brüt m²</FL><INP value={form.gross_m2} onChange={e => set("gross_m2", e.target.value)} placeholder="135" type="number" /></div><div><FL>Net m²</FL><INP value={form.net_m2} onChange={e => set("net_m2", e.target.value)} placeholder="115" type="number" /></div><div><FL>Oda</FL><SEL value={form.room_count} onChange={e => set("room_count", e.target.value)} options={["studio", "1+1", "2+1", "3+1", "4+1", "5+1", "—"]} /></div></div>
      <div style={g3}><div><FL>Kat</FL><INP value={form.floor} onChange={e => set("floor", e.target.value)} placeholder="4" type="number" /></div><div><FL>Toplam kat</FL><INP value={form.total_floors} onChange={e => set("total_floors", e.target.value)} placeholder="8" type="number" /></div><div><FL>Bina yaşı</FL><INP value={form.building_age} onChange={e => set("building_age", e.target.value)} placeholder="12" type="number" /></div></div>
      <div style={g2}><div><FL>Satış fiyatı (₺)</FL><INP value={form.sale_price} onChange={e => set("sale_price", e.target.value)} placeholder="9500000" type="number" /></div><div><FL>Aylık kira (₺)</FL><INP value={form.monthly_rent} onChange={e => set("monthly_rent", e.target.value)} placeholder="32000" type="number" /></div></div>
      <div style={sec}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><FL>Giderler</FL><button onClick={addExp} style={{ fontSize: 11, padding: "4px 10px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer" }}>+ Ekle</button></div>
        {form.expenses.length === 0 && <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Gider eklenmedi.</p>}
        {form.expenses.map((e, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <SEL value={e.type} onChange={ev => upExp(i, "type", ev.target.value)} options={["aidat", "vergi", "sigorta", "bakım", "diğer"]} />
            <INP value={e.amount} onChange={ev => upExp(i, "amount", ev.target.value)} placeholder="Tutar ₺" type="number" />
            <SEL value={e.frequency} onChange={ev => upExp(i, "frequency", ev.target.value)} options={["monthly", "yearly"]} />
            <button onClick={() => rmExp(i)} style={{ padding: "8px 10px", color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, cursor: "pointer" }}>✕</button>
          </div>
        ))}
      </div>
      <div style={sec}>
        <div style={g2}><div><FL>Kiracı adı</FL><INP value={form.tenant_name} onChange={e => set("tenant_name", e.target.value)} placeholder="Ad Soyad" /></div><div><FL>Durum</FL><SEL value={form.tenant_status} onChange={e => set("tenant_status", e.target.value)} options={["active", "vacant", "pending"]} /></div></div>
        <div style={g2}><div><FL>Kira başlangıcı</FL><INP value={form.lease_start} onChange={e => set("lease_start", e.target.value)} type="date" /></div><div><FL>Kira bitişi</FL><INP value={form.lease_end} onChange={e => set("lease_end", e.target.value)} type="date" /></div></div>
      </div>
      <div style={{ marginBottom: 16 }}><FL>Notlar</FL><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Serbest not..." style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} /></div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "8px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>İptal</button>
        <button onClick={handleSave} style={{ background: "#1e3a5f", color: "#fff", border: "none", padding: "8px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{form.id ? "Güncelle" : "Kaydet"}</button>
      </div>
    </div>
  );
}

function GeminiPanel({ property, analysis }) {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true); setError(""); setResult("");
    try {
      const text = await analyzeMulk(property, analysis);
      setResult(text);
    } catch (e) {
      setError("API hatası: " + (e.message || "API key'ini .env dosyasında kontrol et."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 22, height: 22, background: "linear-gradient(135deg,#4285f4,#34a853)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>G</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Gemini AI Analizi</span>
        </div>
        <button onClick={run} disabled={loading} style={{ fontSize: 12, padding: "7px 14px", fontWeight: 700, borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", background: loading ? "#f3f4f6" : "#1e3a5f", color: loading ? "#9ca3af" : "#fff", border: "none", display: "flex", alignItems: "center", gap: 6 }}>
          {loading
            ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #d1d5db", borderTopColor: "#6b7280", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Analiz ediliyor...</>
            : <>{result ? "🔄 Yenile" : "✦ AI Analizi Al"}</>}
        </button>
      </div>
      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#b91c1c" }}>{error}</div>}
      {result && (
        <div style={{ background: "linear-gradient(135deg,#eff6ff,#f0fdf4)", border: "1px solid #bfdbfe", borderRadius: 10, padding: "14px 16px" }}>
          <p style={{ fontSize: 13, color: "#1f2937", margin: 0, lineHeight: 1.8 }}>{result}</p>
        </div>
      )}
      {!result && !loading && !error && <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Mülk verilerini Gemini Pro'ya gönderip Türkçe uzman yorumu al.</p>}
    </div>
  );
}

function AnalysisPanel({ p }) {
  const a = calcAnalysis(p);
  const c = yieldColor(a.net);
  const row = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f9fafb" }}>
      <span style={{ fontSize: 13, color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", margin: "0 0 12px" }}>Getiri oranları</p>
        <YieldBar value={a.gross} label="Brüt kira getirisi" />
        <YieldBar value={a.net} label="Net kira getirisi" />
        <YieldPill value={a.net} size="lg" />
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", margin: "16px 0 4px" }}>Finansal özet</p>
      {row("Geri ödeme süresi", a.payback > 0 ? `${a.payback.toFixed(1)} yıl` : "—")}
      {row("Aylık nakit akışı", `₺${fmt(Math.round(a.cashflow))}`)}
      {row("Yıllık kira geliri", `₺${fmt(p.monthly_rent * 12)}`)}
      {row("Aylık gider", `₺${fmt(Math.round(a.monthlyExp))}`)}
      {row("m² birim fiyatı", `₺${fmt(Math.round(a.ppm2))}`)}
      <div style={{ marginTop: 14, padding: "12px 14px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: c.text, margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Otomatik değerlendirme</p>
        <p style={{ fontSize: 12, color: c.text, margin: 0, lineHeight: 1.7 }}>
          {a.net >= 5 ? `Net %${a.net.toFixed(2)} ile portföyünüzdeki en güçlü mülklerden biri. ${a.payback > 0 ? `Yaklaşık ${a.payback.toFixed(0)} yılda amortisman.` : ""}` : a.net >= 3 ? `Net %${a.net.toFixed(2)} ortalama performans. Giderleri optimize ederek getiri artırılabilir.` : `Net %${a.net.toFixed(2)} düşük. Satış fiyatı veya kira yapısını gözden geçirin.`}
        </p>
      </div>
      <GeminiPanel property={p} analysis={a} />
    </div>
  );
}

function PropertyCard({ p, selected, onSelect, onEdit, onDelete }) {
  const a = calcAnalysis(p);
  const c = yieldColor(a.net);
  return (
    <div onClick={() => onSelect(p.id)} style={{ background: "#fff", border: `1px solid ${selected ? "#3b82f6" : "#e5e7eb"}`, borderLeft: `4px solid ${c.bar}`, borderRadius: 12, padding: "1rem 1.1rem", cursor: "pointer", boxShadow: selected ? "0 0 0 3px #3b82f622" : "none", transition: "box-shadow 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 2 }}>{p.title}</div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{p.district}{p.neighborhood ? ` · ${p.neighborhood}` : ""} · {p.net_m2} m² · Bina yaşı {p.building_age}</div>
        </div>
        <StatusPill type={p.listing_type} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, margin: "10px 0" }}>
        {[["Satış", `₺${fmt(p.sale_price)}`], ["Kira/ay", `₺${fmt(p.monthly_rent)}`], ["m²", `${p.net_m2}`], ["Kat", `${p.floor}/${p.total_floors}`]].map(([lbl, val]) => (
          <div key={lbl} style={{ background: "#f9fafb", borderRadius: 7, padding: "5px 8px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{lbl}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, fontFamily: "monospace" }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <YieldPill value={a.net} />
        {p.tenant_name && <span style={{ fontSize: 11, color: "#9ca3af" }}>👤 {p.tenant_name}{p.lease_end ? ` · ${p.lease_end.slice(0, 7)}` : ""}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
        <button onClick={e => { e.stopPropagation(); onEdit(p); }} style={{ fontSize: 11, padding: "4px 10px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer" }}>✏️ Düzenle</button>
        <button onClick={e => { e.stopPropagation(); if (window.confirm("Mülkü silmek istediğinizden emin misiniz?")) onDelete(p.id); }} style={{ fontSize: 11, padding: "4px 10px", color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer" }}>🗑️ Sil</button>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [properties, setProperties] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [view, setView] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [editingProp, setEditingProp] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("hepsi");
  const [search, setSearch] = useState("");

  const loadProperties = useCallback(async () => {
    setDbLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select("*, property_expenses(*)")
      .order("created_at", { ascending: false });
    if (!error && data) setProperties(data.map(mapProperty));
    setDbLoading(false);
  }, []);

  useEffect(() => {
    if (user) loadProperties();
    else setProperties([]);
  }, [user, loadProperties]);

  const selectedProp = properties.find(p => p.id === selectedId);
  const stats = useMemo(() => {
    const avgNet = properties.length ? properties.reduce((s, p) => s + calcAnalysis(p).net, 0) / properties.length : 0;
    return { total: properties.length, totalValue: properties.reduce((s, p) => s + p.sale_price, 0), totalRent: properties.reduce((s, p) => s + p.monthly_rent, 0), avgNet, occupied: properties.filter(p => p.tenant_status === "active").length };
  }, [properties]);

  const filtered = useMemo(() => properties.filter(p => {
    const mt = filter === "hepsi" || p.listing_type === filter || p.property_type === filter;
    const ms = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.district.toLowerCase().includes(search.toLowerCase());
    return mt && ms;
  }), [properties, filter, search]);

  const save = async (p) => {
    setSaveError("");
    const { id, expenses, property_expenses: _pe, created_at: _ca, updated_at: _ua, user_id: _uid, ...fields } = p;

    let propertyId = id || null;
    if (propertyId) {
      const { error } = await supabase.from("properties").update(fields).eq("id", propertyId);
      if (error) { setSaveError("Kayıt hatası: " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("properties").insert({ ...fields, user_id: user.id }).select().single();
      if (error || !data) { setSaveError("Kayıt hatası: " + (error?.message || "Bilinmeyen hata")); return; }
      propertyId = data.id;
    }

    await supabase.from("property_expenses").delete().eq("property_id", propertyId);
    if (expenses.length > 0) {
      await supabase.from("property_expenses").insert(
        expenses.map(({ type, amount, frequency }) => ({ type, amount, frequency, property_id: propertyId }))
      );
    }

    await loadProperties();
    setModal(null);
    setEditingProp(null);
  };

  const del = async (id) => {
    await supabase.from("properties").delete().eq("id", id);
    setProperties(prev => prev.filter(p => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const navBtn = (id, lbl) => (
    <button onClick={() => setView(id)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: view === id ? 700 : 400, background: view === id ? "#1e3a5f" : "transparent", color: view === id ? "#fff" : "#6b7280" }}>
      {lbl}
    </button>
  );

  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #e5e7eb", borderTopColor: "#1e3a5f", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: "#9ca3af" }}>Yükleniyor...</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!user) return <Auth />;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0.8rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "#1e3a5f", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏢</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>PropAgent</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Emlak yatırım platformu</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 10, padding: 4 }}>
          {navBtn("dashboard", "📊 Dashboard")}
          {navBtn("portfolio", "📋 Portföy")}
          {navBtn("tenants", "🏘️ Kiracılar")}
          {navBtn("market", "🔍 Pazar")}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#9ca3af", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
          <button onClick={signOut} style={{ fontSize: 12, padding: "6px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", color: "#374151" }}>
            Çıkış
          </button>
        </div>
      </div>

      {saveError && (
        <div style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca", padding: "10px 1.5rem", fontSize: 13, color: "#b91c1c", display: "flex", justifyContent: "space-between" }}>
          {saveError}
          <button onClick={() => setSaveError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
        {dbLoading && (
          <div style={{ textAlign: "center", padding: "3rem", color: "#9ca3af", fontSize: 13 }}>
            <div style={{ width: 28, height: 28, border: "2px solid #e5e7eb", borderTopColor: "#1e3a5f", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 10px" }} />
            Mülkler yükleniyor...
          </div>
        )}

        {!dbLoading && view === "dashboard" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: "1.5rem" }}>
              {[["🏠", "Toplam mülk", stats.total, "portföyde", "#3b82f6"], ["💎", "Portföy değeri", `₺${fmt(stats.totalValue)}`, "toplam", "#8b5cf6"], ["💰", "Aylık kira", `₺${fmt(stats.totalRent)}`, "brüt gelir", "#10b981"], ["📈", "Ort. net getiri", `%${stats.avgNet.toFixed(2)}`, yieldLabel(stats.avgNet), yieldColor(stats.avgNet).dot], ["👥", "Doluluk", `${stats.occupied}/${stats.total}`, "aktif kiracı", "#f59e0b"]].map(([icon, label, value, sub, accent]) => (
                <div key={label} style={{ background: "#fff", borderRadius: 12, padding: "1rem 1.1rem", borderTop: `3px solid ${accent}`, border: "1px solid #e5e7eb", borderTopWidth: 3 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>{icon} {label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>{value}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: selectedProp ? "minmax(0,1fr) 400px" : "1fr", gap: "1.25rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#111" }}>Mülkler <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af" }}>({filtered.length})</span></h2>
                  <button onClick={() => { setEditingProp(null); setModal("add"); }} style={{ fontSize: 13, padding: "7px 16px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>+ Mülk ekle</button>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                  <input placeholder="Başlık veya ilçe ara..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 140, padding: "7px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none" }} />
                  {["hepsi", "kiralık", "satılık", "daire", "dükkan"].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 11, padding: "6px 12px", fontWeight: filter === f ? 700 : 400, background: filter === f ? "#1e3a5f" : "#fff", color: filter === f ? "#fff" : "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer" }}>{f}</button>
                  ))}
                </div>
                {properties.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🏠</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Portföyünüz boş</div>
                    <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>İlk mülkünüzü ekleyerek başlayın.</p>
                    <button onClick={() => setModal("add")} style={{ fontSize: 13, padding: "8px 20px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>
                      + İlk mülkü ekle
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filtered.length === 0
                      ? <div style={{ textAlign: "center", padding: "3rem", color: "#9ca3af", fontSize: 13 }}>Mülk bulunamadı.</div>
                      : filtered.map(p => <PropertyCard key={p.id} p={p} selected={selectedId === p.id} onSelect={id => setSelectedId(selectedId === id ? null : id)} onEdit={p => { setEditingProp(p); setModal("edit"); }} onDelete={del} />)}
                  </div>
                )}
              </div>
              {selectedProp && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#111" }}>Analiz paneli</h2>
                    <button onClick={() => setSelectedId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20 }}>✕</button>
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "1.1rem 1.2rem", position: "sticky", top: 20 }}>
                    <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #f3f4f6" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{selectedProp.title}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{selectedProp.district} · {selectedProp.net_m2} m² · {selectedProp.room_count} · {selectedProp.building_age} yaşında</div>
                    </div>
                    <AnalysisPanel p={selectedProp} />
                    {selectedProp.notes && <div style={{ marginTop: 12, padding: "9px 12px", background: "#f9fafb", borderRadius: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>📝 {selectedProp.notes}</div>}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!dbLoading && view === "portfolio" && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: "1rem", color: "#111" }}>Portföy karşılaştırma</h2>
            {properties.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#9ca3af", fontSize: 13 }}>Portföyde henüz mülk yok.</div>
            ) : (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", padding: "8px 16px", background: "#f9fafb", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", gap: 8 }}>
                  {["Mülk", "Satış fiyatı", "Kira/ay", "Brüt", "Net getiri", "Geri ödeme"].map(h => <div key={h}>{h}</div>)}
                </div>
                {[...properties].sort((a, b) => calcAnalysis(b).net - calcAnalysis(a).net).map(p => {
                  const a = calcAnalysis(p);
                  const c = yieldColor(a.net);
                  return (
                    <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", padding: "11px 16px", borderTop: "1px solid #f3f4f6", fontSize: 12, gap: 8, alignItems: "center", borderLeft: `4px solid ${c.bar}` }}>
                      <div><div style={{ fontWeight: 700 }}>{p.title}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{p.district} · {p.net_m2} m²</div></div>
                      <div style={{ fontFamily: "monospace" }}>₺{fmt(p.sale_price)}</div>
                      <div style={{ fontFamily: "monospace" }}>₺{fmt(p.monthly_rent)}</div>
                      <div style={{ fontWeight: 700 }}>%{a.gross.toFixed(2)}</div>
                      <YieldPill value={a.net} />
                      <div>{a.payback > 0 ? `${a.payback.toFixed(1)} yıl` : "—"}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 10 }}>Net getiriye göre sıralanmış.</p>
          </>
        )}

        {!dbLoading && view === "tenants" && (
          <TenantPayments properties={properties} />
        )}

        {!dbLoading && view === "market" && (
          <MarketCompare properties={properties} />
        )}
      </div>

      {(modal === "add" || modal === "edit") && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem", zIndex: 1000, overflowY: "auto" }}>
          <PropertyForm initial={modal === "edit" ? editingProp : null} onSave={save} onCancel={() => { setModal(null); setEditingProp(null); setSaveError(""); }} />
        </div>
      )}
    </div>
  );
}
