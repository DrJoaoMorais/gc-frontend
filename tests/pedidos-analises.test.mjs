import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../modules/pedidos/pedidos-v2.js', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../modules/pedidos/analises-catalog-v2.js', import.meta.url), 'utf8').replaceAll('export const ', 'const ');
const start = source.indexOf('  function getAnalisesByGroupForSelected()');
const end = source.indexOf('  /* ---- PDF: assets partilhados', start);
const context = vm.createContext({});
vm.runInContext(`${catalog}
  const state = {analises:{selected:new Set(),clinicalInfo:''}};
  const escHtml = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  ${source.slice(start, end)}
  globalThis.run = (names, clinicalInfo = '') => {
    state.analises.selected = new Set(names);
    state.analises.clinicalInfo = clinicalInfo;
    return buildAnalisesDocBodyHtml();
  };
  globalThis.profiles = ANALISES_PERFIS.flatMap(p => p.submenu || [p]);
`, context);

for (const profile of context.profiles) {
  const html = context.run(profile.analises);
  assert.equal((html.match(/<li(?:>| )/g) || []).length, new Set(profile.analises).size, profile.label);
}
const neurology = context.profiles.find(p => p.id === 'neurologico');
assert.ok(neurology);
const html = context.run([...neurology.analises, 'Vitamina B12', 'Vitamina B12'], 'Rotina <script>alert(1)</script>\nRastreio & vigilância');
for (const name of ['Cobre sérico', 'Ceruloplasmina', 'Amónia']) assert.ok(html.includes(name), name);
assert.equal((html.match(/<li[^>]*>Vitamina B12<\/li>/g) || []).length, 1);
assert.ok(html.includes('Informação clínica / motivo do pedido'));
assert.ok(!html.includes('<script>'));
assert.ok(html.includes('&lt;script&gt;'));
assert.ok(html.includes('Rastreio &amp; vigilância'));
assert.ok(!context.run([]).includes('pdv2-analysis-clinical'));
console.log('PASS: todos os perfis completos no PDF, itens fora dos grupos preservados, sem duplicados e informação clínica escapada.');
