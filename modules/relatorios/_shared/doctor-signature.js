// A imagem da assinatura é acrescentada apenas pelo serviço privado de PDF.
export function buildDoctorSignature(doctorName = 'Dr. João Morais') {
  const name = String(doctorName).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/^(?:dr\.?|doutor)\s+/, '').trim().replace(/\s+/g, ' ');
  if (name !== 'joao morais') return '';
  return '<span data-gc-private-signature="joao-morais" style="display:block;width:150px;height:102px;max-width:100%;margin:0 auto 3px;position:relative;top:72px;"></span>';
}

export async function fetchPrivatePdf(url, options = {}) {
  const { data, error } = await window.sb.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !token) throw new Error('Inicie sessão para emitir o documento.');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
