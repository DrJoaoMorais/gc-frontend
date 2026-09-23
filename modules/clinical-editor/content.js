// Portable clinical HTML. Never persist Quill's internal OL/data-list representation.
export function clinicalHTML(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,svg,math,template,.ql-ui').forEach(el => el.remove());
  // Convert legacy Quill 2 flat lists BEFORE removing their semantic attributes.
  [...doc.querySelectorAll('ol,ul')].reverse().forEach(list => {
    const items = [...list.children].filter(el => el.tagName === 'LI');
    if (!items.some(li => li.hasAttribute('data-list') || /ql-indent-\d/.test(li.className))) return;
    const fragment = doc.createDocumentFragment();
    const levels = [];
    items.forEach(li => {
      const requested = Number(li.className.match(/ql-indent-(\d+)/)?.[1] || 0);
      const depth = Math.min(requested, levels.length);
      const type = li.dataset.list === 'bullet' ? 'UL' : li.dataset.list === 'ordered' ? 'OL' : list.tagName;
      levels.length = Math.min(levels.length, depth + 1);
      if (!levels[depth] || levels[depth].tagName !== type) {
        const target = doc.createElement(type);
        const parent = depth ? levels[depth - 1].lastElementChild : fragment;
        parent.appendChild(target);
        levels[depth] = target;
      }
      levels[depth].appendChild(li);
    });
    list.replaceWith(fragment);
  });
  const allowed = new Set(['P','BR','DIV','UL','OL','LI','STRONG','B','EM','I','U','S','SPAN','H1','H2','H3','H4','BLOCKQUOTE','A','SUB','SUP']);
  [...doc.body.querySelectorAll('*')].reverse().forEach(el => {
    if (!allowed.has(el.tagName)) { el.replaceWith(...el.childNodes); return; }
    [...el.attributes].forEach(attr => {
      const safeHref = el.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:)/i.test(attr.value);
      const safeStart = el.tagName === 'OL' && attr.name === 'start' && /^\d+$/.test(attr.value);
      if (!safeHref && !safeStart) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
}

export function editorHTML(quill) {
  return clinicalHTML(quill.root.innerHTML);
}

export function loadClinicalHTML(quill, html) {
  quill.__proposal?.remove();
  quill.clipboard.dangerouslyPasteHTML(clinicalHTML(html), 'silent');
  quill.history.clear();
}
