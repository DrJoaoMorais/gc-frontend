"""Prepara seis opções complementares. Não executa SQL nem altera fases existentes."""
import json, uuid, html
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = root / 'docs/protocolos/mobilidade-anca-20261029'
out.mkdir(parents=True, exist_ok=True)
uid = lambda key: str(uuid.uuid5(uuid.NAMESPACE_URL, 'gc:mobilidade-anca:2026-10-29:' + key))
pid = '814aadc3-d054-536c-b67b-a854de80d655'
phase_id = uid('block')
base = 'https://gc.joaomorais.pt/assets/exercicios/mobilidade-anca/2026-10-29/'
sources = [
    {'title': 'APTA/JOSPT 2025 — programa individualizado na coxartrose', 'url': 'https://www.orthopt.org/uploads/content_files/files/Hip_pain_and_mobility_deficits_hip_osteoarthritis_2025.pdf', 'doi': '10.2519/jospt.2025.0301'},
    {'title': 'NHS inform — exercício e adaptação dos sintomas na artrose da anca', 'url': 'https://www.nhsinform.scot/illnesses-and-conditions/muscle-bone-and-joints/leg-and-foot-problems-and-conditions/exercises-for-osteoarthritis-of-the-hip/'},
]
specs = [
    ('figura-quatro', 'Figura 4 na cadeira — mobilidade dinâmica',
     'Sente-se numa cadeira firme e suficientemente alta. Apoie um pé no chão e coloque o tornozelo oposto sobre a coxa, acima do joelho, apenas se o conseguir fazer sem forçar.',
     ['Mantenha o joelho da perna cruzada numa posição confortável, sem o empurrar.', 'Incline ligeiramente o tronco à frente a partir da anca, com as costas direitas, e volte à posição inicial. Um avanço e regresso contam como uma repetição.'],
     ['Se não conseguir colocar o tornozelo sem dor, não faça esta variante; peça uma alternativa.', 'Não comprima o joelho nem procure chegar com o peito à perna. Pare perante pontada na virilha.'],
     'Comece com uma inclinação muito pequena. Aumente-a apenas se confortável, mantendo o apoio e sem empurrar o joelho.',
     'Inspirado no objetivo de mobilidade do pigeon; não é uma variante biomecanicamente equivalente comprovada. Pigeon elevado ou no chão apenas após avaliação e ensino próprios; não é uma progressão obrigatória.'),
    ('passada-transicao', 'Transição em passada — frente e parte posterior da coxa',
     'De pé, com as duas mãos numa bancada firme, coloque um pé à frente e outro atrás, mantendo distância lateral entre eles.',
     ['Avance suavemente a bacia, dobrando o joelho da frente, sem arquear as costas. O calcanhar de trás pode levantar ligeiramente.', 'Recue a bacia, estenda parcialmente o joelho da frente e mantenha esse calcanhar apoiado, levantando ligeiramente os dedos se confortável. Regresse ao avanço. O ciclo completo conta como uma repetição.'],
     ['Use uma passada curta e movimente-se devagar, sem balanços.', 'Não force o joelho a esticar nem procure uma sensação de alongamento intensa.'],
     'Aumente primeiro o controlo e depois, se tolerado, um pouco a amplitude. Mantenha as mãos apoiadas.',
     'Adaptação em pé da transição flexores da anca/isquiotibiais em meio-ajoelhado. A variante ajoelhada depende da tolerância da anca e joelho e da capacidade de transferência; requer ensino separado.'),
    ('abertura-degrau', 'Abertura da anca com pé num degrau baixo',
     'De pé junto de uma bancada firme, apoie uma mão e coloque o pé oposto num degrau baixo e estável, inicialmente cerca de 10–15 cm.',
     ['Com o tronco direito, abra ligeiramente o joelho da perna elevada para fora, num movimento pequeno da anca.', 'Deixe o pé acompanhar suavemente a orientação do joelho, sem o prender ao degrau. Regresse ao centro. Abertura e regresso contam como uma repetição.'],
     ['Não empurre o joelho com a mão nem torça o joelho sobre um pé fixo.', 'Mantenha o outro pé no chão e a bacia estável. Não suba para o degrau durante este exercício.'],
     'Use menor altura ou menor abertura se necessário. Aumente apenas a abertura confortável, mantendo apoio e controlo.',
     'Adaptação apoiada do hip opener. Confirmar que o pé acompanha a rotação, sem torção tibiofemoral. Meio-ajoelhado apenas com capacidade e tolerância adequadas; sem progressão automática da altura.'),
    ('passada-bancada', 'Passada curta com apoio na bancada — mobilidade da anca',
     'De pé diante de uma bancada firme, apoie as duas mãos. Coloque um pé à frente e outro atrás, sem alinhar os pés numa linha estreita.',
     ['Mantenha o pé da frente apoiado e avance ligeiramente a bacia, dobrando o joelho da frente. O calcanhar de trás pode ficar levantado.', 'Conserve o peito elevado e regresse à posição inicial. O avanço e regresso contam como uma repetição; não há rotação do tronco.'],
     ['Use um avanço pequeno, sem afundar a bacia nem arquear a região lombar.', 'Ao contrário da transição frente/trás, o objetivo aqui é um avanço controlado, sem procurar alongar a parte posterior da coxa. Pode escolher apenas um destes dois exercícios.'],
     'Aumente ligeiramente o avanço se tolerado. Mantenha o apoio alto; não desça as mãos para o chão por iniciativa própria.',
     'Adaptação acessível inspirada no Spiderman; não reproduz integralmente o exercício no chão. Redundância parcial com passada-transição: selecionar conforme défice e preferência, não somar por rotina. Apoio baixo/chão só com tolerância de anca, joelho e punho e ensino próprio.'),
    ('circulos-anca', 'Círculos pequenos da anca em pé com apoio',
     'De pé junto de uma bancada firme, apoie uma mão. Dobre ligeiramente a perna mais afastada da bancada e levante o pé apenas o necessário para o libertar do chão.',
     ['Desenhe pequenos círculos com o joelho, com movimento lento da anca e sem rodar o tronco.', 'Complete os círculos no sentido prescrito e depois inverta. Cada círculo conta como uma repetição. Pouse o pé para descansar quando necessário.'],
     ['Mantenha a bacia nivelada. Não é necessário elevar o joelho à altura da anca.', 'Se perder equilíbrio ou inclinar o tronco, faça círculos menores ou pare e peça adaptação.'],
     'Comece com círculos muito pequenos e apoio firme. Aumente apenas a amplitude confortável, sem retirar o apoio para dificultar.',
     'Dose inicial de cinco círculos em cada sentido no lado selecionado, com pausas conforme necessário. Quadrupedia é alternativa, não grau obrigatório; avaliar tolerância de punhos/joelhos e capacidade de ir ao chão.'),
    ('recuo-bacia', 'Recuo da bacia com mãos na bancada',
     'De pé diante de uma bancada firme, apoie as duas mãos. Mantenha os pés paralelos numa largura confortável e os joelhos ligeiramente dobrados.',
     ['Leve devagar a bacia para trás, dobrando na anca e mantendo as costas numa posição confortável, sem as arredondar de propósito.', 'Regresse à posição inicial. Um recuo e regresso contam como uma repetição. Mantenha as mãos apoiadas e os pés no chão.'],
     ['Não é um agachamento profundo. Não force o peito para baixo nem procure a amplitude da imagem.', 'Ajuste a distância à bancada para manter o apoio e não provocar dor na anca ou nos ombros.'],
     'Comece com um recuo curto. Aumente-o apenas se confortável; mantenha a altura e o apoio que permitem controlo.',
     'Adaptação em pé do rock-back/dynamic child pose. Quadrupedia com recuo curto apenas após avaliação das transferências e da tolerância de joelhos/punhos. Não exigir sentar nos calcanhares.'),
]
recs = [
    {'title': 'Opções complementares', 'text': 'Este bloco complementa o seu plano. Faça apenas os exercícios selecionados para si; não é obrigatório realizar os seis nem somá-los a todos os exercícios de força.'},
    {'title': 'Como começar', 'text': 'Comece com movimentos pequenos e lentos, sem forçar. A sugestão inicial é uma série de cinco repetições, conforme a dose prescrita. A equipa pode ajustar o lado e a frequência. Nos círculos, faça cinco em cada sentido se essa for a indicação.'},
    {'title': 'Como evoluir', 'text': 'Se tolerar bem várias sessões, pode aumentar gradualmente até oito a dez repetições, conforme o plano. Altere uma coisa de cada vez. Ir ao chão ou retirar o apoio não são objetivos obrigatórios.'},
    {'title': 'Quando reduzir ou parar', 'text': 'Pare esse movimento se surgir pontada na virilha, dor crescente, bloqueio ou perda de equilíbrio. Se piorarem a marcha, o sono ou a manhã seguinte, reduza a dose e peça ajuste do plano.'},
    {'title': 'Apoios e adaptações', 'text': 'Use cadeira, bancada e degrau estáveis. A variante depende do que consegue fazer com conforto e controlo. Após cirurgia da anca, siga as restrições específicas e confirme este plano com a equipa.'},
    {'title': 'Quando pedir ajuda', 'text': 'Procure avaliação urgente se tiver dor súbita e forte com dificuldade em apoiar a perna, sobretudo após queda, ou febre com dor importante. Contacte a equipa perante agravamento persistente ou perda rápida de movimento.'},
]
phase = {'id': phase_id, 'protocol_id': pid, 'phase_order': 5, 'name': 'Mobilidade dinâmica — opções complementares', 'anchor_kind': 'evolucao_clinica', 'anchor_from': None, 'anchor_to': None,
         'data': {'nota_ancora': 'Bloco complementar selecionável em qualquer fase, após avaliação; não é uma quinta etapa obrigatória.', 'objetivos': [{'id': 'o1', 'label': 'Explorar movimentos confortáveis com adaptações e apoio.'}], 'hep': ['Seis opções complementares; fazer apenas a seleção prescrita.'], 'permitido': ['Movimentos lentos em amplitude tolerada, com apoio estável.'], 'contraindicacoes': ['Não forçar dor aguda, bloqueio ou perda de equilíbrio.'], 'recomendacoes': recs,
                  'recomendacoes_clinicas': [{'title': 'Evidência e limites', 'text': 'A norma APTA/JOSPT 2025 apoia exercício individualizado, incluindo flexibilidade, força e resistência. Não demonstra superioridade desta sequência, destas adaptações ou da dose proposta. NHS inform apoia introdução gradual e ajuste se os sintomas piorarem. A dose de cinco a dez repetições é prática, não um limiar validado.'}, {'title': 'Seleção e progressão', 'text': 'Este bloco não depende da conclusão da manutenção. Escolher pela mobilidade, irritabilidade, equilíbrio, tarefas e preferências. Idade ou IMC isolados não determinam capacidade. Não excluir nem impor variantes no chão com base nesses fatores. Manter reforço e atividade aeróbia. Posições avançadas exigem avaliação e ensino próprios; não estão prescritas pelas imagens acessíveis.'}],
                  'criterios_progressao': [{'id': 'p1', 'texto': 'Ajustar pela resposta e controlo; não há prazo, amplitude ou transição para o chão obrigatórios.'}], 'objetivos_serie': [], 'fontes': sources, 'recommendations_scope': pid + ':' + phase_id, 'revisao_cientifica': '2026-10-29'}}
cards, associations = [], []
for order, (key, name, start, execution, care, progression, clinical) in enumerate(specs, 1):
    tech = {'posicao_inicial': [start], 'execucao': execution, 'pontos_chave': care + ['Adaptação e progressão: ' + progression], 'erros_comuns': ['Forçar amplitude, usar balanços ou continuar perante dor aguda.'], 'dicas': ['Respire normalmente. Execute apenas a dose e o lado selecionados para si.']}
    eid = uid('exercise:' + key)
    cards.append({'id': eid, 'name': name, 'locais': ['Casa', 'Clínica', 'Ginásio'], 'categoria': ['Membro Inferior'], 'equipamento': ['Sem equipamento'], 'is_active': True, 'created_by': '32a24abe-cd69-42d9-bf3a-3355f4f6e28c', 'photo_url': base + key + '.png', 'video_url': None, 'tecnica_info': tech, 'tecnica_notas': '\n\n'.join(k.replace('_', ' ') + '\n' + '\n'.join('• ' + s for s in v) for k, v in tech.items()), 'ajustes_maquina': [], 'contextos_exercicio': ['Reabilitação'], 'objetivos_exercicio': ['Mobilidade / Alongamento']})
    dose = {'sets': 1, 'load': None, 'reps_min': 5, 'reps_max': 5, 'reps_fixed': 5, 'series': [{'reps': 5, 'load': None}], 'duration_sec': None, 'duration_series': None, 'rest_set': 30, 'rest_next': 30, 'tempo_concentrico_s': 2, 'tempo_excentrico_s': 2, 'pausa_superior_s': 0, 'pausa_inferior_s': 0}
    associations.append({'id': uid('association:' + key), 'phase_id': phase_id, 'exercise_id': eid, 'sort_order': order, 'context': 'indiferente', 'is_optional': True, 'prescription_defaults': dose, 'clinical_note': 'Sugestão ajustável: uma série de cinco repetições no lado selecionado, com 30 segundos de repouso conforme necessário. ' + ('Nos círculos, cinco em cada sentido; pausar entre sentidos. ' if key == 'circulos-anca' else '') + 'Confirmar lado, apoio, amplitude e frequência antes de prescrever. Fazer apenas a seleção individual; não somar os seis por rotina.'})
    phase['data']['recomendacoes_clinicas'].append({'title': name + ' — escolha da variante', 'text': clinical})
payload = {'existing_protocol_id': pid, 'phases': [phase], 'exercises': cards, 'associations': associations}
(out / 'protocolo.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')

def literal(v, json_array=False):
    if v is None: return 'NULL'
    if isinstance(v, bool): return 'TRUE' if v else 'FALSE'
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, dict) or json_array: return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    if isinstance(v, list): return 'ARRAY[' + ','.join(literal(x) for x in v) + ']::text[]'
    return "'" + v.replace("'", "''") + "'"

sql = ['BEGIN;', '-- Apenas INSERT de seis fichas e um bloco; não altera fases nem prescrições anteriores.', f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM protocols_catalog WHERE id='{pid}' AND is_active) OR EXISTS (SELECT 1 FROM protocol_phases WHERE protocol_id='{pid}' AND phase_order=5) THEN RAISE EXCEPTION 'Confirmar protocolo e posição do bloco'; END IF; END $$;"]
for table, rows in [('wo_exercises', cards), ('protocol_phases', [phase]), ('protocol_phase_exercises', associations)]:
    for row in rows:
        sql.append('INSERT INTO public.' + table + ' (' + ','.join(row) + ') VALUES (' + ','.join(literal(v, k == 'ajustes_maquina') for k, v in row.items()) + ');')
sql += [f"DO $$ BEGIN IF (SELECT count(*) FROM protocol_phase_exercises WHERE phase_id='{phase_id}') <> 6 THEN RAISE EXCEPTION 'Bloco incompleto'; END IF; END $$;", 'COMMIT;']
(out / 'aplicar.sql').write_text('\n'.join(sql) + '\n')
esc = lambda v: html.escape(str(v))
parts = ['<!doctype html><html lang="pt-PT"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mobilidade dinâmica da anca</title><style>body{font:17px/1.5 system-ui;color:#173655;background:#eff4f8;margin:0}main{max-width:1040px;margin:auto;padding:24px}article,details{background:white;padding:20px;border-radius:14px;margin:16px 0}img{width:100%;max-height:440px;object-fit:contain}summary{cursor:pointer;font-weight:bold}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}button{padding:12px;background:#245bec;color:white;border:0;border-radius:8px}</style><main><h1>Mobilidade dinâmica da anca</h1><p>Pré-visualização das seis opções complementares. Apenas a seleção individual será prescrita.</p><details id="recs" open><summary>Recomendações</summary>']
parts += ['<h3>' + esc(r['title']) + '</h3><p>' + esc(r['text']) + '</p>' for r in recs]
parts += ['</details><button onclick="document.getElementById(\'recs\').open=false;document.getElementById(\'exercicios\').scrollIntoView()">Ir para os exercícios</button><div class="grid" id="exercicios">']
for e in cards:
    parts.append('<article><img src="../../../assets/exercicios/mobilidade-anca/2026-10-29/' + esc(e['photo_url'].split('/')[-1]) + '" alt="' + esc(e['name']) + '"><h2>' + esc(e['name']) + '</h2><p>Sugestão inicial: 1 × 5 movimentos lentos no lado selecionado. Repouso: 30 s conforme necessário.' + (' Nos círculos: cinco em cada sentido.' if 'Círculos' in e['name'] else '') + '</p>')
    for key, label in [('posicao_inicial', 'Posição inicial'), ('execucao', 'Execução'), ('pontos_chave', 'Cuidados e adaptação')]:
        parts.append('<h3>' + label + '</h3><ul>' + ''.join('<li>' + esc(s) + '</li>' for s in e['tecnica_info'][key]) + '</ul>')
    parts.append('</article>')
parts.append('</div><p>Revisão: 29/10/2026. Esta pré-visualização não é uma prescrição individual.</p></main></html>')
(out / 'preview.html').write_text('\n'.join(parts))
print(json.dumps({'phase_id': phase_id, 'cards': len(cards), 'associations': len(associations)}))
