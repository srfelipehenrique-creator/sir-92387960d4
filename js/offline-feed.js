/* ══════════════════════════════════════════════════════════════
   ALIMENTAR OFF-LINE — atualização manual pelo topo do painel
   - Aceita a base de RAL (separa RAL e RAL de Qualidade) e/ou a de REC:
     planilha (.csv, .xlsx, .xlsm, .xls) ou imagem (print/foto da tela).
   - Imagem: o texto é lido no próprio navegador (OCR, sem enviar a lugar
     nenhum); planilha: lê as colunas pelo cabeçalho (Num.Recup., CF Exec.,
     Designação, Tipo Ral, Cliente, Abertura) ou procura os números
     RAL-/REC- em cada linha.
   - Antes de aplicar mostra o que foi encontrado. Entram SÓ os tickets que
     ainda não estão no painel: nada é repetido e nada que já está em tela
     é trocado.
   - Os tickets alimentados ficam guardados neste aparelho enquanto a fonte
     de dados (coletor / servidor / pública) não mudar. Quando ela receber
     uma atualização nova, a sincronização automática volta sozinha e os
     tickets manuais saem.
   ══════════════════════════════════════════════════════════════ */

const LS_OFFLINE = 'sir_offline_feed_v1';   /* { fp, at, items: [{ tk: 'ral'|'rec'|'qual', item }] } */
const OFF_XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const OFF_OCR_URL  = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const OFF_RX_TICKET = /\b(RAL|REC|QUA)?\s*[-–]?\s*(\d{5,8})\s*\/\s*(20\d\d)\b/i;
const OFF_RAL_TIPOS = ['FOTONICA', 'FOTÔNICA', 'BACKBONE', 'COLETOR', 'PPC', 'ACESSO CLIENTE', 'QUALIDADE'];

/* ───────── Guardado no aparelho ───────── */
function _offRead() {
  try { const v = JSON.parse(localStorage.getItem(LS_OFFLINE) || 'null'); if (v && Array.isArray(v.items)) return v; } catch (e) {}
  return { fp: '', at: 0, items: [] };
}
function _offWrite(v) { try { localStorage.setItem(LS_OFFLINE, JSON.stringify(v)); } catch (e) {} }
function offlineFeedCount() { return _offRead().items.length; }

/* Impressão digital simples do conteúdo da fonte (para saber quando ela mudou) */
function _offHash(a, b) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const s = String(a || '') + '\u0001' + String(b || '');
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2246822519) >>> 0; }
  return h1.toString(36) + h2.toString(36) + s.length.toString(36);
}

function _offFirstPattern(cf) {
  for (const cfs of Object.values(REGIONS)) if (cfs[cf]) return cfs[cf][0];
  return null;
}

/* Chamada no começo de onDataReady: junta os tickets manuais que faltam */
function mergeOfflineFeed(ralRes, recRes, ralText, recText) {
  const texts = ralText && recText ? [ralText, recText] : (appState._snapTexts || null);
  const fp = texts ? _offHash(texts[0], texts[1]) : '';
  if (fp) appState.sourceFp = fp;
  const st = _offRead();
  appState.offlineInfo = { n: 0, at: st.at };
  if (!st.items.length) { renderOfflineStatus(); return; }

  if (!st.fp && fp) { st.fp = fp; _offWrite(st); }   /* enviado sem fonte conhecida: adota a atual */
  /* A fonte recebeu dados novos desde o envio manual → volta a sincronização automática */
  if (st.fp && fp && st.fp !== fp) {
    _offWrite({ fp: '', at: 0, items: [] });
    if (typeof showActionToast === 'function')
      showActionToast(`Dados do servidor atualizados: os ${st.items.length} ticket(s) alimentados off-line saíram e a sincronização automática voltou.`, 'success');
    renderOfflineStatus();
    return;
  }

  ralRes.details = ralRes.details || {}; ralRes.counts = ralRes.counts || {}; ralRes.qualidadeDetails = ralRes.qualidadeDetails || {};
  recRes.details = recRes.details || {}; recRes.counts = recRes.counts || {};
  const have = { ral: new Set(), rec: new Set() };
  for (const p in ralRes.details) for (const i of ralRes.details[p]) have.ral.add(normTicket(i.ticket));
  for (const p in ralRes.qualidadeDetails) for (const i of ralRes.qualidadeDetails[p]) have.ral.add(normTicket(i.ticket));
  for (const p in recRes.details) for (const i of recRes.details[p]) have.rec.add(normTicket(i.ticket));

  let n = 0;
  for (const { tk, item } of st.items) {
    const set = tk === 'rec' ? have.rec : have.ral, key = normTicket(item.ticket);
    if (set.has(key)) continue;                         /* já está na fonte: não repete */
    const p = _offFirstPattern(item.cfOrigem);
    if (!p) continue;
    set.add(key);
    const it = { ...item, cfOrigem: item.cfOrigem, manual: true };
    if (tk === 'qual') {
      (ralRes.qualidadeDetails[p] = ralRes.qualidadeDetails[p] || []).push(it);
    } else {
      const res = tk === 'rec' ? recRes : ralRes;
      (res.details[p] = res.details[p] || []).push(it);
      res.counts[p] = (res.counts[p] || 0) + 1;
      res.total = (res.total || 0) + 1;
    }
    n++;
  }
  appState.offlineInfo = { n, at: st.at };
  renderOfflineStatus();
}

/* Rodapé: quantos tickets manuais estão em uso */
function renderOfflineStatus() {
  const info = appState.offlineInfo;
  let el = document.getElementById('offline-feed-status');
  if (!info || !info.n) { if (el) el.remove(); return; }
  if (!el) {
    const footer = document.querySelector('.page-footer');
    if (!footer) return;
    el = document.createElement('span');
    el.id = 'offline-feed-status';
    el.setAttribute('role', 'button'); el.tabIndex = 0;
    el.addEventListener('click', openOfflineFeed);
    footer.insertBefore(el, footer.lastElementChild);
  }
  el.textContent = `Off-line: ${info.n} ticket${info.n > 1 ? 's' : ''}`;
  el.title = `Tickets alimentados manualmente em ${new Date(info.at).toLocaleString('pt-BR')}. Saem sozinhos quando a fonte de dados for atualizada.`;
}

/* ───────── Leitura dos arquivos ───────── */
function _offLoadScript(url, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = url; s.async = true;
    s.onload = () => window[globalName] ? ok(window[globalName]) : fail(new Error('biblioteca'));
    s.onerror = () => fail(new Error('Sem internet para carregar o leitor (' + globalName + ')'));
    document.head.appendChild(s);
  });
}
async function _offText(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder('windows-1252').decode(buf); }
}
function _offCsvRows(text) {
  text = text.replace(/^﻿/, '');
  const first = (text.split(/\r?\n/).find(l => l.trim()) || '');
  const sep = [';', '\t', ','].map(s => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(x => String(x).trim()));
}
async function _offSheetRows(file) {
  const XLSX = await _offLoadScript(OFF_XLSX_URL, 'XLSX');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const rows = [];
  for (const name of wb.SheetNames) {
    const r = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
    rows.push(...r.map(x => x.map(c => String(c ?? '').trim())), []);
  }
  return rows;
}
async function _offImageLines(file, onProgress) {
  const T = await _offLoadScript(OFF_OCR_URL, 'Tesseract');
  const r = await T.recognize(file, 'por', { logger: m => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress); } });
  return String(r.data.text || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/* CF a partir do texto da célula ou da linha (padrão "RT/RJO /SEF/NET/FO" ou a sigla) */
const _offCfKeys = () => Object.values(REGIONS).flatMap(c => Object.keys(c));
function _offResolveCf(txt) {
  const raw = String(txt || '').toUpperCase();
  if (!raw.trim()) return '';
  const compact = raw.replace(/\s+/g, '');
  for (const [pat, cf] of Object.entries(patternToCF)) if (compact.includes(pat.replace(/\s+/g, ''))) return cf;
  const m = compact.match(/R[TC]\/[A-Z]{3}\/([A-Z0-9]{3})\//);
  if (m && _offCfKeys().includes(m[1])) return m[1];
  for (const cf of _offCfKeys()) if (new RegExp(`(^|[^A-Z0-9])${cf}([^A-Z0-9]|$)`).test(raw)) return cf;
  return '';
}
function _offTicket(txt, defTk) {
  const m = String(txt || '').match(OFF_RX_TICKET);
  if (!m) return null;
  let tk = (m[1] || '').toUpperCase();
  if (tk === 'QUA') tk = 'RAL';
  if (!tk) tk = defTk === 'rec' ? 'REC' : 'RAL';
  return { ticket: `${tk}-${m[2]}/${m[3]}`, tk: tk.toLowerCase(), at: m.index, len: m[0].length };
}
function _offDate(txt) {
  const m = String(txt || '').match(/(\d{2}\/\d{2}\/\d{4})\s*[-–]?\s*(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : '';
}
function _offIsQual(txt) { return /QUALIDADE/i.test(normalizeStr(txt)); }

/* Linhas de planilha → tickets */
function _offFromRows(rows, zone) {
  const out = [];
  const norm = s => normalizeStr(String(s || '')).trim();
  let H = null;
  for (const r of rows) {
    if (!r || !r.some(c => c)) continue;
    const n = r.map(norm);
    const looksHeader = n.some(c => c === 'CF EXEC.' || c === 'CF EXEC' || c.startsWith('NUM.RECUP') || c === 'DESIGNACAO') && !r.some(c => OFF_RX_TICKET.test(c));
    if (looksHeader) {
      const f = test => n.findIndex(test);
      H = {
        num: f(c => c.startsWith('NUM.RECUP') || c.startsWith('NUM.RAL') || c === 'TICKET' || c === 'NUMERO'),
        cf: f(c => c.startsWith('CF')),
        desig: f(c => c.startsWith('DESIGNA')),
        tipo: f(c => c.includes('TIPO')),
        cli: f(c => c.includes('CLIENTE')),
        ab: f(c => c.includes('ABERTURA')),
      };
      continue;
    }
    const line = r.join(' ');
    const t = _offTicket(H && H.num > -1 ? r[H.num] : line, zone) || _offTicket(line, zone);
    if (!t) continue;
    const get = k => (H && H[k] > -1 ? r[H[k]] || '' : '');
    const cf = _offResolveCf(get('cf')) || _offResolveCf(line);
    const isRal = t.tk === 'ral';
    const qual = isRal && _offIsQual(line);
    out.push({
      tk: qual ? 'qual' : t.tk,
      ticket: t.ticket,
      cfOrigem: cf,
      designacao: get('desig') || (isRal ? '' : ''),
      extra: isRal ? (get('tipo') || (qual ? 'QUALIDADE' : '')) : get('cli'),
      abertura: get('ab') || _offDate(line),
    });
  }
  return out;
}

/* Texto lido da imagem → tickets (uma linha por ticket; a de baixo pode ser a designação/cliente) */
function _offFromLines(lines, zone) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = _offTicket(line, zone);
    if (!t) continue;
    const isRal = t.tk === 'ral';
    let before = line.slice(0, t.at).trim(), after = line.slice(t.at + t.len).trim();
    const next = lines[i + 1] && !_offTicket(lines[i + 1], zone) ? lines[i + 1] : '';
    const cf = _offResolveCf(line) || _offResolveCf(next);
    const qual = isRal && (_offIsQual(line) || _offIsQual(next));
    let tipo = '';
    if (isRal) for (const tp of OFF_RAL_TIPOS) if (normalizeStr(line).includes(normalizeStr(tp))) { tipo = normalizeStr(tp) === 'FOTONICA' ? 'FOTÔNICA' : tp; break; }
    const clean = s => s.replace(/\b\d{2}\/\d{2}\/\d{4}.*$/, '').replace(new RegExp(`\\b(${_offCfKeys().join('|')})\\b\\s*$`), '').replace(/R[TC]\s*\/.*$/, '').trim();
    let desig = isRal ? clean(before.replace(new RegExp(OFF_RAL_TIPOS.join('|'), 'i'), '')) : '';
    let extra = isRal ? tipo : clean(after.replace(/^\d+\s*/, ''));
    if (!desig && !extra && next) { if (isRal) desig = clean(next); else extra = clean(next); }
    else if (isRal && !desig && next) desig = clean(next);
    out.push({ tk: qual ? 'qual' : t.tk, ticket: t.ticket, cfOrigem: cf, designacao: desig, extra: extra || (qual ? 'QUALIDADE' : ''), abertura: _offDate(line) || _offDate(next) });
  }
  return out;
}

/* ───────── Janela ───────── */
let _offFound = [];   /* tickets encontrados na última leitura */
let _offBusy = 0;     /* arquivos sendo lidos (o botão Aplicar espera) */

function _offModal() {
  let ov = document.getElementById('offline-modal');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'offline-modal';
  ov.addEventListener('click', closeOfflineFeed);
  const accept = '.csv,.txt,.xlsx,.xlsm,.xls,image/*';
  const zone = (k, icon, title, desc) => `
    <label class="off-zone" data-zone="${k}">
      <div class="off-zone-t"><span class="off-zone-ico">${icon}</span>${title}</div>
      <div class="off-zone-d">${desc}</div>
      <span class="off-pick">Selecionar arquivo ${k.toUpperCase()}…</span>
      <span class="off-files" data-files="${k}"></span>
      <input type="file" accept="${accept}" multiple hidden data-input="${k}">
    </label>`;
  ov.innerHTML = `
    <div class="modal-content off-modal-content" onclick="event.stopPropagation()">
      <div class="off-head">
        <div class="off-head-ico" aria-hidden="true">⤒</div>
        <div class="off-head-tx">
          <div class="off-title">Alimentar off-line</div>
          <div class="off-sub">Envie RAL (separa automaticamente RAL + Qualidade) e/ou REC — planilha (.csv, .xlsx, .xlsm, .xls) ou imagem (print ou foto da tela)</div>
        </div>
        <button class="modal-close-btn" onclick="closeOfflineFeed()" aria-label="Fechar">&times;</button>
      </div>
      <div class="off-body">
        <div class="off-warn">Entram só os tickets que <b>ainda não estão no painel</b> — nada é repetido e nada que já está em tela é trocado. Enquanto a fonte de dados não receber uma nova atualização, os tickets alimentados aqui ficam guardados neste aparelho. Assim que ela atualizar, a sincronização automática volta sozinha.</div>
        <div class="off-zones">
          ${zone('ral', '▦', 'Base RAL (RAL + QUA)', 'Separa automaticamente filas RAL e QUALIDADE.')}
          ${zone('rec', '▤', 'Base REC', 'Atualiza exclusivamente a fila de Reclamações (REC).')}
        </div>
        <div class="off-progress" id="off-progress" hidden></div>
        <div class="off-preview" id="off-preview"></div>
        <div class="off-current" id="off-current"></div>
      </div>
      <div class="off-foot">
        <button type="button" class="off-btn off-btn-ghost" onclick="closeOfflineFeed()">Fechar</button>
        <button type="button" class="off-btn off-btn-main" id="off-apply" disabled onclick="applyOfflineFeed()">⤒ Aplicar no painel</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll('[data-input]').forEach(inp => inp.addEventListener('change', () => _offReadFiles(inp.dataset.input, [...inp.files])));
  ov.querySelectorAll('.off-zone').forEach(z => {
    z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('drag'); });
    z.addEventListener('dragleave', () => z.classList.remove('drag'));
    z.addEventListener('drop', e => { e.preventDefault(); z.classList.remove('drag'); _offReadFiles(z.dataset.zone, [...e.dataTransfer.files]); });
  });
  ov.addEventListener('change', e => {
    const cb = e.target.closest('[data-off-pick]'); if (cb) { const it = _offFound[+cb.dataset.offPick]; if (it) it.on = cb.checked; _offPaintApply(); }
    const sel = e.target.closest('[data-off-cf]'); if (sel) { const it = _offFound[+sel.dataset.offCf]; if (it) { it.cfOrigem = sel.value; it.on = !!sel.value; } _offPreview(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('active')) closeOfflineFeed(); });
  return ov;
}

function openOfflineFeed() {
  const ov = _offModal();
  _offFound = [];
  ov.querySelectorAll('[data-files]').forEach(x => x.textContent = '');
  ov.querySelectorAll('[data-input]').forEach(x => x.value = '');
  _offPreview(); _offPaintCurrent();
  ov.classList.add('active');
}
function closeOfflineFeed() { document.getElementById('offline-modal')?.classList.remove('active'); }

function _offProgress(t) { const el = document.getElementById('off-progress'); if (!el) return; el.hidden = !t; el.textContent = t || ''; }

async function _offReadFiles(zone, files) {
  if (!files.length) return;
  const label = document.querySelector(`#offline-modal [data-files="${zone}"]`);
  if (label) label.textContent = files.map(f => f.name).join(', ');
  const found = [], erros = [];
  _offBusy++; _offPaintApply();
  for (const f of files) {
    const name = f.name.toLowerCase();
    try {
      if (f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|heic)$/.test(name)) {
        _offProgress(`Lendo a imagem ${f.name}… (pode levar alguns segundos)`);
        const lines = await _offImageLines(f, p => _offProgress(`Lendo a imagem ${f.name}… ${Math.round(p * 100)}%`));
        found.push(..._offFromLines(lines, zone).map(x => ({ ...x, src: 'imagem' })));
      } else if (/\.(xlsx|xlsm|xls)$/.test(name)) {
        _offProgress(`Lendo a planilha ${f.name}…`);
        found.push(..._offFromRows(await _offSheetRows(f), zone).map(x => ({ ...x, src: 'planilha' })));
      } else {
        _offProgress(`Lendo ${f.name}…`);
        found.push(..._offFromRows(_offCsvRows(await _offText(f)), zone).map(x => ({ ...x, src: 'csv' })));
      }
    } catch (e) { erros.push(`${f.name}: ${e.message || e}`); }
  }
  _offBusy--;
  _offProgress(erros.length ? 'Não consegui ler: ' + erros.join(' · ') : '');
  /* junta com o que já foi lido nesta janela (sem repetir) */
  const seen = new Set(_offFound.map(x => x.tk + normTicket(x.ticket)));
  for (const x of found) { const k = x.tk + normTicket(x.ticket); if (seen.has(k)) { x.dupFile = true; } seen.add(k); _offFound.push(x); }
  _offClassify();
  _offPreview();
}

/* Situação de cada ticket encontrado */
function _offClassify() {
  const inPanel = { ral: new Set(), rec: new Set() };
  ((modalData.ral && modalData.ral['ALL']) || []).forEach(i => inPanel.ral.add(normTicket(i.ticket)));
  (typeof _qualAll === 'function' ? _qualAll() : []).forEach(i => inPanel.ral.add(normTicket(i.ticket)));
  ((modalData.rec && modalData.rec['ALL']) || []).forEach(i => inPanel.rec.add(normTicket(i.ticket)));
  const stored = new Set(_offRead().items.map(x => (x.tk === 'rec' ? 'rec' : 'ral') + normTicket(x.item.ticket)));
  for (const x of _offFound) {
    const base = x.tk === 'rec' ? 'rec' : 'ral', key = normTicket(x.ticket);
    x.st = x.dupFile ? 'dup' : (inPanel[base].has(key) || stored.has(base + key)) ? 'painel' : !x.cfOrigem ? 'semcf' : 'novo';
    x.on = x.st === 'novo';
  }
}

function _offPreview() {
  const box = document.getElementById('off-preview');
  if (!box) return;
  if (!_offFound.length) { box.innerHTML = ''; _offPaintApply(); return; }
  const c = { novo: 0, painel: 0, semcf: 0, dup: 0 };
  _offFound.forEach(x => { if (x.st === 'semcf' && x.cfOrigem) x.st = 'novo'; c[x.st]++; });
  const stLbl = { novo: 'Novo', painel: 'Já no painel', semcf: 'Escolha o CF', dup: 'Repetido no arquivo' };
  const tkLbl = { ral: 'RAL', rec: 'REC', qual: 'QUAL' };
  const cfOpts = sel => `<option value="">CF?</option>` + _offCfKeys().map(cf => `<option value="${cf}"${cf === sel ? ' selected' : ''}>${cf}</option>`).join('');
  box.innerHTML = `
    <div class="off-sum"><b>${_offFound.length}</b> encontrado${_offFound.length > 1 ? 's' : ''} · <span class="s-novo">${c.novo} novo${c.novo === 1 ? '' : 's'}</span> · ${c.painel} já no painel${c.semcf ? ` · <span class="s-semcf">${c.semcf} sem CF</span>` : ''}${c.dup ? ` · ${c.dup} repetido${c.dup > 1 ? 's' : ''}` : ''}</div>
    <div class="off-table-wrap"><table class="off-table">
      <thead><tr><th></th><th>Tipo</th><th>Ticket</th><th>CF</th><th>Designação / Cliente</th><th>Abertura</th><th>Situação</th></tr></thead>
      <tbody>${_offFound.map((x, i) => {
        const can = x.st === 'novo' || x.st === 'semcf';
        return `<tr class="off-st-${x.st}">
          <td>${can ? `<input type="checkbox" data-off-pick="${i}" ${x.on ? 'checked' : ''} ${x.cfOrigem ? '' : 'disabled'} aria-label="Incluir ${escapeHtml(x.ticket)}">` : ''}</td>
          <td><span class="off-tk off-tk-${x.tk}">${tkLbl[x.tk]}</span></td>
          <td class="off-mono">${escapeHtml(x.ticket)}</td>
          <td>${can ? `<select data-off-cf="${i}">${cfOpts(x.cfOrigem)}</select>` : escapeHtml(x.cfOrigem || '—')}</td>
          <td class="off-desc">${escapeHtml([x.designacao, x.extra].filter(Boolean).join(' · ') || '—')}</td>
          <td class="off-mono">${escapeHtml(x.abertura || '—')}</td>
          <td><span class="off-st">${stLbl[x.st]}</span></td>
        </tr>`; }).join('')}</tbody>
    </table></div>`;
  _offPaintApply();
}
function _offPaintApply() {
  const btn = document.getElementById('off-apply');
  if (!btn) return;
  const n = _offFound.filter(x => x.on && x.cfOrigem && (x.st === 'novo' || x.st === 'semcf')).length;
  btn.disabled = !n || _offBusy > 0;
  if (_offBusy > 0) { btn.textContent = 'Lendo arquivos…'; return; }
  btn.textContent = n ? `⤒ Aplicar ${n} novo${n > 1 ? 's' : ''} no painel` : '⤒ Aplicar no painel';
}
function _offPaintCurrent() {
  const el = document.getElementById('off-current');
  if (!el) return;
  const st = _offRead();
  el.innerHTML = st.items.length
    ? `Em uso agora: <b>${st.items.length}</b> ticket${st.items.length > 1 ? 's' : ''} alimentado${st.items.length > 1 ? 's' : ''} em ${new Date(st.at).toLocaleString('pt-BR')}. <button type="button" class="off-link" onclick="clearOfflineFeed()">Tirar todos</button>`
    : '';
}

function applyOfflineFeed() {
  const pick = _offFound.filter(x => x.on && x.cfOrigem && (x.st === 'novo' || x.st === 'semcf'));
  if (!pick.length) return;
  const st = _offRead();
  const seen = new Set(st.items.map(x => (x.tk === 'rec' ? 'rec' : 'ral') + normTicket(x.item.ticket)));
  let n = 0;
  for (const x of pick) {
    const k = (x.tk === 'rec' ? 'rec' : 'ral') + normTicket(x.ticket);
    if (seen.has(k)) continue;
    seen.add(k);
    st.items.push({ tk: x.tk, item: { ticket: x.ticket, designacao: x.designacao || 'N/D', extra: x.extra || 'N/D', cfOrigem: x.cfOrigem, abertura: x.abertura || '' } });
    n++;
  }
  st.fp = st.fp || appState.sourceFp || '';
  st.at = Date.now();
  _offWrite(st);
  closeOfflineFeed();
  if (typeof showActionToast === 'function') showActionToast(`${n} ticket${n > 1 ? 's' : ''} incluído${n > 1 ? 's' : ''} no painel (off-line)`, 'success');
  if (typeof loadNow === 'function') loadNow();
}
function clearOfflineFeed() {
  if (!confirm('Tirar do painel todos os tickets alimentados off-line?')) return;
  _offWrite({ fp: '', at: 0, items: [] });
  _offPaintCurrent();
  if (typeof loadNow === 'function') loadNow();
}

/* Botão no menu, antes de "Minhas Áreas" */
document.addEventListener('DOMContentLoaded', () => {
  const ref = document.querySelector('.header-actions .btn-settings-areas');
  if (!ref || document.getElementById('btn-offline-feed')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'btn-offline-feed';
  b.className = 'btn-settings btn-offline-feed';
  b.title = 'Alimentar off-line: incluir RAL/REC a partir de planilha, CSV ou imagem';
  b.innerHTML = '<span aria-hidden="true">⤒</span> Alimentar off-line';
  b.addEventListener('click', openOfflineFeed);
  ref.parentNode.insertBefore(b, ref);
});
