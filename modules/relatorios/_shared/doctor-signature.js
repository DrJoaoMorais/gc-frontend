// A imagem da assinatura é acrescentada apenas pelo serviço privado de PDF.
export function buildDoctorSignature(doctorName = 'Dr. João Morais') {
  const name = String(doctorName).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/^(?:dr\.?|doutor)\s+/, '').trim().replace(/\s+/g, ' ');
  if (name !== 'joao morais') return '';
  // A mesma caixa é usada na pré-visualização e após a inserção privada da imagem.
  // Alinha a base de «oão» com a linha; a haste do J desce sem afastar a identificação.
  return `<style>
    .gc-doctor-signature > [data-gc-private-signature],
    .gc-doctor-signature > [data-gc-doctor-signature] {
      display:block!important;width:150px!important;height:102px!important;
      max-width:100%!important;margin:0 auto!important;position:relative!important;
      top:14px!important;transform:translateX(-50px)!important;object-fit:contain!important;
    }
  </style><div class="gc-doctor-signature" style="height:50px;break-inside:avoid;"><span data-gc-private-signature="joao-morais"></span></div>`;
}

export async function fetchPrivatePdf(url, options = {}) {
  const { data, error } = await window.sb.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !token) throw new Error('Inicie sessão para emitir o documento.');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
