// Supabase Edge Function: read-meters
// 收電表照片(base64),用 Google Gemini(免費額度)視覺辨識「房號 + 讀數」,回傳 JSON。
// GEMINI_API_KEY 存在 Supabase Secrets,絕不外洩到前端。
// 預設只有登入者能呼叫(Supabase 預設驗證 JWT)。
// 免費金鑰:Google AI Studio (aistudio.google.com) → Get API key,免信用卡。

const KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODEL = "gemini-2.5-flash"; // 免費額度、支援視覺;不夠快可改 gemini-2.0-flash

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `你是台灣電子式電表讀數辨識助手。
我會給你多張圖片,每張是一個獨立電表,表面貼有「手寫房號標籤」(例如 101、201、303)。
請逐張辨識並回傳:
1. room:讀出手寫房號標籤的數字(字串,如 "201")。
2. raw:電表數字輪由左到右的完整數字(通常 6 位,最後一位常為紅色,代表 0.1 度小數)。
3. reading:整數度數 = raw 去掉最後一位(即前 5 位)轉成整數。例如 raw "208740" → reading 20874;raw "211514" → reading 21151。
看不清楚的值就填 null。
只輸出 JSON,格式:{"readings":[{"room":"201","raw":"172083","reading":17208}]}`;

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!KEY) return json({ error: "GEMINI_API_KEY 未設定" }, 500);
    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0) return json({ error: "no images" }, 400);

    const parts: unknown[] = images.map((img: { media_type: string; data: string }) => ({
      inline_data: { mime_type: img.media_type, data: img.data },
    }));
    parts.push({ text: PROMPT });

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
    );
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message ?? "Gemini 失敗", detail: data }, 502);

    // deno-lint-ignore no-explicit-any
    const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text ?? "").join("").trim();
    const out = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return new Response(out || "{}", { headers: { ...CORS, "content-type": "application/json" } });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
