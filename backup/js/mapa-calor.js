/* ══════════════════════════════════════════════════════════════
   v71 — MAPA DE CALOR de RAL / REC
   - Em cada ticket (cartão ou linha) há o botão "Inserir endereço do evento".
     Você digita o endereço, o SIR procura no mapa (OpenStreetMap), você
     escolhe o resultado certo (e pode arrastar o pino para acertar) e salva.
   - O mapa mostra o calor e um pino por evento (RAL vermelho, REC azul),
     com o ticket, CF, designação, endereço e data.
   - Período: Hoje · 7 dias · 30 dias · 60 dias (pela data de abertura do
     ticket). Tipo: RAL · REC · Ambos. Botão para ver em tela cheia.
   - Fica guardado no seu servidor por 60 dias (rota /mapa), igual para o
     PC, o celular e quem tiver a chave do SIR. Sem servidor/chave, guarda
     só neste aparelho.
   - v73: a busca usa o servidor (CEP pela AwesomeAPI e TomTom, com a chave
     escondida lá) e, sem resultado da TomTom, o OpenStreetMap.
   - Computador: abaixo de "Novas Entradas", à direita.
     Celular/tablet: logo abaixo de "Novas Entradas".
   ══════════════════════════════════════════════════════════════ */

const MAPA_DIAS = 60;
const MAPA_POLL_MS = 120000;
const MAPA_LIBS = {
  css:  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  js:   'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  heat: 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js',
};
/* Região de busca preferida (RJ + ES); não impede achar fora dela */
const MAPA_VIEWBOX = '-44.95,-17.85,-39.6,-23.45';
const MAPA_CENTRO = [-22.9, -43.25];

const _mp = { itens: {}, carregado: false, local: false, mapa: null, calor: null, pinos: null, sync: 0, carregando: null };

/* ── Utilitários ── */
const _mpId = (tk, ticket) => `${tk === 'rec' ? 'rec' : 'ral'}:${String(ticket || '').trim()}`;
function _mpServidor() { return typeof _pushUrl === 'function' && _pushUrl() && typeof _pushKey === 'function' && _pushKey() && location.protocol === 'https:'; }
function _mpAutor() { try { return localStorage.getItem('sir_user_name') || ''; } catch (e) { return ''; } }
function _mpDataTxt(ms) {
  return ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—';
}
function _mpLimpar() {   /* tira o que passou de 60 dias */
  const lim = Date.now() - MAPA_DIAS * 86400000;
  for (const [id, it] of Object.entries(_mp.itens)) if (Math.max(it.dt || 0, it.at || 0) < lim) delete _mp.itens[id];
}

/* ── Servidor ── */
async function _mpPost(payload) {
  const r = await fetch(_pushUrl() + '/mapa', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: _pushKey(), by: _mpAutor(), ...payload })
  });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}
function mapaCarregar() {
  if (_mp.carregando) return _mp.carregando;
  if (!_mp.carregado) { _mp.itens = SirStore.get('mapaCache'); _mpLimpar(); }
  if (!_mpServidor()) {
    _mp.local = true; _mp.carregado = true;
    _mpAtualizarTela();
    return Promise.resolve();
  }
  _mp.carregando = _mpPost({ op: 'list' })
    .then(j => { _mp.itens = j.itens || {}; _mp.local = false; SirStore.set('mapaCache', _mp.itens); })
    .catch(e => console.warn('mapa', e))
    .finally(() => { _mp.carregando = null; _mp.carregado = true; _mpAtualizarTela(); });
  return _mp.carregando;
}
async function _mpSalvar(id, item) {
  if (_mpServidor()) {
    const j = await _mpPost({ op: 'set', id, item });
    _mp.itens[id] = j.item;
  } else {
    _mp.itens[id] = { ...item, tk: id.slice(0, 3), by: _mpAutor(), at: Date.now() };
  }
  SirStore.set('mapaCache', _mp.itens);
  _mpAtualizarTela();
}
async function _mpRemover(id) {
  if (_mpServidor()) await _mpPost({ op: 'del', id });
  delete _mp.itens[id];
  SirStore.set('mapaCache', _mp.itens);
  _mpAtualizarTela();
}

/* ── Botão nos tickets (chamado por modal.js ao montar cada linha/cartão) ── */
function mapaBotaoHTML(tk, item) {
  const id = _mpId(tk, item.ticket), tem = !!_mp.itens[id];
  return `<button type="button" class="btn-ev-end${tem ? ' tem' : ''}" data-mapa-id="${escapeHtml(id)}" onclick="abrirEnderecoEvento(this)"
      title="${tem ? 'Ver ou trocar o endereço do evento no mapa de calor' : 'Inserir o endereço do evento no mapa de calor'}">
      <span aria-hidden="true">📍</span><span class="btn-ev-lbl">${tem ? 'Endereço do evento ✓' : 'Inserir endereço do evento'}</span></button>`;
}
function _mpAtualizarBotoes() {
  document.querySelectorAll('[data-mapa-id]').forEach(b => {
    const tem = !!_mp.itens[b.dataset.mapaId];
    b.classList.toggle('tem', tem);
    const l = b.querySelector('.btn-ev-lbl'); if (l) l.textContent = tem ? 'Endereço do evento ✓' : 'Inserir endereço do evento';
  });
}

/* ── Janela: inserir / trocar endereço ── */
let _mpAtual = null;   /* { id, tk, item, escolhido:{lat,lon,achado} } */
function abrirEnderecoEvento(btn) {
  const id = btn.dataset.mapaId, tk = id.slice(0, 3);
  const row = btn.closest('tr.ticket-row');
  const lista = (typeof _waCurrentList === 'function' ? _waCurrentList().list : []) || [];
  const item = (row && lista.find(i => makeIdentity(tk, i) === row.dataset.identity))
            || lista.find(i => _mpId(tk, i.ticket) === id)
            || { ticket: id.slice(4), designacao: '', cfOrigem: '', abertura: '' };
  const salvo = _mp.itens[id];
  _mpAtual = { id, tk, item, escolhido: salvo ? { lat: salvo.lat, lon: salvo.lon, achado: salvo.achado } : null };

  const ov = _mpJanela();
  ov.querySelector('.mpe-tit').textContent = `${tk.toUpperCase()} ${item.ticket}`;
  ov.querySelector('.mpe-sub').textContent = [item.cfOrigem && 'CF ' + item.cfOrigem, item.designacao, item.abertura].filter(Boolean).join(' · ');
  ov.querySelector('#mpe-q').value = salvo ? salvo.end : '';
  ov.querySelector('.mpe-res').innerHTML = salvo ? '' : '<div class="mpe-dica">Digite rua, número, bairro e cidade — ou só o CEP. Ex.: <i>Rua Uruguai 200, Tijuca, Rio de Janeiro</i> ou <i>20510-060</i></div>';
  ov.querySelector('.mpe-del').hidden = !salvo;
  ov.querySelector('.mpe-quem').textContent = salvo ? `Salvo em ${_mpDataTxt(salvo.at)}${salvo.by ? ' por ' + salvo.by : ''}` : '';
  _mpMostrarEscolha();
  ov.classList.add('active');
  setTimeout(() => ov.querySelector('#mpe-q').focus(), 60);
}
function fecharEnderecoEvento() { document.getElementById('mapa-end-modal')?.classList.remove('active'); }

function _mpJanela() {
  let ov = document.getElementById('mapa-end-modal');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.className = 'modal-overlay mpe-overlay'; ov.id = 'mapa-end-modal';
  ov.innerHTML = `<div class="modal-content mpe-box" role="dialog" aria-modal="true" aria-labelledby="mpe-tit" onclick="event.stopPropagation()">
    <div class="modal-header">
      <div><div class="modal-title"><span aria-hidden="true">📍</span> Endereço do evento · <span class="mpe-tit" id="mpe-tit"></span></div><div class="mpe-sub"></div></div>
      <button class="modal-close-btn" onclick="fecharEnderecoEvento()" aria-label="Fechar">&times;</button>
    </div>
    <div class="mpe-body">
      <form class="mpe-busca" onsubmit="event.preventDefault(); _mpBuscar();">
        <input type="search" id="mpe-q" class="mpe-input" placeholder="Endereço do evento ou CEP" autocomplete="off" aria-label="Endereço do evento">
        <button type="submit" class="mpe-btn mpe-btn-pri">Buscar</button>
      </form>
      <div class="mpe-res" aria-live="polite"></div>
      <div class="mpe-prev" hidden><div class="mpe-prev-map"></div><div class="mpe-prev-txt"></div></div>
      <div class="mpe-quem"></div>
      <div class="mpe-acoes">
        <button type="button" class="mpe-btn mpe-del" onclick="_mpExcluirAtual()">Remover do mapa</button>
        <span class="mpe-esp"></span>
        <button type="button" class="mpe-btn" onclick="fecharEnderecoEvento()">Cancelar</button>
        <button type="button" class="mpe-btn mpe-btn-pri mpe-salvar" onclick="_mpSalvarAtual()" disabled>Salvar no mapa</button>
      </div>
    </div>
  </div>`;
  ov.addEventListener('click', fecharEnderecoEvento);
  document.body.appendChild(ov);
  return ov;
}

/* Busca do endereço (v73):
   1º seu servidor: CEP (AwesomeAPI/IBGE) e TomTom (chave escondida lá; limite diário na cota grátis);
   2º OpenStreetMap (Nominatim), quando a TomTom não trouxer nada (sem chave, limite do dia ou sem resultado).
   Cada resultado mostra de onde veio e a precisão. */
async function _mpServidorBusca(q) {
  if (!_mpServidor()) return null;
  try {
    const r = await fetch(_pushUrl() + '/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: _pushKey(), q }) });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j.resultados) ? j : null;
  } catch (e) { return null; }
}
async function _mpOsm(q) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=br&accept-language=pt-BR'
    + '&viewbox=' + MAPA_VIEWBOX + '&q=' + encodeURIComponent(q);
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(r.status);
  return (await r.json()).map(x => ({ lat: +x.lat, lon: +x.lon, display_name: x.display_name, fonte: 'OpenStreetMap',
    precisao: x.addresstype === 'house' || x.type === 'house' ? 'numero' : (x.addresstype === 'road' ? 'rua' : 'aprox') }));
}
const _MP_PRECISAO = { numero: 'número exato', faixa: 'número aproximado', rua: 'rua', cruzamento: 'cruzamento', CEP: 'região do CEP', aprox: 'aproximado' };
async function _mpBuscar() {
  const ov = _mpJanela(), q = ov.querySelector('#mpe-q').value.trim(), box = ov.querySelector('.mpe-res');
  if (q.length < 4) { box.innerHTML = '<div class="mpe-dica">Digite um endereço mais completo ou o CEP.</div>'; return; }
  box.innerHTML = '<div class="mpe-dica">Procurando…</div>';
  const srv = await _mpServidorBusca(q);
  let lista = srv ? srv.resultados.slice() : [];
  const soCep = /^\s*(cep[:\s]*)?\d{2}\.?\d{3}-?\d{3}\s*$/i.test(q);
  if (!lista.some(x => x.fonte === 'TomTom') && !(soCep && lista.length)) {
    try { lista = lista.concat(await _mpOsm(q)); }
    catch (e) {
      if (!lista.length) { box.innerHTML = '<div class="mpe-dica">Não foi possível buscar agora (sem internet ou serviço de mapas fora do ar). Tente de novo em instantes.</div>'; return; }
    }
  }
  if (!lista.length) {
    box.innerHTML = '<div class="mpe-dica">Nada encontrado. Tente sem o complemento (sala, loja), com o bairro e a cidade, ou só o CEP.</div>';
    return;
  }
  box.innerHTML = lista.map((x, i) => `<button type="button" class="mpe-op" data-i="${i}">
      <span aria-hidden="true">📍</span><span class="mpe-op-txt">${escapeHtml(x.display_name)}
        <small class="mpe-prec"><b class="mpe-fonte mpe-f-${escapeHtml(String(x.fonte || '').toLowerCase())}">${escapeHtml(x.fonte || '')}</b>${_MP_PRECISAO[x.precisao] ? ' ' + _MP_PRECISAO[x.precisao] : ''}</small></span></button>`).join('')
    + '<div class="mpe-dica">Escolha o resultado certo. Depois, se precisar, arraste o pino para o local exato.</div>';
  box.querySelectorAll('.mpe-op').forEach(b => b.addEventListener('click', () => {
    const x = lista[+b.dataset.i];
    box.querySelectorAll('.mpe-op').forEach(o => o.classList.toggle('on', o === b));
    _mpAtual.escolhido = { lat: +x.lat, lon: +x.lon, achado: x.display_name };
    _mpMostrarEscolha();
  }));
  if (lista.length === 1) box.querySelector('.mpe-op').click();
}

/* Prévia com pino arrastável */
let _mpPrev = null, _mpPrevPino = null;
async function _mpMostrarEscolha() {
  const ov = _mpJanela(), e = _mpAtual && _mpAtual.escolhido;
  const prev = ov.querySelector('.mpe-prev');
  ov.querySelector('.mpe-salvar').disabled = !e;
  prev.hidden = !e;
  if (!e) return;
  ov.querySelector('.mpe-prev-txt').textContent = e.achado || '';
  if (!(await _mpLibs())) return;
  const el = ov.querySelector('.mpe-prev-map');
  if (!_mpPrev) {
    _mpPrev = L.map(el, { zoomControl: true, attributionControl: true });
    _mpTiles().addTo(_mpPrev);
    _mpPrevPino = L.marker([e.lat, e.lon], { draggable: true, icon: _mpIcone(_mpAtual.tk) }).addTo(_mpPrev);
    _mpPrevPino.on('dragend', () => {
      const p = _mpPrevPino.getLatLng();
      _mpAtual.escolhido = { ..._mpAtual.escolhido, lat: p.lat, lon: p.lng, ajustado: true };
    });
  }
  _mpPrevPino.setIcon(_mpIcone(_mpAtual.tk));
  _mpPrevPino.setLatLng([e.lat, e.lon]);
  setTimeout(() => { _mpPrev.invalidateSize(); _mpPrev.setView([e.lat, e.lon], 17); }, 30);
}

async function _mpSalvarAtual() {
  const a = _mpAtual; if (!a || !a.escolhido) return;
  const ov = _mpJanela(), btn = ov.querySelector('.mpe-salvar');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    await _mpSalvar(a.id, {
      ticket: a.item.ticket, desig: a.item.designacao || '', cf: a.item.cfOrigem || '',
      end: ov.querySelector('#mpe-q').value.trim(), achado: a.escolhido.achado || '',
      lat: a.escolhido.lat, lon: a.escolhido.lon,
      dt: (typeof parseAbertura === 'function' && parseAbertura(a.item.abertura || '')) || Date.now(),
    });
    fecharEnderecoEvento();
    if (typeof showActionToast === 'function') showActionToast(`${a.tk.toUpperCase()} ${a.item.ticket} no mapa de calor`, 'success');
    mapaFocar(a.id);
  } catch (e) {
    if (typeof showActionToast === 'function') showActionToast('Não foi possível salvar: ' + (e.message === 'chave' ? 'chave de acesso inválida' : e.message), 'error');
  } finally { btn.textContent = 'Salvar no mapa'; btn.disabled = false; }
}
async function _mpExcluirAtual() {
  const a = _mpAtual; if (!a) return;
  try { await _mpRemover(a.id); fecharEnderecoEvento(); if (typeof showActionToast === 'function') showActionToast('Removido do mapa', 'success'); }
  catch (e) { if (typeof showActionToast === 'function') showActionToast('Não foi possível remover', 'error'); }
}

/* ── Bibliotecas do mapa (carregadas só quando precisa) ── */
let _mpLibsP = null;
function _mpLibs() {
  if (window.L && L.heatLayer) return Promise.resolve(true);
  if (_mpLibsP) return _mpLibsP;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = MAPA_LIBS.css; document.head.appendChild(css);
  const js = src => new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = err; document.head.appendChild(s); });
  _mpLibsP = js(MAPA_LIBS.js).then(() => js(MAPA_LIBS.heat)).then(() => true)
    .catch(() => { _mpLibsP = null; const m = document.querySelector('#mapa-calor .mp-map'); if (m) m.innerHTML = '<div class="mp-vazio">Não foi possível carregar o mapa (sem internet?).</div>'; return false; });
  return _mpLibsP;
}
function _mpTiles() {
  const escuro = document.documentElement.getAttribute('data-mode') !== 'light';
  return L.tileLayer(`https://{s}.basemaps.cartocdn.com/${escuro ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`, {
    maxZoom: 19, subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
  });
}
function _mpIcone(tk) {
  return L.divIcon({ className: 'mp-pin-wrap', html: `<span class="mp-pin mp-pin-${tk}"></span>`, iconSize: [22, 30], iconAnchor: [11, 29], popupAnchor: [0, -26] });
}

/* ── Painel do mapa ── */
function _mpPainelHTML() {
  return `<div class="mp-head">
      <div class="mp-tit"><span class="mp-dot" aria-hidden="true"></span>Mapa de calor <small class="mp-qtd"></small></div>
      <button type="button" class="mp-ico" onclick="mapaTelaCheia()" title="Ver em tela cheia" aria-label="Ver mapa em tela cheia">⤢</button>
    </div>
    <div class="mp-filtros">
      <div class="mp-seg" data-mp="periodo" role="group" aria-label="Período">
        <button type="button" data-v="1">Hoje</button><button type="button" data-v="7">7 dias</button><button type="button" data-v="30">30 dias</button><button type="button" data-v="60">60 dias</button>
      </div>
      <div class="mp-seg" data-mp="tipo" role="group" aria-label="Tipo">
        <button type="button" data-v="ral">RAL</button><button type="button" data-v="rec">REC</button><button type="button" data-v="ambos">Ambos</button>
      </div>
    </div>
    <div class="mp-map"><div class="mp-vazio">Carregando mapa…</div></div>
    <div class="mp-rodape"><span class="mp-leg"><i class="mp-pin mp-pin-ral"></i>RAL <i class="mp-pin mp-pin-rec"></i>REC</span><span class="mp-info"></span></div>`;
}
function _mpPainel() {
  let sec = document.getElementById('mapa-calor');
  if (sec) return sec;
  const inbox = document.getElementById('inbox-section');
  if (!inbox) return null;
  /* Coluna da direita: "Novas Entradas" + mapa (no celular os dois seguem a ordem da página) */
  let lado = inbox.closest('.v2-side');
  if (!lado) {
    lado = document.createElement('aside');
    lado.className = 'v2-side';
    inbox.parentNode.insertBefore(lado, inbox);
    lado.appendChild(inbox);
  }
  sec = document.createElement('section');
  sec.className = 'mapa-calor'; sec.id = 'mapa-calor'; sec.setAttribute('aria-label', 'Mapa de calor de RAL e REC');
  sec.innerHTML = _mpPainelHTML();
  lado.appendChild(sec);
  sec.addEventListener('click', e => {
    const b = e.target.closest('.mp-seg button'); if (!b) return;
    const grupo = b.parentNode.dataset.mp;
    SirStore.set(grupo === 'periodo' ? 'mapaPeriodo' : 'mapaTipo', b.dataset.v);
    _mpDesenhar(true);
  });
  return sec;
}

function _mpFiltrados() {
  const dias = +SirStore.get('mapaPeriodo') || 60, tipo = SirStore.get('mapaTipo');
  let desde;
  if (dias === 1) { const d = new Date(); d.setHours(0, 0, 0, 0); desde = d.getTime(); }   /* "Hoje" = desde 00h */
  else desde = Date.now() - dias * 86400000;
  return Object.entries(_mp.itens)
    .filter(([, it]) => (it.dt || it.at || 0) >= desde && (tipo === 'ambos' || it.tk === tipo))
    .map(([id, it]) => ({ id, ...it }));
}

let _mpUltimaChave = '';
async function _mpDesenhar(ajustarVista) {
  const sec = _mpPainel(); if (!sec) return;
  const per = SirStore.get('mapaPeriodo'), tipo = SirStore.get('mapaTipo');
  sec.querySelectorAll('[data-mp="periodo"] button').forEach(b => b.classList.toggle('on', b.dataset.v === per));
  sec.querySelectorAll('[data-mp="tipo"] button').forEach(b => b.classList.toggle('on', b.dataset.v === tipo));
  const lista = _mpFiltrados();
  const nRal = lista.filter(x => x.tk === 'ral').length, nRec = lista.length - nRal;
  sec.querySelector('.mp-qtd').textContent = `${lista.length} evento${lista.length === 1 ? '' : 's'}`;
  sec.querySelector('.mp-info').textContent = _mp.local
    ? 'Só neste aparelho (sem servidor/chave)'
    : `${nRal} RAL · ${nRec} REC · guarda ${MAPA_DIAS} dias`;

  if (!(await _mpLibs())) return;
  const el = sec.querySelector('.mp-map');
  if (!_mp.mapa) {
    el.innerHTML = '';
    _mp.mapa = L.map(el, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView(MAPA_CENTRO, 10);
    _mp.mapa.on('focus click', () => _mp.mapa.scrollWheelZoom.enable());
    _mp.mapa.on('mouseout', () => { if (!sec.classList.contains('mp-full')) _mp.mapa.scrollWheelZoom.disable(); });
    _mp.tiles = _mpTiles().addTo(_mp.mapa);
    _mp.calor = L.heatLayer([], { radius: 28, blur: 22, maxZoom: 15, minOpacity: 0.35,
      gradient: { 0.2: '#3b82f6', 0.45: '#22d3ee', 0.65: '#facc15', 0.85: '#f97316', 1: '#ef4444' } }).addTo(_mp.mapa);
    _mp.pinos = L.layerGroup().addTo(_mp.mapa);
    new ResizeObserver(() => _mp.mapa && _mp.mapa.invalidateSize()).observe(el);
  }
  _mp.calor.setLatLngs(lista.map(x => [x.lat, x.lon, 1]));
  _mp.pinos.clearLayers();
  lista.forEach(x => {
    const m = L.marker([x.lat, x.lon], { icon: _mpIcone(x.tk), title: `${x.tk.toUpperCase()} ${x.ticket}`, keyboard: true });
    m.bindPopup(_mpPopupHTML(x), { maxWidth: 280 });
    m._mpId = x.id;
    _mp.pinos.addLayer(m);
  });
  const chave = per + tipo + lista.length;
  if ((ajustarVista || chave !== _mpUltimaChave) && lista.length) {
    const b = L.latLngBounds(lista.map(x => [x.lat, x.lon]));
    _mp.mapa.fitBounds(b.pad(0.25), { maxZoom: 15 });
  }
  _mpUltimaChave = chave;
}
function _mpPopupHTML(x) {
  return `<div class="mp-pop">
    <div class="mp-pop-h"><b class="mp-pop-tk mp-pop-${x.tk}">${x.tk.toUpperCase()}</b> <b>${escapeHtml(x.ticket)}</b>${x.cf ? ` <span class="mp-pop-cf">CF ${escapeHtml(x.cf)}</span>` : ''}</div>
    ${x.desig ? `<div class="mp-pop-l">${escapeHtml(x.desig)}</div>` : ''}
    <div class="mp-pop-l">📍 ${escapeHtml(x.end || x.achado || '')}</div>
    <div class="mp-pop-s">Abertura: ${_mpDataTxt(x.dt)}${x.by ? ` · marcado por ${escapeHtml(x.by)}` : ''}</div>
  </div>`;
}
function _mpAtualizarTela() { _mpAtualizarBotoes(); _mpDesenhar(false); }

/* Depois de salvar: mostra o pino no mapa */
function mapaFocar(id) {
  const it = _mp.itens[id]; if (!it || !_mp.mapa) return;
  _mp.mapa.setView([it.lat, it.lon], 15);
  _mp.pinos.eachLayer(m => { if (m._mpId === id) m.openPopup(); });
}
function mapaTelaCheia() {
  const sec = document.getElementById('mapa-calor'); if (!sec) return;
  const on = sec.classList.toggle('mp-full');
  document.body.classList.toggle('mp-full-on', on);
  const b = sec.querySelector('.mp-ico'); b.textContent = on ? '✕' : '⤢';
  b.title = on ? 'Fechar tela cheia' : 'Ver em tela cheia'; b.setAttribute('aria-label', b.title);
  if (_mp.mapa) { _mp.mapa.scrollWheelZoom[on ? 'enable' : 'disable'](); setTimeout(() => _mp.mapa.invalidateSize(), 60); }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('mapa-calor')?.classList.contains('mp-full')) mapaTelaCheia();
});

/* Tema claro/escuro: troca o fundo do mapa */
new MutationObserver(() => {
  if (!_mp.mapa || !_mp.tiles) return;
  _mp.mapa.removeLayer(_mp.tiles); _mp.tiles = _mpTiles().addTo(_mp.mapa); _mp.tiles.bringToBack();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });

/* Início: painel + dados; atualiza a cada 2 min e ao voltar para o app */
document.addEventListener('DOMContentLoaded', () => {
  _mpPainel();
  mapaCarregar();
  setInterval(() => { if (!document.hidden) mapaCarregar(); }, MAPA_POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) mapaCarregar(); });
});
