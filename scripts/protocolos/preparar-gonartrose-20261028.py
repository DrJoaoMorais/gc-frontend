"""Prepara um novo protocolo conservador. Só gera ficheiros; não publica nem executa SQL."""
import json,uuid,copy,sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
out=root/'docs/protocolos/gonartrose-20261028';out.mkdir(parents=True,exist_ok=True)
uid=lambda k:str(uuid.uuid5(uuid.NAMESPACE_URL,'gc:gonartrose:2026-10-28:'+k))
pid=uid('protocol');date='2026-10-28';owner='32a24abe-cd69-42d9-bf3a-3355f4f6e28c'
gtps=json.loads((root/'docs/protocolos/trocanterite-20261028/protocolo.json').read_text())
machines=json.loads(Path(sys.argv[1]).read_text());M={e['name']:e for e in machines}
sources=[{'title':'NICE NG226 — exercício, educação e peso','url':'https://www.nice.org.uk/guidance/ng226/chapter/recommendations'},{'title':'EULAR — atualização 2023, publicada em 2024','url':'https://pmc.ncbi.nlm.nih.gov/articles/PMC11103326/'},{'title':'Núñez-Cortés et al., JOSPT 2026 — intensidade e volume; certeza baixa a muito baixa','url':'https://pubmed.ncbi.nlm.nih.gov/42676087/','doi':'10.2519/jospt.2026.13477'},{'title':'START, JAMA 2021 — alta intensidade sem superioridade na dor aos 18 meses','url':'https://pmc.ncbi.nlm.nih.gov/articles/PMC7887656/'},{'title':'BMJ 2025 — modalidades de exercício','url':'https://www.bmj.com/content/391/bmj-2025-085242'}]
protocol={'id':pid,'region':'joelho','name':'Gonartrose — osteoartrose do joelho','kind':'conservador','is_active':True,'sort_order':11,'data':{'version':1,'versao_clinica':date,'contextos':['Casa','Clínica','Ginásio'],'fontes':sources,'status_revisao':'revisto_com_limites_de_evidencia_2026-10-28','nota_clinica':'Quatro fases por evolução clínica, seis opções por fase e seleção individual. Exercício de força e aeróbio, com educação. Sem calendário obrigatório. Não é um protocolo pós-operatório.','dose':'Doses iniciais práticas, ajustáveis pelo prescritor. Não representam um conjunto ou dose ótima experimentalmente validados.','auditoria_cientifica':{'data':date,'limites':'A evidência apoia exercício individualizado. Não valida seis exercícios obrigatórios, um limiar universal de dor, percentagens automáticas de progressão ou ângulos fixos.','imagens':'Cinco imagens novas no modelo masculino e nove imagens reutilizadas do catálogo, inspecionadas antes da publicação.'}}}
response='Desconforto ligeiro pode acontecer. Reduza ou pare se a dor aumentar, perder controlo ou começar a coxear. Se piorarem o inchaço, o sono ou a manhã seguinte, reduza a dose e peça ajuste do plano.'
helptext='Procure avaliação urgente se o joelho ficar muito quente e inchado com febre, ou se deixar subitamente de conseguir apoiar a perna. Contacte a equipa perante bloqueio novo, inchaço súbito importante ou agravamento persistente.'
weight='Mantenha atividade regular e evite aumentos bruscos. Se tiver excesso de peso, peça apoio para uma redução gradual. Não precisa de esperar por emagrecer para começar a mexer-se.'
clinical=[{'title':'Âmbito e entrada na fase','text':'Confirmar diagnóstico clínico, lado, irritabilidade, derrame, mobilidade, força, comorbilidades e objetivo. A pessoa com quadro estável pode começar na fase B ou C; não exigir passagem pela agudização. Não aplicar a artroplastia recente, traumatismo agudo ou suspeita de infeção/fratura.'},{'title':'Dose e evidência','text':'Escolher opções e individualizar dose, amplitude, resistência, apoio e frequência. As doses do catálogo são propostas práticas. Revisão JOSPT 2026: certeza baixa a muito baixa; não converter estimativas de dose-resposta em quotas de repetições. Carga elevada não é requisito universal para analgesia.'},{'title':'Adaptações','text':'Sintomas patelofemorais: ajustar amplitude e carga por exercício, sem proibir flexão acima de um ângulo fixo. Obesidade não exclui exercício em carga. Treino de equilíbrio em chão firme; instabilidade não é progressão obrigatória. Se dor persistente, avaliar também sono, receio do movimento e fatores psicossociais, sem presumir sensibilização central.'},{'title':'Acompanhamento','text':'Rever adesão, dor, derrame e uma tarefa relevante, por exemplo cadeira, escadas ou caminhada. Usar medida funcional consistente quando útil. Progredir uma variável de cada vez. Se ausência de evolução, rever dose e diagnóstico; não repetir imagem por rotina. Impacto importante apesar de tratamento adequado pode justificar referenciação.'}]
specs=[
 ('A — Agudização e recuperação de tolerância','Manter movimento e ativação com uma dose tolerada.',[
 ('O seu plano','Faça apenas as opções selecionadas para si. Começar habitualmente com 2–3 opções; não fazer as seis por obrigação.'),
 ('Frequência','Mobilidade e ativação em períodos curtos, conforme prescrito. Comece a ponte e o levantar da cadeira em dias alternados, se tolerados.'),
 ('Atividade','Mantenha deslocações curtas em plano, com pausas. Evite repouso prolongado e aumentos bruscos; não existe um número obrigatório de passos.'),
 ('Resposta ao exercício',response),('Hábitos',weight),('Quando pedir ajuda',helptext)],
 ['Movimentos e dose inicial tolerados sem agravamento persistente do inchaço, do sono ou da marcha.','Caminhar e levantar da cadeira com tolerância estável ou em melhoria, dentro da capacidade individual.']),
 ('B — Base e função','Aprender os movimentos e melhorar a tolerância nas tarefas diárias.',[
 ('O seu plano','Habitualmente 3–4 opções por sessão, escolhidas com a equipa. Não precisa de fazer todas as opções da fase.'),
 ('Frequência','Força em 2–3 dias por semana, de preferência alternados. Comece com carga que permita movimento lento e controlado.'),
 ('Caminhada ou bicicleta','Inclua períodos curtos da atividade que melhor tolera. Aumente gradualmente o tempo; pode dividi-lo ao longo do dia.'),
 ('Resposta ao exercício',response),('Hábitos',weight),('Quando pedir ajuda',helptext)],
 ['Completar a seleção prescrita com controlo e sem agravamento sustentado.','Melhorar a tarefa escolhida com a equipa, como cadeira, caminhada ou escadas.']),
 ('C — Reforço e capacidade funcional','Aumentar força e capacidade para as atividades importantes.',[
 ('O seu plano','Faça as 3–4 opções selecionadas para o seu objetivo. As máquinas são opções para quem tem acesso; não são obrigatórias.'),
 ('Frequência e esforço','Força habitualmente 2–3 dias por semana, em dias alternados. Termine inicialmente com capacidade para mais 2–3 repetições, sem perder controlo.'),
 ('Progressão','Se tolerar bem várias sessões, aumente uma variável de cada vez: repetições, carga, amplitude ou duração. Mantenha caminhada ou bicicleta adaptada à sua capacidade.'),
 ('Resposta ao exercício',response),('Hábitos',weight),('Quando pedir ajuda',helptext)],
 ['Tarefas relevantes realizadas com maior capacidade e sem agravamento persistente.','Conseguir gerir a dose e reconhecer quando deve reduzir temporariamente a carga.']),
 ('D — Manutenção','Manter os ganhos e uma rotina sustentável.',[
 ('O seu plano','Mantenha as opções mais úteis para si. Pode alterná-las entre sessões, sem obrigação de fazer as seis.'),
 ('Frequência','Mantenha habitualmente duas sessões de força por semana. Ajuste a carga à capacidade atual; o programa não tem de terminar ao fim de 12 semanas.'),
 ('Atividade regular','Mantenha caminhada, bicicleta ou outra atividade de que goste. Acumule períodos tolerados e aumente aos poucos. A meta de atividade é adaptada à sua saúde e capacidade.'),
 ('Resposta ao exercício',response),('Hábitos',weight),('Quando pedir ajuda',helptext)],
 ['Manter a rotina e rever o plano se as necessidades ou a capacidade mudarem.','Pedir reavaliação perante agravamento persistente ou perda de função.'])]
phases=[]
for n,(name,goal,recs,criteria) in enumerate(specs,1):
 phase_id=uid('phase'+str(n))
 phases.append({'id':phase_id,'protocol_id':pid,'phase_order':n,'name':name,'anchor_kind':'evolucao_clinica','anchor_from':None,'anchor_to':None,'data':{'nota_ancora':'Fase definida pela evolução clínica, sem semanas obrigatórias.','objetivos':[{'id':'o1','label':goal}],'permitido':['Movimento e carga tolerados, de acordo com a seleção individual.'],'contraindicacoes':['Não forçar dor aguda, amplitude ou carga que provoquem perda de controlo.','Não prosseguir sem avaliação perante sinais de alarme.'],'hep':['As seis opções não são obrigatórias. Fazer apenas os exercícios e as doses selecionados.'],'recomendacoes':[{'title':t,'text':s} for t,s in recs],'recomendacoes_clinicas':copy.deepcopy(clinical),'criterios_progressao':[{'id':f'p{i}','texto':s} for i,s in enumerate(criteria,1)],'objetivos_serie':[{'id':'s1','tipo':'qualitativo','texto':'Resposta do joelho e tarefa funcional revistas.','escala':'binario'}],'recommendations_scope':pid+':'+phase_id,'revisao_cientifica':date}})
cards={};base='https://gc.joaomorais.pt/assets/exercicios/gonartrose/2026-10-28/'
def card(key,name,pos,execution,care,equipment=None,goal='Fortalecimento',image=None,locais=None):
 tech={'posicao_inicial':[pos],'execucao':execution,'pontos_chave':care+['Faça apenas a dose e a amplitude prescritas. Pare perante dor aguda ou perda de controlo.'],'erros_comuns':['Usar impulso, prender a respiração ou aumentar a dificuldade sem controlo.'],'dicas':['Respire normalmente e peça ensino da técnica se tiver dúvidas.']}
 cards[key]={'id':uid('exercise:'+key),'name':name,'locais':locais or ['Casa','Clínica','Ginásio'],'categoria':['Membro Inferior'],'equipamento':equipment or ['Sem equipamento'],'is_active':True,'created_by':owner,'photo_url':image or base+key+'.png','video_url':None,'tecnica_info':tech,'tecnica_notas':'\n\n'.join(k.replace('_',' ')+'\n'+'\n'.join('• '+v for v in vals) for k,vals in tech.items()),'ajustes_maquina':[],'contextos_exercicio':['Reabilitação'],'objetivos_exercicio':[goal]}
card('isometrico-quadricipite','Isométrico de quadricípite com toalha','De costas, cabeça apoiada, perna alongada e pequena toalha enrolada debaixo do joelho.',['Contraia a parte anterior da coxa, pressionando suavemente o joelho contra a toalha.','Mantenha pelo tempo prescrito, relaxe e repita.'],['Não levante a bacia nem force a extensão. Não é necessário fazer força máxima.'])
card('deslizar-calcanhar','Deslizamento do calcanhar deitado','De costas, cabeça apoiada e pernas numa posição confortável.',['Deslize o calcanhar na direção da bacia, fletindo o joelho dentro da amplitude tolerada.','Deslize de novo para alongar a perna, sem forçar o fim do movimento.'],['O calcanhar mantém contacto com a superfície. A imagem não define a amplitude obrigatória.'],goal='Mobilidade / Alongamento')
card('perna-estendida','Elevação da perna estendida','De costas, uma perna fletida com o pé apoiado e a perna a exercitar alongada.',['Contraia a coxa e eleve ligeiramente a perna, mantendo o joelho estendido dentro da capacidade.','Desça lentamente e descanse conforme prescrito.'],['Não levantar a cabeça ou arquear a região lombar.','Se não conseguir manter o joelho estendido ou aumentar a dor, pare e peça uma alternativa.'],['Peso Corporal'])
card('marcha-curta','Caminhada curta em plano','Percurso plano, desimpedido e com calçado estável. Utilize a ajuda de marcha prescrita, se indicada.',['Caminhe com passos confortáveis e ritmo tolerado.','Faça pausas antes de começar a coxear ou perder controlo.'],['O tempo inicial é ajustável; não é uma duração mínima obrigatória.','A imagem mostra o gesto de caminhar e não substitui uma ajuda de marcha prescrita.'],goal='Cardiovascular')
card('calcanhares','Elevação bilateral dos calcanhares com apoio','De pé no chão plano, pés paralelos e mãos num apoio estável.',['Eleve os dois calcanhares lentamente, mantendo a parte anterior dos pés apoiada.','Baixe os calcanhares com controlo até ao chão.'],['Distribua o peso pelos dois pés. Não usar um degrau nesta variante.','Reduza a amplitude ou a dose se o joelho ou o tornozelo agravarem.'],['Peso Corporal'])
def clone_gtps(key,oldkey,name):
 old=next(e for e in gtps['exercises'] if e['id']==str(uuid.uuid5(uuid.NAMESPACE_URL,'gc:trocanterite:2026-10-28:exercise:'+oldkey)))
 new=copy.deepcopy(old);new['id']=uid('exercise:'+key);new['name']=name;cards[key]=new
clone_gtps('ponte','ponte-bilateral','Ponte glútea bilateral — joelho')
clone_gtps('cadeira','sentar-levantar','Sentar e levantar de cadeira — joelho')
clone_gtps('abducao','abducao-sem-carga','Abdução da anca em pé com apoio — joelho')
clone_gtps('equilibrio','apoio-unipodal','Equilíbrio numa perna com apoio — joelho')
clone_gtps('degrau','step-up','Subida de degrau baixo com apoio — joelho')
for key,name in [('leg-press','Horizontal Leg Press'),('extensao','Leg Extension'),('flexao','Leg Curl'),('bicicleta','Bicicleta')]:
 old=M[name];tech=copy.deepcopy(old['tecnica_info'])
 # Uniformizar instruções com a regra clínica de desconforto ligeiro.
 tech['dicas']=[x for x in tech.get('dicas',[]) if not x.startswith('Parar perante dor articular')]
 tech.setdefault('pontos_chave',[]).append('A carga, a amplitude e a dose são individuais. Reduza se piorarem o inchaço, o sono ou a manhã seguinte.')
 cards[key]={'id':uid('exercise:'+key),'name':{'leg-press':'Leg press horizontal — joelho','extensao':'Extensão de joelho na máquina — joelho','flexao':'Flexão de joelho na máquina — joelho','bicicleta':'Bicicleta estática — joelho'}[key],'locais':['Clínica','Ginásio'],'categoria':['Membro Inferior'],'equipamento':['Máquina'],'is_active':True,'created_by':owner,'photo_url':old['photo_url'],'video_url':None,'tecnica_info':tech,'tecnica_notas':'\n\n'.join(k.replace('_',' ')+'\n'+'\n'.join('• '+v for v in vals) for k,vals in tech.items()),'ajustes_maquina':[],'contextos_exercicio':['Reabilitação'],'objetivos_exercicio':['Cardiovascular' if key=='bicicleta' else 'Fortalecimento']}
def dose(sets,amount,rest=60,timed=False):
 return {'sets':sets,'load':None,'reps_min':None if timed else amount,'reps_max':None if timed else amount,'reps_fixed':None if timed else amount,'series':None if timed else [{'reps':amount,'load':None} for _ in range(sets)],'duration_sec':None,'duration_series':[{'duration_sec':amount} for _ in range(sets)] if timed else None,'rest_set':rest,'rest_next':rest,'tempo_concentrico_s':None if timed else 2,'tempo_excentrico_s':None if timed else 3,'pausa_superior_s':0,'pausa_inferior_s':0}
selection=[
 [('isometrico-quadricipite',5,10,20,True),('deslizar-calcanhar',1,10,30,False),('perna-estendida',1,8,60,False),('ponte',1,8,60,False),('cadeira',1,5,60,False),('marcha-curta',1,120,60,True)],
 [('cadeira',2,8,60,False),('extensao',2,10,60,False),('ponte',2,10,60,False),('abducao',2,10,60,False),('calcanhares',2,10,60,False),('equilibrio',3,15,30,True)],
 [('leg-press',2,10,90,False),('extensao',2,10,90,False),('degrau',2,8,60,False),('flexao',2,10,60,False),('calcanhares',2,12,60,False),('equilibrio',3,20,30,True)],
 [('cadeira',2,10,60,False),('extensao',2,10,60,False),('degrau',2,10,60,False),('calcanhares',2,12,60,False),('abducao',2,12,60,False),('bicicleta',1,600,60,True)]]
associations=[]
for n,items in enumerate(selection,1):
 for i,(key,sets,amount,rest,timed) in enumerate(items,1):
  note=f'Sugestão inicial ajustável: {sets} '+('exposições de '+str(amount)+' segundos' if timed else 'séries de '+str(amount)+' repetições')+f', com {rest} segundos de repouso. '
  if key in ['abducao','equilibrio','degrau','perna-estendida','isometrico-quadricipite','deslizar-calcanhar']:note+='Dose no lado selecionado; adaptar ao treino de ambos os lados se indicado. '
  if key in ['marcha-curta','bicicleta']:note+='Tempo contínuo apenas se tolerado; pode dividir em períodos mais curtos. Ritmo ou resistência iniciais leves, individualizados. '
  note+='Confirmar carga, amplitude, apoio e frequência para este doente. Fazer apenas a seleção prescrita. Reduzir se piorarem o inchaço, a marcha, o sono ou a manhã seguinte.'
  associations.append({'id':uid(f'association:{n}:{key}'),'phase_id':phases[n-1]['id'],'exercise_id':cards[key]['id'],'sort_order':i,'context':'indiferente','is_optional':True,'prescription_defaults':dose(sets,amount,rest,timed),'clinical_note':note})
payload={'protocol':protocol,'phases':phases,'exercises':list(cards.values()),'associations':associations}
(out/'protocolo.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
def literal(v,json_array=False):
 if v is None:return 'NULL'
 if isinstance(v,bool):return 'TRUE' if v else 'FALSE'
 if isinstance(v,(int,float)):return str(v)
 if isinstance(v,dict) or json_array:return "'"+json.dumps(v,ensure_ascii=False).replace("'","''")+"'::jsonb"
 if isinstance(v,list):return 'ARRAY['+','.join(literal(x) for x in v)+']::text[]'
 return "'"+v.replace("'","''")+"'"
sql=['BEGIN;','-- Só inserir registos novos, após confirmar imagens publicadas. Não altera prescrições ou histórico.']
for table,rows in [('wo_exercises',list(cards.values())),('protocols_catalog',[protocol]),('protocol_phases',phases),('protocol_phase_exercises',associations)]:
 for row in rows:sql.append('INSERT INTO public.'+table+' ('+','.join(row)+') VALUES ('+','.join(literal(v,k=='ajustes_maquina') for k,v in row.items())+');')
sql += [f"DO $$ BEGIN IF (SELECT count(*) FROM protocol_phases WHERE protocol_id='{pid}') <> 4 OR (SELECT count(*) FROM protocol_phase_exercises WHERE phase_id IN (SELECT id FROM protocol_phases WHERE protocol_id='{pid}')) <> 24 THEN RAISE EXCEPTION 'Estrutura incompleta'; END IF; END $$;",'COMMIT;']
(out/'aplicar.sql').write_text('\n'.join(sql)+'\n')
print(json.dumps({'id':pid,'phases':len(phases),'cards':len(cards),'associations':len(associations)}))
