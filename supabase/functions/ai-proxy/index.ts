import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { prompt, mode } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: "prompt" }), { status: 400, headers: CORS });
    const PROMPTS = {
      optimizar: `És um médico fisiatra português. Optimiza este texto de anamnese clínica. Mantém todos os factos. Devolve apenas o texto.\n\n${prompt}`,
      junta: `És um médico perito português. Reescreve para relatório de junta médica, linguagem pericial formal portuguesa. Devolve apenas o texto.\n\n${prompt}`,
      tribunal: `És um médico perito português. Reescreve para relatório pericial para tribunal, linguagem técnico-jurídica, TNI quando aplicável. Devolve apenas o texto.\n\n${prompt}`,
    };
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {"Content-Type":"application/json","x-api-key":Deno.env.get("ANTHROPIC_API_KEY")??"","anthropic-version":"2023-06-01"},
      body: JSON.stringify({ model: "claude-opus-4-6", max_tokens: 1024, messages: [{ role: "user", content: PROMPTS[mode] || PROMPTS.optimizar }] }),
    });
    const data = await resp.json();
    const text = data?.content?.[0]?.text ?? "";
    return new Response(JSON.stringify({ text }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
