"""Gera um protocolo novo e SQL transacional. Não executa SQL nem publica ficheiros."""
import json, uuid, sys, copy
from pathlib import Path

out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
existing=json.loads(Path(sys.argv[2]).read_text())
uid=lambda key:str(uuid.uuid5(uuid.NAMESPACE_URL,'gc:trocanterite:2026-10-28:'+key))
date='2026-10-28';pid=uid('protocol')
base='https://gc.joaomorais.pt/assets/exercicios/trocanterite/2026-10-28/'
sources=[
 {'title':'Mellor et al. 2018 — ensaio LEAP','url':'https://www.bmj.com/content/361/bmj.k1662','doi':'10.1136/bmj.k1662'},
 {'title':'Mellor et al. 2016 — protocolo LEAP','url':'https://pmc.ncbi.nlm.nih.gov/articles/PMC4852446/','doi':'10.1186/s12891-016-1043-6'},
 {'title':'ISHA 2022, publicado em 2023 — consenso','url':'https://pmc.ncbi.nlm.nih.gov/articles/PMC10234389/','doi':'10.1093/jhps/hnac050'},
 {'title':'Clifford et al. 2019 — ensaio piloto de isométricos e isotónicos','url':'https://pubmed.ncbi.nlm.nih.gov/31673402/','doi':'10.1136/bmjsem-2019-000558'}]
protocol={'id':pid,'region':'anca','name':'Trocanterite — síndrome de dor do grande trocânter / tendinopatia glútea','kind':'conservador','is_active':True,'sort_order':10,'data':{'version':1,'versao_clinica':date,'contextos':['Casa','Clínica','Ginásio'],'fontes':sources,'status_revisao':'revisto_com_limites_de_evidencia_2026-10-28','nota_clinica':'Programa conservador para dor lateral da anca clinicamente compatível com tendinopatia glútea. Não é um protocolo pós-operatório nem de rotura aguda. Três fases por evolução clínica; seis opções por fase, com seleção individual.','dose':'Pontos de partida práticos individualizáveis. O conjunto, as doses e os critérios de passagem não foram validados como protocolo único.','auditoria_cientifica':{'data':date,'evidencia':'Educação e exercício apoiados por ensaio clínico; seleção e doses adaptadas para a biblioteca GC.','limites':'O ensaio LEAP estudou dor persistente, não valida por si só a fase altamente irritável nem o retorno ao desporto.','imagens':'Oito ilustrações novas e seis imagens existentes, sujeitas a inspeção visual antes da ativação.'}}}
common_care=['Não forçar alongamentos que cruzem a perna sobre o corpo enquanto provocarem dor lateral da anca.','Evitar progressões bruscas, repetir testes dolorosos ou treinar com claudicação.','Este plano não substitui restrições específicas após cirurgia, traumatismo, suspeita de fratura ou rotura aguda.']
monitor='Faça os movimentos com desconforto ligeiro e tolerável. Como referência inicial, procure não ultrapassar 3/10, salvo indicação individual. Reduza ou interrompa se a dor aumentar, alterar a marcha ou a técnica. A dor deve aproximar-se do habitual após a sessão, sem piorar claramente o sono ou a manhã seguinte; se continuar agravada no dia seguinte, reduza a dose e contacte a equipa.'
alarm='Procure avaliação urgente se não conseguir apoiar a perna após queda, surgir dor súbita intensa, febre com anca quente ou inchada, ou fraqueza/dormência novas. Peça reavaliação se a dor piorar de forma persistente, surgir dor profunda na virilha, ou não houver evolução apesar do plano ajustado.'
sleep='Enquanto houver dor, evite apoiar diretamente a anca dolorosa. Experimente dormir de costas ou sobre o lado mais confortável, com almofada entre as coxas e os joelhos, mantendo a perna de cima apoiada.'
daily='Reduza temporariamente posições que provoquem dor: pernas cruzadas ou ficar apoiado numa só anca com a bacia caída. Distribua o peso pelos dois pés e sente-se para vestir calças, se necessário. Ajuste a altura da cadeira apenas se ajudar.'
clinical=[
 {'title':'Diagnóstico e âmbito','text':'Confirmar quadro clínico e excluir causas relevantes da anca e coluna. SDGT inclui várias estruturas; não equivale sempre a bursite ou a uma rotura. Ecografia/RM dirigidas pela suspeita clínica, fraqueza importante, traumatismo ou evolução atípica; não obrigatórias em todos os casos.'},
 {'title':'Evidência e limites','text':'LEAP 2018: educação e exercício superiores à infiltração na melhoria global às 52 semanas, sem diferença significativa na intensidade da dor nesse momento. População com sintomas persistentes. ISHA é consenso, não valida doses ou testes universais.'},
 {'title':'Individualizar a prescrição','text':'As seis opções são uma biblioteca, não seis exercícios obrigatórios. Escolher em função da irritabilidade, capacidade e objetivo. As doses são sugestões práticas, não uma dose ótima demonstrada. Não exigir zero dor, apoio unipodal de 30 segundos ou percentagem fixa de simetria para todos.'},
 {'title':'Tratamentos associados','text':'Infiltração pode ser ponderada para sintomas selecionados, sem substituir gestão da carga e reabilitação. Após infiltração, respeitar as instruções do médico; a redução da dor não autoriza carga máxima. Não prescrever PRP, ondas de choque ou hormonas como rotina deste programa.'},
 {'title':'Reavaliação','text':'Registar dor noturna, tarefa funcional relevante e tolerância à carga; usar PSFS/VISA-G se adequado. Reavaliar precocemente se deterioração e rever diagnóstico/adesão/dose se não houver tendência favorável. Os critérios abaixo são clínicos e individualizáveis, não limiares validados.'}]
phase_specs=[
 ('Proteção relativa e carga inicial tolerada',[
  'Reduzir a irritabilidade e encontrar uma dose tolerada, sem repouso absoluto.',
  'Manter ativação e recuperar tarefas simples com apoio e controlo.'
 ],[
  ('O seu plano','Faça apenas os exercícios selecionados para si. Nesta fase, começar habitualmente com 2–3 opções. Os dois isométricos são alternativas: escolha um, sem os somar por rotina.'),
  ('Sono e posições',sleep),('Atividades diárias',daily),
  ('Caminhar e manter atividade','Divida a caminhada em períodos curtos e em plano, conforme tolerância. Reduza temporariamente escadas, ladeiras e passos longos se agravarem. Não existe uma duração mínima obrigatória. A bicicleta ou a natação só entram se forem bem toleradas.'),
  ('Frequência','Ativação ligeira pode ser feita numa sessão curta por dia, se tolerada. Na ponte e no sentar/levantar, começar em dias alternados. Não junte todas as opções nem repita sessões para compensar um dia falhado.'),
  ('Resposta ao exercício',monitor),('Quando pedir ajuda',alarm)
 ],[
  'Exercícios iniciais selecionados executados com controlo e sem agravamento sustentado do sono ou da manhã seguinte.',
  'Levantar da cadeira e caminhar a distância útil para o doente com tolerância estável ou em melhoria.',
  'Conseguir aumentar gradualmente a carga sem claudicação crescente; confirmar progressão com a equipa.'
 ]),
 ('Carga progressiva e controlo funcional',[
  'Aumentar gradualmente força e tolerância dos abdutores da anca.',
  'Melhorar sentar/levantar, escadas e controlo da bacia conforme necessidades.'
 ],[
  ('O seu plano','Escolha com a equipa 3–4 opções, sem obrigação de fazer as seis. Substitua variantes semelhantes em vez de acrescentar carga em todas. O apoio unipodal é uma opção de treino, não um exame obrigatório.'),
  ('Sono e posições',sleep),
  ('Frequência e esforço','Comece com 2–3 sessões de força por semana, em dias alternados. Use resistência que permita terminar com mais 2–3 repetições possíveis e sem perder controlo. Os apoios podem ser mais curtos e assistidos.'),
  ('Como progredir','Aumente uma variável de cada vez: repetições, resistência, amplitude ou dificuldade. Ajuste o degrau e mantenha apoio estável se necessário. Nos passos laterais, não cruze as pernas.'),
  ('Atividade cardiovascular','Aumente a caminhada aos poucos, conforme resposta. Na bicicleta, ajuste posição e esforço ao conforto; não suba o selim automaticamente. Na natação, escolha o estilo tolerado, sem impor acessórios ou proibições universais.'),
  ('Resposta ao exercício',monitor),('Quando pedir ajuda',alarm)
 ],[
  'Dose de força acordada tolerada em várias sessões, sem piora progressiva da dor noturna ou da função.',
  'Melhoria das tarefas relevantes: caminhada, cadeira, escadas ou apoio numa perna quando necessário.',
  'Controlo suficiente para a dificuldade seguinte, com adaptação da carga, altura e apoio; não avançar apenas por terem passado semanas.'
 ]),
 ('Capacidade funcional e regresso à atividade exigente',[
  'Recuperar força e resistência para trabalho, lazer ou desporto.',
  'Retomar cargas específicas gradualmente e manter autonomia na gestão do exercício.'
 ],[
  ('O seu plano','Faça as 3–4 opções selecionadas para o seu objetivo. Esta fase também serve tarefas exigentes do dia a dia; não exige praticar desporto. Exercícios numa perna entram apenas quando tolerados.'),
  ('Frequência e recuperação','Faça força habitualmente 2–3 vezes por semana em dias alternados, ajustando à carga do trabalho e do treino. Aumentar a resistência não implica acrescentar exercícios à sessão.'),
  ('Regresso à corrida e ao desporto','Reintroduza primeiro períodos curtos e tolerados do gesto. Na corrida, pode alternar marcha e corrida em plano antes de aumentar duração, velocidade e subidas. Mudanças de direção e saltos exigem preparação específica orientada; não estão automaticamente autorizados por entrar nesta fase.'),
  ('Carga total','Conte também caminhadas longas, escadas, trabalho e treinos. Aumente uma variável de cada vez e observe a resposta até à manhã seguinte. Não existe uma percentagem semanal de aumento adequada para todos.'),
  ('Sono e posições','Use as posições de descanso que lhe sejam confortáveis. As adaptações posturais são ajustadas aos sintomas; não precisa de evitar para sempre um movimento que já tolera.'),
  ('Resposta ao exercício',monitor),('Quando pedir ajuda',alarm)
 ],[
  'Tarefas-alvo e exposições específicas repetidas com confiança, controlo e sem agravamento sustentado.',
  'Força e capacidade avaliadas em relação ao objetivo individual; testes e comparação entre lados quando úteis, sem um limiar universal.',
  'Plano de manutenção definido e conhecimento de como reduzir temporariamente a carga perante uma exacerbação.'
 ])]
phases=[]
for n,(name,goals,recs,criteria) in enumerate(phase_specs,1):
 phase_id=uid('phase'+str(n));data={'nota_ancora':'Progressão por evolução clínica; sem semanas fixas. Doses iniciais ajustáveis pelo prescritor.','objetivos':[{'id':f'o{i}','label':x} for i,x in enumerate(goals,1)],'permitido':['Carga tolerada e progressiva, dentro do plano individual.','Uso de apoio estável e redução de amplitude quando necessários.'],'contraindicacoes':common_care,'hep':['As seis opções não são obrigatórias. Fazer apenas a seleção e a dose prescritas.','As doses do catálogo são pontos de partida práticos e devem ser revistas conforme resposta.'],'recomendacoes':[{'title':t,'text':v} for t,v in recs],'recomendacoes_clinicas':copy.deepcopy(clinical),'criterios_progressao':[{'id':f'p{i}','texto':x} for i,x in enumerate(criteria,1)],'objetivos_serie':[{'id':'s1','tipo':'qualitativo','texto':'Sono, dor na manhã seguinte e tarefa funcional revistos.','escala':'binario'},{'id':'s2','tipo':'qualitativo','texto':'Movimento e dose selecionada tolerados com controlo.','escala':'binario'}],'recommendations_scope':pid+':'+phase_id,'revisao_cientifica':date}
 if n==1:data['recomendacoes_clinicas'].append({'title':'Isométricos','text':'Não prometer analgesia imediata ou superioridade dos isométricos. Começar com esforço submáximo e tempos curtos se irritável. Supino e sentado são alternativas da mesma função; evitar dupla contabilização da carga.'})
 phases.append({'id':phase_id,'protocol_id':pid,'phase_order':n,'name':name,'anchor_kind':'evolucao_clinica','anchor_from':None,'anchor_to':None,'data':data})

cards={}
def card(key,name,position,movement,cautions,equipment=None,goal='Fortalecimento',image=None):
 tech={'posicao_inicial':[position],'execucao':movement,'pontos_chave':cautions+['Faça apenas a dose e a amplitude prescritas. Pare perante dor aguda ou perda de controlo.'],'erros_comuns':['Aumentar a carga ou a amplitude sem conseguir manter o controlo.','Prender a respiração ou continuar apesar de agravamento.'],'dicas':['Respire normalmente. Peça ensino da técnica e adapte o lado exercitado.']}
 labels={'posicao_inicial':'Posição inicial','execucao':'Execução','pontos_chave':'Pontos-chave','erros_comuns':'Erros comuns','dicas':'Dicas'}
 row={'id':uid('exercise:'+key),'name':name,'locais':['Casa','Clínica','Ginásio'],'categoria':['Membro Inferior'],'equipamento':equipment or ['Sem equipamento'],'is_active':True,'created_by':'32a24abe-cd69-42d9-bf3a-3355f4f6e28c','photo_url':image or base+key+'.png','video_url':None,'tecnica_info':tech,'tecnica_notas':'\n\n'.join(labels[k]+'\n'+'\n'.join('• '+x for x in vals) for k,vals in tech.items()),'ajustes_maquina':[],'contextos_exercicio':['Reabilitação'],'objetivos_exercicio':[goal]}
 cards[key]=row
card('isometrico-deitado','Abdução isométrica da anca deitado com elástico','De costas num tapete ou cama firme, joelhos fletidos e pés apoiados à largura da bacia. Elástico em laço à volta das coxas, acima dos joelhos, com tensão ligeira e sem apertar a pele.',['Pressione suavemente as coxas para fora contra o elástico e mantenha os joelhos imóveis à largura da bacia.','Mantenha durante o tempo prescrito, relaxe completamente e repita.'],['A bacia fica apoiada. Escolha resistência que permita manter a posição sem esforço excessivo.','Alternativa ao isométrico sentado; não somar os dois por rotina.'],['Elásticos'])
card('isometrico-sentado','Abdução isométrica da anca sentado com elástico','Sentado numa cadeira estável, pés e joelhos à largura da bacia. Elástico em laço acima dos joelhos, com tensão ligeira e sem apertar a pele.',['Pressione suavemente as coxas para fora, sem movimento dos joelhos.','Mantenha o tronco confortável, respire e relaxe entre exposições.'],['Alternativa ao isométrico deitado, não um exercício adicional obrigatório.'],['Elásticos'])
card('ponte-bilateral','Ponte glútea bilateral — carga inicial','De costas num tapete, joelhos fletidos, pés apoiados à largura da bacia e braços ao lado do corpo.',['Empurre o chão com os dois pés e eleve a bacia apenas até à altura tolerada.','Regresse lentamente, sem arquear excessivamente a região lombar.'],['Distribua o esforço pelos dois pés e não deixe os joelhos cair para dentro.'],['Peso Corporal'])
card('sentar-levantar','Sentar e levantar de cadeira alta — controlo da anca','Cadeira firme encostada à parede, com altura que permita levantar sem esforço excessivo. Pés apoiados à largura da bacia.',['Incline ligeiramente o tronco para a frente e levante-se sem impulso.','Volte a sentar-se devagar, mantendo os joelhos na direção dos pés.'],['Use apoio dos braços se necessário; reduza-o apenas quando conseguir.','Ajuste altura e amplitude ao conforto.'],['Peso Corporal'])
card('transferencia-peso','Transferência lateral de peso com apoio das mãos','De pé diante de apoio estável, mãos apoiadas e ambos os pés no chão à largura da bacia.',['Desloque uma pequena parte do peso para uma perna, mantendo os dois pés apoiados.','Regresse ao centro e alterne, sem deixar a bacia cair para o lado.'],['Movimento pequeno. Não ficar pendurado numa só anca.','Reduza o deslocamento ou substitua a opção se provocar dor.'],goal='Propriocepção / Equilíbrio')
card('abducao-sem-carga','Abdução da anca em pé sem resistência e com apoio','De pé junto a uma cadeira firme, segurando o encosto. Tronco vertical, bacia nivelada e pés paralelos.',['Afaste ligeiramente a perna a exercitar para o lado, mantendo o pé para a frente.','Regresse até à posição inicial, sem cruzar a linha do corpo.'],['Comece com amplitude pequena e sem elástico.','O apoio na outra perna também exige esforço: se agravar os sintomas, escolha uma opção deitada ou sentada.'])
card('step-up','Subida de degrau baixo com apoio — controlo da anca','Diante de um degrau baixo, firme e antiderrapante, com corrimão ao lado. Pé da perna a exercitar totalmente apoiado no degrau.',['Suba com controlo, sem impulso excessivo da perna de trás.','Desça devagar e repita na altura e amplitude prescritas.'],['Mantenha o joelho orientado com o pé e a bacia controlada.','Use o corrimão. Não existe uma altura obrigatória; não use bancos instáveis.'],['Peso Corporal'])
card('apoio-unipodal','Apoio numa perna com apoio da mão — controlo da bacia','De pé ao lado de uma cadeira firme, em chão plano e com olhos abertos. Uma mão apoiada no encosto.',['Transfira o peso para a perna a exercitar e eleve ligeiramente o outro pé.','Mantenha a bacia nivelada pelo tempo prescrito. Volte aos dois apoios e descanse.'],['Ajuste o apoio da mão e o tempo à tolerância. Não deixe a bacia cair.','Não progrida automaticamente para olhos fechados ou superfície instável.'],goal='Propriocepção / Equilíbrio')
images={e['id']:e['photo_url'] for e in existing}
card('abducao-elastico','Abdução da anca com elástico — tendinopatia glútea','De pé com apoio estável disponível, elástico leve nos tornozelos e pés paralelos à largura da bacia.',['Afaste lateralmente a perna a exercitar na amplitude prescrita, sem inclinar o tronco.','Regresse devagar até à largura inicial; não deixe a perna cruzar a linha do corpo.'],['A imagem demonstra a variante sem apoio; use apoio da mão se necessário.','Aumente a resistência só mantendo controlo da bacia e boa tolerância.'],['Elásticos'],image=images['9d2aa349-56f3-4b64-acd4-d6ed0a497fa9'])
card('ponte-unipodal','Ponte unipodal — progressão funcional da anca','De costas, um pé apoiado e joelho fletido. Eleve a outra perna conforme ensino.',['Eleve a bacia pela perna de apoio, dentro da amplitude tolerada.','Desça lentamente, sem rodar a bacia ou arquear a região lombar.'],['A perna livre pode ficar fletida para facilitar; a imagem ilustra uma variante mais exigente.','Substitua pela ponte bilateral se perder controlo ou agravar.'],['Peso Corporal'],image=images['11a70293-9990-4df2-8025-ed9c28f994ec'])
card('agachamento','Agachamento — progressão funcional da anca','De pé, pés numa largura confortável e apoio estável disponível. Começar sem carga externa.',['Fleta a anca e os joelhos dentro da amplitude prescrita, levando a bacia para trás.','Volte a subir com controlo e pés apoiados.'],['Não precisa de atingir a profundidade ilustrada.','Aumente amplitude ou resistência separadamente, conforme o objetivo.'],['Peso Corporal'],image=images['6e0f7ba4-f02f-4c1e-beda-02b42da7aa67'])
card('step-down','Descida lateral de degrau — controlo da anca','De pé sobre um degrau firme e baixo, junto a um corrimão, com uma perna livre ao lado.',['Fleta lentamente a anca e o joelho da perna de apoio, aproximando o calcanhar livre do chão.','Volte a subir sem impulso da perna livre.'],['A imagem mostra uma plataforma alta; use apenas a altura individualmente prescrita.','Joelho acompanha o pé; reduza altura e use apoio antes de aumentar a dificuldade.'],['Peso Corporal'],image=images['21e0a814-794a-4c77-85d1-a92a34ae2ace'])
card('hinge','Dobradiça da anca com halteres — progressão funcional','De pé, pés à largura da bacia e joelhos ligeiramente fletidos. Halteres leves apenas se prescritos.',['Leve a bacia para trás, inclinando o tronco como um conjunto e mantendo os pesos próximos das pernas.','Volte à posição vertical com controlo, sem empurrar a bacia excessivamente para a frente.'],['É um complemento funcional, não um exercício isolado dos tendões glúteos.','A amplitude depende da capacidade de manter controlo; não procure tocar no chão.'],['Halteres'],image=images['cd2d3adf-cb13-477c-b1ea-5b4b6c73c45f'])
card('passos-laterais','Passos laterais com elástico — controlo da anca','De pé com elástico leve nos tornozelos, pés paralelos e ligeira flexão confortável dos joelhos. Apoio próximo se necessário.',['Dê um passo lateral curto, mantendo a bacia controlada.','Aproxime a outra perna apenas até à largura inicial; não cruze nem junte completamente os pés.','Faça os passos prescritos e regresse na direção oposta.'],['Use pouca tensão inicial. Não rode os pés ou balance o tronco para puxar o elástico.','Não precisa de manter um agachamento profundo.'],['Elásticos'],image=images['86dc4451-a392-4a3a-9d6e-bfe452b8c15e'])

def dose(sets,amount,rest=60,timed=False):
 return {'sets':sets,'load':None,'reps_min':None if timed else amount,'reps_max':None if timed else amount,'reps_fixed':None if timed else amount,'series':None if timed else [{'reps':amount,'load':None} for _ in range(sets)],'duration_sec':None,'duration_series':[{'duration_sec':amount} for _ in range(sets)] if timed else None,'rest_set':rest,'rest_next':rest,'tempo_concentrico_s':None if timed else 2,'tempo_excentrico_s':None if timed else 3,'pausa_superior_s':0,'pausa_inferior_s':0}
selections=[
 [('isometrico-deitado',4,10,20,True),('isometrico-sentado',4,10,20,True),('ponte-bilateral',2,8,60,False),('sentar-levantar',2,8,60,False),('transferencia-peso',1,8,30,False),('abducao-sem-carga',1,8,30,False)],
 [('abducao-elastico',2,10,60,False),('ponte-bilateral',2,10,60,False),('sentar-levantar',2,10,60,False),('step-up',2,8,60,False),('apoio-unipodal',3,15,30,True),('passos-laterais',2,6,60,False)],
 [('abducao-elastico',3,10,90,False),('ponte-unipodal',2,8,90,False),('agachamento',3,8,90,False),('step-down',2,8,90,False),('hinge',3,8,90,False),('passos-laterais',2,10,60,False)]]
associations=[]
for n,items in enumerate(selections,1):
 for i,(key,sets,amount,rest,timed) in enumerate(items,1):
  note=('Ponto de partida ajustável: '+(f'{sets} exposições de {amount} segundos' if timed else f'{sets} séries de {amount} repetições')+f', com {rest} segundos de repouso. ')
  if key in ['isometrico-deitado','isometrico-sentado']:note+='Esforço suave, sem movimento; escolher apenas um dos dois isométricos. '
  if key in ['step-up','step-down','abducao-elastico','abducao-sem-carga','ponte-unipodal','apoio-unipodal']:note+='Dose no lado selecionado pelo profissional; ajustar ao exercício de ambos os lados se indicado. '
  if key=='transferencia-peso':note+='Cada repetição corresponde a deslocar para um lado e regressar ao centro, alternando os lados. '
  if key=='passos-laterais':note+='Cada série corresponde aos passos indicados em cada direção, sem cruzar as pernas. '
  note+='Confirmar carga, amplitude, apoio e frequência no plano individual. Reduzir se houver agravamento do sono ou da manhã seguinte. Não fazer automaticamente todas as opções da fase.'
  associations.append({'id':uid(f'association:{n}:{key}'),'phase_id':phases[n-1]['id'],'exercise_id':cards[key]['id'],'sort_order':i,'context':'indiferente','is_optional':True,'prescription_defaults':dose(sets,amount,rest,timed),'clinical_note':note})
payload={'protocol':protocol,'phases':phases,'exercises':list(cards.values()),'associations':associations}
(out/'protocolo.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
def literal(value):
 if value is None:return 'NULL'
 if isinstance(value,bool):return 'TRUE' if value else 'FALSE'
 if isinstance(value,(int,float)):return str(value)
 if isinstance(value,dict):return "'"+json.dumps(value,ensure_ascii=False).replace("'","''")+"'::jsonb"
 if isinstance(value,list):return 'ARRAY['+','.join(literal(x) for x in value)+']::text[]' if all(isinstance(x,str) for x in value) else "'"+json.dumps(value,ensure_ascii=False).replace("'","''")+"'::jsonb"
 return "'"+value.replace("'","''")+"'"
sql=['BEGIN;','-- Aplicar apenas depois de publicar e verificar todas as imagens e o cartão de acesso.','-- Só INSERT: não altera os nove protocolos existentes nem planos/sessões/histórico.']
for table,rows in [('wo_exercises',list(cards.values())),('protocols_catalog',[protocol]),('protocol_phases',phases),('protocol_phase_exercises',associations)]:
 for row in rows:
  keys=list(row)
  values=[("'"+json.dumps(row[k],ensure_ascii=False).replace("'","''")+"'::jsonb") if k=='ajustes_maquina' else literal(row[k]) for k in keys]
  sql.append('INSERT INTO public.'+table+' ('+','.join(keys)+') VALUES ('+','.join(values)+');')
sql+=['DO $$ BEGIN',f"IF (SELECT count(*) FROM protocol_phases WHERE protocol_id='{pid}') <> 3 THEN RAISE EXCEPTION 'Esperadas três fases'; END IF;",f"IF (SELECT count(*) FROM protocol_phase_exercises WHERE phase_id IN (SELECT id FROM protocol_phases WHERE protocol_id='{pid}')) <> 18 THEN RAISE EXCEPTION 'Esperadas 18 opções'; END IF;",'END $$;','COMMIT;']
(out/'aplicar.sql').write_text('\n'.join(sql)+'\n')
print(json.dumps({'protocol_id':pid,'phases':len(phases),'exercises':len(cards),'associations':len(associations),'sql':str(out/'aplicar.sql')},ensure_ascii=False))
