"""Preview loopback da implementação real, com dados sintéticos e escrita em memória."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json

ROOT = Path(__file__).resolve().parents[1]
SEED = r'''
export function abrirDemonstracao(catalogo) {
  G.sessionUser={id:'demo-medico'}; G.clinics=[{id:'demo-clinica',name:'Clínica de demonstração'}];
  _state=freshState();_state.patient={id:'demo-doente',full_name:'Doente de demonstração'};_state.clinicId='demo-clinica';
  _state.startDate='2026-11-02';_state.endDate='2026-11-29';_state.linkExpiryDate='2026-11-16';
  _state.exercisesCatalog=catalogo;_state.catalogLoaded=true;_calendarFirstMonday='2026-11-02';
  renderStep2();
  for(const [bloco,dias] of [['inteiro',[0,2,4]],['superiores',[1,3]],['core',[5,6]]]) {
    _biblioteca.bloco=bloco;_biblioteca.dias=new Set(dias);aplicarCircuitoPreFeito();
  }
  _biblioteca.bloco=null;_biblioteca.mensagem='Exemplo: Corpo inteiro à 2.ª/4.ª/6.ª, Membros superiores à 3.ª/5.ª e Core ao fim de semana.';_state.activePrescriptionId='demo-plano';
  window.registoDemo={id:'demo-plano',token:'demonstracao-sem-acesso-real',data:buildFinalData(),expires_at:'2026-11-16T23:59:59.000Z',status:'active'};
  _state.savedFingerprint=JSON.stringify(buildFinalData());_embeddedCare={savedFingerprint:_state.savedFingerprint,onSaved:async()=>{}};renderStep2();
}
'''
HTML = '''<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GC — Prescrição atual · Demonstração</title>
<style>body{margin:0;font:14px/1.5 system-ui;background:#f1f5fa;color:#172f51}*{box-sizing:border-box}.demo-head{background:#172f51;color:white;padding:15px 24px}.demo-head strong{font-size:20px}.demo-head p{margin:4px 0 0;color:#d3dfef}.demo-main{max-width:1460px;margin:0 auto;padding:20px}button,input,select{font:inherit}button{cursor:pointer}#demo-result{position:sticky;bottom:0;background:#e7f3eb;color:#164526;padding:12px 20px}#demo-result:empty{display:none}</style>
<link rel="stylesheet" href="/modules/exercicio/prescricao/prescricao.css"></head><body><header class="demo-head"><strong>GC · Versão atual da prescrição</strong><p>Demonstração da implementação real · Doente fictício · Alterações apenas nesta página</p></header><main class="demo-main"><div id="gcwoPrescricaoRoot">A carregar…</div></main><div id="demo-result" role="status"></div>
<script type="module">
window.sb={from(table){let patch=null;const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},gt(){return q},update(v){patch=v;return q},insert(v){patch=v;return q},async maybeSingle(){return{data:table==='wo_prescriptions'?window.registoDemo:null,error:null}},async single(){if(table==='wo_prescriptions'&&patch){window.registoDemo={...window.registoDemo,...structuredClone(patch)};document.getElementById('demo-result').textContent='Demonstração: alteração guardada apenas na memória desta página. Nenhum dado foi enviado ao GC.';}return{data:table==='wo_prescriptions'?window.registoDemo:null,error:null}},then(resolve){resolve({data:[],error:null});}};return q;}};
try{const catalogo=await (await fetch('/_preview/catalogo.json')).json();const m=await import('/modules/exercicio/prescricao/prescricao.js');m.abrirDemonstracao(catalogo);}catch(e){document.getElementById('gcwoPrescricaoRoot').textContent='Não foi possível abrir a demonstração: '+e.message;console.error(e);}
</script></body></html>'''

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = unquote(urlsplit(self.path).path)
        if route in ('/', '/preview'):
            body, mime = HTML.encode(), 'text/html; charset=utf-8'
        elif route == '/_preview/catalogo.json':
            catalogo = json.loads((ROOT/'tests/fixtures/catalogo-173.json').read_text())
            for ex in catalogo:
                for key in ('photo_url', 'video_url'):
                    ex[key] = None
            body, mime = json.dumps(catalogo).encode(), 'application/json'
        elif route.startswith('/modules/') and route.endswith(('.js', '.css')):
            file = (ROOT/route.lstrip('/')).resolve()
            if not file.is_relative_to(ROOT/'modules') or not file.is_file():
                return self.send_error(404)
            source = file.read_text()
            if route == '/modules/exercicio/prescricao/prescricao.js':
                source += '\n' + SEED
            body, mime = source.encode(), 'text/css' if route.endswith('.css') else 'text/javascript'
        else:
            return self.send_error(404)
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; form-action 'none'")
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
    print('Pré-visualização: http://127.0.0.1:8765', flush=True)
    server.serve_forever()
