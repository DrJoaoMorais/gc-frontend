const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;

// A presença de uma chave não significa que exista uma dose utilizável.
export function doseProtocoloCompleta(dose) {
  if (!Number.isInteger(dose?.sets) || dose.sets < 1 || typeof dose.rest_set !== 'number' || !Number.isFinite(dose.rest_set) || dose.rest_set < 0) return false;
  if (Array.isArray(dose.duration_series) && dose.duration_series.length) {
    return dose.duration_series.length === dose.sets && dose.duration_series.every(s => positive(s.duration_sec));
  }
  if (positive(dose.duration_sec)) return true;
  if (Array.isArray(dose.series) && dose.series.length) {
    return dose.series.length === dose.sets && dose.series.every(s => Number.isInteger(s.reps) && s.reps > 0);
  }
  if (Number.isInteger(dose.reps_fixed) && dose.reps_fixed > 0) return true;
  return Number.isInteger(dose.reps_min) && dose.reps_min > 0 && Number.isInteger(dose.reps_max) && dose.reps_max >= dose.reps_min;
}

export function construirDoseIndividual({sets,mode,amount,rest,instruction}) {
  if (String(sets).trim() === '' || String(amount).trim() === '' || String(rest).trim() === '' || !String(instruction || '').trim()) throw new Error('Defina a dose, o repouso e a carga/amplitude individual.');
  sets = Number(sets); amount = Number(amount); rest = Number(rest);
  if (!Number.isInteger(sets) || sets < 1 || !Number.isFinite(rest) || rest < 0 || !positive(amount) || !['reps','seconds'].includes(mode) || (mode === 'reps' && !Number.isInteger(amount))) throw new Error('Indique séries e repetições inteiras positivas, ou duração positiva, e repouso não negativo.');
  const timed = mode === 'seconds';
  return {sets,load:null,reps_min:timed ? null : amount,reps_max:timed ? null : amount,reps_fixed:timed ? null : amount,
    series:timed ? null : Array.from({length:sets},()=>({reps:amount,load:null})),
    duration_sec:null,duration_series:timed ? Array.from({length:sets},()=>({duration_sec:amount})) : null,
    rest_set:rest,rest_next:rest,tempo_concentrico_s:null,tempo_excentrico_s:null,pausa_inferior_s:0,pausa_superior_s:0};
}

// Apenas a nova seleção: nunca altera o catálogo, a prescrição anterior ou o histórico.
export function pedirDosesIndividuais(entries) {
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'gcwo-modal-overlay';
    overlay.innerHTML = `<div class="gcwo-modal gcwo-protocol-editor" role="dialog" aria-modal="true" aria-labelledby="gcDoseTitle"><form>
      <div class="gcwo-modal-head"><h3 id="gcDoseTitle">Definir a dose individual</h3><button type="button" data-cancel aria-label="Fechar">×</button></div>
      <div class="gcwo-modal-body"><p>Estes exercícios não têm dose específica completa. Defina a dose e os limites autorizados para este doente. Não serão usados valores automáticos.</p>
      ${entries.map(({ex},i)=>`<fieldset data-dose-index="${i}"><legend>${esc(ex.name)}</legend>
        <label>Séries ou exposições<input name="sets" type="number" min="1" step="1" required></label>
        <label>Forma de execução<select name="mode"><option value="reps">Repetições por série</option><option value="seconds">Segundos por exposição</option></select></label>
        <label>Repetições ou segundos<input name="amount" type="number" min="1" step="1" required></label>
        <label>Repouso (segundos)<input name="rest" type="number" min="0" step="1" required></label>
        <label>Carga, amplitude e cuidados autorizados<textarea name="instruction" required placeholder="Indique a resistência ou ausência de carga, a amplitude e os cuidados individuais."></textarea></label>
      </fieldset>`).join('')}<p role="alert" data-error></p></div>
      <div class="gcwo-modal-foot"><button type="button" data-cancel>Cancelar</button><button type="submit" class="gcBtnSuccess">Aplicar doses e continuar</button></div>
    </form></div>`;
    const close = result => { overlay.remove(); previousFocus?.focus(); resolve(result); };
    overlay.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>close(null));
    overlay.addEventListener('keydown',event=>{
      if (event.key === 'Escape') { event.preventDefault(); close(null); }
      if (event.key !== 'Tab') return;
      const controls = [...overlay.querySelectorAll('button,input,select,textarea')].filter(x=>!x.disabled);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    });
    overlay.querySelector('form').onsubmit = event => {
      event.preventDefault();
      try {
        const rows = [...overlay.querySelectorAll('[data-dose-index]')].map(field=>{
          const read = name => field.querySelector(`[name="${name}"]`).value;
          const input = Object.fromEntries(['sets','mode','amount','rest','instruction'].map(k=>[k,read(k)]));
          return {dose:construirDoseIndividual(input),instruction:input.instruction.trim()};
        });
        close(rows);
      } catch (error) { overlay.querySelector('[data-error]').textContent=error.message; }
    };
    document.body.append(overlay);
    overlay.querySelector('input').focus();
  });
}
