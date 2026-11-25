/* ══════════════════════════════════════════════════════════════
   v67 — Atualizar só o que mudou (ideia do React: "reconciliação")
   sirMorph(alvo, html): compara o painel que está na tela com o novo
   e altera apenas números, cores e cards que mudaram. Os elementos
   que não mudaram continuam os mesmos → sem piscar, sem perder o
   foco do teclado, sem fechar o que está aberto e sem recomeçar
   animações.
   - data-key: identifica um card (ex.: CF) mesmo se a ordem mudar.
   - data-morph-keep: o conteúdo é desenhado por outro código
     (gráficos, linha do tempo) e não é apagado aqui.
   ══════════════════════════════════════════════════════════════ */
function _morphKey(n) { return n.nodeType === 1 ? n.getAttribute('data-key') : null; }

function _morphAttrs(from, to) {
  for (const a of Array.from(from.attributes)) if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
  for (const a of Array.from(to.attributes)) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
}

function _morphNode(from, to) {
  if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName || _morphKey(from) !== _morphKey(to)) {
    from.replaceWith(to); return;
  }
  if (from.nodeType === 3 || from.nodeType === 8) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  if (from.nodeType !== 1) return;
  _morphAttrs(from, to);
  if (from.hasAttribute('data-morph-keep')) return;
  _morphChildren(from, to);
}

function _morphChildren(from, to) {
  const keyed = new Map();
  for (const c of Array.from(from.childNodes)) { const k = _morphKey(c); if (k) keyed.set(k, c); }
  const next = Array.from(to.childNodes);
  let cur = from.firstChild;
  for (const nc of next) {
    const k = _morphKey(nc);
    let match = null;
    if (k && keyed.has(k)) { match = keyed.get(k); keyed.delete(k); }
    else if (!k && cur && !_morphKey(cur)) match = cur;
    if (match) {
      if (match !== cur) from.insertBefore(match, cur);
      cur = match.nextSibling;
      _morphNode(match, nc);           /* pode trocar o nó; a posição se mantém */
    } else {
      from.insertBefore(nc, cur);
    }
  }
  while (cur) { const nx = cur.nextSibling; cur.remove(); cur = nx; }
}

/* Atualiza o conteúdo de "alvo" para ficar igual a "html".
   Na primeira vez (alvo vazio) apenas insere o HTML. */
function sirMorph(target, html) {
  if (!target.firstChild) { target.innerHTML = html; return; }
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  _morphChildren(target, tpl.content);
}

/* Atualiza um elemento (e o que tem dentro) para ficar igual ao HTML novo,
   que deve ter um único elemento de topo. */
function sirMorphEl(el, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  const neo = tpl.content.firstElementChild;
  if (neo) _morphNode(el, neo);
}
