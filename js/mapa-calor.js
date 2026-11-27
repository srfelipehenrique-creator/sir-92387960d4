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
     Celular (v76): logo abaixo do TOTAL, antes das áreas. Tablet: no topo.
   ══════════════════════════════════════════════════════════════ */

const MAPA_DIAS = 60;
const MAPA_POLL_MS = 120000;
const MAPA_CALOR_MAX = 5;   /* v75: com 5 ou mais eventos no mesmo local o calor fica vermelho completo */
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
      <span aria-hidden="true">📍</span><span class="btn-ev-lbl">${tem ? 'Evento ✓' : 'Inserir evento'}</span></button>`;
}
function _mpAtualizarBotoes() {
  document.querySelectorAll('[data-mapa-id]').forEach(b => {
    const tem = !!_mp.itens[b.dataset.mapaId];
    b.classList.toggle('tem', tem);
    const l = b.querySelector('.btn-ev-lbl'); if (l) l.textContent = tem ? 'Evento ✓' : 'Inserir evento';
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
  const r = await fetch(url, { headers: { 'Accept': 'application/json' }, referrerPolicy: 'origin' });
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
    _mpAplicarTema();
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
/* v74: fundo do OpenStreetMap (grátis, sem chave). O CARTO passou a exigir chave.
   No tema escuro o fundo é escurecido por CSS (.mp-escuro), sem mudar os pinos e o calor. */
function _mpEscuro() { return document.documentElement.getAttribute('data-mode') !== 'light'; }
function _mpTiles() {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, referrerPolicy: 'origin',   /* o OpenStreetMap pede a origem do site (a página usa no-referrer) */
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  });
}
function _mpAplicarTema() {
  const esc = _mpEscuro();
  document.querySelectorAll('.mp-map, .mpe-prev-map').forEach(el => el.classList.toggle('mp-escuro', esc));
}
function _mpIcone(tk, n) {
  return L.divIcon({ className: 'mp-pin-wrap', iconSize: [22, 30], iconAnchor: [11, 29], popupAnchor: [0, -26],
    html: `<span class="mp-pin mp-pin-${tk}"></span>${n > 1 ? `<b class="mp-pin-n">${n}</b>` : ''}` });
}

/* ── Painel do mapa ── */
function _mpPainelHTML() {
  return `<div class="mp-head">
      <div class="mp-tit"><span class="mp-dot" aria-hidden="true"></span>Mapa de calor <small class="mp-qtd"></small></div>
      <div class="mp-head-btns">
        <button type="button" class="v2-charts-toggle mp-toggle" aria-expanded="true" aria-controls="mp-corpo" title="Recolher ou expandir o Mapa de calor">▾ Recolher</button>
        <button type="button" class="mp-ico" onclick="mapaTelaCheia()" title="Ver em tela cheia" aria-label="Ver mapa em tela cheia">⤢</button>
      </div>
    </div>
    <div class="mp-corpo" id="mp-corpo">
    <div class="mp-filtros">
      <div class="mp-seg" data-mp="periodo" role="group" aria-label="Período">
        <button type="button" data-v="1">Hoje</button><button type="button" data-v="7">7 dias</button><button type="button" data-v="30">30 dias</button><button type="button" data-v="60">60 dias</button>
      </div>
    </div>
    <div class="mp-map"><div class="mp-vazio">Carregando mapa…</div></div>
    <div class="mp-rodape">
      <span class="mp-leg"><i class="mp-pin mp-pin-ral"></i>RAL <i class="mp-pin mp-pin-rec"></i>REC <i class="mp-pin mp-pin-mix"></i>RAL+REC</span>
      <span class="mp-escala" title="Cor do calor pela quantidade de eventos no mesmo local">1<i></i>${MAPA_CALOR_MAX}+</span>
      <span class="mp-info"></span>
    </div>
    </div>`;
}
/* v84 — celular: recolher / expandir o card (igual aos outros). Fica salvo neste aparelho. */
function _mpAplicarFechado(sec) {
  const fechado = SirStore.get('mapaFechado') === '1';
  sec.classList.toggle('mp-closed', fechado);
  const b = sec.querySelector('.mp-toggle');
  if (b) { b.textContent = fechado ? '▸ Expandir' : '▾ Recolher'; b.setAttribute('aria-expanded', String(!fechado)); }
  if (!fechado && _mp.mapa) setTimeout(() => _mp.mapa && _mp.mapa.invalidateSize(), 60);
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
  _mpAplicarFechado(sec);
  sec.addEventListener('click', e => {
    if (e.target.closest('.mp-toggle')) { SirStore.set('mapaFechado', SirStore.get('mapaFechado') === '1' ? '0' : '1'); _mpAplicarFechado(sec); return; }
    const b = e.target.closest('.mp-seg button'); if (!b) return;
    const grupo = b.parentNode.dataset.mp;
    if (grupo === 'periodo') SirStore.set('mapaPeriodo', b.dataset.v);
    _mpDesenhar(true);
  });
  return sec;
}

function _mpFiltrados() {
  const dias = +SirStore.get('mapaPeriodo') || 60;   /* v75: RAL e REC sempre juntos no mesmo mapa */
  let desde;
  if (dias === 1) { const d = new Date(); d.setHours(0, 0, 0, 0); desde = d.getTime(); }   /* "Hoje" = desde 00h */
  else desde = Date.now() - dias * 86400000;
  return Object.entries(_mp.itens)
    .filter(([, it]) => (it.dt || it.at || 0) >= desde)
    .map(([id, it]) => ({ id, ...it }));
}

let _mpUltimaChave = '';
async function _mpDesenhar(ajustarVista) {
  const sec = _mpPainel(); if (!sec) return;
  const per = SirStore.get('mapaPeriodo');
  sec.querySelectorAll('[data-mp="periodo"] button').forEach(b => b.classList.toggle('on', b.dataset.v === per));
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
    _mpAplicarTema();
    /* v75: círculo menor e claro; vai até o vermelho completo com MAPA_CALOR_MAX eventos no mesmo local.
       maxZoom 0 = a mesma força em qualquer zoom (o plugin enfraquece o calor ao afastar). */
    _mp.calor = L.heatLayer([], { radius: 16, blur: 12, maxZoom: 0, max: MAPA_CALOR_MAX, minOpacity: 0.18,
      gradient: { 0.15: '#fef3c7', 0.35: '#fde68a', 0.55: '#fbbf24', 0.75: '#f97316', 0.9: '#ef4444', 1: '#dc2626' } }).addTo(_mp.mapa);
    _mp.pinos = L.layerGroup().addTo(_mp.mapa);
    new ResizeObserver(() => _mp.mapa && _mp.mapa.invalidateSize()).observe(el);
  }
  /* Eventos no mesmo local (até ~40 m) viram um ponto só: o calor soma e o pino mostra a quantidade */
  const grupos = _mpAgrupar(lista);
  _mp.calor.setLatLngs(grupos.map(g => [g.lat, g.lon, g.itens.length]));
  _mp.pinos.clearLayers();
  grupos.forEach(g => {
    const tipos = new Set(g.itens.map(x => x.tk)), tk = tipos.size > 1 ? 'mix' : [...tipos][0];
    const m = L.marker([g.lat, g.lon], { icon: _mpIcone(tk, g.itens.length), keyboard: true,
      title: g.itens.length > 1 ? `${g.itens.length} eventos neste local` : `${g.itens[0].tk.toUpperCase()} ${g.itens[0].ticket}` });
    m.bindPopup(_mpPopupHTML(g), { maxWidth: 300 });
    m._mpIds = g.itens.map(x => x.id);
    _mp.pinos.addLayer(m);
  });
  const chave = per + lista.length;
  if ((ajustarVista || chave !== _mpUltimaChave) && lista.length) {
    const b = L.latLngBounds(lista.map(x => [x.lat, x.lon]));
    _mp.mapa.fitBounds(b.pad(0.25), { maxZoom: 15 });
  }
  _mpUltimaChave = chave;
}
/* Agrupa eventos a até ~40 m um do outro (mesmo prédio/esquina) */
function _mpAgrupar(lista) {
  const grupos = [], perto = (a, b) => {
    const dy = (a.lat - b.lat) * 111320, dx = (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180);
    return dx * dx + dy * dy <= 40 * 40;
  };
  lista.slice().sort((a, b) => (b.dt || 0) - (a.dt || 0)).forEach(x => {
    const g = grupos.find(g => perto(g, x));
    if (g) g.itens.push(x); else grupos.push({ lat: x.lat, lon: x.lon, itens: [x] });
  });
  return grupos;
}
function _mpPopupHTML(g) {
  const n = g.itens.length, nRal = g.itens.filter(x => x.tk === 'ral').length;
  const end = g.itens[0].end || g.itens[0].achado || '';
  return `<div class="mp-pop">
    ${n > 1 ? `<div class="mp-pop-h"><b>${n} eventos neste local</b> <span class="mp-pop-cf">${nRal} RAL · ${n - nRal} REC</span></div>` : ''}
    <div class="mp-pop-l">📍 ${escapeHtml(end)}</div>
    <div class="mp-pop-lista">${g.itens.map(x => `<div class="mp-pop-it">
      <div><b class="mp-pop-tk mp-pop-${x.tk}">${x.tk.toUpperCase()}</b> <b>${escapeHtml(x.ticket)}</b>${x.cf ? ` <span class="mp-pop-cf">CF ${escapeHtml(x.cf)}</span>` : ''}</div>
      ${x.desig ? `<div class="mp-pop-l">${escapeHtml(x.desig)}</div>` : ''}
      <div class="mp-pop-s">Abertura: ${_mpDataTxt(x.dt)}${x.by ? ` · marcado por ${escapeHtml(x.by)}` : ''}</div>
    </div>`).join('')}</div>
  </div>`;
}
function _mpAtualizarTela() { _mpAtualizarBotoes(); _mpDesenhar(false); }

/* Depois de salvar: mostra o pino no mapa */
function mapaFocar(id) {
  const it = _mp.itens[id]; if (!it || !_mp.mapa) return;
  _mp.mapa.setView([it.lat, it.lon], 15);
  _mp.pinos.eachLayer(m => { if ((m._mpIds || []).includes(id)) m.openPopup(); });
}
/* Tela cheia (v74): o mapa vai para o fim da página enquanto está em tela cheia
   (a coluna da direita "gruda" na tela e prendia o mapa atrás dos cards) e volta ao lugar ao fechar. */
let _mpLugar = null;
function mapaTelaCheia() {
  const sec = document.getElementById('mapa-calor'); if (!sec) return;
  const on = !sec.classList.contains('mp-full');
  if (on) {
    _mpLugar = document.createComment('lugar do mapa');
    sec.parentNode.insertBefore(_mpLugar, sec);
    document.body.appendChild(sec);
  } else if (_mpLugar && _mpLugar.parentNode) {
    _mpLugar.parentNode.insertBefore(sec, _mpLugar); _mpLugar.remove(); _mpLugar = null;
  }
  sec.classList.toggle('mp-full', on);
  document.body.classList.toggle('mp-full-on', on);
  const b = sec.querySelector('.mp-ico'); b.textContent = on ? '✕' : '⤢';
  b.title = on ? 'Fechar tela cheia' : 'Ver em tela cheia'; b.setAttribute('aria-label', b.title);
  if (_mp.mapa) { _mp.mapa.scrollWheelZoom[on ? 'enable' : 'disable'](); setTimeout(() => _mp.mapa.invalidateSize(), 60); }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('mapa-calor')?.classList.contains('mp-full')) mapaTelaCheia();
});

/* Tema claro/escuro: escurece ou clareia o fundo do mapa */
new MutationObserver(_mpAplicarTema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });

/* Início: painel + dados; atualiza a cada 2 min e ao voltar para o app */
document.addEventListener('DOMContentLoaded', () => {
  _mpPainel();
  mapaCarregar();
  setInterval(() => { if (!document.hidden) mapaCarregar(); }, MAPA_POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) mapaCarregar(); });
});
