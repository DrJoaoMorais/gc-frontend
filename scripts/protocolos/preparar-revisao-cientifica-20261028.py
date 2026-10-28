"""Prepara novas versões do catálogo. Não executa SQL nem altera prescrições."""
import copy,json,uuid,re,sys
from pathlib import Path
src=Path(sys.argv[1]); out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
d=json.loads(src.read_text()); old=copy.deepcopy(d);uid=lambda:str(uuid.uuid4()); date='2026-10-28'
C={c['name']:c for c in d['catalog']}; E={e['name']:e for e in d['exercises']}
TSA=C['Artroplastia Anatómica do Ombro (TSA)'];RSA=C['Artroplastia Invertida do Ombro (RSA)'];CAP=C['Capsulite adesiva do ombro'];RC=C['Sutura da coifa'];BANK=C['Reparação de Bankart com remplissage'];TEND=C['Tendinopatia da coifa dos rotadores — predomínio do supraespinhoso']
phases=lambda c:[p for p in d['phases'] if p['protocol_id']==c['id']]
P=lambda c,n:next(p for p in phases(c) if p['phase_order']==n)
def rec(data,title,text):
 data.setdefault('recomendacoes',[]).append({'title':title,'text':text})
def clinic(data,title,text):
 data.setdefault('recomendacoes_clinicas',[]).append({'title':title,'text':text})
refs={TSA['id']:[('ASSET 2020 — consenso TSA, nível IV','https://pmc.ncbi.nlm.nih.gov/articles/PMC8262512/')],RSA['id']:[('Edwards 2021 — ensaio RSA','https://pubmed.ncbi.nlm.nih.gov/34659491/'),('Sachinis 2024 — revisão RSA','https://pubmed.ncbi.nlm.nih.gov/38655406/'),('AAOS — informação para o doente','https://www.orthoinfo.org/treatment/reverse-total-shoulder-replacement/')],RC['id']:[('ASSET 2016 — consenso de reabilitação da sutura','https://scholars.duke.edu/publication/1488364'),('AAOS 2025 — norma de lesões da coifa','https://www.aaos.org/globalassets/quality-and-practice-resources/rotator-cuff/rotator-cuff-2025/rotator-cuff-cpg.pdf')]}
for c in d['catalog']:
 c['data'].update({'versao_clinica':date,'status_revisao':'revisto_com_limites_de_evidencia_2026-10-28','auditoria_cientifica':{'data':date,'dose':'Parâmetros iniciais individualizáveis; não existe validação experimental deste catálogo como conjunto.','imagens':'Mantidas as imagens existentes; sem certificação anatómica integral nesta revisão.'}})
 if c['id'] in refs:c['data']['fontes']=[{'title':t,'url':u} for t,u in refs[c['id']]]
for p in d['phases']:
 data=p['data'];data['revisao_cientifica']=date;data.setdefault('recommendations_scope',p['protocol_id']+':'+p['id'])
 clinic(data,'Dose e escolha individual','As opções não constituem um conjunto obrigatório. A dose da sessão é definida ou confirmada pelo prescritor; os parâmetros do catálogo não são uma dose ótima universal.')
 if C[next(c['name'] for c in d['catalog'] if c['id']==p['protocol_id'])]['kind']=='cirurgico':
  rec(data,'Quando contactar a equipa','Contacte a equipa perante febre, ferida a drenar, dor que piora subitamente, perda nova de função, dormência ou fraqueza novas. Não aumente a carga nem continue um exercício para ultrapassar estes sintomas.')
  clinic(data,'Autorização cirúrgica','Registar no plano individual as amplitudes, a carga, o apoio e a contração resistida autorizados. Considerar técnica, tecidos reparados, procedimentos associados e evolução clínica; as semanas não autorizam a progressão por si só.')
# F01: deixa de existir a opção de RI isométrica na fase 2 da TSA.
d['associations']=[a for a in d['associations'] if a['id']!='b51f1ab1-5518-48ad-b203-9fe8ef3dc06d']
p=P(TSA,2);p['data']['contraindicacoes']=['Não iniciar fortalecimento ou isométricos de rotação interna sem autorização cirúrgica específica e definição da dose.','Não forçar amplitude nem progredir apenas pelo tempo pós-operatório.'];p['data']['hep']=['Mobilidade assistida e ativa apenas na amplitude autorizada.','Isométricos de outras direções apenas se especificamente autorizados; não incluir rotação interna nesta seleção-base.'];p['data']['objetivos']=[{'id':'tsa2_1','label':'Recuperar mobilidade ativa funcional de acordo com os limites individuais.'},{'id':'tsa2_2','label':'Retirar progressivamente a ortótese apenas conforme indicação cirúrgica.'}]
for r in p['data']['recomendacoes']:
 if r['title'] in ['Cuidados nesta fase','Mobilidade']:r['text']='Não inicie exercícios de força de rotação interna por iniciativa própria. Faça os movimentos assistidos e os exercícios selecionados dentro dos limites indicados para a sua cirurgia.'
# F04: tetos autorizados são distintos de metas mínimas de progressão.
for c in [TSA,RSA]:
 p=P(c,1);data=p['data'];data['objetivos_serie']=[x for x in data.get('objetivos_serie',[]) if x.get('param') not in ['rom.flex_p','rom.re_p'] and x.get('texto')!='Sem dor nocturna']
 data['objetivos_serie'].append({'id':'rom_individual','tipo':'qualitativo','texto':'Mobilidade passiva evolui dentro dos limites individuais autorizados, sem forçar para atingir um valor mínimo.','escala':'binario'})
 data['limites_amplitude']=[{'movimento':'Flexão passiva','tipo':'limite individual definido pelo cirurgião'},{'movimento':'Rotação externa passiva','tipo':'limite individual definido pelo cirurgião'}]
 data['objetivos']=[{'id':'protecao','label':'Proteger os tecidos operados e cumprir os limites individuais de mobilidade.'},{'id':'evolucao','label':'Dor controlada e evolução clínica compatível com a fase autorizada.'}]
 data['criterios_progressao']=[{'id':'p1','texto':'Cicatrização e dor avaliadas, sem sinais de complicação.'},{'id':'p2','texto':'Mobilidade compatível com os limites operatórios, sem exigência de um ângulo universal.'},{'id':'p3','texto':'Autorização para progredir conforme avaliação e indicações cirúrgicas.'}]
# F03/F09: RSA sem limites universais em kg ou proibições vitalícias indiferenciadas.
for p in phases(RSA):
 data=p['data'];n=p['phase_order']
 data['nota_ancora']='Modelo para seleção individual. As restrições dependem da indicação, técnica, estabilidade, tecidos reparados e orientação do cirurgião; não aplicar automaticamente a fratura ou revisão.'
 data['contraindicacoes']=(['Não realizar a combinação de extensão, adução e rotação interna nem posições extremas sem autorização nesta fase.','Não apoiar o peso do corpo, empurrar para se levantar ou levantar cargas com o membro sem autorização.'] if n<=2 else ['Não realizar aumentos bruscos de carga ou esforço repetitivo pesado.','Respeitar as posições, tarefas, cargas e duração das restrições prescritas pelo cirurgião.'])
 data['hep']=['Realizar apenas os exercícios selecionados, com amplitude, carga e frequência individualmente definidas.','Manter a ortótese e as precauções no horário e período indicados pela equipa.' if n==1 else 'Ajustar o volume à recuperação e às tarefas diárias; não avançar apenas por terem passado mais semanas.']
 data['objetivos']=[{'id':'rsa_funcao','label':'Melhorar a função e a mobilidade necessárias às tarefas individuais, sem ultrapassar as restrições.'},{'id':'rsa_protecao','label':'Executar o plano autorizado com controlo e resposta sintomática aceitável.'}]
 data['recomendacoes']=[r for r in data['recomendacoes'] if r['title'] not in ['Cuidados nesta fase','Regularidade','Manutenção','Controlo do movimento']]
 rec(data,'Carga e movimentos','Cumpra as posições, os apoios e as cargas autorizados pelo cirurgião. Não use um limite geral em quilogramas nem o tempo desde a cirurgia como autorização para progredir. Evite esforço repetitivo pesado e aumentos bruscos.')
 if n==3:clinic(data,'Elevação insuficiente ou perda de função','Elevação ativa insuficiente, dor nova ou perda funcional justificam reavaliação do deltóide/nervo axilar, rigidez, estabilidade e complicações, incluindo fratura de stress. Uma adaptação reclinada pode ser escolhida após avaliação; não é uma mudança automática às 12 semanas.')
# F08: manutenção e preparação desportiva da TSA, sem prometer ROM completa.
for n in [3,4,5]:
 p=P(TSA,n);data=p['data'];data['objetivos']=[{'id':'funcao','label':'Mobilidade, força e resistência adequadas às tarefas acordadas, dentro dos limites cirúrgicos.'}]
 if n>=4:
  data['hep']=['Manter os exercícios selecionados na dose e frequência individualmente prescritas.','Adaptar o plano às tarefas diárias, laborais ou desportivas, sem obrigação de executar todas as opções.']
  data['contraindicacoes']=['Não realizar carga, posições ou gestos desportivos ainda não autorizados.','Evitar sobrecarga súbita e treino que provoque perda de controlo ou agravamento persistente.']
  data['criterios_progressao']=[{'id':'p1','texto':'Tolerância demonstrada às tarefas progressivas, com mobilidade e força suficientes para o objetivo individual.'},{'id':'p2','texto':'Autorização cirúrgica para a atividade-alvo, com exposição gradual e dose definida.'}]
  data['recomendacoes']=[r for r in data['recomendacoes'] if r['title'] not in ['Manutenção','Plano individual']]
  rec(data,'Plano individual','Faça apenas as opções selecionadas, na dose prescrita. Os exercícios gerais não substituem a preparação específica da sua atividade nem autorizam o regresso à competição.')
# F10/F15 capsulite.
CAP['data']['fontes']=[x for x in CAP['data']['fontes'] if not x.endswith(('.docx','.pdf'))]
CAP['data']['materiais_educativos_locais']=['Capsulite Adesiva.docx','PREHAB program-SD5HRFHH-2.pdf — material local; não evidência independente']
for p in phases(CAP):
 clinic(p['data'],'Opções de tratamento','Considerar infiltração intra-articular quando clinicamente indicada, incluindo dor que dificulta a reabilitação; discutir benefícios, riscos e alternativas. Autoalongamento e reforço dependem da avaliação e têm evidência limitada para a dose ou variante exata. Não prometer recuperação completa espontânea em todos.')
 rec(p['data'],'Se a evolução não for favorável','Contacte o médico se a dor noturna ou a limitação piorarem ou se não conseguir realizar o plano. A equipa pode ajustar os exercícios e discutir outras opções de tratamento; não force para recuperar toda a amplitude de uma vez.')
# F13: simetria de força como referência contextual.
for p in phases(BANK):
 if p['phase_order']>=5:clinic(p['data'],'Avaliar o regresso','Medir força com método e posição consistentes; considerar dominância, valores absolutos, mobilidade, tarefa, apreensão e prontidão psicológica. Os 80%/90% e as semanas são referências orientadoras, não limiares universais de segurança nem autorização isolada.')
# F14 seleção, sem seis exercícios obrigatórios.
for p in phases(TEND):
 if p['phase_order']==1:p['data']['hep'][0]='Escolher os exercícios necessários e tolerados; as seis opções não são obrigatórias. Dose e frequência ajustadas individualmente.'
 clinic(p['data'],'Interpretação da evidência','A norma apoia reabilitação ativa, não a superioridade deste conjunto, uma causa mecânica única da dor ou uma dose ótima. Não extrapolar a tendinopatia para uma reparação cirúrgica.')
for p in d['phases']:
 if p['protocol_id'] in [c['id'] for c in d['catalog'] if c['name'].startswith(('Dedo em gatilho','Tenossinovite de De Quervain'))]:
  clinic(p['data'],'Opções complementares','Não selecionar mobilidade de cotovelo, punho ou outros complementos apenas para atingir seis exercícios. Prescrever apenas quando há necessidade funcional; não alegar cura ou prevenção comprovada de recidiva.')
# F05/F06/F11/F16: novas versões das fichas, preservando as antigas e as imagens.
revised={}; retired=[]
def edit(name,fn):
 e=E[name]
 if e['id'] not in revised:revised[e['id']]=copy.deepcopy(e)
 fn(revised[e['id']]['tecnica_info'])
edit('Abdução do Ombro – Mobilização Ativa-Assistida com Bastão em pé',lambda t:t.update({'posicao_inicial':['De pé, com tronco confortável e estável. Segurar um bastão leve com as duas mãos, adaptando a pega ao lado a tratar conforme ensino.'],'execucao':['Usar a mão contralateral para assistir a subida lateral do braço a tratar, sem impulso.','Parar na amplitude individualmente prescrita e regressar devagar; não é obrigatório chegar acima da cabeça.'],'pontos_chave':['A orientação da mão é adaptada ao conforto e à prescrição; não garante proteção de todas as estruturas.','Faça apenas as séries, repetições e tempos definidos na sessão.','Não aumente a amplitude apenas porque repetiu o movimento.','Reduza ou pare perante dor aguda ou agravamento persistente e peça ajuste do plano.'],'erros_comuns':['Forçar o fim da amplitude ou usar impulso.','Inclinar ou rodar o tronco para ganhar altura.'],'dicas':['Aprender a técnica e adaptar ao lado tratado antes de realizar em casa.']}))
edit('Flexão do Ombro – Mobilização Ativa-Assistida com Bastão em pé',lambda t:t.update({'execucao':['Usar a mão contralateral para ajudar a elevar o braço a tratar à frente, dentro da amplitude autorizada.','Regressar devagar com assistência. Não aumentar a amplitude automaticamente ao longo das repetições.'],'pontos_chave':['Esta é uma mobilização assistida, não garantia de ausência de carga muscular.','Adaptar ao lado tratado e fazer apenas a dose da sessão.','Não é necessário chegar acima da cabeça; respeitar os limites cirúrgicos e o ensino individual.','Parar perante dor aguda ou agravamento persistente.']}))
for name in ['Rotação Interna do Ombro – Alongamento Ativo-Assistido com Bastão','Rotação Externa do Ombro – Mobilização Ativa-Assistida com Bastão']:
 def fix(t,name=name):
  t['posicao_inicial']=['Posição ensinada pelo profissional, com tronco estável e bastão leve, adaptada ao lado tratado. '+('Mão do lado tratado atrás do tronco apenas se essa posição estiver autorizada.' if 'Interna' in name else 'Braço junto ao corpo, cotovelo fletido e apoiado se indicado.')]
  t['execucao']=(['Com a mão contralateral, ajudar suavemente a deslocar a mão do lado tratado atrás do tronco até à amplitude ensinada.','É um movimento combinado do ombro; não procurar uma medida isolada de rotação interna nem puxar com força.'] if 'Interna' in name else ['Com a mão contralateral, ajudar a rodar suavemente o antebraço do lado tratado para fora, mantendo o cotovelo no lugar.'])+['Manter apenas o tempo indicado na sessão, se prescrito, e regressar lentamente.']
  t['pontos_chave']=['Respeitar a amplitude e dose individuais; não aumentar automaticamente com as repetições.','Não aplicar um limiar fixo de dor ou de minutos como garantia de segurança.','Adaptar ao lado tratado; interromper perante dor aguda ou agravamento persistente.']
  t['erros_comuns']=['Forçar a amplitude ou rodar o tronco para ganhar movimento.','Usar impulso ou contrariar restrições operatórias.']
  t['dicas']=['Aprender a variante com o profissional; fazer apenas a amplitude e a dose prescritas.']
 edit(name,fix)
edit('Rotação interna do ombro autoassistida em supino a 45 graus',lambda t:t.update({'pontos_chave':['Aprender a direção do movimento e a posição com o profissional.','Não forçar a amplitude nem deslocar a frente do ombro para ganhar movimento.','A amplitude e a dose são individualizadas. Parar perante dor aguda ou agravamento persistente.']}))
for name in ['Shoulder Press','Elevação Frontal com Halters','Low Row','Remada unilateral','Remada com Halteres','Chest Press','Supino plano com Halteres']:
 def fix(t):
  for key,vals in t.items():
   if not isinstance(vals,list):continue
   t[key]=[v.replace('ombros baixos','ombros confortáveis').replace('ombro baixo','ombro confortável').replace('ombros afastados das orelhas','pescoço relaxado').replace('Ombros afastados das orelhas.','Pescoço relaxado.').replace('Encolher os ombros.','Contrair excessivamente o pescoço ou compensar com o tronco.').replace('Elevar os ombros.','Compensar a carga com esforço excessivo do pescoço.').replace('Ombro não sobe em direção à orelha.','Evitar compensação excessiva do pescoço.') for v in vals]
  t.setdefault('pontos_chave',[]).append('Permitir o movimento natural das omoplatas; não as manter rigidamente deprimidas durante a elevação. Após cirurgia, realizar apenas na posição, carga e amplitude autorizadas.')
 edit(name,fix)
for old_id,e in revised.items():
 e['id']=uid();e['created_at']=None;e['is_active']=True
 labels={'posicao_inicial':'Posição inicial','execucao':'Execução','pontos_chave':'Pontos-chave','erros_comuns':'Erros comuns','dicas':'Dicas'}
 e['tecnica_notas']='\n\n'.join(labels.get(k,k)+'\n'+'\n'.join('• '+x for x in v) for k,v in e['tecnica_info'].items() if isinstance(v,list))
 retired.append(old_id)
# Novas opções conservadoras, todas exigem seleção e dose individual; imagens existentes.
def add(c,n,names):
 p=P(c,n)
 for name in names:
  e=E[name]
  d['associations'].append({'id':uid(),'phase_id':p['id'],'exercise_id':e['id'],'sort_order':len([a for a in d['associations'] if a['phase_id']==p['id']]),'context':'Clínica' if name=='PROM em supino (assistido)' else 'Casa','is_optional':True,'prescription_defaults':{},'clinical_note':'Opção a selecionar após avaliação e autorização cirúrgica para este movimento e carga. Definir individualmente a dose, amplitude e resistência antes de prescrever; não é obrigatória nem autorização para desporto.'})
add(RSA,1,['Mobilidade de mão e punho com membro superior apoiado','Flexão/extensão do cotovelo','Mobilidade cervical com membro superior apoiado','Pêndulares de Codman','PROM em supino (assistido)'])
add(RSA,2,['Elevação do braço no plano escapular (polegar para cima)','Isométrico de flexão do ombro','Wall slides'])
add(RSA,3,['Scaption com halteres leves','Flexão de ombro com elástico','Remada com elástico'])
add(RSA,4,['Elevação do braço no plano escapular (polegar para cima)','Scaption com halteres leves','Flexão de ombro com elástico','Remada com elástico'])
add(TSA,4,['Rotação externa de ombro com elástico','Rotação interna de ombro com elástico','Scaption com halteres leves','Remada com elástico'])
add(TSA,5,['Rotação externa de ombro com elástico','Rotação interna de ombro com elástico','Remada com elástico','Elevação do braço no plano escapular (polegar para cima)'])
# Marca opções e protege a ausência de dose no código novo; não inventa parâmetros científicos.
for a in d['associations']:
 p=next(p for p in d['phases'] if p['id']==a['phase_id']); c=next(c for c in d['catalog'] if c['id']==p['protocol_id'])
 if c['kind']=='cirurgico' or c['id']==TEND['id']:a['is_optional']=True
 if a['exercise_id'] in revised:a['exercise_id']=revised[a['exercise_id']]['id']
# Fotografia estável da versão auditada para futuras revisões locais (não é dado do doente).
for p in d['phases']:
 if p['protocol_id']==RSA['id'] and p['phase_order']==2:
  p['data']['recomendacoes']=[r for r in p['data']['recomendacoes'] if r['title']!='Controlo do movimento']
# SQL de dados, sem DDL permanente. Clona versões; preserva originais e histórico.
q=lambda x:"'"+json.dumps(x,ensure_ascii=False,separators=(',',':')).replace("'","''")+"'::jsonb"
statements=['begin;','create temporary table clinical_guard on commit drop as select (select md5(coalesce(string_agg(to_jsonb(p)::text,\'\' order by id),\'\')) from public.wo_prescriptions p) prescriptions, (select md5(coalesce(string_agg(to_jsonb(s)::text,\'\' order by id),\'\')) from public.wo_session_prescription_snapshots s) snapshots;']
# Hashes obtidos por consulta de leitura imediatamente antes da aplicação.
hashes=json.loads((out/'preapply-fingerprints.json').read_text())
for table,key in [('protocols_catalog','catalog'),('protocol_phases','phases'),('protocol_phase_exercises','associations'),('wo_exercises','exercises')]:
 ids=','.join("'"+r['id']+"'" for r in old[key]);expected=hashes[table]
 statements.append(f"do $check$ begin perform 1 from public.{table} where id in ({ids}) for update; if (select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.{table} t where id in ({ids})) <> '{expected}' then raise exception 'Conteúdo alterado: {table}'; end if; end $check$;")
# UUID maps are deterministic within this generated release; do not rerun after apply.
cm={c['id']:uid() for c in d['catalog']};pm={p['id']:uid() for p in d['phases']}
old_tables={table:{r['id']:r for r in old[key]} for table,key in [('protocols_catalog','catalog'),('protocol_phases','phases'),('protocol_phase_exercises','associations'),('wo_exercises','exercises')]}
def insert(table,row,sourceid=None):
 row={k:v for k,v in row.items() if not(k=='created_at' and v is None)}
 source=old_tables[table].get(sourceid)
 if source:
  patch={k:v for k,v in row.items() if k!='data' and source.get(k)!=v}
  payload='to_jsonb(t) || '+q(patch)
  if 'data' in row:
   patchdata={k:v for k,v in row['data'].items() if source.get('data',{}).get(k)!=v}
   payload+=" || jsonb_build_object('data',t.data || "+q(patchdata)+')'
  payload+=" - 'created_at'"
  # Explicit columns preserve DB defaults for creation timestamps.
  keys=[k for k in row if k!='created_at'];expr=','.join('x.'+k for k in keys)
  statements.append('insert into public.'+table+'('+','.join(keys)+') select '+expr+' from public.'+table+' t cross join lateral jsonb_populate_record(null::public.'+table+','+payload+") x where t.id='"+sourceid+"';")
 else:
  keys=list(row);expr=','.join('x.'+k for k in keys)
  statements.append('insert into public.'+table+'('+','.join(keys)+') select '+expr+' from jsonb_populate_record(null::public.'+table+','+q(row)+') x;')
for oldid,e in revised.items():
 insert('wo_exercises',e,oldid)
 statements.append("update public.wo_exercises set is_active=false where id='"+oldid+"';")
for c in d['catalog']:
 oid=c['id'];c['id']=cm[oid];c['data']['previous_version_id']=oid;c['data']['version']=int(c['data'].get('version',1))+1;c.pop('created_at',None);insert('protocols_catalog',c,oid)
for p in d['phases']:
 oid=p['id'];p['id']=pm[oid];p['protocol_id']=cm[p['protocol_id']];p.pop('created_at',None);insert('protocol_phases',p,oid)
for a in d['associations']:
 oid=a['id'];a['id']=uid();a['phase_id']=pm[a['phase_id']];a.pop('created_at',None);insert('protocol_phase_exercises',a,oid)
statements.append('update public.protocols_catalog set is_active=false where id in ('+','.join("'"+x+"'" for x in cm)+');')
statements.append("do $check$ begin if (select prescriptions from clinical_guard) is distinct from (select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by id),'')) from public.wo_prescriptions p) or (select snapshots from clinical_guard) is distinct from (select md5(coalesce(string_agg(to_jsonb(s)::text,'' order by id),'')) from public.wo_session_prescription_snapshots s) then raise exception 'Histórico alterado'; end if; if (select count(*) from public.protocols_catalog where is_active) <> 9 then raise exception 'Contagem de protocolos ativos inesperada'; end if; end $check$;")
statements.append("select 'applied' as status, (select count(*) from public.protocols_catalog where is_active) active_protocols;")
statements.append('commit;')
(out/'apply.sql').write_text('\n'.join(statements)+'\n')
(out/'revised-catalog.json').write_text(json.dumps({**d,'revised_exercises':list(revised.values()),'retired_exercises':retired},ensure_ascii=False,indent=2))
(out/'mapping.json').write_text(json.dumps({'catalog':cm,'phases':pm,'exercises':{k:v['id'] for k,v in revised.items()}},indent=2))
print(json.dumps({'new_protocols':len(cm),'phases':len(pm),'associations':len(d['associations']),'revised_cards':len(revised),'new_options':len(d['associations'])-len(old['associations'])+1,'empty_doses_require_individual_definition':sum(not a['prescription_defaults'] for a in d['associations'])}))
