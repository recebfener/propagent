import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./lib/supabase";

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const CURRENT_YEAR = String(new Date().getFullYear());

function getOldestMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().slice(0, 7);
}

function getLast6Months() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  }).reverse();
}

function getAvailableMonths() {
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });
}

function monthLabel(m) {
  const [y, mo] = m.split("-");
  const names = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  return `${names[parseInt(mo, 10) - 1]} ${y}`;
}

function monthLabelShort(m) {
  const [, mo] = m.split("-");
  const names = ["Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return names[parseInt(mo, 10) - 1];
}

function fmt(n) {
  return Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

function calcMonthlyExpense(property) {
  return (property.expenses || []).reduce(
    (s, e) => s + (e.frequency === "monthly" ? e.amount : e.frequency === "yearly" ? e.amount / 12 : 0),
    0
  );
}

function BarChart({ data }) {
  const BAR_W = 40;
  const GAP = 12;
  const H = 90;
  const LABEL_H = 18;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const svgW = data.length * (BAR_W + GAP) - GAP;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${H + LABEL_H}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
    >
      {data.map((d, i) => {
        const x = i * (BAR_W + GAP);
        const barH = Math.max((d.value / maxVal) * H, d.value > 0 ? 3 : 2);
        const y = H - barH;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={BAR_W} height={barH} rx={4}
              fill={d.isCurrent ? "#1e3a5f" : "#bfdbfe"} />
            <text x={x + BAR_W / 2} y={H + LABEL_H - 2}
              textAnchor="middle" fontSize={9} fill="#9ca3af">
              {d.label}
            </text>
            {d.value > 0 && (
              <text x={x + BAR_W / 2} y={y - 4}
                textAnchor="middle" fontSize={8} fill="#6b7280">
                {d.value >= 10000 ? `${Math.round(d.value / 1000)}K` : fmt(d.value)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function FinancialPanel({ properties }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);

  const propertyIds = useMemo(() => properties.map(p => p.id), [properties]);

  useEffect(() => {
    if (!propertyIds.length) { setPayments([]); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("tenant_payments")
      .select("*")
      .in("property_id", propertyIds)
      .gte("month", getOldestMonth())
      .order("month", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) { setPayments(data || []); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [propertyIds]);

  const last6Months = useMemo(() => getLast6Months(), []);
  const availableMonths = useMemo(() => getAvailableMonths(), []);
  const activeProperties = useMemo(() => properties.filter(p => p.tenant_status === "active"), [properties]);

  const getPaidIncome = useCallback((month) =>
    payments.filter(p => p.month === month && p.status === "paid")
      .reduce((s, p) => s + (p.amount || 0), 0),
    [payments]
  );

  const thisMonthIncome = useMemo(() => getPaidIncome(CURRENT_MONTH), [getPaidIncome]);

  const thisYearIncome = useMemo(() =>
    payments.filter(p => p.month.startsWith(CURRENT_YEAR) && p.status === "paid")
      .reduce((s, p) => s + (p.amount || 0), 0),
    [payments]
  );

  const monthlyExpenses = useMemo(() =>
    activeProperties.reduce((s, p) => s + calcMonthlyExpense(p), 0),
    [activeProperties]
  );

  const netMonthly = thisMonthIncome - monthlyExpenses;

  const chartData = useMemo(() =>
    last6Months.map(month => ({
      label: monthLabelShort(month),
      value: getPaidIncome(month),
      isCurrent: month === CURRENT_MONTH,
    })),
    [last6Months, getPaidIncome]
  );

  const selectedMonthData = useMemo(() => {
    const monthPayments = payments.filter(p => p.month === selectedMonth);
    return activeProperties.map(prop => {
      const payment = monthPayments.find(p => p.property_id === prop.id);
      const expense = calcMonthlyExpense(prop);
      const income = payment?.status === "paid" ? (payment.amount || prop.monthly_rent) : 0;
      return { property: prop, income, expense, net: income - expense, status: payment?.status || "pending" };
    });
  }, [payments, selectedMonth, activeProperties]);

  const totals = useMemo(() => ({
    income: selectedMonthData.reduce((s, d) => s + d.income, 0),
    expense: selectedMonthData.reduce((s, d) => s + d.expense, 0),
    net: selectedMonthData.reduce((s, d) => s + d.net, 0),
  }), [selectedMonthData]);

  const downloadPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const rows = selectedMonthData.map(d => {
      const sl = { paid: "✓ Ödendi", overdue: "✗ Gecikti", pending: "⏳ Bekliyor" };
      return `<tr>
        <td>${d.property.title}</td>
        <td>${d.property.district}</td>
        <td class="num">₺${fmt(d.income)}</td>
        <td class="num">₺${fmt(Math.round(d.expense))}</td>
        <td class="num" style="color:${d.net >= 0 ? "#15803d" : "#dc2626"}">₺${fmt(Math.round(d.net))}</td>
        <td class="ctr">${sl[d.status] || sl.pending}</td>
      </tr>`;
    }).join("");

    win.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>PropAgent — ${monthLabel(selectedMonth)} Raporu</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:40px;font-size:13px}
    .header{display:flex;align-items:center;gap:14px;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #1e3a5f}
    .logo{width:48px;height:48px;background:#1e3a5f;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:26px}
    .title{font-size:22px;font-weight:700;color:#1e3a5f}
    .subtitle{font-size:13px;color:#6b7280;margin-top:2px}
    .cards{display:flex;gap:12px;margin-bottom:24px}
    .card{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px}
    .clabel{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
    .cval{font-size:20px;font-weight:700}
    .green{color:#15803d}.red{color:#dc2626}.orange{color:#d97706}
    table{width:100%;border-collapse:collapse}
    th{background:#f9fafb;padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e5e7eb}
    td{padding:10px 12px;border-bottom:1px solid #f3f4f6}
    .num{text-align:right;font-family:monospace}
    .ctr{text-align:center}
    tfoot td{font-weight:700;background:#f9fafb;border-top:2px solid #1e3a5f}
    .footer{margin-top:32px;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:12px}
    @media print{body{padding:20px}@page{margin:1.5cm}}
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏢</div>
    <div>
      <div class="title">PropAgent</div>
      <div class="subtitle">Gelir / Gider Raporu — ${monthLabel(selectedMonth)}</div>
    </div>
  </div>
  <div class="cards">
    <div class="card"><div class="clabel">Tahsil Edilen Gelir</div><div class="cval green">₺${fmt(totals.income)}</div></div>
    <div class="card"><div class="clabel">Toplam Gider</div><div class="cval orange">₺${fmt(Math.round(totals.expense))}</div></div>
    <div class="card"><div class="clabel">Net Gelir</div><div class="cval ${totals.net >= 0 ? "green" : "red"}">₺${fmt(Math.round(totals.net))}</div></div>
    <div class="card"><div class="clabel">Aktif Kiracı</div><div class="cval">${activeProperties.length}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Mülk</th><th>İlçe</th>
        <th style="text-align:right">Gelir</th>
        <th style="text-align:right">Gider</th>
        <th style="text-align:right">Net</th>
        <th style="text-align:center">Durum</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="2">TOPLAM</td>
        <td class="num green">₺${fmt(totals.income)}</td>
        <td class="num orange">₺${fmt(Math.round(totals.expense))}</td>
        <td class="num ${totals.net >= 0 ? "green" : "red"}">₺${fmt(Math.round(totals.net))}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">PropAgent · Oluşturma tarihi: ${new Date().toLocaleString("tr-TR")} · Bu rapor PropAgent platformu tarafından otomatik oluşturulmuştur.</div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
</body>
</html>`);
    win.document.close();
  };

  if (properties.length === 0) return null;

  const statusStyles = {
    paid: { color: "#15803d", bg: "#dcfce7", label: "Ödendi" },
    overdue: { color: "#dc2626", bg: "#fef2f2", label: "Gecikti" },
    pending: { color: "#d97706", bg: "#fffbeb", label: "Bekliyor" },
  };

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#111" }}>Finansal Özet</h2>
        {loading && <span style={{ fontSize: 12, color: "#9ca3af" }}>Yükleniyor...</span>}
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["💵", "Bu ay gelir", `₺${fmt(thisMonthIncome)}`, "tahsil edildi", "#10b981"],
          ["📅", "Bu yıl gelir", `₺${fmt(thisYearIncome)}`, CURRENT_YEAR, "#8b5cf6"],
          ["📉", "Aylık gider", `₺${fmt(Math.round(monthlyExpenses))}`, "aktif mülkler", "#f59e0b"],
          ["📊", "Net bu ay", `₺${fmt(Math.round(netMonthly))}`, netMonthly >= 0 ? "kâr" : "zarar", netMonthly >= 0 ? "#10b981" : "#dc2626"],
        ].map(([icon, label, value, sub, accent]) => (
          <div key={label} style={{ background: "#fff", borderRadius: 12, padding: "1rem 1.1rem", border: "1px solid #e5e7eb", borderTop: `3px solid ${accent}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>{icon} {label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>{value}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Chart + month selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem 1.2rem" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Son 6 Ay — Tahsil Edilen Kira</div>
          <BarChart data={chartData} />
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#9ca3af" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#1e3a5f", display: "inline-block" }} />Bu ay</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#bfdbfe", display: "inline-block" }} />Geçmiş aylar</span>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem 1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Ay Detayı</div>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ fontSize: 12, padding: "5px 8px", border: "1px solid #e5e7eb", borderRadius: 7, outline: "none" }}
            >
              {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["Tahsil Edilen", `₺${fmt(totals.income)}`, "#10b981"],
              ["Toplam Gider", `₺${fmt(Math.round(totals.expense))}`, "#f59e0b"],
              ["Net Gelir", `₺${fmt(Math.round(totals.net))}`, totals.net >= 0 ? "#10b981" : "#dc2626"],
            ].map(([label, value, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f9fafb", borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</span>
              </div>
            ))}
          </div>
          <button
            onClick={downloadPDF}
            style={{ width: "100%", marginTop: 12, padding: "9px 0", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            📄 PDF İndir — {monthLabel(selectedMonth)}
          </button>
        </div>
      </div>

      {/* Per-property income/expense table */}
      {activeProperties.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{monthLabel(selectedMonth)} — Mülk Bazlı Özet</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "8px 16px", background: "#f9fafb", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", gap: 8 }}>
            {["Mülk", "Gelir", "Gider", "Net", "Durum"].map(h => <div key={h}>{h}</div>)}
          </div>
          {selectedMonthData.map(({ property, income, expense, net, status }) => {
            const ss = statusStyles[status] || statusStyles.pending;
            return (
              <div key={property.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 16px", borderTop: "1px solid #f3f4f6", fontSize: 12, gap: 8, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{property.title}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{property.district}</div>
                </div>
                <div style={{ fontFamily: "monospace", color: "#10b981", fontWeight: 600 }}>₺{fmt(income)}</div>
                <div style={{ fontFamily: "monospace", color: "#f59e0b" }}>₺{fmt(Math.round(expense))}</div>
                <div style={{ fontFamily: "monospace", fontWeight: 700, color: net >= 0 ? "#10b981" : "#dc2626" }}>₺{fmt(Math.round(net))}</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: ss.bg, color: ss.color, display: "inline-block" }}>{ss.label}</span>
              </div>
            );
          })}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 16px", borderTop: "2px solid #e5e7eb", fontSize: 12, gap: 8, fontWeight: 700, background: "#f9fafb" }}>
            <div>TOPLAM</div>
            <div style={{ fontFamily: "monospace", color: "#10b981" }}>₺{fmt(totals.income)}</div>
            <div style={{ fontFamily: "monospace", color: "#f59e0b" }}>₺{fmt(Math.round(totals.expense))}</div>
            <div style={{ fontFamily: "monospace", color: totals.net >= 0 ? "#10b981" : "#dc2626" }}>₺{fmt(Math.round(totals.net))}</div>
            <div />
          </div>
        </div>
      )}
    </div>
  );
}
