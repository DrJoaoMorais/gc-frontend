import { escapeHtml as e } from './helpers.js';
import { emailURL } from './agenda-contactos.js';
import { loadFinanceForAgenda } from './financas.js';
import { appointmentsFor, historyFor } from './agenda-financeiro.js';
import { buildRequest, euro, isSent, lisbonDay, monthBounds, sentForRecord } from './agenda-fecho-model.js';

// Cada destinatário é validado individualmente antes de construir o mailto.
export function billingEmailURL(addresses, subject = '', body = '') {
  const recipients = String(addresses ?? '').split(',').map(address => address.trim());
  const links = recipients.map(address => emailURL(address, subject, body));
  if (links.some(link => !link)) return null;
  return 'mailto:' + recipients.map(encodeURIComponent).join(',') + links[0].slice(links[0].indexOf('?'));
}

export function parseWebPrice(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return amount > 0 ? amount : null;
}

export function eligibleWebRecord(row, booking, start, today) {
  return Boolean(start && booking && row.patient_id && row.patient_id === booking.patient_id &&
    row.agendaClinicId === booking.clinic_id && row.tipo_acto && booking.status === 'done' &&
    row.appt_status === 'done' && row.financial_status === (booking.financial_status ?? 'normal') &&
    row.financial_status !== 'honorarios_dispensados' && row.data === lisbonDay(booking.start_at) &&
    row.data >= start && row.data <= today);
}

const movements = [
  ['doente', 'web_recebido_doente_at', 'Recebido do doente'],
  ['transferencia', 'web_transferido_at', 'Transferido para a Novo Cuidar'],
  ['honorarios', 'web_honorarios_recebidos_at', 'Honorários recebidos'],
];

export function renderFaturacao(content, back, {day, onChange} = {}) {
  const today = lisbonDay(new Date());
  const initialDay = day && day <= today ? day : today;
  content.innerHTML = `<section class="gc-faturacao" aria-label="Faturação">
    ${back ? '<button type="button" class="gc-btn" data-back>Voltar a Finanças</button><h1>Faturação</h1>' : '<h2>Faturação pela Novo Cuidar</h2>'}
    ${back ? '<p>Consultas João Morais Web e Athletix · Faturação pela Novo Cuidar</p>' : ''}
    <form data-period style="display:flex;flex-wrap:wrap;align-items:end;gap:12px">
      <label>De <input type="date" name="inicio" value="${initialDay}" max="${today}" required></label>
      <label>Até <input type="date" name="fim" value="${initialDay}" max="${today}" required></label>
      <button class="gc-btn-primary">Consultar</button>
      <button type="button" class="gc-btn" data-shortcut="day">Hoje</button>
      <button type="button" class="gc-btn" data-shortcut="month">Este mês</button>
    </form>
    <p role="status" data-status></p><div data-results></div>
  </section>`;
  const page = content.firstElementChild;
  const form = page.querySelector('form');
  const result = page.querySelector('[data-results]');
  const status = page.querySelector('[data-status]');
  let revision = 0;
  let busy = false;

  if (back) page.querySelector('[data-back]').onclick = back;
  form.onsubmit = event => { event.preventDefault(); if (!busy) load(); };
  page.querySelectorAll('[data-shortcut]').forEach(button => {
    button.onclick = () => {
      if (busy) return;
      form.elements.inicio.value = button.dataset.shortcut === 'month' ? monthBounds(today).start : today;
      form.elements.fim.value = today;
      load();
    };
  });

  async function load() {
    const run = ++revision;
    const start = form.elements.inicio.value;
    const end = form.elements.fim.value;
    result.replaceChildren();
    status.textContent = 'A consultar Finanças…';
    try {
      if (!start || !end || start > end || end > today) throw new Error('Escolha um período válido até hoje.');
      const config = await window.sb.from('clinics').select('id,slug,extra_fields,billing_email')
        .in('slug', ['joao-morais-web', 'novo-cuidar','athletix']).eq('is_active', true);
      if (config.error) throw config.error;
      const web = config.data.find(clinic => clinic.slug === 'joao-morais-web');
      const destination = config.data.find(clinic => clinic.slug === 'novo-cuidar');
      const email = String(destination?.extra_fields?.faturacao_destinatarios ?? destination?.billing_email ?? '').trim();
      if (!web) throw new Error('A clínica João Morais Web está indisponível para esta sessão.');
      const activation = web.extra_fields?.faturacao_web_desde;
      const athletix = config.data.find(clinic => clinic.slug === 'athletix');
      const sources = [web, athletix].filter(Boolean);
      const [finances, bookings] = await Promise.all([
        Promise.all(sources.map(clinic => loadFinanceForAgenda({day: today, start, end, clinicId: clinic.id}))),
        appointmentsFor(start, end, sources.map(clinic => clinic.id)),
      ]);
      const history = await historyFor(finances.flatMap(finance => finance.entities));
      if (run !== revision || !page.isConnected) return;
      show(finances.flatMap(finance => finance.records), bookings, history, {start, end, activation, email, webId:web.id});
    } catch (error) {
      if (run === revision && page.isConnected) status.textContent = error.message || 'Não foi possível carregar a faturação.';
    }
  }

  function show(records, bookings, history, {start, end, activation, email, webId}) {
    const appts = new Map(bookings.map(booking => [booking.id, booking]));
    const byAppointment = new Map(records.map(row => [row.appointment_id, row]));
    const ownHistory = new Map(history.filter(item => item.envio_snapshot?.circuito === 'web_novo_cuidar')
      .map(item => [item.registo_financeiro_id, item]));
    const historical = row => sentForRecord(row, history) || history.find(item =>
      item.entidade_id === row.entidade_id && item.granularidade === 'registo' && item.chave === row.id &&
      (item.envio_id || item.estado !== 'por_enviar'));
    const eligible = row => eligibleWebRecord(row, appts.get(row.appointment_id), activation, today);
    const available = row => eligible(row) && !row.web_pedido_id && !historical(row);
    const visible = records.filter(row => row.appointment_id && (row.appt_status === 'done' ||
      row.financial_status === 'honorarios_dispensados' || appts.get(row.appointment_id)?.status === 'done'));
    const missing = bookings.filter(booking => booking.status === 'done' && !byAppointment.has(booking.id)).length;
    const price = row => row.financial_status === 'honorarios_dispensados' ? 0 : row.agendaClinicId !== webId || row.web_preco_confirmado_at ? row.valor_faturado : null;
    const confirmed = visible.filter(row => price(row) != null);
    const sum = rows => euro(rows.reduce((total, row) => total + Math.round(Number(price(row)) * 100), 0) / 100);
    status.textContent = !activation ? 'Circuito por ativar. O histórico está em consulta.' :
      !billingEmailURL(email) ? 'Configure o email de faturação da Novo Cuidar para preparar pedidos.' : '';
    result.innerHTML = `
      <p>Preço confirmado ${e(sum(confirmed))} · Recebido do doente ${e(sum(confirmed.filter(r => r.web_recebido_doente_at)))}
        · Transferido ${e(sum(confirmed.filter(r => r.web_transferido_at)))}
        · Honorários recebidos ${e(sum(confirmed.filter(r => r.web_honorarios_recebidos_at)))}</p>
      ${missing ? `<p>${missing} consulta(s) realizada(s) sem registo financeiro neste período.</p>` : ''}
      <p><strong>${visible.filter(available).length}</strong> consultas elegíveis sem pedido ·
        <strong>${visible.map(row => ownHistory.get(row.id)).filter(item => item && isSent(item) && !item.recibo_emitido_at).length}</strong> a aguardar emissão ·
        <strong>${visible.filter(row => ownHistory.get(row.id)?.recibo_emitido_at).length}</strong> com emissão confirmada</p>
      <div role="group" aria-label="Mostrar consultas">
        ${[['all','Todas'],['pending','Pendentes'],['history','Histórico']].map(([value,label]) =>
          `<button class="gc-btn" data-filter="${value}" aria-pressed="${value === 'all'}">${label}</button>`).join('')}
      </div>
      <div style="overflow-x:auto;margin-top:12px"><table class="gc-table" style="min-width:690px">
        <thead><tr><th scope="col">Selecionar</th><th scope="col">Consulta</th><th scope="col">Preço</th>
        <th scope="col">Pedido</th><th scope="col">Movimentos confirmados</th></tr></thead>
        <tbody>${visible.map(row => {
          const sent = ownHistory.get(row.id);
          const label = row.patients?.full_name || 'Doente por confirmar';
          const editable = row.agendaClinicId === webId && available(row) && !row.web_recebido_doente_at;
          const pendingMovement = movements.findIndex(([,field]) => !row[field]);
          const rowStatus = row.financial_status === 'honorarios_dispensados' ? 'Honorários dispensados' :
            sent ? (sent.recibo_emitido_at ? '✓ EMITIDA' : isSent(sent) ? 'Envio confirmado' : 'Pedido preparado') :
              historical(row) ? 'Histórico anterior' : !eligible(row) ? 'Por conciliar ou fora do circuito' :
                price(row) == null ? 'Preço por confirmar' : 'Por preparar';
          return `<tr data-row="${e(row.id)}" data-history="${Boolean(sent || historical(row))}"
            data-pending="${Boolean(eligible(row) && (!isSent(sent) || pendingMovement !== -1) && (available(row) || sent))}">
            <td>${available(row) && price(row) > 0 ? `<input type="checkbox" data-select aria-label="Selecionar ${e(label)}">` : '—'}</td>
            <td><strong>${e(label)}</strong><br>${e(row.agendaEntityName || '')} · ${e(row.data)} · ${e(row.tipo_acto || '')}</td>
            <td>${!editable ? e(euro(price(row))) : `<form data-price style="display:flex;gap:6px;flex-wrap:wrap">
              <span role="group" aria-label="Preço de ${e(label)}">${[45,50,60,65,'outro'].map(value =>
                `<label><input type="radio" name="preset" value="${value}">${value === 'outro' ? 'Outro' : value+' €'}</label>`).join(' ')}</span>
              <input data-custom hidden inputmode="decimal" aria-label="Outro preço em euros" placeholder="€" size="7">
              <button class="gc-btn">Confirmar preço</button>
              <small>${e(euro(price(row)))}</small></form>`}</td>
            <td>${sent?.recibo_emitido_at ? '<strong style="background:#135e41;color:white;padding:4px 8px;border-radius:5px">✓ EMITIDA</strong>' : e(rowStatus)}
              ${isSent(sent) ? `<button class="gc-btn" data-issue="${sent.recibo_emitido_at ? 'corrigir_emissao' : 'emitida'}">${sent.recibo_emitido_at ? 'Corrigir emissão' : 'Confirmar emissão'}</button>` : ''}
              ${sent ? '<br><button class="gc-btn" data-open>Ver pedido</button>' : ''}</td>
            <td>${movements.map(([action,field,label], index) => row[field]
              ? `<div>${e(label)} · ${e(lisbonDay(row[field]))}</div>`
              : row.agendaClinicId === webId && eligible(row) && (available(row) || sent) && price(row) > 0 && index === pendingMovement
                ? `<button class="gc-btn" data-action="${action}">Confirmar: ${e(label.toLowerCase())}</button>`
                : `<div>${e(label)} · Por confirmar</div>`).join('')}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
      ${visible.length ? '' : '<p>Sem consultas neste período.</p>'}
      ${start === end && visible.some(row => available(row) && price(row) > 0) ? '<button type="button" class="gc-btn" data-select-day>Selecionar consultas do dia</button>' : ''}
      <p data-selection>0 consultas selecionadas</p>
      <button class="gc-btn-primary" data-preview disabled>Pré-visualizar pedido</button><div data-draft></div>`;
    const selection = new Set();
    const draft = result.querySelector('[data-draft]');
    const preview = result.querySelector('[data-preview]');
    const selectedRows = () => visible.filter(row => selection.has(row.id));
    const clearDraft = () => draft.replaceChildren();
    const refreshSelection = () => {
      result.querySelector('[data-selection]').textContent = `${selection.size} consultas selecionadas · ${sum(selectedRows())}`;
      preview.disabled = !selection.size || selection.size > 100;
      clearDraft();
    };

    result.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => {
      const filter = button.dataset.filter;
      result.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
      for (const tr of result.querySelectorAll('[data-row]')) {
        tr.hidden = filter !== 'all' && tr.dataset[filter] !== 'true';
        if (tr.hidden && tr.querySelector('[data-select]')) {
          tr.querySelector('[data-select]').checked = false;
          selection.delete(tr.dataset.row);
        }
      }
      refreshSelection();
    });

    const selectDay = result.querySelector('[data-select-day]');
    if (selectDay) selectDay.onclick = () => {
      for (const checkbox of result.querySelectorAll('tr:not([hidden]) [data-select]')) {
        checkbox.checked = true;
        selection.add(checkbox.closest('tr').dataset.row);
      }
      refreshSelection();
    };

    async function submit(action, rows, amount, reviewed) {
      if (busy) return;
      busy = true;
      status.textContent = 'A guardar…';
      const buttons = [...result.querySelectorAll('button:not(:disabled), input[type=checkbox]:not(:disabled), select:not(:disabled)')];
      buttons.forEach(button => { button.disabled = true; });
      try {
        const {data, error} = await window.sb.rpc('faturacao_web_registar', {
          p_acao: action,
          p_itens: rows.map(row => ({id: row.id, versao: row.updated_at, preco: amount})),
          p_destinatario: email || null,
          p_previa: reviewed || null,
        });
        if (error) throw error;
        if (!page.isConnected) return;
        if (action === 'prever') {
          displayDraft(data, () => submit('pedido', rows, null, data.body));
          status.textContent = '';
          return;
        }
        if (action === 'preco' && onChange && start === day && end === day) {
          await onChange();
          return;
        }
        await load();
        if (action === 'pedido' && data?.id) {
          result.querySelector(`[data-row="${CSS.escape(rows[0].id)}"] [data-open]`)?.click();
        }
      } catch (error) {
        status.textContent = error.message || 'Não foi possível guardar.';
      } finally {
        busy = false;
        buttons.filter(button => button.isConnected).forEach(button => { button.disabled = false; });
      }
    }

    function displayDraft({body, subject, recipient, prepared}, onConfirm, onOpen) {
      draft.innerHTML = `<section><h2>${prepared ? 'Pedido preparado' : 'Pré-visualização'}</h2>
        <p>Destinatário ${e(recipient || 'Por configurar')}</p>
        <p>${e(subject)}</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>
        <div data-draft-actions></div></section>`;
      draft.querySelector('pre').textContent = body;
      const actions = draft.querySelector('[data-draft-actions]');
      if (onOpen) {
        const link = document.createElement('a');
        link.href = onOpen;
        link.textContent = 'Abrir no email';
        actions.append(link, ' ');
      }
      if (onConfirm) {
        const button = document.createElement('button');
        button.className = 'gc-btn-primary';
        button.type = 'button';
        button.textContent = prepared ? 'Confirmar que enviei o email' : 'Registar pedido para envio';
        button.onclick = onConfirm;
        actions.append(button);
      }
      draft.scrollIntoView({block:'nearest'});
    }

    for (const row of visible) {
      const tr = result.querySelector(`[data-row="${CSS.escape(row.id)}"]`);
      const checkbox = tr.querySelector('[data-select]');
      if (checkbox) checkbox.onchange = () => {
        if (checkbox.checked) selection.add(row.id);
        else selection.delete(row.id);
        refreshSelection();
      };
      const priceForm = tr.querySelector('[data-price]');
      if (priceForm) {
        const preset = priceForm.elements.preset;
        const custom = priceForm.querySelector('[data-custom]');
        priceForm.onchange = () => {
          custom.hidden = preset.value !== 'outro';
          if (!custom.hidden) custom.focus();
        };
        priceForm.onsubmit = event => {
          event.preventDefault();
          const amount = parseWebPrice(preset.value === 'outro' ? custom.value : preset.value);
          if (amount == null) status.textContent = 'Indique um preço positivo com até duas casas decimais.';
          else submit('preco', [row], amount);
        };
      }
      tr.querySelector('[data-action]')?.addEventListener('click', event => {
        if (window.confirm(`Confirma este movimento de ${euro(price(row))}?`)) submit(event.target.dataset.action, [row]);
      });
      tr.querySelector('[data-issue]')?.addEventListener('click', event => {
        const action = event.currentTarget.dataset.issue;
        if (window.confirm(action === 'emitida' ? 'Recebeu a fatura deste doente?' : 'Voltar a aguardar a fatura deste doente?')) submit(action,[row]);
      });
      tr.querySelector('[data-open]')?.addEventListener('click', () => {
        const entry = ownHistory.get(row.id);
        const snapshot = entry.envio_snapshot;
        const outstanding = visible.filter(item => item.web_pedido_id === row.web_pedido_id && !isSent(ownHistory.get(item.id)));
        const covered = snapshot.items.length === visible.filter(item => item.web_pedido_id === row.web_pedido_id).length;
        displayDraft({...snapshot, prepared:true},
          covered && outstanding.length ? () => submit('envio', outstanding) : null,
          covered && outstanding.length ? billingEmailURL(snapshot.recipient,snapshot.subject,snapshot.body) : null);
        if (covered && !outstanding.length) {
          const batch = visible.filter(item => item.web_pedido_id === row.web_pedido_id);
          if (batch.every(item => !ownHistory.get(item.id)?.recibo_emitido_at)) {
            const correct = document.createElement('button');
            correct.textContent = 'Corrigir envio do pedido';
            correct.onclick = () => {
              if (window.confirm('Voltar a pedido preparado para todos os doentes deste email?')) submit('corrigir_envio',batch);
            };
            draft.querySelector('[data-draft-actions]').append(correct);
          }
        }
        if (!covered) status.textContent = 'Escolha um período que inclua todos os atos deste pedido para registar o envio.';
      });
    }

    preview.onclick = () => {
      const rows = selectedRows();
      if (new Set(rows.map(row => row.data)).size !== 1) { status.textContent = 'Selecione consultas do mesmo dia.'; return; }
      const request = buildRequest({name:'João Morais Web',start,end,policy:'individual',
        records:rows.map(row => ({...row,agendaBilled:price(row)}))});
      if (request.issues.length) {
        status.textContent = request.issues.join(' ');
        clearDraft();
        return;
      }
      if (billingEmailURL(email)) submit('prever', rows);
      else {
        const blocks = new Map();
        for (const row of rows) {
          const patient = row.patients;
          if (!blocks.has(row.patient_id)) blocks.set(row.patient_id, [
            'Doente: ' + patient.full_name, 'NIF: ' + patient.nif,
            'Morada: ' + patient.address_line1 + ', ' + patient.postal_code + ' ' + patient.city,
          ]);
          blocks.get(row.patient_id).push('Valor da consulta: ' + euro(price(row)));
        }
        const body = ['Bom dia,', 'Peço a emissão de uma fatura por doente.',
          ...Array.from(blocks.values(), lines => lines.join('\n')), 'Obrigado,\nJoão Morais'].join('\n\n');
        displayDraft({body,recipient:null,subject:'Pedido de faturação'});
      }
    };
  }

  load();
}
