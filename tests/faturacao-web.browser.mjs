import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1120,height:900}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://faturacao.test/**', async route => {
    const {pathname} = new URL(route.request().url());
    if (pathname === '/') return route.fulfill({contentType:'text/html',
      body:'<!doctype html><html lang="pt"><meta name="viewport" content="width=device-width,initial-scale=1"><main class="gc-content"></main></html>'});
    if (pathname === '/modules/faturacao-visual.css') return route.fulfill({contentType:'text/css',body:await readFile(new URL('..'+pathname,import.meta.url),'utf8')});
    if (!/^\/modules\/[\w./-]+\.js$/.test(pathname)) return route.abort();
    const body = await readFile(new URL('..'+pathname,import.meta.url),'utf8');
    return route.fulfill({contentType:'text/javascript',body});
  });
  await page.goto('http://faturacao.test/');
  await page.evaluate(async () => {
    const {parseWebPrice} = await import('/modules/faturacao-web.js');
    const {lisbonDay} = await import('/modules/agenda-fecho-model.js');
    const day = lisbonDay(new Date());
    const appointment = (id,patient_id) => ({
      id,clinic_id:'web',patient_id,start_at:day+'T12:00:00Z',status:'done',financial_status:'normal',mode:'consulta'
    });
    const record = (id,booking,full_name) => ({
      id,entidade_id:'e-web',appointment_id:booking.id,patient_id:booking.patient_id,data:day,tipo_acto:'Consulta',
      appt_status:'done',financial_status:'normal',valor:0,valor_faturado:null,web_preco_pendente:true,
      patients:{full_name,nif:'123456789',address_line1:'Rua de teste',postal_code:'1234-567',city:'Lisboa'},
      updated_at:'2026-01-01T00:00:00Z'
    });
    const appointments = [appointment('a','p1'),appointment('b','p2')];
    const records = [record('r1',appointments[0],'Doente A'),record('r2',appointments[1],'Doente B')];
    const thirdBooking = {...appointment('c','p3'),clinic_id:'ath'};
    appointments.push(thirdBooking);
    records.push({...record('r3',thirdBooking,'Doente C'),entidade_id:'e-ath',valor:65,valor_faturado:65,web_preco_pendente:false});
    const recipient = 'faturacao@example.invalid,segundo@example.invalid';
    const tables = {
      clinics:[{id:'web',slug:'joao-morais-web',is_active:true,extra_fields:{faturacao_web_desde:day}},
        {id:'novo',slug:'novo-cuidar',is_active:true,billing_email:null},{id:'ath',slug:'athletix',is_active:true}],
      entidades_financeiras:[{id:'e-web',clinic_id:'web',ativa:true,tipo:'acto',nome:'João Morais Web'},{id:'e-ath',clinic_id:'ath',ativa:true,tipo:'acto',nome:'Athletix'}],
      presencas:[],registos_financeiros:records,appointments,clinic_prices:[],controlo_faturacao:[]
    };
    window.testPrices = ['65','53,25','0','65.555',''].map(parseWebPrice);
    window.configureTestEmail = () => { tables.clinics[1].billing_email = recipient; };
    window.calls = [];
    window.sb = {
      from(table) {
        const predicates = [];
        let first = 0;
        let last = Infinity;
        const query = {
          select:()=>query, eq:(key,value)=>{predicates.push(r=>r[key]===value);return query;},
          in:(key,values)=>{predicates.push(r=>values.includes(r[key]));return query;},
          gte:(key,value)=>{predicates.push(r=>r[key]>=value);return query;},
          lt:(key,value)=>{predicates.push(r=>r[key]<value);return query;},
          order:()=>query,range:(a,b)=>{first=a;last=b;return query;},
          then:resolve=>resolve({data:tables[table].filter(r=>predicates.every(p=>p(r))).slice(first,last+1)}),
        };
        return query;
      },
      async rpc(name,args) {
        const {p_acao:action,p_itens:items} = args;
        window.calls.push({name,args});
        const row = records.find(r=>r.id===items[0].id);
        const now = new Date().toISOString();
        const preview = {recipient,subject:'Pedido de faturação | João Morais Web',body:'Doente A\nConsulta: 65,00 €'};
        if (action==='preco') Object.assign(row,{valor_faturado:items[0].preco,web_preco_confirmado_at:now});
        if (action==='prever') return {data:preview};
        if (action==='pedido') {
          for (const item of items) {
          const row = records.find(r=>r.id===item.id);
          row.web_pedido_id = 'pedido1';
          tables.controlo_faturacao.push({id:'h'+row.id,entidade_id:row.entidade_id,granularidade:'registo',chave:row.id,
            data_referencia:day,registo_financeiro_id:row.id,envio_id:'pedido1',estado:'por_enviar',
            envio:{snapshot:{...preview,circuito:'web_novo_cuidar',items}}});
          }
          return {data:{id:'pedido1'}};
        }
        if (action==='envio') tables.controlo_faturacao.forEach(entry=>entry.enviado_contabilista_at=now);
        const field = {doente:'web_recebido_doente_at',transferencia:'web_transferido_at',honorarios:'web_honorarios_recebidos_at'}[action];
        if (field) row[field]=now;
        return {data:{}};
      },
    };
    const {G} = await import('/modules/state.js');
    G.role = 'medico';
    const {renderFinancas} = await import('/modules/financas.js');
    await renderFinancas();
  });

  await page.getByRole('button',{name:'Faturação',exact:true}).click();
  await page.getByRole('button',{name:'Preparar pedido do dia'}).click();
  assert.deepEqual(await page.evaluate(()=>window.testPrices),[65,53.25,null,null,null]);
  const first = page.getByRole('row').filter({hasText:'Doente A'});
  const second = page.getByRole('row').filter({hasText:'Doente B'});
  await first.getByRole('radio',{name:'65 €'}).check();
  await first.getByRole('button',{name:'Confirmar preço'}).click();
  await second.getByRole('radio',{name:'Outro'}).check();
  await second.getByLabel('Outro preço em euros').fill('53,25');
  await second.getByRole('button',{name:'Confirmar preço'}).click();
  await first.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Pré-visualizar pedido'}).click();
  await page.getByText('Destinatário Por configurar').waitFor();
  assert.equal(await page.getByRole('button',{name:'Registar pedido para envio'}).count(),0);
  await page.evaluate(()=>window.configureTestEmail());
  await page.getByRole('button',{name:'Consultar'}).click();
  await page.getByRole('button',{name:'Selecionar consultas do dia'}).click();
  await second.getByRole('checkbox').uncheck();
  await page.getByRole('button',{name:'Pré-visualizar pedido'}).click();
  await page.getByText('Consulta: 65,00 €',{exact:false}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.calls.at(-1).args.p_itens.map(r=>r.id).sort()),['r1','r3']);
  await page.getByRole('button',{name:'Registar pedido para envio'}).click();
  const mail = page.getByRole('link',{name:'Abrir no email'});
  assert.match(await mail.getAttribute('href'),/faturacao%40example.invalid/);
  // Valida apenas o endereço do link. O cliente de email nunca é aberto.
  await page.getByRole('button',{name:'Confirmar que enviei o email'}).click();
  await first.getByText('Envio confirmado').waitFor();
  assert.equal(await first.getByRole('checkbox').count(),0);
  assert.equal(await first.getByRole('button',{name:'Confirmar preço'}).count(),0);
  page.on('dialog', dialog => dialog.accept());
  for (const action of ['doente','transferencia','honorarios']) {
    await first.locator('.gc-fat-moves:not([open]) summary').click();
    await first.locator(`[data-action="${action}"]`).click();
  }
  await first.locator('.gc-fat-moves:not([open]) summary').click();
  await first.getByText(/Honorários recebidos · \d/).waitFor();
  await page.getByRole('button',{name:'Histórico',exact:true}).click();
  assert.equal(await second.isVisible(),false);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  assert.deepEqual(errors,[]);
  assert.deepEqual(await page.evaluate(()=>window.calls.map(c=>c.args.p_acao)),
    ['preco','preco','prever','pedido','envio','doente','transferencia','honorarios']);
  console.log('PASS: Faturação em Chrome, seleção, preços, destinatário em falta, pré-visualização, histórico e confirmação de movimentos.');
} finally {
  await browser.close();
}
