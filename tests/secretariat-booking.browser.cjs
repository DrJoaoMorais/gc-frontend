const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require('playwright-core');

const root = resolve(__dirname, '..');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ timezoneId: 'America/New_York' });
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    await page.route('https://gc-agenda.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<div id="appRoot"></div>' });
      if (!/^\/modules\/[a-z0-9_./-]+\.(m?js|css)$/i.test(path)) return route.abort();
      const file = resolve(root, '.' + path);
      if (!file.startsWith(resolve(root, 'modules') + '/')) return route.abort();
      const contentType = path.endsWith('.css') ? 'text/css' : 'application/javascript';
      return route.fulfill({ contentType, body: readFileSync(file) });
    });
    await page.goto('https://gc-agenda.test/');
    await page.evaluate(async () => {
      const clinics = [{ id: 'web', name: 'João Morais Web', duration: 30 }, { id: 'novo', name: 'Novo Cuidar' }];
      const row = { id: 'booking', status: 'scheduled', mode: 'presencial', patient_name: 'Doente Teste',
        start_at: '2026-07-17T09:00:00Z', end_at: '2026-07-17T09:20:00Z', updated_at: '2026-07-01T10:30:00Z' };
      window.calls = [];
      window.sb = { rpc: async (name, { p_action, p_args }) => {
        window.calls.push([p_action, p_args]);
        let data = [];
        if (p_action === 'scope') data = { clinics, report_clinics: [] };
        if (p_action === 'day' && p_args.clinic_id === 'web') data = [row];
        if (p_action === 'patients') data = [{ id: 'patient', full_name: 'Doente Teste', dob: '1980-01-02' }];
        if (p_action === 'save') data = { id: row.id };
        if (p_action === 'report') data = [
          { secretary: 'Secretária A', user_id: 'a', clinic_name: 'Novo Cuidar', status: 'scheduled', total: 1 },
          { secretary: 'Secretária B', user_id: 'b', clinic_name: 'João Morais Web', status: 'cancelled', total: 2 }
        ];
        return { data, error: null };
      }};
      window.module = await import('/modules/secretariat-booking.js');
      const scope = await window.module.bookingAccess();
      await window.module.openSecretariatAgenda(scope.clinics);
    });
    await page.getByRole('button', { name: 'Agendar consulta' }).click();
    const editor = page.getByRole('dialog');
    const clinics = editor.getByRole('group', { name: 'Clínica' });
    assert.deepEqual(await clinics.getByRole('button').allTextContents(), ['Novo Cuidar', 'João Morais Web']);
    assert.equal(await clinics.getByRole('button', { name: 'Novo Cuidar' }).getAttribute('aria-pressed'), 'true');
    await clinics.getByRole('button', { name: 'João Morais Web' }).click();
    assert.equal(await clinics.getByRole('button', { name: 'João Morais Web' }).getAttribute('aria-pressed'), 'true');
    assert.match(await editor.locator('.gm-header').textContent(), /João Morais Web/);
    await editor.getByLabel('Nome do doente').fill('Doente');
    await editor.getByRole('button', { name: 'Doente Teste · 02/01/1980' }).click();
    await editor.getByLabel('Data', { exact: true }).fill('2026-07-17');
    await editor.getByLabel('Hora de início').fill('10:00');
    await editor.getByRole('button', { name: 'Primeira Consulta' }).click();
    if (process.env.GC_BOOKING_SCREENSHOT) {
      await page.locator('.gm-panel').screenshot({ path: process.env.GC_BOOKING_SCREENSHOT });
    }
    await editor.getByRole('button', { name: 'Agendar consulta' }).click();
    await editor.waitFor({ state: 'hidden' });
    const create = await page.evaluate(() => window.calls.find(([action]) => action === 'save')[1]);
    assert.equal(create.clinic_id, 'web');
    assert.equal(create.duration, 30);
    assert.equal(create.patient_id, 'patient');
    assert.equal(create.start_at, '2026-07-17T09:00:00.000Z');
    assert.match(create.request_id, /^[0-9a-f-]{36}$/);
    await page.getByRole('button', { name: 'Editar' }).click();
    assert.equal(await clinics.getByRole('button', { name: 'João Morais Web' }).isDisabled(), true);
    await editor.getByLabel('Estado').selectOption('cancelled');
    await editor.getByRole('button', { name: 'Guardar' }).click();
    await editor.waitFor({ state: 'hidden' });
    const edit = await page.evaluate(() => window.calls.filter(([action]) => action === 'save').at(-1)[1]);
    assert.equal(edit.id, 'booking');
    assert.equal(edit.status, 'cancelled');
    assert.equal(edit.updated_at, '2026-07-01T10:30:00Z');
    assert.equal(Object.hasOwn(edit, 'patient_id'), false);

    await page.evaluate(() => {
      const host = document.getElementById('appRoot');
      host.replaceChildren();
      window.module.mountBookingReport(host, [{ id: 'novo', name: 'Novo Cuidar' }]);
    });
    await page.getByText('Estatísticas de marcações', { exact: true }).click();
    await page.getByLabel('Clínica').selectOption('novo');
    await page.getByRole('button', { name: 'Consultar' }).click();
    await page.getByLabel('Secretária').selectOption('b');
    assert.equal(await page.getByRole('listitem').count(), 1);
    assert.match(await page.getByRole('listitem').textContent(), /Secretária B.*Cancelada.*2/);
    assert.deepEqual(errors, []);
    console.log('Secretariado no Chrome: seleção da clínica, pesquisa, marcação, edição, hora de Lisboa e filtro de estatísticas validados.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
