import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getLast6Months() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });
}

function monthLabel(m) {
  const [y, mo] = m.split("-");
  const names = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return `${names[parseInt(mo, 10) - 1]} ${y}`;
}

function fmt(n) { return Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 0 }); }

function getLeaseAlert(leaseEnd) {
  if (!leaseEnd) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(leaseEnd);
  const diff = Math.floor((end - today) / 86400000);
  if (diff < 0) return { type: "expired", days: Math.abs(diff) };
  if (diff <= 30) return { type: "warning", days: diff };
  return null;
}

const SS = {
  paid:    { label: "Ödendi",   color: "#15803d", bg: "#dcfce7", border: "#86efac", dot: "#16a34a" },
  overdue: { label: "Gecikti",  color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "#dc2626" },
  pending: { label: "Bekliyor", color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "#d97706" },
};

function StatusBadge({ status, size = "sm" }) {
  const s = SS[status] || SS.pending;
  const pad = size === "lg" ? "4px 12px" : "2px 9px";
  const fs = size === "lg" ? 12 : 10;
  const dotSize = size === "lg" ? 7 : 5;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: fs, fontWeight: 700, padding: pad, borderRadius: 99 }}>
      <span style={{ width: dotSize, height: dotSize, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

export default function TenantPayments({ properties }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [selectedPropId, setSelectedPropId] = useState(null);

  const occupied = properties.filter(p => p.tenant_status === "active");

  const loadPayments = useCallback(async (ids) => {
    if (!ids.length) { setPayments([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("tenant_payments")
      .select("*")
      .in("property_id", ids)
      .order("month", { ascending: false });
    setPayments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const ids = properties.filter(p => p.tenant_status === "active").map(p => p.id);
    loadPayments(ids);
  }, [properties, loadPayments]);

  const getPayment = (propertyId, month) =>
    payments.find(p => p.property_id === propertyId && p.month === month);

  const setStatus = async (property, month, status) => {
    const key = `${property.id}-${month}`;
    setSaving(key);
    const existing = getPayment(property.id, month);
    if (existing) {
      await supabase.from("tenant_payments").update({
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      }).eq("id", existing.id);
    } else {
      await supabase.from("tenant_payments").insert({
        property_id: property.id,
        month,
        amount: property.monthly_rent,
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      });
    }
    const ids = properties.filter(p => p.tenant_status === "active").map(p => p.id);
    await loadPayments(ids);
    setSaving(null);
  };

  const CURRENT_MONTH = getCurrentMonth();
  const last6 = getLast6Months();
  const selectedProp = properties.find(p => p.id === selectedPropId);

  if (occupied.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 14 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🏘️</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Aktif kiracı yok</div>
        <p style={{ fontSize: 13, color: "#9ca3af" }}>Mülk formunda kiracı durumunu "active" yapın.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111" }}>
          Kiracı Ödeme Takibi
          <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af", marginLeft: 8 }}>({occupied.length} aktif kiracı)</span>
        </h2>
        {loading && <span style={{ fontSize: 12, color: "#9ca3af" }}>Yükleniyor...</span>}
      </div>

      {/* Per-property payment cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12, marginBottom: 20 }}>
        {occupied.map(property => {
          const payment = getPayment(property.id, CURRENT_MONTH);
          const status = payment?.status || "pending";
          const s = SS[status];
          const lease = getLeaseAlert(property.lease_end);
          const savingKey = `${property.id}-${CURRENT_MONTH}`;
          const isSelected = selectedPropId === property.id;

          return (
            <div
              key={property.id}
              onClick={() => setSelectedPropId(isSelected ? null : property.id)}
              style={{
                background: "#fff",
                border: `1px solid ${isSelected ? "#3b82f6" : "#e5e7eb"}`,
                borderLeft: `4px solid ${s.dot}`,
                borderRadius: 12,
                padding: "1rem 1.1rem",
                cursor: "pointer",
                boxShadow: isSelected ? "0 0 0 3px #3b82f622" : "none",
                transition: "box-shadow 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 2 }}>{property.title}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    👤 {property.tenant_name || "—"} · ₺{fmt(property.monthly_rent)}/ay
                  </div>
                </div>
                <StatusBadge status={status} size="lg" />
              </div>

              {/* Lease expiry warning */}
              {lease && (
                <div style={{
                  marginBottom: 10, padding: "6px 10px",
                  background: lease.type === "expired" ? "#fef2f2" : "#fffbeb",
                  border: `1px solid ${lease.type === "expired" ? "#fecaca" : "#fde68a"}`,
                  borderRadius: 7, fontSize: 11, fontWeight: 600,
                  color: lease.type === "expired" ? "#dc2626" : "#d97706",
                }}>
                  {lease.type === "expired"
                    ? `⚠️ Sözleşme ${lease.days} gün önce sona erdi`
                    : `⏳ Sözleşme ${lease.days} gün sonra bitiyor`}
                </div>
              )}

              {/* This month status buttons */}
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                {monthLabel(CURRENT_MONTH)} ödeme durumu
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["paid", "pending", "overdue"].map(st => {
                  const ss = SS[st];
                  const isActive = status === st;
                  return (
                    <button
                      key={st}
                      onClick={e => { e.stopPropagation(); if (!isActive) setStatus(property, CURRENT_MONTH, st); }}
                      disabled={saving === savingKey}
                      style={{
                        flex: 1, fontSize: 11, fontWeight: isActive ? 700 : 400,
                        padding: "5px 0", borderRadius: 7,
                        cursor: saving === savingKey || isActive ? "default" : "pointer",
                        background: isActive ? ss.bg : "#f9fafb",
                        color: isActive ? ss.color : "#6b7280",
                        border: `1px solid ${isActive ? ss.border : "#e5e7eb"}`,
                        transition: "all 0.15s",
                      }}
                    >
                      {ss.label}
                    </button>
                  );
                })}
              </div>

              {property.lease_end && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                  Sözleşme:{" "}
                  {property.lease_start ? property.lease_start.slice(0, 7) : "?"} — {property.lease_end.slice(0, 7)}
                </div>
              )}

              <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 8, fontWeight: 600 }}>
                {isSelected ? "▲ Geçmişi gizle" : "▼ Ödeme geçmişini gör"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment history table for selected property */}
      {selectedProp && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{selectedProp.title} — Ödeme Geçmişi</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Son 6 ay · 👤 {selectedProp.tenant_name || "—"}</div>
            </div>
            <button onClick={() => setSelectedPropId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20 }}>✕</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.4fr", padding: "8px 16px", background: "#f9fafb", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", gap: 8 }}>
            {["Ay", "Tutar", "Durum", "İşlem / Tarih"].map(h => <div key={h}>{h}</div>)}
          </div>

          {last6.map(month => {
            const payment = getPayment(selectedProp.id, month);
            const status = payment?.status || "pending";
            const key = `${selectedProp.id}-${month}`;
            const isCurrent = month === CURRENT_MONTH;
            return (
              <div key={month} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.4fr", padding: "10px 16px", borderTop: "1px solid #f3f4f6", fontSize: 12, alignItems: "center", gap: 8, background: isCurrent ? "#fafbff" : "transparent" }}>
                <div style={{ fontWeight: isCurrent ? 700 : 400 }}>
                  {monthLabel(month)}
                  {isCurrent && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: "#3b82f6", fontWeight: 700, background: "#eff6ff", border: "1px solid #bfdbfe", padding: "1px 6px", borderRadius: 99 }}>bu ay</span>
                  )}
                </div>
                <div style={{ fontFamily: "monospace" }}>₺{fmt(payment?.amount ?? selectedProp.monthly_rent)}</div>
                <div><StatusBadge status={status} /></div>
                <div>
                  {payment?.paid_at ? (
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{payment.paid_at.slice(0, 10)}</span>
                  ) : (
                    <div style={{ display: "flex", gap: 4 }}>
                      {["paid", "overdue"].map(st => (
                        <button
                          key={st}
                          onClick={() => setStatus(selectedProp, month, st)}
                          disabled={saving === key}
                          style={{
                            fontSize: 10, padding: "3px 8px", borderRadius: 5, fontWeight: 600,
                            cursor: saving === key ? "not-allowed" : "pointer",
                            background: SS[st].bg, color: SS[st].color, border: `1px solid ${SS[st].border}`,
                          }}
                        >
                          {SS[st].label}
                        </button>
                      ))}
                      {payment && payment.status !== "pending" && (
                        <button
                          onClick={() => setStatus(selectedProp, month, "pending")}
                          disabled={saving === key}
                          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, fontWeight: 600, cursor: saving === key ? "not-allowed" : "pointer", background: "#f9fafb", color: "#6b7280", border: "1px solid #e5e7eb" }}
                        >
                          Sıfırla
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
