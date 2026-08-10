// Ritmo — sempre min:seg no ecrã, nunca decimal, nunca guardado como texto livre
// (unidade interna é segundos por quilómetro). Partilhado entre prescricao.js e
// doente.js (perfis de zonas de treino, Fase 1 — spec-zonas-treino.md) para não
// haver duas implementações a divergir.
export function fmtPaceEditavel(sec) {
  if (sec == null) return '';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function parsePaceParaSegundos(txt) {
  const m = String(txt || '').trim().match(/^(\d+):(\d{1,2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Regra de conversão obrigatória (spec-zonas-treino.md, Fase 1): percentagens
// aplicam-se sempre à velocidade, nunca directamente ao ritmo em min/km — ritmos
// mais rápidos têm números menores, aplicar a percentagem ao valor invertia a relação.
export function velocidadeKmhParaPaceSegKm(kmh) {
  if (kmh == null || !Number.isFinite(kmh) || kmh <= 0) return null;
  return Math.round(3600 / kmh);
}

export function paceSegKmParaVelocidadeKmh(sec) {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  return 3600 / sec;
}
