/* ══════════════════════════════════════════════════════════════
   Endereços de Node
   - Busca por node → título + HEADEND/HUB, ROTA, SEGMENTAÇÃO,
     FABRICANTE, MODELO, ENDEREÇO, NÚMERO/REFERÊNCIA
   - Botão de balão (pino) abre o endereço no Google Maps
   - A base fica no servidor, protegida pela chave do SIR
     (não vai para o GitHub público). Fica guardada no aparelho
     para abrir rápido e funcionar sem internet.
   - "Atualizar base": escolha a planilha .xlsx; ela é lida aqui
     mesmo no aparelho e enviada ao servidor para todos.
   Linha: [node, headend, rota, segmentação, fabricante, modelo, endereço, número/ref, região]
   ══════════════════════════════════════════════════════════════ */

const LS_NODES = 'sir_nodes_cache';
const NODES_MAX_RESULTS = 60;
const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

let _nodes = { at: 0, rows: [], idx: null };
try { const c = JSON.parse(localStorage.getItem(LS_NODES) || 'null'); if (c && Array.isArray(c.rows)) _nodes = { at: c.at || 0, rows: c.rows, idx: null }; } catch (e) {}

const _ndNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
function _ndUrl() { return typeof _pushUrl === 'function' ? _pushUrl() : ''; }
function _ndKey() { return typeof _pushKey === 'function' ? _pushKey() : ''; }
function _ndReady() { return !!(_ndUrl() && location.protocol === 'https:'); }

/* ── Google Maps: monta "endereço, número, rota, cidade - UF" ── */
const _ND_RIO = new Set(['CENTRO-SUL', 'NORTE', 'OESTE']);
const _ND_ES  = new Set(['SERRA', 'VILA VELHA', 'VITORIA', 'CARIACICA', 'CACHOEIRA DE ITAPEMIRIM']);
function nodeMapQuery(r) {
  const [, headend, rota, , , , end, num, regiao] = r;
  const reg = _ndNorm(regiao), he = _ndNorm(headend).replace(/\s*-\s*BLUE TV$/, '');
  const es = _ND_ES.has(reg) || _ND_ES.has(he);
  let cidade = '';
  if (_ND_RIO.has(reg)) cidade = 'Rio de Janeiro';
  else if (es) cidade = _ND_ES.has(reg) ? regiao : headend;
  else if (reg !== 'BAIXADA FLUMINENSE') cidade = he ? headend.replace(/\s*-\s*BLUE TV$/i, '') : '';
  const partes = [end, num && num !== '-' ? num : '', rota, cidade].map(x => String(x || '').trim()).filter(Boolean);
  return partes.join(', ') + ` - ${es ? 'ES' : 'RJ'}, Brasil`;
}
function openNodeMap(i) {
  const r = _nodes.rows[i];
  if (!r) return;
  window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(nodeMapQuery(r)), '_blank', 'noopener,noreferrer');
}

/* ── Janela ── */
function _ndModal() {
  let ov = document.getElementById('nodes-modal');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'nodes-modal';
  ov.addEventListener('click', closeNodes);
  ov.innerHTML = `
    <div class="modal-content nodes-modal-content" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">Endereços de Node</div>
        <div class="modal-tools">
          <button type="button" class="modal-csv-btn" id="nodes-update-btn" title="Enviar uma planilha .xlsx nova para todos">Atualizar base</button>
          <button class="modal-close-btn" onclick="closeNodes()">&times;</button>
        </div>
      </div>
      <div class="nodes-search">
        <input type="search" id="nodes-q" placeholder="Buscar node (ex.: IPNG)" autocomplete="off" autocapitalize="characters" spellcheck="false">
        <div class="nodes-status" id="nodes-status"></div>
      </div>
      <div class="nodes-results" id="nodes-results"></div>
      <input type="file" id="nodes-file" accept=".xlsx,.xls" hidden>
    </div>`;
  document.body.appendChild(ov);
  const q = ov.querySelector('#nodes-q');
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderNodeResults, 120); });
  q.addEventListener('keydown', e => { if (e.key === 'Escape') closeNodes(); });
  ov.querySelector('#nodes-update-btn').addEventListener('click', () => ov.querySelector('#nodes-file').click());
  ov.querySelector('#nodes-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) uploadNodesXlsx(f); });
  ov.querySelector('#nodes-results').addEventListener('click', e => {
    const b = e.target.closest('[data-map]');
    if (b) openNodeMap(Number(b.dataset.map));
  });
  return ov;
}

function openNodes() {
  const ov = _ndModal();
  ov.classList.add('active');
  renderNodeResults();
  setTimeout(() => ov.querySelector('#nodes-q').focus(), 60);
  syncNodes();
}
function closeNodes() { document.getElementById('nodes-modal')?.classList.remove('active'); }

function _ndStatus(html) { const s = document.getElementById('nodes-status'); if (s) s.innerHTML = html; }
function _ndInfo() {
  if (!_nodes.rows.length) return '';
  const d = _nodes.at ? new Date(_nodes.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '';
  return `${_nodes.rows.length.toLocaleString('pt-BR')} nodes na base${d ? ' · atualizada em ' + d : ''}`;
}

/* ── Busca ── */
function _ndIndex() {
  if (_nodes.idx) return _nodes.idx;
  _nodes.idx = _nodes.rows.map(r => ({ n: _ndNorm(r[0]), a: _ndNorm([r[6], r[7], r[2], r[1]].join(' ')) }));
  return _nodes.idx;
}
function searchNodes(q) {
  q = _ndNorm(q);
  if (!q) return [];
  const idx = _ndIndex(), exact = [], starts = [], has = [], addr = [];
  idx.forEach((x, i) => {
    if (x.n === q) exact.push(i);
    else if (x.n.startsWith(q)) starts.push(i);
    else if (x.n.includes(q)) has.push(i);
    else if (q.length >= 4 && x.a.includes(q)) addr.push(i);
  });
  const byName = (a, b) => idx[a].n.localeCompare(idx[b].n);
  return [...exact, ...starts.sort(byName), ...has.sort(byName), ...addr.sort(byName)];
}

function renderNodeResults() {
  const box = document.getElementById('nodes-results');
  if (!box) return;
  const q = document.getElementById('nodes-q').value;
  if (!_nodes.rows.length) {
    box.innerHTML = `<div class="nodes-empty">${_ndReady()
      ? 'Base de nodes ainda não carregada. Toque em <b>Atualizar base</b> e escolha a planilha <b>.xlsx</b> de endereços.'
      : 'Disponível no SIR publicado (site), com a chave de acesso.'}</div>`;
    _ndStatus('');
    return;
  }
  if (!q.trim()) { box.innerHTML = `<div class="nodes-empty">Digite o nome do node para buscar.<br><small>Também acha por endereço (4+ letras).</small></div>`; _ndStatus(_ndInfo()); return; }
  const res = searchNodes(q);
  _ndStatus(res.length ? `${res.length} resultado${res.length > 1 ? 's' : ''}${res.length > NODES_MAX_RESULTS ? ` · mostrando ${NODES_MAX_RESULTS}` : ''}` : 'Nenhum node encontrado');
  const F = (lbl, v, wide) => `<div class="nd-f${wide ? ' nd-wide' : ''}"><span class="nd-l">${lbl}</span><span class="nd-v">${escapeHtml(v || '—')}</span></div>`;
  box.innerHTML = res.slice(0, NODES_MAX_RESULTS).map(i => {
    const r = _nodes.rows[i];
    return `<div class="nd-card">
      <div class="nd-head">
        <div class="nd-title">${escapeHtml(r[0])}</div>
        <button type="button" class="nd-map" data-map="${i}" title="Abrir no Google Maps" aria-label="Abrir ${escapeHtml(r[0])} no Google Maps">
          <i data-lucide="map-pin"></i><span>Mapa</span>
        </button>
      </div>
      <div class="nd-grid">
        ${F('HEADEND/HUB', r[1])}${F('ROTA', r[2])}${F('SEGMENTAÇÃO', r[3])}
        ${F('FABRICANTE', r[4])}${F('MODELO', r[5])}
        ${F('ENDEREÇO', r[6], true)}${F('NÚMERO/REFERÊNCIA', r[7], true)}
      </div>
    </div>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: Array.from(box.querySelectorAll('[data-lucide]')) });
}

/* ── Servidor ── */
async function _ndPost(path, payload) {
  const r = await fetch(_ndUrl() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}
async function syncNodes() {
  if (!_ndReady()) return;
  const key = _ndKey();
  if (!key) { if (typeof _ntAskKeyCard === 'function') _ntAskKeyCard(); return; }
  try {
    if (!_nodes.rows.length) _ndStatus('Carregando base…');
    const r = await _ndPost('/nodes', { key, since: _nodes.at || 0 });
    if (r.status === 403) { if (typeof _ntAskKeyCard === 'function') _ntAskKeyCard('Chave incorreta. Digite novamente.'); return; }
    if (r.status === 200 && !r.body.same && Array.isArray(r.body.rows)) {
      _nodes = { at: r.body.at || 0, rows: r.body.rows, idx: null };
      try { localStorage.setItem(LS_NODES, JSON.stringify({ at: _nodes.at, rows: _nodes.rows })); } catch (e) {}
      renderNodeResults();
    } else if (!document.getElementById('nodes-q')?.value.trim()) _ndStatus(_ndInfo());
  } catch (e) {
    _ndStatus(_nodes.rows.length ? _ndInfo() + ' · sem conexão' : 'Sem conexão com o servidor');
  }
}

/* ── Atualizar base a partir da planilha .xlsx ── */
function _ndLoadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = XLSX_CDN; s.onload = () => ok(window.XLSX); s.onerror = () => fail(new Error('não foi possível carregar o leitor de planilhas'));
    document.head.appendChild(s);
  });
}
function parseNodesSheet(XLSX, wb) {
  const want = { node: ['NODES', 'NODE'], headend: ['HEADEND/HUB', 'HEADEND', 'HUB'], rota: ['ROTA'], seg: ['SEGMENTACAO'],
                 fab: ['FABRICANTE'], modelo: ['MODELO'], end: ['ENDERECO'], num: ['NUMERO / REFERENCIA', 'NUMERO/REFERENCIA', 'NUMERO', 'REFERENCIA'], reg: ['REGIAO'] };
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
    for (let h = 0; h < Math.min(grid.length, 15); h++) {
      const head = grid[h].map(c => _ndNorm(c).replace(/\s*\/\s*/g, ' / ').replace(/\n/g, ' '));
      const col = {};
      for (const [k, alts] of Object.entries(want)) {
        const norm = alts.map(a => a.replace(/\s*\/\s*/g, ' / '));
        let i = head.findIndex(x => norm.includes(x));
        if (i < 0 && k !== 'rota') i = head.findIndex(x => norm.some(a => x.startsWith(a)));
        col[k] = i;
      }
      if (col.node < 0 || col.end < 0) continue;
      const rows = [];
      for (let i = h + 1; i < grid.length; i++) {
        const g = grid[i], v = k => (col[k] >= 0 ? String(g[col[k]] ?? '').trim() : '');
        if (!v('node')) continue;
        rows.push([v('node').toUpperCase(), v('headend'), v('rota'), v('seg'), v('fab'), v('modelo'), v('end'), v('num'), v('reg')]);
      }
      if (rows.length) return { sheet: name, rows };
    }
  }
  return null;
}
async function uploadNodesXlsx(file) {
  if (!_ndReady()) { if (typeof showActionToast === 'function') showActionToast('Use o SIR publicado (site) para atualizar a base', 'error'); return; }
  const key = _ndKey();
  if (!key) { if (typeof _ntAskKeyCard === 'function') _ntAskKeyCard(); return; }
  const btn = document.getElementById('nodes-update-btn');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Lendo planilha…'; }
    const XLSX = await _ndLoadXlsx();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const parsed = parseNodesSheet(XLSX, wb);
    if (!parsed) throw new Error('não achei as colunas NODES e ENDEREÇO na planilha');
    if (btn) btn.textContent = `Enviando ${parsed.rows.length}…`;
    const by = (() => { try { return localStorage.getItem('sir_user_name') || ''; } catch (e) { return ''; } })();
    const r = await _ndPost('/nodes/set', { key, rows: parsed.rows, by });
    if (r.status !== 200) throw new Error(r.status === 403 ? 'chave incorreta' : 'o servidor recusou (' + r.status + ')');
    _nodes = { at: r.body.at, rows: parsed.rows, idx: null };
    try { localStorage.setItem(LS_NODES, JSON.stringify({ at: _nodes.at, rows: _nodes.rows })); } catch (e) {}
    renderNodeResults(); _ndStatus(_ndInfo());
    if (typeof showActionToast === 'function') showActionToast(`Base atualizada: ${parsed.rows.length.toLocaleString('pt-BR')} nodes (aba ${parsed.sheet})`, 'success');
  } catch (e) {
    if (typeof showActionToast === 'function') showActionToast('Não foi possível atualizar: ' + (e && e.message), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Atualizar base'; }
  }
}
