export function whatsappURL(value) {
 const raw=String(value||'').trim();if(!raw||!/^[+\d\s().-]+$/.test(raw))return null;
 let n=raw.replace(/\D/g,'');if(raw.startsWith('00'))n=n.slice(2);else if(!raw.startsWith('+')&&/^[29]\d{8}$/.test(n))n='351'+n;else if(!raw.startsWith('+'))return null;
 return /^[1-9]\d{7,14}$/.test(n)?'https://wa.me/'+n:null;
}
export function emailURL(value,subject='',body='') {
 const email=String(value||'').trim();if(!/^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/.test(email))return null;
 return 'mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}
