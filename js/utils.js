const normalizeStr = s => String(s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const escapeHtml   = s => String(s??'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const normTicket   = t => String(t||'').replace(/\s+/g,'').replace(/[^A-Za-z0-9/-]/g,'').toUpperCase();

const makeIdentityRaw = (tk, i) =>
  `${tk}::${normTicket(i.ticket)}::${normalizeStr(i.cfOrigem)}::${normalizeStr(i.designacao)}::${normalizeStr(i.extra)}`;

/* v101 — apelidos de identidade: quando os dados de um ticket mudam (inserção manual
   ou o SIR atualizou CF/designação/tipo), a identidade nova aponta para a antiga e
   as notas, a classificação e os registros continuam no mesmo ticket.
   { identidadeNova: { to: identidadeAntiga, at } } — guardado neste aparelho, 60 dias. */
const LS_IDENT_ALIAS = 'sir_ident_alias_v1';
const _identAlias = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(LS_IDENT_ALIAS) || '{}') || {};
    const lim = Date.now() - 60 * 86400000;
    for (const k of Object.keys(v)) if (!v[k] || !v[k].to || Math.max(v[k].at || 0, v[k].hit || 0) < lim) delete v[k];
    return v;
  } catch (e) { return {}; }
})();
function resolveIdentity(id) {
  let cur = id, n = 0;
  while (_identAlias[cur] && n++ < 10) { _identAlias[cur].hit = Date.now(); cur = _identAlias[cur].to; }
  return cur;
}
function setIdentityAlias(from, to) {
  if (!from || !to) return;
  to = resolveIdentity(to);
  if (from === to || resolveIdentity(from) === to) return;
  _identAlias[from] = { to, at: Date.now() };
  for (const k of Object.keys(_identAlias)) if (_identAlias[k].to === from) _identAlias[k] = { to, at: Date.now() };
  try {   /* junta com o que a outra versão (principal/backup) gravou nesse meio-tempo */
    const disco = JSON.parse(localStorage.getItem(LS_IDENT_ALIAS) || '{}') || {};
    for (const k of Object.keys(disco)) if (!_identAlias[k]) _identAlias[k] = disco[k];
    localStorage.setItem(LS_IDENT_ALIAS, JSON.stringify(_identAlias));
  } catch (e) {}
}
const makeIdentity = (tk, i) => resolveIdentity(makeIdentityRaw(tk, i));

function animateValue(el, start, end, dur) {
  /* v68: sem animação quando o sistema pede "reduzir movimento" */
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { el.innerHTML = end; return; }
  let ts = null;
  const step = t => {
    if (!ts) ts = t;
    const p = Math.min((t - ts) / dur, 1);
    el.innerHTML = Math.floor((1 - Math.pow(1 - p, 4)) * (end - start) + start);
    p < 1 ? requestAnimationFrame(step) : (el.innerHTML = end);
  };
  requestAnimationFrame(step);
}

function parseAbertura(str) {
  if (!str || str === '—') return 0;
  let m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s*[-–]\s*(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5], +(m[6]||0)).getTime();
  m = str.match(/(\d{2})\/(\d{2})\/(\d{4})[T\s]+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5], +(m[6]||0)).getTime();
  m = str.match(/(\d{4})-(\d{2})-(\d{2})[T\s]+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0)).getTime();
  return 0;
}

function ralTypeRank(tipo) {
  const n = normalizeStr(String(tipo || '')).trim();
  const idx = RAL_TYPE_ORDER.findIndex(t => n === t || n.includes(t));
  return idx === -1 ? RAL_TYPE_ORDER.length : idx;
}

function generateTicketURL(ticketStr, isRal, desig) {
  if (!ticketStr || ticketStr === 'N/D') return null;
  const m = ticketStr.match(/(?:RAL|REC)?-?(\d+)\/(\d{4})/i);
  if (!m) return null;
  const num = m[1], ano = m[2], rec = parseInt(num, 10) + 17267511;
  if (isRal)
    return `http://10.13.54.150:20020/navegacao/framesetNivel2TarefaRal.cfm?iorigem=Consulta&tipo=RAL&num_recup=${num}&ano_recup=${ano}&recuperacao=${rec}&acaoDesc=&flag=999`;
  return `http://10.13.54.150:20020/navegacao/framesetNivel2TarefaRec.cfm?exibe_msg=SIM&iorigem=Consulta&itemAtual=1&tipo=REC&num_recup=${num}&designacao=${encodeURIComponent(desig||'')}&ano_recup=${ano}&recuperacao=${rec}&acaoDesc=&flag=999`;
}

function isLinkableDesig(desig) {
  if (!desig || desig === 'N/D') return false;
  return /^[A-Z0-9]{2,8}\/IP\/[A-Z0-9]+$/i.test(desig) || /^\d{4,}$/.test(desig);
}

function makeTicketHTML(ticket, isRal, desig) {
  const url = generateTicketURL(ticket, isRal, desig);
  const txt = escapeHtml(ticket);
  if (!url) return txt;
  return `<button class="ticket-link" data-url="${escapeHtml(url)}">${txt}</button>`;
}

function makeDesigHTML(desig, isRal) {
  const txt = escapeHtml(desig);
  if (isRal || !isLinkableDesig(desig)) return txt;
  const url = `http://200.255.253.12/grb/critel/index.php?submitted=1&mcid=&query=${encodeURIComponent(desig)}&cliente=1&backbone=1&grafico=0&exibir=designacao&agrupar=nao&range=0.25&tipo=medias&plotar=1`;
  return `<button class="desig-link" data-url="${escapeHtml(url)}">${txt}</button>`;
}

function openTicketWindow(url) {
  const w = 1200, h = 800;
  const l = Math.floor((screen.width - w) / 2);
  const t = Math.floor((screen.height - h) / 2);
  window.open(url, 'TicketWin', `width=${w},height=${h},top=${t},left=${l},scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no`);
}
