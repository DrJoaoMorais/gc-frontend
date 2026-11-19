const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');

const root = resolve(__dirname, '..');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ timezoneId: 'America/New_York' });
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    await page.route('https://gc-agenda.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: readFileSync(resolve(root, 'app.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '') });
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
      function assertMembershipTable(table) { if (table !== 'clinic_members') throw new Error('Consulta inesperada: ' + table); }
      window.sb = {
        from(table) {
          assertMembershipTable(table);
          const query = { select: () => query, eq: () => query, then: resolve => resolve({ data: [] }) };
          return query;
        },
        auth: {
          getSession: async () => ({ data: { session: { user: { id: 'secretary' } } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
          mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2' } }) }
        },
        rpc: async (name, { p_action, p_args }) => {
        window.calls.push([p_action, p_args]);
        let data = [];
        if (p_action === 'scope') data = { clinics, report_clinics: [] };
        if (p_action === 'day' && p_args.clinic_id === 'web') data = [row];
        if (p_action === 'patients') data = [{ id: 'patient', full_name: 'Doente Teste', dob: '1980-01-02' }];
        if (p_action === 'save') data = { id: row.id };
        return { data, error: null };
      }};
      const { boot } = await import('/modules/boot.js');
      await boot();
      if (document.body.textContent.includes('Erro ao iniciar a app.')) throw new Error('O arranque do secretariado falhou');
    });
    assert.equal(await page.locator('.gc-sidebar').count(), 1);
    assert.equal(await page.locator('#hdrClinicCount').textContent(), '2');
    assert.deepEqual(await page.locator('#selClinic option').allTextContents(), ['Novo Cuidar', 'João Morais Web']);
    assert.equal(await page.locator('#selClinic').inputValue(), 'novo');
    assert.equal(await page.locator('[data-nav="doentes"]').count(), 0);
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
    await page.getByRole('button', { name: 'Editar marcação' }).click();
    assert.equal(await clinics.getByRole('button', { name: 'João Morais Web' }).isDisabled(), true);
    await editor.getByLabel('Estado').selectOption('cancelled');
    await editor.getByRole('button', { name: 'Guardar' }).click();
    await editor.waitFor({ state: 'hidden' });
    const edit = await page.evaluate(() => window.calls.filter(([action]) => action === 'save').at(-1)[1]);
    assert.equal(edit.id, 'booking');
    assert.equal(edit.status, 'cancelled');
    assert.equal(edit.updated_at, '2026-07-01T10:30:00Z');
    assert.equal(Object.hasOwn(edit, 'patient_id'), false);

    assert.deepEqual(errors, []);
    console.log('Secretariado no Chrome: seleção da clínica, pesquisa, marcação, edição, hora de Lisboa e interface habitual validados.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
