import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const utils=readFileSync(new URL('modules/exercicio/prescricao/recomendacoes.js',root),'utf8');
const {normalizarRecomendacoes,recomendacoesParaSessao,renderRecomendacoesFase}=await import('data:text/javascript;base64,'+Buffer.from(utils).toString('base64'));
assert.deepEqual(normalizarRecomendacoes([null,{},' ',{title:'A',text:' B '},' C ']),[{title:'A',text:'B'},{title:'',text:'C'}]);
assert.equal(renderRecomendacoesFase({data:{}}),'');
assert.equal(recomendacoesParaSessao({data:{}}),'');
const fase={id:'f1',name:'Fase',phase_order:1,data:{recomendacoes:[{title:'Ortótese',text:'Horário individual <script>alert(1)</script>'}],recomendacoes_clinicas:[{title:'Nota clínica',text:'Apenas para o médico'}],recomendacoes_imagem:'javascript:alert(1)'}};
const html=renderRecomendacoesFase(fase);
assert.ok(html.includes('&lt;script&gt;'));
assert.ok(!html.includes('<script>')&&!html.includes('src="javascript:'));
assert.ok(!recomendacoesParaSessao(fase).includes('Apenas para o médico'));
const source=readFileSync(new URL('modules/exercicio/prescricao/prescricao.js',root),'utf8');
const extract=(start,end)=>source.slice(source.indexOf('function '+start),source.indexOf('function '+end,source.indexOf('function '+start)));
const originals=[{session_id:'old',notes:'Não alterar',items:[{exercise_id:'previous'}]}];
const oldSnapshot=JSON.stringify(originals);
const ctx=vm.createContext({
 _patologia:{biblioteca:false,protocolos:[{id:'p',name:'De Quervain'}],protocoloId:'p',fases:[fase],faseId:'f1'},
 _state:{patient:{id:'fixture'},startDate:'2026-10-27',sessions:originals},
 _patologiaPendente:null,
 agruparSelecaoPatologiaPorLocal:()=>new Map([['Casa',[{ex:{id:'selected'},info:{}}]]]),
 criarItemPatologia:ex=>({exercise_id:ex.id}),recomendacoesParaSessao,
 novaSessaoSkeleton:()=>({session_id:'new'}),renderStep2:()=>{},renderStep1:()=>{},
 escHtml:x=>String(x??'').replaceAll('<','&lt;'),renderCuidadosEspecificosPatologia:()=>'',
 renderRecomendacoesFase,renderListaExerciciosPatologia:()=>'<div>Lista de exercícios</div>',
});
vm.runInContext(extract('avancarParaPrescricaoPatologia()','aplicarPatologiaPendenteAoEstado()')+extract('aplicarPatologiaPendenteAoEstado()','renderPatologia()'),ctx);
ctx.avancarParaPrescricaoPatologia();
assert.equal(JSON.stringify(originals[0]),JSON.stringify(JSON.parse(oldSnapshot)[0]));
assert.equal(originals.length,2);
assert.equal(originals[1].items.length,1);
assert.ok(originals[1].notes.startsWith('Origem: De Quervain — Fase.\n\nRecomendações\n'));
assert.ok(originals[1].notes.includes('Horário individual'));
assert.ok(!originals[1].notes.includes('Apenas para o médico'));
ctx._patologia={fases:[fase],faseId:'f1',biblioteca:true,exercicios:[],selecionados:new Set()};
vm.runInContext(extract('renderFaseDetalheEExerciciosPatologia()','algumExercicioAdicionadoPatologia()'),ctx);
const integrated=ctx.renderFaseDetalheEExerciciosPatologia();
assert.ok(integrated.indexOf('aria-label="Recomendações"')<integrated.indexOf('Exercícios sugeridos'));
console.log('Recomendações: ordem, edição, texto seguro, notas clínicas separadas e transferência só para novas sessões: OK');
// Os rótulos pertencem à discussão clínica, nunca à versão partilhada.
const {textoParaDoente,conteudoParaDoente}=await import('data:text/javascript;base64,'+Buffer.from(utils).toString('base64'));
const tagged={data:{recomendacoes:[{title:'[Certo] Ortótese',text:'[Provável] Usar se indicado. [Palpite] Reduzir se agravar.'}],recomendacoes_clinicas:[{title:'Evidência',text:'[Palpite] Dose não validada.'}]}};
assert.equal(recomendacoesParaSessao(tagged),'Recomendações\nOrtótese: Usar se indicado. Reduzir se agravar.');
assert.ok(renderRecomendacoesFase(tagged).includes('[Palpite] Dose não validada.'));
assert.ok(!renderRecomendacoesFase(tagged).includes('[Provável] Usar'));
assert.equal(textoParaDoente('[PROVAVEL] A\n[palpite] B'),'A\nB');
assert.equal(textoParaDoente('É provável que melhore; manter a precaução.'),'É provável que melhore; manter a precaução.');
const old={notes:'[Certo] Orientação',items:[{sets:2,load:1.5,prescription_note:'[Provável] Parar se piorar.',tecnica_info:{execucao:['[Palpite] Movimento suave.']}}]};
const beforeJSON=JSON.stringify(old),clean=conteudoParaDoente(old);
assert.equal(JSON.stringify(old),beforeJSON);
assert.equal(clean.items[0].sets,2);assert.equal(clean.items[0].load,1.5);
assert.equal(clean.items[0].prescription_note,'Parar se piorar.');assert.equal(clean.items[0].tecnica_info.execucao[0],'Movimento suave.');
const saveCtx=vm.createContext({conteudoParaDoente,modoExecucaoGinasio:()=> 'free'});
vm.runInContext(extract('sessaoParaGravar(s)','zoneSnapshotParaGravar(').split('// Fotografia das zonas')[0],saveCtx);
const saved=saveCtx.sessaoParaGravar({...old,session_id:'new',kind:'list'});
assert.ok(!JSON.stringify(saved).match(/\[(Certo|Provável|Palpite)\]/));
assert.equal(JSON.stringify(old),beforeJSON);
console.log('Texto do doente: sem rótulos, precauções e doses preservadas; notas profissionais separadas; original intacto: OK');
