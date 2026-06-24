// Supabase Edge Function: read-meters
// 收電表照片(base64),用 Claude 視覺辨識「房號 + 讀數」,回傳 JSON。
// ANTHROPIC_API_KEY 存在 Supabase Secrets,絕不外洩到前端。
// 預設只有登入者能呼叫(Supabase 預設驗證 JWT)。
import Anthropic from "npm:@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });

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
只輸出 JSON,不要任何其他文字、不要 markdown 程式碼框。格式:
{"readings":[{"room":"201","raw":"172083","reading":17208}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "no images" }), {
        status: 400, headers: { ...CORS, "content-type": "application/json" },
      });
    }
    const content: unknown[] = images.map((img: { media_type: string; data: string }) => ({
      type: "image",
      source: { type: "base64", media_type: img.media_type, data: img.data },
    }));
    content.push({ type: "text", text: PROMPT });

    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      // deno-lint-ignore no-explicit-any
      messages: [{ role: "user", content: content as any }],
    });

    // deno-lint-ignore no-explicit-any
    const textBlock = msg.content.find((b: any) => b.type === "text") as any;
    let out: string = textBlock?.text ?? "{}";
    out = out.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(); // 去掉可能的程式碼圍欄
    return new Response(out, { headers: { ...CORS, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
