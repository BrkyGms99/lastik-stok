// Lastik yan yüzü fotoğrafını okur ve ebat, marka, model, mevsim bilgisini JSON döndürür.
// Sadece giriş yapmış VE allowed_users listesindeki kişiler kullanabilir.
// Gerekli gizli değer (Edge Functions → Secrets): ANTHROPIC_API_KEY
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5-5";
const MAX_BASE64 = 6_000_000; // yaklaşık 4,5 MB görüntü
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `Bu fotoğraf bir otomobil lastiğinin yan yüzünü gösteriyor. Üzerindeki yazılardan şu bilgileri oku.
Net okuyamadığın veya emin olmadığın alanı null bırak, ASLA tahmin etme.

Sadece tek bir JSON nesnesi döndür, başka hiçbir metin yazma:
{
  "size": "205/55 R16",        // genişlik/profil + R + jant. ZR veya R yazıyorsa hep "R" kullan. Örnek: 205/55ZR16 -> "205/55 R16"
  "load_speed": "91V",         // yük endeksi ve hız sembolü, yoksa null
  "brand": "Michelin",         // marka, yoksa null
  "model": "Primacy 4",        // model adı, yoksa null
  "season": "Yaz",             // "Yaz", "Kış", "4 Mevsim" veya null
  "dot": "2423",               // DOT kodunun sonundaki 4 hane (hafta+yıl), yoksa null
  "confidence": "high"         // "high", "medium" veya "low"
}

Mevsim kuralı: Dağ ve kar tanesi sembolü (3PMSF) varsa ve model adında All Season / 4Season / CrossClimate / Vector 4Seasons gibi bir ifade geçiyorsa "4 Mevsim", geçmiyorsa "Kış".
Sadece M+S yazıyorsa ve başka ipucu yoksa null bırak. Hiçbir ipucu yoksa null bırak, yaz diye varsayma.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  try {
    // 1) Kim çağırıyor? Giriş yapmış ve izinli listede olmalı.
    const auth = req.headers.get("Authorization") ?? "";
    const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, apikey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "auth" }, 401);
    const { data: allowed } = await sb.rpc("is_allowed");
    if (!allowed) return json({ error: "forbidden" }, 403);

    // 2) Görüntüyü doğrula
    const body = await req.json();
    const image = String(body?.image ?? "");
    const mediaType = String(body?.media_type ?? "image/jpeg");
    if (!image || image.length > MAX_BASE64) return json({ error: "image" }, 400);
    if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
      return json({ error: "media_type" }, 400);
    }

    // 3) Claude'a okut
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "not_configured" }, 500);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });
    if (!r.ok) return json({ error: "upstream", status: r.status }, 502);
    const out = await r.json();
    const text: string = out?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: "parse" }, 502);
    const raw = JSON.parse(m[0]);

    // 4) Temizle: sadece beklediğimiz alanlar, makul uzunluklarda
    const str = (v: unknown, n = 60) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
    const seasons = ["Yaz", "Kış", "4 Mevsim"];
    const size = str(raw.size, 20)?.toUpperCase().replace(/Z?R/, " R").replace(/\s+/g, " ").replace("/ ", "/") ?? null;
    return json({
      size: size && /^\d{3}\/\d{2} R\d{2}/.test(size) ? size : null,
      load_speed: str(raw.load_speed, 10),
      brand: str(raw.brand),
      model: str(raw.model),
      season: seasons.includes(raw.season) ? raw.season : null,
      dot: typeof raw.dot === "string" && /^\d{4}$/.test(raw.dot.trim()) ? raw.dot.trim() : null,
      confidence: ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "low",
    });
  } catch (_e) {
    return json({ error: "server" }, 500);
  }
});
