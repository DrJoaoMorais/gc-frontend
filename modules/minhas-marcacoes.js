const clinicSlugs = ['novo-cuidar', 'joao-morais-web'];
const accountEmail = 'novocuidar@joaomorais.pt';
const lisbonDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' });
const lisbonHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', hourCycle: 'h23' });

function monthStart(year, monthIndex) {
  const utc = Date.UTC(year, monthIndex, 1);
  const offsetHours = Number(lisbonHour.format(utc));
  return new Date(utc - offsetHours * 3600000).toISOString();
}

export function mountMinhasMarcacoes(host, { sessionUser, role, clinics }) {
  if (!host || role !== 'administrativo' || sessionUser?.email?.toLowerCase() !== accountEmail) return;
  const ownClinics = clinicSlugs.map(slug => clinics.find(clinic => clinic.slug === slug)).filter(Boolean);
  if (ownClinics.length !== clinicSlugs.length) return;
  const panel = document.createElement('details');
  panel.innerHTML = `
    <summary>Minhas marcações por clínica</summary>
    <p>Contagem pelo mês em que fizeste a marcação. Inclui cancelamentos e conta cada reagendamento uma só vez.</p>
    <label>Mês <input type="month" required></label>
    <p role="status"></p>
    <ul></ul>`;
  host.append(panel);

  const month = panel.querySelector('input');
  const status = panel.querySelector('[role="status"]');
  const list = panel.querySelector('ul');
  month.value = lisbonDate.format(new Date());
  let revision = 0;

  async function refresh() {
    const current = ++revision;
    list.replaceChildren();
    if (!/^\d{4}-\d{2}$/.test(month.value)) {
      status.textContent = 'Escolhe um mês.';
      return;
    }
    const [year, monthNumber] = month.value.split('-').map(Number);
    const start = monthStart(year, monthNumber - 1);
    const end = monthStart(year, monthNumber);
    status.textContent = 'A contar marcações…';
    try {
      const results = await Promise.all(ownClinics.map(clinic => window.sb.from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', sessionUser.id)
        .eq('clinic_id', clinic.id)
        .is('rescheduled_from_id', null)
        .not('patient_id', 'is', null)
        .neq('mode', 'bloqueio')
        .gte('created_at', start)
        .lt('created_at', end)));
      if (current !== revision || !panel.isConnected) return;
      if (results.some(result => result.error || result.count == null)) throw new Error('Contagem indisponível');
      for (const [index, clinic] of ownClinics.entries()) {
        const item = document.createElement('li');
        item.textContent = `${clinic.name}: ${results[index].count}`;
        list.append(item);
      }
      status.textContent = '';
    } catch {
      if (current === revision && panel.isConnected) status.textContent = 'Não foi possível obter as contagens. Volta a abrir este painel para tentar novamente.';
    }
  }

  panel.ontoggle = () => { if (panel.open) refresh(); };
  month.onchange = refresh;
}
