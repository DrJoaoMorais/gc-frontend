// Utilitários de sanitização partilhados pelos módulos relatorios/v2.
// Lógica copiada de modules/doente.js — não alterar aqui sem alinhar com a origem.

function sanitizeHTML(html) {
  try {
    const allowed = new Set(["B","STRONG","U","BR","P","DIV","UL","OL","LI"]);
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");

    doc.querySelectorAll("script,style").forEach(n => n.remove());

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(el => {
      [...el.attributes].forEach(a => el.removeAttribute(a.name));
      if (!allowed.has(el.tagName)) {
        const text = doc.createTextNode(el.textContent || "");
        el.replaceWith(text);
      }
    });

    return doc.body.innerHTML || "";
  } catch (e) {
    console.error(e);
    return String(html || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}

function escAttr(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

window.gcv2SanitizeHTML = sanitizeHTML;
window.gcv2EscAttr = escAttr;
