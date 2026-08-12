import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const ALLOWED_ORIGINS = new Set([
  "https://treino.joaomorais.pt",
  "https://gc.joaomorais.pt",
  "http://127.0.0.1:8765",
  "http://127.0.0.1:8766",
]);
const corsFor = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://gc.joaomorais.pt",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
};
const BUCKET = "wo-session-images";
const MAX_IMAGE = 2 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

serve(async (req) => {
  const cors = corsFor(req);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceKey) return reply({ error: "serviço indisponível" }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const form = await req.formData();
    const action = String(form.get("action") || "upload");

    if (action === "list") {
      const authHeader = req.headers.get("authorization") ?? "";
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData.user) return reply({ error: "não autenticado" }, 401);
      const prescriptionId = String(form.get("prescription_id") || "");
      const { data: permitted } = await userClient.from("wo_prescriptions").select("id").eq("id", prescriptionId).maybeSingle();
      if (!permitted) return reply({ error: "sem acesso" }, 403);
      const { data: images, error } = await admin.from("wo_session_images")
        .select("id,session_id,storage_path,byte_size,mime_type,created_at")
        .eq("prescription_id", prescriptionId).eq("status", "ready").order("created_at");
      if (error) throw error;
      const output = await Promise.all((images || []).map(async (image) => {
        const signed = await admin.storage.from(BUCKET).createSignedUrl(image.storage_path, 600);
        return { ...image, signed_url: signed.data?.signedUrl || null };
      }));
      return reply({ ok: true, images: output });
    }

    const token = String(form.get("token") || "");
    const sessionId = String(form.get("session_id") || "");
    const file = form.get("file");
    if (!(file instanceof File) || !token || !sessionId) return reply({ error: "pedido incompleto" }, 400);
    if (!TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE) return reply({ error: "imagem inválida" }, 400);

    const { data: reserved, error: reserveError } = await admin
      .rpc("wo_reserve_session_image", { p_token: token, p_session_id: sessionId, p_byte_size: file.size, p_mime_type: file.type });
    if (reserveError || !reserved?.[0]) {
      const code = reserveError?.message || "";
      const friendly = code.includes("session_image_limit") ? "Este treino já tem 3 imagens."
        : code.includes("plan_storage_limit") ? "Este plano atingiu o limite de 50 MB."
        : code.includes("invalid_image") ? "A imagem não é válida."
        : "O plano ou a sessão já não são válidos.";
      return reply({ error: friendly }, 400);
    }
    const row = reserved[0];
    const upload = await admin.storage.from(BUCKET).upload(row.storage_path, file, { contentType: file.type, upsert: false });
    if (upload.error) {
      await admin.rpc("wo_cancel_session_image", { p_image_id: row.image_id });
      throw upload.error;
    }
    await admin.rpc("wo_mark_session_image_ready", { p_image_id: row.image_id });
    return reply({ ok: true, image_id: row.image_id });
  } catch (error) {
    console.error("[wo-session-image] pedido falhou");
    return reply({ error: "Não foi possível guardar a imagem." }, 500);
  }
});
