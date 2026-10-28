"""Cria uma pré-visualização local do conteúdo exato do novo protocolo."""
import json,html
from pathlib import Path
root=Path(__file__).resolve().parents[2]
folder=root/'docs/protocolos/trocanterite-20261028'
d=json.loads((folder/'protocolo.json').read_text())
esc=lambda x:html.escape(str(x))
E={e['id']:e for e in d['exercises']}
parts=['<!doctype html><html lang="pt-PT"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Trocanterite — pré-visualização GC</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#173655;background:#eff4f8;margin:0}main{max-width:1080px;margin:auto;padding:24px}h1{font-size:27px}h2{font-size:23px}h3{font-size:18px}section{background:white;border-radius:16px;padding:24px;margin:24px 0}p{margin:.6em 0}summary{font-weight:700;cursor:pointer}button,a.phase{color:white;background:#245bec;border:0;border-radius:8px;padding:12px 16px;cursor:pointer;text-decoration:none;display:inline-block;margin:4px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.exercise{border:1px solid #d9e2ec;border-radius:12px;padding:16px}.exercise img{width:100%;height:220px;object-fit:contain}.dose{background:#edf3ff;padding:10px;border-radius:7px;font-weight:600}.muted{color:#5e7185}.notice{background:#fff4d6;padding:14px;border-radius:10px}li{margin:.5em 0}footer{font-size:14px;color:#5e7185}</style><main><p class="muted">Pré-visualização local · conteúdo para a biblioteca GC</p><h1>Trocanterite — dor lateral da anca</h1><p class="notice">Este exemplo mostra as opções da biblioteca. O seu plano inclui apenas os exercícios e doses selecionados pelo profissional.</p>']
parts.append('<nav>'+''.join(f'<a class="phase" href="#fase{p["phase_order"]}">Fase {p["phase_order"]}</a>' for p in d['phases'])+'</nav>')
for p in d['phases']:
 n=p['phase_order'];data=p['data'];parts.append(f'<section id="fase{n}"><h2>Fase {n} — {esc(p["name"])}</h2><p class="muted">Progressão pela resposta clínica, sem semanas fixas.</p>')
 parts.append(f'<details id="recs{n}" '+('open' if n==1 else '')+'><summary>Recomendações desta fase</summary>')
 for r in data['recomendacoes']:parts.append(f'<h3>{esc(r["title"])}</h3><p>{esc(r["text"])}</p>')
 parts.append('</details>'+f'<button type="button" onclick="document.getElementById(\'recs{n}\').open=false;document.getElementById(\'ex{n}\').scrollIntoView({{behavior:\'smooth\'}})">Ir para os exercícios ↓</button>')
 parts.append(f'<h3 id="ex{n}">Seis opções — seleção individual</h3><div class="grid">')
 for a in sorted([a for a in d['associations'] if a['phase_id']==p['id']],key=lambda a:a['sort_order']):
  e=E[a['exercise_id']];dose=a['prescription_defaults'];timed=bool(dose['duration_series']);v=dose['duration_series'][0]['duration_sec'] if timed else dose['reps_fixed'];unit='segundos' if timed else 'repetições'
  url=e['photo_url'];prefix='https://gc.joaomorais.pt/'
  if url.startswith(prefix):url='../../../'+url[len(prefix):]
  parts.append(f'<article class="exercise"><img src="{esc(url)}" alt="{esc(e["name"])}"><h3>{esc(e["name"])}</h3><p class="dose">Sugestão inicial: {dose["sets"]} × {v} {unit}<br>Repouso: {dose["rest_set"]} s</p><details><summary>Como fazer e adaptar</summary>')
  for key,label in [('posicao_inicial','Posição inicial'),('execucao','Execução'),('pontos_chave','Cuidados')]:parts.append('<h4>'+label+'</h4><ul>'+''.join('<li>'+esc(x)+'</li>' for x in e['tecnica_info'][key])+'</ul>')
  parts.append('<p>'+esc(a['clinical_note'])+'</p></details></article>')
 parts.append('</div><h3>Antes de progredir</h3><ul>'+''.join('<li>'+esc(x['texto'])+'</li>' for x in data['criterios_progressao'])+'</ul></section>')
parts.append('<footer>Revisão do conteúdo: 28/10/2026. Esta pré-visualização não representa uma prescrição individual nem confirma publicação no GC.</footer></main></html>')
(folder/'preview.html').write_text('\n'.join(parts))
print(folder/'preview.html')
