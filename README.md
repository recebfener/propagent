# PropAgent — Kurulum Rehberi

## 1. Gemini API Key Al
1. https://aistudio.google.com adresine git
2. "Get API Key" → "Create API Key" → kopyala

## 2. .env Dosyası Oluştur
Proje klasöründe `.env` adında bir dosya oluştur:
```
VITE_GEMINI_API_KEY=buraya_keyini_yaz
```
⚠️ Bu dosyayı GitHub'a yükleme!

## 3. Çalıştır
```bash
npm install
npm run dev
```
Tarayıcıda → http://localhost:5173

## 4. Kullanım
1. Mülk ekle, kartına tıkla
2. Sağda analiz paneli açılır
3. "✦ AI Analizi Al" → Gemini Türkçe yorum üretir

## Sonraki adımlar
- Supabase veritabanı bağlantısı
- Kullanıcı girişi
- Faz 2: Pazar karşılaştırma
- Faz 3: Agent orkestrası
