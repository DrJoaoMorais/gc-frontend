// No audio, clinical text, credentials or upstream responses are written to logs.
//
// Transcrição LITERAL apenas — sem raciocínio clínico, sem IA a melhorar/completar
// texto, sem json_schema, sem CLINICAL_STYLE_JM. Recebe um segmento de áudio,
// devolve só { text }. O áudio nunca é guardado (nem aqui, nem em Storage/BD) —
// só é reencaminhado para a API de transcrição e depois esquecido.
const TRANSCRIBE_MODEL = 'gpt-transcribe'; // trocar aqui para comparar (ex.: gpt-4o-transcribe)
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB — limite da API de transcrição da OpenAI

export function createHandler({ env, fetchImpl = fetch }) {
  return async req => {
    const origin = req.headers.get('origin') || '';
    const allowed = ['https://gc.joaomorais.pt', 'http://127.0.0.1:8766'].includes(origin);
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowed ? origin : 'https://gc.joaomorais.pt', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowed) return reply({ error: 'Origem não permitida.' }, 403);
    if (req.method === 'OPTIONS') return new Response('ok', { headers });
    if (req.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405);
    const auth = req.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(auth)) return reply({ error: 'Inicia sessão.' }, 401);
    try {
      const url = env('SUPABASE_URL'), anon = env('SUPABASE_ANON_KEY');
      const authHeaders = { Authorization: auth, apikey: anon };
      const userRes = await fetchImpl(`${url}/auth/v1/user`, { headers: authHeaders, signal: AbortSignal.timeout(10000) });
      const user = userRes.ok ? await userRes.json() : null;
      if (!user?.id || user.is_anonymous) return reply({ error: 'Sessão inválida.' }, 401);
      const membership = await fetchImpl(`${url}/rest/v1/clinic_members?select=clinic_id&user_id=eq.${encodeURIComponent(user.id)}&role=in.(medico,super_admin)&limit=1`, { headers: authHeaders, signal: AbortSignal.timeout(10000) });
      const members = membership.ok ? await membership.json() : [];
      if (!Array.isArray(members) || !members.length) return reply({ error: 'Acesso reservado ao médico.' }, 403);

      const contentLength = Number(req.headers.get('content-length') || 0);
      if (contentLength > MAX_AUDIO_BYTES) return reply({ error: 'Segmento de áudio demasiado grande (máximo 25 MB).' }, 413);

      let form;
      try { form = await req.formData(); } catch { return reply({ error: 'Pedido inválido.' }, 400); }
      const audio = form.get('audio');
      if (!audio || typeof audio.arrayBuffer !== 'function') return reply({ error: 'Áudio em falta.' }, 400);
      if (audio.size > MAX_AUDIO_BYTES) return reply({ error: 'Segmento de áudio demasiado grande (máximo 25 MB).' }, 413);
      if (!audio.size) return reply({ error: 'Áudio vazio.' }, 400);

      const key = env('OPENAI_API_KEY');
      if (!key) return reply({ error: 'A chave OpenAI ainda não está configurada no servidor.' }, 503);

      const filename = (audio.name && /\.[a-z0-9]+$/i.test(audio.name)) ? audio.name : 'segment.webm';
      const upstreamForm = new FormData();
      upstreamForm.set('file', audio, filename);
      upstreamForm.set('model', TRANSCRIBE_MODEL);
      upstreamForm.set('language', 'pt');
      upstreamForm.set('response_format', 'json');

      const result = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(90000),
        body: upstreamForm
      });
      if (!result.ok) return reply({ error: result.status === 429 ? 'A OpenAI está temporariamente indisponível ou sem saldo.' : 'Não foi possível transcrever este segmento.' }, result.status === 429 ? 429 : 502);
      const data = await result.json();
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      if (!text) return reply({ error: 'A transcrição devolvida está vazia.' }, 502);
      return reply({ text, provider: 'openai', model: TRANSCRIBE_MODEL });
    } catch {
      return reply({ error: 'Não foi possível concluir a transcrição.' }, 502);
    }
  };
}
