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
   - v59: a mesma busca também procura nas SIGLAS (base do antigo
     "Buscador de Siglas", em data/siglas.json — carregada só quando
     a janela abre). Resultados de siglas usam o mesmo cartão.
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
function nodeMapUrl(r) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(nodeMapQuery(r)); }
function openNodeMap(i) {
  const r = _nodes.rows[i];
  if (!r) return;
  window.open(nodeMapUrl(r), '_blank', 'noopener,noreferrer');
}

/* ── Siglas (v58) ──
   data/siglas.json: { cols:[sigla, endereco, uf, tipo, nomeFantasia, razaoSocial, predio], dic:{uf,tipo,ng,rs,pr}, rows } */
const SIGLAS_URL = 'data/siglas.json';
let _sg = { rows: null, dic: null, idx: null, loading: null, err: false };
function _sgLoad() {
  if (_sg.rows) return Promise.resolve();
  if (_sg.loading) return _sg.loading;
  _sg.err = false;
  _sg.loading = fetch(SIGLAS_URL).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => { _sg.rows = j.rows; _sg.dic = j.dic; _sg.idx = null; })
    .catch(() => { _sg.err = true; })
    .finally(() => { _sg.loading = null; });
  return _sg.loading;
}
function sgItem(i) {
  const r = _sg.rows[i], d = _sg.dic;
  return { sigla: r[0], end: r[1], uf: d.uf[r[2]], tipo: d.tipo[r[3]], fantasia: d.ng[r[4]], razao: d.rs[r[5]], predio: d.pr[r[6]] };
}
const _sgIsMovel = it => /SITE DA M[OÓ]VEL/i.test(it.tipo || '');
const _sgCompact = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function _sgIndex() {
  if (_sg.idx) return _sg.idx;
  _sg.idx = _sg.rows.map(r => ({ c: _sgCompact(r[0]), n: _ndNorm(r[0]),
    a: _ndNorm([r[0], r[1], _sg.dic.ng[r[4]], _sg.dic.rs[r[5]], _sg.dic.pr[r[6]]].join(' ')) }));
  return _sg.idx;
}
function sgMapUrl(it) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${it.end}${it.uf ? ' - ' + it.uf : ''}, Brasil`);
}
function openSiglaMap(i) {
  const it = _sg.rows && _sg.rows[i] ? sgItem(i) : null;
  if (!it || !it.end) { if (typeof showActionToast === 'function') showActionToast('Sem endereço para abrir no mapa', 'error'); return; }
  window.open(sgMapUrl(it), '_blank', 'noopener,noreferrer');
}
function formatSiglaMsg(it) {
  const v = x => { x = String(x || '').trim(); return x && x !== '-' ? x : ''; };
  const L = [`🏷️ *SIGLA ${v(it.sigla) || '—'}*`, ''];
  if (v(it.tipo)) L.push(`🏗️ *Tipo de site:* ${v(it.tipo)}`);
  if (!_sgIsMovel(it)) {
    if (v(it.predio))   L.push(`🏢 *Prédio:* ${v(it.predio)}`);
    if (v(it.razao))    L.push(`🏛️ *Razão social:* ${v(it.razao)}`);
    if (v(it.fantasia)) L.push(`✨ *Nome fantasia:* ${v(it.fantasia)}`);
  }
  L.push('');
  L.push(`📍 *Endereço:* ${v(it.end) || '—'}`);
  if (v(it.end)) L.push(`🗺️ ${sgMapUrl(it)}`);
  return L.join('\n');
}
async function _ndCopyText(text, btn, okMsg) {
  const ok = typeof _waWrite === 'function' ? await _waWrite(text)
    : await navigator.clipboard.writeText(text).then(() => true, () => false);
  if (btn) {
    const lbl = btn.querySelector('span');
    btn.classList.toggle('done', ok);
    if (lbl) lbl.textContent = ok ? 'Copiado' : 'Erro';
    setTimeout(() => { btn.classList.remove('done'); if (lbl) lbl.textContent = 'Copiar'; }, 1600);
  }
  if (typeof showActionToast === 'function')
    showActionToast(ok ? okMsg : 'Não foi possível copiar', ok ? 'success' : 'error');
}
function copySiglaInfo(i, btn) {
  if (!_sg.rows || !_sg.rows[i]) return;
  const it = sgItem(i);
  _ndCopyText(formatSiglaMsg(it), btn, `Sigla ${it.sigla || ''} copiada — cole na conversa`);
}

/* ── Copiar as informações do node para enviar por mensagem (WhatsApp etc.) ── */
function formatNodeMsg(r) {
  const v = x => { x = String(x || '').trim(); return x && x !== '-' ? x : ''; };
  const L = [];
  L.push(`📡 *NODE ${v(r[0])}*`);
  L.push('');
  if (v(r[1])) L.push(`🏢 *Headend/Hub:* ${v(r[1])}`);
  if (v(r[2])) L.push(`🛣️ *Rota:* ${v(r[2])}`);
  if (v(r[3])) L.push(`🔀 *Segmentação:* ${v(r[3])}`);
  if (v(r[4])) L.push(`🏭 *Fabricante:* ${v(r[4])}`);
  if (v(r[5])) L.push(`⚙️ *Modelo:* ${v(r[5])}`);
  L.push('');
  L.push(`📍 *Endereço:* ${v(r[6]) || '—'}`);
  if (v(r[7])) L.push(`🔢 *Número/Ref.:* ${v(r[7])}`);
  L.push(`🗺️ ${nodeMapUrl(r)}`);
  return L.join('\n');
}
async function copyNodeInfo(i, btn) {
  const r = _nodes.rows[i];
  if (!r) return;
  return _ndCopyText(formatNodeMsg(r), btn, `Node ${r[0]} copiado — cole na conversa`);
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
        <div class="modal-title">Endereços de Node e Siglas</div>
        <div class="modal-tools">
          <button type="button" class="modal-csv-btn" id="nodes-update-btn" title="Enviar uma planilha .xlsx nova para todos">Atualizar base</button>
          <button class="modal-close-btn" onclick="closeNodes()">&times;</button>
        </div>
      </div>
      <div class="nodes-search">
        <input type="search" id="nodes-q" placeholder="Buscar node ou sigla (ex.: IPNG, ARS RP)" autocomplete="off" autocapitalize="characters" spellcheck="false">
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
    if (b) { openNodeMap(Number(b.dataset.map)); return; }
    const c = e.target.closest('[data-ndcopy]');
    if (c) { copyNodeInfo(Number(c.dataset.ndcopy), c); return; }
    const sm = e.target.closest('[data-sgmap]');
    if (sm) { openSiglaMap(Number(sm.dataset.sgmap)); return; }
    const sc = e.target.closest('[data-sgcopy]');
    if (sc) copySiglaInfo(Number(sc.dataset.sgcopy), sc);
  });
  return ov;
}

function openNodes() {
  const ov = _ndModal();
  ov.classList.add('active');
  renderNodeResults();
  setTimeout(() => ov.querySelector('#nodes-q').focus(), 60);
  syncNodes();
  if (!_sg.rows) _sgLoad().then(renderNodeResults);
}
function closeNodes() { document.getElementById('nodes-modal')?.classList.remove('active'); }

function _ndStatus(html) { const s = document.getElementById('nodes-status'); if (s) s.innerHTML = html; }
function _ndInfo() {
  const p = [];
  if (_nodes.rows.length) {
    const d = _nodes.at ? new Date(_nodes.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '';
    p.push(`${_nodes.rows.length.toLocaleString('pt-BR')} nodes na base${d ? ' (atualizada em ' + d + ')' : ''}`);
  }
  if (_sg.rows) p.push(`${_sg.rows.length.toLocaleString('pt-BR')} siglas`);
  else if (_sg.loading) p.push('carregando siglas…');
  else if (_sg.err) p.push('siglas indisponíveis');
  return p.join(' · ');
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
/* Siglas: igual ao antigo buscador — "ARS RP", "ARSRP" e "ars-rp" acham a mesma sigla */
function searchSiglas(q) {
  if (!_sg.rows) return { exact: [], starts: [], has: [], text: [] };
  const qn = _ndNorm(q), qc = _sgCompact(q);
  const out = { exact: [], starts: [], has: [], text: [] };
  if (!qn) return out;
  _sgIndex().forEach((x, i) => {
    if (qc && x.c === qc) out.exact.push(i);
    else if (qc && x.c && x.c.startsWith(qc)) out.starts.push(i);
    else if (qc && x.c && x.c.includes(qc)) out.has.push(i);
    else if (qn.length >= 3 && x.a.includes(qn)) out.text.push(i);
  });
  const by = (a, b) => _sg.idx[a].n.localeCompare(_sg.idx[b].n);
  out.starts.sort(by); out.has.sort(by); out.text.sort(by);
  return out;
}
/* Junta nodes e siglas na mesma lista, do mais parecido para o menos */
function searchAll(q) {
  const qn = _ndNorm(q);
  const tiers = { exact: [], starts: [], has: [], text: [] };
  if (_nodes.rows.length) {
    const idx = _ndIndex();
    searchNodes(q).forEach(i => {
      const n = idx[i].n;
      tiers[n === qn ? 'exact' : n.startsWith(qn) ? 'starts' : n.includes(qn) ? 'has' : 'text'].push({ k: 'n', i });
    });
  }
  const sg = searchSiglas(q);
  for (const t of Object.keys(tiers)) sg[t].forEach(i => tiers[t].push({ k: 's', i }));
  return [...tiers.exact, ...tiers.starts, ...tiers.has, ...tiers.text];
}

function renderNodeResults() {
  const box = document.getElementById('nodes-results');
  if (!box) return;
  const q = document.getElementById('nodes-q').value;
  const nodesMsg = _nodes.rows.length ? '' : (_ndReady()
      ? 'Base de nodes ainda não carregada. Toque em <b>Atualizar base</b> e escolha a planilha <b>.xlsx</b> de endereços.'
      : 'Nodes: disponível no SIR publicado (site), com a chave de acesso.');
  if (!q.trim()) {
    box.innerHTML = `<div class="nodes-empty">Digite o nome do node ou a sigla para buscar.<br><small>Também acha por endereço, prédio ou empresa.</small>${nodesMsg ? `<br><small>${nodesMsg}</small>` : ''}</div>`;
    _ndStatus(_ndInfo());
    return;
  }
  const res = searchAll(q);
  const extra = _sg.loading ? ' · carregando siglas…' : (_sg.err ? ' · siglas indisponíveis' : '');
  _ndStatus((res.length ? `${res.length} resultado${res.length > 1 ? 's' : ''}${res.length > NODES_MAX_RESULTS ? ` · mostrando ${NODES_MAX_RESULTS}` : ''}` : 'Nada encontrado') + extra);
  if (!res.length) {
    box.innerHTML = `<div class="nodes-empty">Nenhum node ou sigla encontrado${_sg.loading ? '<br><small>As siglas ainda estão carregando…</small>' : ''}${nodesMsg ? `<br><small>${nodesMsg}</small>` : ''}</div>`;
    return;
  }
  const F = (lbl, v, wide) => `<div class="nd-f${wide ? ' nd-wide' : ''}"><span class="nd-l">${lbl}</span><span class="nd-v">${escapeHtml(v || '—')}</span></div>`;
  const BTNS = (attrCopy, attrMap, name) => `
        <button type="button" class="nd-copy" ${attrCopy} title="Copiar informações para enviar por mensagem" aria-label="Copiar informações de ${escapeHtml(name)}">
          <i data-lucide="copy"></i><span>Copiar</span>
        </button>
        <button type="button" class="nd-map" ${attrMap} title="Abrir no Google Maps" aria-label="Abrir ${escapeHtml(name)} no Google Maps">
          <i data-lucide="map-pin"></i><span>Mapa</span>
        </button>`;
  box.innerHTML = res.slice(0, NODES_MAX_RESULTS).map(({ k, i }) => {
    if (k === 'n') {
      const r = _nodes.rows[i];
      return `<div class="nd-card">
      <div class="nd-head">
        <div class="nd-title">${escapeHtml(r[0])}</div>
        <span class="nd-kind">Node</span>
        ${BTNS(`data-ndcopy="${i}"`, `data-map="${i}"`, 'node ' + r[0])}
      </div>
      <div class="nd-grid">
        ${F('HEADEND/HUB', r[1])}${F('ROTA', r[2])}${F('SEGMENTAÇÃO', r[3])}
        ${F('FABRICANTE', r[4])}${F('MODELO', r[5])}
        ${F('ENDEREÇO', r[6], true)}${F('NÚMERO/REFERÊNCIA', r[7], true)}
      </div>
    </div>`;
    }
    const it = sgItem(i), movel = _sgIsMovel(it);
    return `<div class="nd-card nd-sigla">
      <div class="nd-head">
        <div class="nd-title">${escapeHtml(it.sigla || '(sem sigla)')}</div>
        <span class="nd-kind">${movel ? 'Site da Móvel' : 'Sigla'}</span>
        ${BTNS(`data-sgcopy="${i}"`, `data-sgmap="${i}"`, 'sigla ' + (it.sigla || ''))}
      </div>
      <div class="nd-grid">
        ${F('TIPO DE SITE', it.tipo)}${movel ? '' : F('NOME DO PRÉDIO', it.predio) + F('NOME FANTASIA', it.fantasia)}
        ${movel ? '' : F('RAZÃO SOCIAL', it.razao, true)}
        ${F('ENDEREÇO COMPLETO', it.end, true)}
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
