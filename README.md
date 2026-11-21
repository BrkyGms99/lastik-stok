# Lastik Stok

Lastikçi için stok, satış, randevu ve sipariş uygulaması. Telefona uygulama gibi kurulur, iki kişi aynı veriyi canlı görür.

## Nasıl çalışır

- Sayfa: `index.html` (tek dosya, derleme yok)
- Veri: Supabase (ücretsiz katman). Tüm kayıtlar `records` tablosunda durur.
- Giriş: e-posta ve şifre. Sadece `allowed_users` tablosundaki adresler veriyi okuyup yazabilir.
- Yayın: GitHub Pages

## Kurulum

### 1. Supabase projesi

1. https://supabase.com → **New project**. Bölge olarak Frankfurt (eu-central-1) seç, güçlü bir veri tabanı şifresi belirle.
2. Sol menü **SQL Editor** → **New query** → `schema.sql` dosyasının içeriğini yapıştır → **Run**.
   Dosyanın sonundaki iki e-posta adresini kendininkilerle değiştirmeyi unutma.
3. **Authentication → Providers → Email**: "Confirm email" seçeneğini kapat.
4. **Authentication → Sign In / Providers** (veya Settings) bölümünde yeni kayıtları kapat ("Allow new users to sign up" kapalı olsun).
5. **Authentication → Users → Add user → Create new user**: kendin ve Berat için birer kullanıcı oluştur (e-posta + şifre, "Auto confirm" açık).
6. **Project Settings → API**: **Project URL** ve **anon public** anahtarını kopyala.

### 2. Bağlantı bilgisini yaz

`config.js` dosyasındaki iki değeri 1. adımdaki Project URL ve anon anahtarla değiştir.
Bu iki değer gizli değildir. Verinin güvenliğini veri tabanındaki erişim kuralları sağlar.

### 3. GitHub Pages ile yayınla

Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `(root)` → **Save**.
Bir iki dakika sonra adres `https://KULLANICIADIN.github.io/lastik-stok/` olur.

### 4. Telefona kur

- iPhone: Safari'de adresi aç → Paylaş → **Ana Ekrana Ekle**
- Android: Chrome'da adresi aç → ⋮ → **Ana ekrana ekle / Uygulamayı yükle**

## Bilmen gerekenler

- Veriyi yazmak için internet gerekir. İnternet yokken uygulama açılır ama liste yüklenmez.
- Bir kişiyi eklemek veya çıkarmak için Supabase'de hem Authentication → Users'a kullanıcı ekle hem de `allowed_users` tablosuna e-postasını yaz.
- Yedek için sayfanın altındaki **Yedek indir** düğmesini kullan.
