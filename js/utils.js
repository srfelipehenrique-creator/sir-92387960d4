const normalizeStr = s => String(s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const escapeHtml   = s => String(s??'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const normTicket   = t => String(t||'').replace(/\s+/g,'').replace(/[^A-Za-z0-9/-]/g,'').toUpperCase();

const makeIdentity = (tk, i) =>
  `${tk}::${normTicket(i.ticket)}::${normalizeStr(i.cfOrigem)}::${normalizeStr(i.designacao)}::${normalizeStr(i.extra)}`;

function animateValue(el, start, end, dur) {
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
