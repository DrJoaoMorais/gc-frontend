// Apoio ao prescritor: usa o catálogo existente; não altera dados nem determina aptidão clínica.
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const PADROES_CASA=[
 {nome:'Agachar',A:'Sentar e levantar de cadeira',B:'Agachamento'},
 {nome:'Anca',A:'Ponte glútea bilateral',B:'Extensão da anca em pé com apoio'},
 {nome:'Empurrar',A:'Flexão dos braços na parede',B:'Flexão de braços inclinada com apoio numa bancada'},
 {nome:'Apoio em pé',A:'Elevação bilateral dos calcanhares com apoio',B:'Abdução da anca em pé com apoio'},
 {nome:'Controlo do tronco',A:'Prancha Abdominal',B:'Apoio quadrúpede com transferências de peso'},
];
export function catalogoCasa(lista){return(lista||[]).filter(e=>e.id&&e.name&&e.is_active!==false&&Array.isArray(e.locais)&&e.locais.includes('Casa')&&Array.isArray(e.equipamento)&&e.equipamento.length>0&&e.equipamento.every(eq=>['peso corporal','peso do corpo','sem equipamento','cadeira','banco'].includes(norm(eq))));}
export function sugerirVariantesCasa(lista){const exs=catalogoCasa(lista);return Object.fromEntries(['A','B'].map(t=>[t,PADROES_CASA.map(p=>exs.find(e=>norm(e.name)===norm(p[t]))?.id||'')]));}
export function semanaCasa(n){return({3:[[0,'forca','A'],[3,'forca','B'],[5,'cardio','A']],4:[[0,'forca','A'],[1,'cardio','A'],[3,'forca','B'],[5,'cardio','B']],5:[[0,'forca','A'],[1,'cardio','A'],[3,'forca','B'],[5,'misto','C'],[6,'cardio','B']]}[n]||[]).map(([dia,tipo,variante])=>({dia,tipo,variante}));}
const datePlus=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const ROTINAS=[['Marcha no lugar com balanço dos braços','Passos laterais sem salto','Marcha no lugar','Boxe sem contacto, pés apoiados'],['Passos à frente e atrás, sem salto','Marcha no lugar','Dança com passos simples','Passos laterais com movimento dos braços'],['Marcha no lugar','Boxe sem contacto, pés apoiados','Passos laterais sem salto','Marcha confortável com movimentos dos braços'],['Dança com passos simples','Marcha no lugar','Passos à frente e atrás, sem salto','Passos laterais sem salto']];
export function proporProgramaCasa(c,x){
 const erros=[],sessoes=[],semana=c.semana||semanaCasa(Number(c.frequencia));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(c.inicio||'')||(!Number.isFinite(new Date(c.inicio+'T12:00:00Z').getTime())||new Date(c.inicio+'T12:00:00Z').toISOString().slice(0,10)!==c.inicio))return{erros:['Indique uma data inicial válida.'],sessoes};
 if(![3,4,5].includes(Number(c.frequencia))||semana.length!==Number(c.frequencia)||new Set(semana.map(d=>d.dia)).size!==semana.length||semana.some(d=>!Number.isInteger(d.dia)||d.dia<0||d.dia>6))erros.push('Escolha 3, 4 ou 5 dias diferentes por semana.');
 const forcaDias=semana.filter(d=>d.tipo!=='cardio').map(d=>d.dia).sort((a,b)=>a-b);
 if(forcaDias.some((d,i)=>((forcaDias[(i+1)%forcaDias.length]-d+7)%7||7)<2))erros.push('Deixe pelo menos um dia entre sessões de força ou mistas, incluindo a passagem entre semanas.');
 if(semana.some(d=>!['forca','cardio','misto'].includes(d.tipo)||!['A','B','C'].includes(d.variante)))erros.push('Tipo de sessão inválido.');
 if(![20,30,45].includes(Number(c.minutos)))erros.push('Escolha 20, 30 ou 45 minutos.');
 if(!Number.isInteger(Number(c.reps))||c.reps<1||c.reps>30||!Number.isInteger(Number(c.voltas))||c.voltas<1||c.voltas>5||!Number.isFinite(Number(c.pausa))||c.pausa<0||!Number.isFinite(Number(c.entreVoltas))||c.entreVoltas<0)erros.push('Reveja repetições, voltas e pausas.');
 const porId=new Map(catalogoCasa(x.catalogo).map(e=>[e.id,e]));
 for(const t of ['A','B']){const ids=c.variantes?.[t]||[];if(ids.length!==5||new Set(ids).size!==5||ids.some(id=>!porId.has(id)))erros.push(`Escolha cinco exercícios diferentes do catálogo para a sessão ${t}.`);}
 if(erros.length)return{erros,sessoes};
 const review=datePlus(c.inicio,13),fim=datePlus(c.inicio,27),programaId=x.criarId();
 for(let i=0;i<28;i++){
  const date=datePlus(c.inicio,i),dia=(new Date(date+'T12:00:00Z').getUTCDay()+6)%7,p=semana.find(d=>d.dia===dia);if(!p)continue;
  const week=Math.floor(i/7)+1,disp=x.disponibilidade(date);
  if(x.ocupado(date)){erros.push(`${date}: já existe treino. O programa não substitui sessões existentes.`);continue;}
  if(!disp?.ativo||!Number.isFinite(disp.min)||disp.min<=0||disp.min>1440){erros.push(`${date}: sem tempo disponível confirmado.`);continue;}
  const minutos=Math.min(Number(c.minutos),disp.min),aquecimento=minutos>=40?300:minutos>=25?240:180,retorno=minutos>=40?240:minutos>=25?180:120;
  const fixo=(name,duration_sec)=>({block_id:x.criarId(),tipo:'fixed',name,duration_sec}),blocks=[fixo('Aquecimento — marcha confortável e mobilização suave',aquecimento)];
  const variante=p.tipo==='cardio'?p.variante:p.tipo==='misto'?(week%2?'A':'B'):(week%2?p.variante:p.variante==='A'?'B':'A');
  let forca=0,voltas=0;
  if(p.tipo!=='cardio'){
   let ids=c.variantes[variante];if(p.tipo==='misto')ids=ids.slice(0,3);if(week%2===0)ids=[...ids.slice(1),ids[0]];
   const exercicios=ids.map(id=>{const ex=porId.get(id),tempo=/prancha|isom[eé]trico|wall\s*sit|cadeira na parede|equil[ií]brio/i.test(ex.name);return{id:x.criarId(),exercise_id:id,name:ex.name,measure:tempo?'time':'reps',value:tempo?20:Number(c.reps),rest_after_s:Number(c.pausa)};});
   const tempos=exercicios.map(e=>e.measure==='time'?1:Number(x.tempoRepeticao(porId.get(e.exercise_id))));
   if(tempos.some(t=>!Number.isFinite(t)||t<=0||t>60)){erros.push(`${date}: tempo por repetição inválido.`);continue;}
   const uma=exercicios.reduce((t,e,j)=>t+(e.measure==='time'?e.value:e.value*tempos[j])+e.rest_after_s,0);
   const reserva=p.tipo==='misto'?Math.floor(minutos*60*.25):0;
   voltas=Math.min(Number(c.voltas),Math.floor((minutos*60-aquecimento-retorno-reserva+Number(c.entreVoltas))/(uma+Number(c.entreVoltas))));
   if(voltas<1){erros.push(`${date}: não cabe uma volta completa. Reveja a dose ou o tempo disponível.`);continue;}
   forca=voltas*uma+(voltas-1)*Number(c.entreVoltas);
   blocks.push({block_id:x.criarId(),tipo:'voltas',name:`Força ${variante} — ${c.reps} repetições controladas; isométricos 20 s`,rounds:voltas,rest_between_rounds_s:Number(c.entreVoltas),exercicios});
  }
  let cardio=Math.floor(minutos*60)-aquecimento-retorno-forca;const cardioTotal=cardio;
  if(cardio<0){erros.push(`${date}: tempo insuficiente para aquecimento e retorno à calma.`);continue;}
  const rotina=ROTINAS[(week-1+(p.variante==='B'?1:0))%ROTINAS.length];let parte=0;
  while(cardio>0){const sec=Math.min(180,cardio);blocks.push(fixo(rotina[parte++%rotina.length],sec));cardio-=sec;}
  blocks.push(fixo('Retorno à calma — marcha lenta e respiração confortável',retorno));
  const nome=p.tipo==='forca'?`Força ${variante}`:p.tipo==='misto'?'Misto C':`Cardio ${p.variante}`;
  const notes=[`${nome} · semana ${week}.`,c.nivel==='moderado'?'Cardio: esforço percebido 5–6/10; deve conseguir conversar.':'Adaptação: esforço percebido 3–4/10; reduza o ritmo se necessário.',p.tipo!=='cardio'?`Força: ${c.reps} repetições controladas no total (nos unilaterais, repartir pelos dois lados); isométricos: 20 s. Termine com capacidade para mais 2–4 repetições. O tempo de trabalho é estimado; não acelere para acompanhar o cronómetro.`:'Intercale marcha lenta se necessário.',week>2?'Mantenha a dose revista na reavaliação; não existe aumento automático de intensidade.':'','Use apoios estáveis.'].filter(Boolean).join('\n');
  sessoes.push({date,nome,minutos,forca,cardio:cardioTotal,aquecimento,retorno,voltas,ajustado:minutos<Number(c.minutos),doseReduzida:p.tipo!=='cardio'&&voltas<Number(c.voltas),sessao:{session_id:x.criarId(),kind:'circuit',modality:'Circuito',local:'Casa',date,order:0,notes,training_focus:p.tipo,training_program:{id:programaId,name:c.programName||'Atividade física em casa',source_id:c.programSource||null,week,frequency:Number(c.frequencia),review_date:review,progression:'rever_antes_de_aumentar'},circuit_time_limit_min:minutos,_limiteMin:minutos,blocks}});
 }
 return{erros,sessoes,fim,review,programaId};
}
