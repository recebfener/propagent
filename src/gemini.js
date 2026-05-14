import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export async function analyzeMulk(property, analysis) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
Sen bir Türk gayrimenkul yatırım uzmanısın. Aşağıdaki mülkü analiz et ve Türkçe, kısa ve pratik bir değerlendirme yap.

MÜLK BİLGİLERİ:
- Başlık: ${property.title}
- Konum: ${property.district}, ${property.city}
- Tip: ${property.property_type} / ${property.room_count}
- Alan: ${property.net_m2} m² net, ${property.gross_m2} m² brüt
- Bina yaşı: ${property.building_age} yıl, ${property.floor}. kat / ${property.total_floors} toplam kat
- Satış fiyatı: ${property.sale_price.toLocaleString("tr-TR")} ₺
- Aylık kira: ${property.monthly_rent.toLocaleString("tr-TR")} ₺

FİNANSAL ANALİZ:
- Brüt kira getirisi: %${analysis.gross.toFixed(2)}
- Net kira getirisi: %${analysis.net.toFixed(2)}
- Geri ödeme süresi: ${analysis.payback.toFixed(1)} yıl
- Aylık nakit akışı: ${analysis.cashflow.toFixed(0)} ₺
- m² birim fiyatı: ${analysis.ppm2.toFixed(0)} ₺/m²

Lütfen şunları içeren 4-5 cümlelik bir değerlendirme yap:
1. Getiri oranının Türkiye ortalamasına göre durumu
2. Bu ilçede bu fiyatın mantıklı olup olmadığı
3. Varsa önemli risk faktörleri
4. Kısa net tavsiye: al, tut veya sat

Markdown kullanma. Sadece düz metin yaz.
`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
