const TORPEDO_KEY    = 'cop_rede_premium_data';
const TORPEDO_CAMPOS = ['rec','ral','cluster','cidade','ref','desig','hab','hrec','haci','motivo','status','prev','causa','e4','e6','hf'];

let torpedos         = [];
let idTorpedoAtivo   = null;
let contadorTorpedos = 1;
let torpedoTimer     = null;

function salvarCacheTorpedo() {
  localStorage.setItem(TORPEDO_KEY, JSON.stringify({ torpedos, contadorTorpedos, idTorpedoAtivo }));
}

function carregarCacheTorpedo() {
  try {
    const s = JSON.parse(localStorage.getItem(TORPEDO_KEY));
    if (s) { torpedos = s.torpedos || []; contadorTorpedos = s.contadorTorpedos || 1; idTorpedoAtivo = s.idTorpedoAtivo || null; }
  } catch(e) {}
}

function openTorpedos() {
  renderizarListaTorpedos();
  if (idTorpedoAtivo) carregarDadosTorpedo();
  document.getElementById('torpedo-modal').classList.add('active');
}

function closeTorpedos() {
  salvarDadosTorpedo();
  document.getElementById('torpedo-modal').classList.remove('active');
}

function renderizarListaTorpedos() {
  const list = document.getElementById('torpedo-list');
  if (!list) return;
  if (!torpedos.length) {
    list.innerHTML = `<div class="torpedo-list-empty">Nenhum evento ativo.</div>`;
    mostrarFormTorpedo(false); return;
  }
  list.innerHTML = torpedos.map(t => {
    const m = Math.floor(Math.abs(t.tempo) / 60).toString().padStart(2,'0');
    const s = (Math.abs(t.tempo) % 60).toString().padStart(2,'0');
    const txt = t.atrasado ? `⚠ ALERTA +${m}:${s}` : `${m}:${s}`;
    return `<div id="titem-${t.id}" class="torpedo-list-item${t.id === idTorpedoAtivo ? ' tactive' : ''}${t.atrasado ? ' talerta' : ''}" onclick="selecionarTorpedo('${t.id}')">
      <div class="torpedo-item-header">
        <span class="torpedo-item-nome" title="${escapeHtml(t.nome)}">${escapeHtml(t.nome)}</span>
        <button class="torpedo-rename-btn" onclick="renomearTorpedo(event,'${t.id}')" title="Renomear">✏️</button>
      </div>
      <div class="torpedo-item-timer${t.atrasado ? ' talerta' : ''}">${txt}</div>
    </div>`;
  }).join('');
  mostrarFormTorpedo(!!idTorpedoAtivo);
  atualizarBotoesTorpedo();
}

function mostrarFormTorpedo(show) {
  const form  = document.getElementById('torpedo-form-wrap');
  const empty = document.getElementById('torpedo-form-empty');
  if (form)  form.style.display  = show ? 'flex' : 'none';
  if (empty) empty.style.display = show ? 'none'  : 'flex';
}

function criarNovoTorpedo() {
  const nome   = `EVENTO ${String(contadorTorpedos).padStart(3,'0')}`;
  const novoId = Date.now().toString();
  const novo   = { id: novoId, nome, tempo: 3600, atrasado: false, dados: {} };
  TORPEDO_CAMPOS.forEach(c => novo.dados[c] = '');
  torpedos.push(novo); contadorTorpedos++;
  salvarDadosTorpedo(); idTorpedoAtivo = novoId;
  renderizarListaTorpedos(); carregarDadosTorpedo(); salvarCacheTorpedo();
  setTimeout(() => { const el = document.getElementById('tf_rec'); if (el) el.focus(); }, 60);
}

function selecionarTorpedo(id) {
  if (id === idTorpedoAtivo) return;
  salvarDadosTorpedo(); idTorpedoAtivo = id;
  renderizarListaTorpedos(); carregarDadosTorpedo(); salvarCacheTorpedo();
}

function salvarDadosTorpedo() {
  const t = torpedos.find(t => t.id === idTorpedoAtivo);
  if (!t) return;
  TORPEDO_CAMPOS.forEach(c => { const el = document.getElementById(`tf_${c}`); if (el) t.dados[c] = el.textContent; });
  salvarCacheTorpedo();
}

function carregarDadosTorpedo() {
  const t = torpedos.find(t => t.id === idTorpedoAtivo);
  if (!t) return;
  TORPEDO_CAMPOS.forEach(c => { const el = document.getElementById(`tf_${c}`); if (el) el.textContent = t.dados[c] || ''; });
}

function atualizarBotoesTorpedo() {
  const btn = document.getElementById('btn-torpedo-encerrar');
  if (btn) { btn.disabled = false; btn.classList.add('ready'); }
}

function renomearTorpedo(e, id) {
  e.stopPropagation();
  const item = document.getElementById(`titem-${id}`);
  if (!item) return;
  const nomeSpan = item.querySelector('.torpedo-item-nome');
  const t = torpedos.find(t => t.id === id);
  if (!t || !nomeSpan) return;
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = t.nome; inp.className = 'torpedo-rename-input';
  inp.onclick = ev => ev.stopPropagation();
  const confirmar = () => { const novo = inp.value.trim().toUpperCase(); if (novo) t.nome = novo; salvarCacheTorpedo(); renderizarListaTorpedos(); };
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  { ev.preventDefault(); confirmar(); }
    if (ev.key === 'Escape') renderizarListaTorpedos();
  });
  inp.addEventListener('blur', confirmar);
  nomeSpan.replaceWith(inp); inp.select();
}

function montarTextoTorpedo() {
  const notepad = document.getElementById('torpedo-notepad');
  if (!notepad) return '';
  let text = '';
  notepad.querySelectorAll('.tline').forEach((line, idx, arr) => {
    let lineText = '';
    line.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) lineText += node.textContent;
      else if (node.nodeType === Node.ELEMENT_NODE) lineText += node.innerText || node.textContent || '';
    });
    text += lineText + (idx < arr.length - 1 ? '\n' : '');
  });
  return text;
}

async function copiarTorpedo() {
  salvarDadosTorpedo();
  const texto = montarTextoTorpedo();
  if (!texto) return;
  await navigator.clipboard.writeText(texto);
  const t = torpedos.find(t => t.id === idTorpedoAtivo);
  if (t) { t.tempo = 3600; t.atrasado = false; }
  salvarCacheTorpedo(); renderizarTimersSidebar();
  const btn = document.getElementById('btn-torpedo-copiar');
  if (btn) { btn.textContent = 'COPIADO!'; btn.style.background = '#10b981'; btn.style.color = '#000'; setTimeout(() => { btn.textContent = 'COPIAR'; btn.style.background = ''; btn.style.color = ''; }, 1500); }
}

function encerrarTorpedo() {
  const btn = document.getElementById('btn-torpedo-encerrar');
  if (btn && btn.disabled) return;
  torpedos = torpedos.filter(t => t.id !== idTorpedoAtivo);
  idTorpedoAtivo = torpedos.length ? torpedos[torpedos.length - 1].id : null;
  renderizarListaTorpedos();
  if (idTorpedoAtivo) carregarDadosTorpedo();
  salvarCacheTorpedo();
}

function toggleSlaCalc() {
  const panel = document.getElementById('sla-calc-panel');
  const btn   = document.getElementById('btn-torpedo-calc');
  const open  = panel.style.display === 'none' || panel.style.display === '';
  panel.style.display = open ? 'flex' : 'none';
  if (btn) btn.classList.toggle('active', open);
}

function calcSlaPanel() {
  function compute(totalId, foraId, resultId) {
    const total = parseInt(document.getElementById(totalId).value) || 0;
    const fora  = parseInt(document.getElementById(foraId).value)  || 0;
    const el    = document.getElementById(resultId);
    if (total <= 0) { el.textContent = '—'; el.className = 'sla-calc-result'; return; }
    const pct = Math.round(((total - Math.min(fora, total)) / total) * 100);
    el.textContent = pct + '%';
    el.className   = 'sla-calc-result' + (pct >= 90 ? ' good' : pct >= 70 ? ' warn' : ' bad');
  }
  compute('sc_ral_total', 'sc_ral_fora', 'sc_ral_result');
  compute('sc_rec_total', 'sc_rec_fora', 'sc_rec_result');
}

function aplicarSlaAoTorpedo() {
  const getVal = id => { const t = document.getElementById(id).textContent; return (t && t !== '—') ? t.replace('%','') : ''; };
  const e6 = getVal('sc_ral_result'); const e4 = getVal('sc_rec_result');
  if (e6) document.getElementById('tf_e6').textContent = e6;
  if (e4) document.getElementById('tf_e4').textContent = e4;
  salvarDadosTorpedo();
  document.getElementById('sla-calc-panel').style.display = 'none';
  document.getElementById('btn-torpedo-calc')?.classList.remove('active');
}

function renderizarTimersSidebar() {
  torpedos.forEach(t => {
    const item = document.getElementById(`titem-${t.id}`);
    if (!item) return;
    const el = item.querySelector('.torpedo-item-timer');
    if (!el) return;
    const m = Math.floor(Math.abs(t.tempo) / 60).toString().padStart(2,'0');
    const s = (Math.abs(t.tempo) % 60).toString().padStart(2,'0');
    el.textContent = t.atrasado ? `⚠ ALERTA +${m}:${s}` : `${m}:${s}`;
    el.classList.toggle('talerta', t.atrasado);
    item.classList.toggle('talerta', t.atrasado);
  });
  const ta    = torpedos.find(t => t.id === idTorpedoAtivo);
  const badge = document.getElementById('torpedo-timer-badge');
  if (badge && ta) {
    const m = Math.floor(Math.abs(ta.tempo) / 60).toString().padStart(2,'0');
    const s = (Math.abs(ta.tempo) % 60).toString().padStart(2,'0');
    badge.textContent = ta.atrasado ? `⚠ ALERTA DE PRAZO +${m}:${s}` : `ATUALIZAÇÃO EM ${m}:${s}`;
    badge.classList.toggle('talerta', ta.atrasado);
  }
}

function iniciarTimerTorpedo() {
  if (torpedoTimer) return;
  torpedoTimer = setInterval(() => {
    if (!torpedos.length) return;
    torpedos.forEach(t => {
      if (!t.atrasado) { t.tempo--; if (t.tempo <= 0) { t.atrasado = true; t.tempo = 0; } }
      else { t.tempo++; }
    });
    salvarCacheTorpedo();
    const modalAberto = document.getElementById('torpedo-modal')?.classList.contains('active');
    if (modalAberto) renderizarTimersSidebar();
  }, 1000);
}
