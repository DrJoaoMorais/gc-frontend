export function downloadFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function base64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
const encoded = text => base64(new TextEncoder().encode(text));
const folded = text => text.match(/.{1,76}/g)?.join('\r\n') || '';
export function attachmentEmail(recipient, text, files) {
  if (!/^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/.test(recipient)) throw new Error('Email inválido.');
  const boundary = 'gc_' + crypto.randomUUID();
  const lines = [`To: ${recipient}`, `Subject: =?UTF-8?B?${encoded('Documentação')}?=`, 'X-Unsent: 1', 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', folded(encoded(text))];
  files.forEach((file, i) => lines.push(`--${boundary}`, 'Content-Type: application/pdf', 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="documento-${i + 1}.pdf"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, '%27')}`, '', folded(base64(file.bytes))));
  lines.push(`--${boundary}--`, '');
  return new Blob([lines.join('\r\n')], {type: 'message/rfc822'});
}
export async function fetchPdf(url, title, index) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Não foi possível obter o PDF.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('O documento selecionado não é um PDF.');
  const name = `${index + 1}-${String(title || 'Documento').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').slice(0, 100).replace(/\.pdf$/i, '')}.pdf`;
  return {name, bytes};
}
