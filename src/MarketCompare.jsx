import { useState, useMemo } from "react";

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
  if (v >= 6) return "Mükemmel"; if (v >= 5) return "İyi"; if (v >= 4) return "Orta"; if (v >= 3) return "Zayıf"; return "Düşük";
}

function YieldPill({ value }) {
  const c = yieldColor(value);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} />
      %{value.toFixed(2)} · {yieldLabel(value)}
    </span>
  );
}

function calcYield(salePrice, monthlyRent, monthlyExp) {
  if (!salePrice || !monthlyRent) return { gross: 0, net: 0, payback: 0, cashflow: 0, ppm2: 0 };
  const annual = monthlyRent * 12;
  const annualNet = annual - monthlyExp * 12;
  return {
    gross: (annual / salePrice) * 100,
    net: (annualNet / salePrice) * 100,
    payback: annualNet > 0 ? salePrice / annualNet : 0,
    cashflow: monthlyRent - monthlyExp,
  };
}

function calcPortfolioAnalysis(p) {
  const monthlyExp = p.expenses.reduce((s, e) =>
    s + (e.frequency === "monthly" ? e.amount : e.frequency === "yearly" ? e.amount / 12 : 0), 0);
  return calcYield(p.sale_price, p.monthly_rent, monthlyExp);
}

const EMPTY_LISTING = {
  source: "sahibinden", title: "", district: "", city: "İstanbul",
  property_type: "daire", room_count: "3+1",
  net_m2: "", sale_price: "", monthly_rent: "",
  floor: "", building_age: "", notes: "",
};

const FL = ({ children }) => (
  <label style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{children}</label>
);
const INP = ({ value, onChange, placeholder, type = "text" }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
);
const SEL = ({ value, onChange, options }) => (
  <select value={value} onChange={onChange}
    style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none" }}>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

function ScoreMeter({ score, label }) {
  const color = score >= 70 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626";
  const bg = score >= 70 ? "#f0fdf4" : score >= 50 ? "#fefce8" : "#fef2f2";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 8px" }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="8" />
          <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${(score / 100) * 201} 201`}
            strokeLinecap="round"
            transform="rotate(-90 40 40)" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color }}>
          {score}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: "2px 8px", borderRadius: 99, display: "inline-block" }}>{label}</div>
    </div>
  );
}

function CompareRow({ label, marketVal, portfolioVal, unit = "", higherIsBetter = true, format = "number" }) {
  const mv = Number(marketVal) || 0;
  const pv = Number(portfolioVal) || 0;
  const marketBetter = higherIsBetter ? mv > pv : mv < pv;
  const equal = Math.abs(mv - pv) < 0.01;

  const fmtVal = (v) => {
    if (format === "currency") return `₺${fmt(v)}`;
    if (format === "percent") return `%${v.toFixed(2)}`;
    if (format === "year") return `${v.toFixed(1)} yıl`;
    return fmt(v);
  };

  const diff = pv > 0 ? ((mv - pv) / pv * 100) : 0;
  const diffColor = equal ? "#9ca3af" : (higherIsBetter ? (mv > pv ? "#16a34a" : "#dc2626") : (mv < pv ? "#16a34a" : "#dc2626"));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 80px", gap: 8, padding: "10px 16px", borderBottom: "1px solid #f3f4f6", alignItems: "center", fontSize: 13 }}>
      <div style={{ color: "#374151", fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontWeight: 700, color: marketBetter && !equal ? "#16a34a" : "#374151" }}>
        {fmtVal(mv)}{unit}
      </div>
      <div style={{ fontFamily: "monospace", color: "#6b7280" }}>{fmtVal(pv)}{unit}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: diffColor, textAlign: "right" }}>
        {equal ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`}
      </div>
    </div>
  );
}

function SimilarPropertyCard({ p, marketListing }) {
  const a = calcPortfolioAnalysis(p);
  const priceDiff = marketListing.sale_price && p.sale_price
    ? ((Number(marketListing.sale_price) - p.sale_price) / p.sale_price * 100)
    : null;

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "0.9rem 1rem" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{p.title}</div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>{p.district} · {p.net_m2} m² · {p.room_count}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
        <div style={{ background: "#f9fafb", borderRadius: 6, padding: "5px 8px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Satış fiyatı</div>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>₺{fmt(p.sale_price)}</div>
        </div>
        <div style={{ background: "#f9fafb", borderRadius: 6, padding: "5px 8px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>m² fiyatı</div>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>₺{fmt(Math.round(p.sale_price / p.net_m2))}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <YieldPill value={a.net} />
        {priceDiff !== null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: priceDiff > 0 ? "#dc2626" : "#16a34a", background: priceDiff > 0 ? "#fef2f2" : "#f0fdf4", padding: "2px 8px", borderRadius: 99 }}>
            İlan {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}% {priceDiff > 0 ? "pahalı" : "ucuz"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MarketCompare({ properties }) {
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState(EMPTY_LISTING);
  const [showForm, setShowForm] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = () => {
    if (!form.district || !form.sale_price) return alert("İlçe ve satış fiyatı zorunlu.");
    const listing = {
      ...form,
      id: String(Date.now()),
      sale_price: Number(form.sale_price),
      monthly_rent: Number(form.monthly_rent) || 0,
      net_m2: Number(form.net_m2) || 0,
      floor: Number(form.floor) || 0,
      building_age: Number(form.building_age) || 0,
    };
    setListings(prev => [...prev, listing]);
    setForm(EMPTY_LISTING);
    setShowForm(false);
    setSelectedListing(listing.id);
  };

  const activeListing = listings.find(l => l.id === selectedListing);

  const similarProperties = useMemo(() => {
    if (!activeListing) return [];
    return properties.filter(p => {
      const sameDistrict = p.district.toLowerCase() === activeListing.district.toLowerCase();
      const sameCity = p.city.toLowerCase() === activeListing.city.toLowerCase();
      const sameType = p.property_type === activeListing.property_type;
      const sameRoom = p.room_count === activeListing.room_count;
      if (sameDistrict && sameType) return true;
      if (sameCity && sameType && sameRoom) return true;
      return false;
    });
  }, [activeListing, properties]);

  const avgPortfolio = useMemo(() => {
    if (similarProperties.length === 0) return null;
    const analyses = similarProperties.map(p => calcPortfolioAnalysis(p));
    return {
      sale_price: similarProperties.reduce((s, p) => s + p.sale_price, 0) / similarProperties.length,
      monthly_rent: similarProperties.reduce((s, p) => s + p.monthly_rent, 0) / similarProperties.length,
      net_m2: similarProperties.reduce((s, p) => s + p.net_m2, 0) / similarProperties.length,
      ppm2: similarProperties.reduce((s, p) => s + (p.sale_price / p.net_m2), 0) / similarProperties.length,
      gross: analyses.reduce((s, a) => s + a.gross, 0) / analyses.length,
      net: analyses.reduce((s, a) => s + a.net, 0) / analyses.length,
      payback: analyses.reduce((s, a) => s + a.payback, 0) / analyses.length,
    };
  }, [similarProperties]);

  const marketAnalysis = useMemo(() => {
    if (!activeListing || !activeListing.sale_price) return null;
    const monthlyRent = activeListing.monthly_rent || 0;
    const gross = monthlyRent > 0 ? (monthlyRent * 12 / activeListing.sale_price) * 100 : 0;
    const net = gross;
    const payback = net > 0 ? 100 / net : 0;
    const ppm2 = activeListing.net_m2 > 0 ? activeListing.sale_price / activeListing.net_m2 : 0;
    return { gross, net, payback, ppm2 };
  }, [activeListing]);

  const score = useMemo(() => {
    if (!marketAnalysis || !avgPortfolio) return null;
    let s = 50;
    if (marketAnalysis.ppm2 > 0 && avgPortfolio.ppm2 > 0) {
      const ratio = avgPortfolio.ppm2 / marketAnalysis.ppm2;
      s += (ratio - 1) * 30;
    }
    if (marketAnalysis.gross > 0 && avgPortfolio.gross > 0) {
      const ratio = marketAnalysis.gross / avgPortfolio.gross;
      s += (ratio - 1) * 20;
    }
    return Math.min(100, Math.max(0, Math.round(s)));
  }, [marketAnalysis, avgPortfolio]);

  const scoreLabel = score >= 70 ? "Fırsat" : score >= 50 ? "Ortalama" : "Pahalı";

  const g2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 };
  const g3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 3px", color: "#111" }}>Pazar Karşılaştırma</h2>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>İlan bilgilerini gir, portföyünle karşılaştır</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ fontSize: 13, padding: "7px 16px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>
          + İlan ekle
        </button>
      </div>

      {listings.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Henüz ilan eklenmedi</div>
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>Sahibinden veya Zingat'ta gördüğün bir ilanın bilgilerini gir,<br />portföyündeki benzer mülklerle otomatik karşılaştır.</p>
          <button onClick={() => setShowForm(true)} style={{ fontSize: 13, padding: "8px 20px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>
            İlk ilanı ekle
          </button>
        </div>
      )}

      {showForm && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Yeni ilan bilgileri</h3>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20 }}>✕</button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <FL>Kaynak</FL>
            <SEL value={form.source} onChange={e => set("source", e.target.value)} options={["sahibinden", "zingat", "hepsiemlak", "diğer"]} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FL>İlan başlığı (opsiyonel)</FL>
            <INP value={form.title} onChange={e => set("title", e.target.value)} placeholder="ör. Kadıköy Moda 3+1 Satılık" />
          </div>

          <div style={g2}>
            <div><FL>Mülk tipi</FL><SEL value={form.property_type} onChange={e => set("property_type", e.target.value)} options={["daire", "villa", "dükkan", "arsa", "ofis"]} /></div>
            <div><FL>Oda sayısı</FL><SEL value={form.room_count} onChange={e => set("room_count", e.target.value)} options={["studio", "1+1", "2+1", "3+1", "4+1", "5+1", "—"]} /></div>
          </div>

          <div style={g2}>
            <div><FL>Şehir</FL><INP value={form.city} onChange={e => set("city", e.target.value)} placeholder="İstanbul" /></div>
            <div><FL>İlçe *</FL><INP value={form.district} onChange={e => set("district", e.target.value)} placeholder="Kadıköy" /></div>
          </div>

          <div style={g3}>
            <div><FL>Net m²</FL><INP value={form.net_m2} onChange={e => set("net_m2", e.target.value)} placeholder="115" type="number" /></div>
            <div><FL>Kat</FL><INP value={form.floor} onChange={e => set("floor", e.target.value)} placeholder="4" type="number" /></div>
            <div><FL>Bina yaşı</FL><INP value={form.building_age} onChange={e => set("building_age", e.target.value)} placeholder="12" type="number" /></div>
          </div>

          <div style={g2}>
            <div><FL>Satış fiyatı (₺) *</FL><INP value={form.sale_price} onChange={e => set("sale_price", e.target.value)} placeholder="9500000" type="number" /></div>
            <div><FL>İstenen kira (₺)</FL><INP value={form.monthly_rent} onChange={e => set("monthly_rent", e.target.value)} placeholder="32000" type="number" /></div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <FL>Notlar</FL>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="İlan hakkında notlar..."
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "8px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>İptal</button>
            <button onClick={handleAdd} style={{ background: "#1e3a5f", color: "#fff", border: "none", padding: "8px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Karşılaştır</button>
          </div>
        </div>
      )}

      {listings.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {listings.map(l => (
            <button key={l.id} onClick={() => setSelectedListing(l.id)}
              style={{ fontSize: 12, padding: "6px 14px", fontWeight: selectedListing === l.id ? 700 : 400, background: selectedListing === l.id ? "#1e3a5f" : "#fff", color: selectedListing === l.id ? "#fff" : "#374151", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer" }}>
              {l.title || `${l.district} ${l.room_count}`}
              <span onClick={e => { e.stopPropagation(); setListings(prev => prev.filter(x => x.id !== l.id)); if (selectedListing === l.id) setSelectedListing(null); }}
                style={{ marginLeft: 6, color: selectedListing === l.id ? "#93c5fd" : "#9ca3af", fontWeight: 700 }}>✕</span>
            </button>
          ))}
        </div>
      )}

      {activeListing && (
        <div style={{ display: "grid", gridTemplateColumns: similarProperties.length > 0 ? "minmax(0,1fr) 340px" : "1fr", gap: "1.25rem" }}>
          <div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: "1.25rem" }}>
              <div style={{ padding: "12px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{activeListing.title || `${activeListing.district} ${activeListing.room_count} ${activeListing.property_type}`}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{activeListing.source} · {activeListing.district}, {activeListing.city} · {activeListing.net_m2} m² · Bina yaşı {activeListing.building_age}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 1, background: "#f3f4f6" }}>
                {[
                  ["Satış fiyatı", `₺${fmt(activeListing.sale_price)}`],
                  ["Kira/ay", activeListing.monthly_rent ? `₺${fmt(activeListing.monthly_rent)}` : "—"],
                  ["m² fiyatı", activeListing.net_m2 ? `₺${fmt(Math.round(activeListing.sale_price / activeListing.net_m2))}` : "—"],
                  ["Brüt getiri", marketAnalysis?.gross > 0 ? `%${marketAnalysis.gross.toFixed(2)}` : "—"],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: "#fff", padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#111", fontFamily: "monospace" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {avgPortfolio && marketAnalysis && (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 80px", padding: "8px 16px", background: "#f9fafb", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", gap: 8, borderBottom: "1px solid #e5e7eb" }}>
                  <div>Metrik</div>
                  <div>Bu ilan</div>
                  <div>Portföy ort.</div>
                  <div style={{ textAlign: "right" }}>Fark</div>
                </div>
                <CompareRow label="Satış fiyatı" marketVal={activeListing.sale_price} portfolioVal={avgPortfolio.sale_price} format="currency" higherIsBetter={false} />
                <CompareRow label="m² birim fiyatı" marketVal={marketAnalysis.ppm2} portfolioVal={avgPortfolio.ppm2} format="currency" higherIsBetter={false} />
                {activeListing.monthly_rent > 0 && <>
                  <CompareRow label="Aylık kira" marketVal={activeListing.monthly_rent} portfolioVal={avgPortfolio.monthly_rent} format="currency" higherIsBetter={true} />
                  <CompareRow label="Brüt getiri" marketVal={marketAnalysis.gross} portfolioVal={avgPortfolio.gross} format="percent" higherIsBetter={true} />
                  <CompareRow label="Geri ödeme" marketVal={marketAnalysis.payback} portfolioVal={avgPortfolio.payback} format="year" higherIsBetter={false} />
                </>}
              </div>
            )}

            {similarProperties.length === 0 && (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "2rem", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Portföyde benzer mülk yok</div>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                  {activeListing.district} ilçesinde veya aynı tipte mülk bulunamadı.<br />
                  Portföye benzer mülk ekleyerek karşılaştırma yapabilirsin.
                </p>
              </div>
            )}
          </div>

          {similarProperties.length > 0 && (
            <div>
              {score !== null && (
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "1.25rem", marginBottom: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Fırsat Skoru</div>
                  <ScoreMeter score={score} label={scoreLabel} />
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 12, lineHeight: 1.6 }}>
                    {score >= 70
                      ? "Portföyündeki benzer mülklere göre bu ilan fiyat olarak avantajlı görünüyor."
                      : score >= 50
                      ? "Piyasa ortalamasına yakın bir fiyatlandırma. Müzakere yapılabilir."
                      : "Portföyündeki benzer mülklere göre bu ilan pahalı. Fiyat indirimi talep edilebilir."}
                  </p>
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                Portföydeki Benzer Mülkler ({similarProperties.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {similarProperties.map(p => <SimilarPropertyCard key={p.id} p={p} marketListing={activeListing} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
