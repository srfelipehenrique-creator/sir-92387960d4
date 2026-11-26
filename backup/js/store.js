/* ══════════════════════════════════════════════════════════════
   v67 — Store: um lugar só para as preferências do painel
   (boa prática vinda do React Native: estado central em vez de
   localStorage espalhado pelos arquivos).

   - Cada preferência tem um nome, a chave no aparelho e o valor padrão.
     As chaves são as mesmas de antes → nada do que já estava salvo
     (nem os backups) se perde.
   - SirStore.get(nome)            → lê (já convertido; nunca quebra)
   - SirStore.set(nome, valor)     → grava e avisa quem depende
   - SirStore.update(nome, fn)     → lê, altera e grava de uma vez
   - SirStore.on(nome, fn)         → avisa quando mudar (também quando
     mudar em outra aba/janela do SIR aberta no mesmo aparelho)
   ══════════════════════════════════════════════════════════════ */
const SirStore = (function () {
  /* json: true → objeto/lista guardado como JSON; false → texto simples */
  const KEYS = {
    layout:         { ls: 'sir_layout',            def: 'v2',   json: false },   /* 'v2' | 'classic' */
    scope:          { ls: 'sir_v2_scope',          def: 'mine', json: false },   /* 'all' | 'mine' */
    ticketView:     { ls: 'sir_ticket_view',       def: '',     json: false },   /* 'cards' | 'list' | '' */
    openCards:      { ls: 'sir_v2_open',           def: [],     json: true  },   /* CFs com o resumo aberto */
    chartGroups:    { ls: 'sir_charts_groups',     def: {},     json: true  },   /* { ES: true } → gráfico encolhido */
    chartsAllClosed:{ ls: 'sir_charts_collapsed',  def: '',     json: false },   /* escolha antiga ('1') */
    timeline:       { ls: 'sir_timeline_v3',       def: {},     json: true  },   /* { PAINEL: { tk, win, area, closed } } */
    mapaFechado:    { ls: 'sir_mapa_fechado',      def: '0',    json: false },   /* v84: celular — '1' = mapa recolhido */
    mapaPeriodo:    { ls: 'sir_mapa_periodo',      def: '60',   json: false },   /* v71: '1' | '7' | '30' | '60' dias */
    mapaTipo:       { ls: 'sir_mapa_tipo',         def: 'ambos',json: false },   /* 'ral' | 'rec' | 'ambos' */
    mapaCache:      { ls: 'sir_mapa_cache',        def: {},     json: true  },   /* última lista do servidor (abre sem internet) */
  };
  const subs = {};
  const byLs = {};
  Object.entries(KEYS).forEach(([n, k]) => { byLs[k.ls] = n; });

  const clone = v => (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
  const sameType = (v, def) => Array.isArray(def) ? Array.isArray(v) : (typeof def === 'object' ? (v && typeof v === 'object' && !Array.isArray(v)) : typeof v === 'string');

  function get(name) {
    const k = KEYS[name];
    if (!k) throw new Error('SirStore: preferência desconhecida ' + name);
    let raw = null;
    try { raw = localStorage.getItem(k.ls); } catch (e) {}
    if (raw === null || raw === '') return clone(k.def);
    if (!k.json) return raw;
    try { const v = JSON.parse(raw); return sameType(v, k.def) ? v : clone(k.def); } catch (e) { return clone(k.def); }
  }
  function emit(name, value) { (subs[name] || []).slice().forEach(fn => { try { fn(value); } catch (e) { console.warn('SirStore', name, e); } }); }
  function set(name, value) {
    const k = KEYS[name];
    if (!k) throw new Error('SirStore: preferência desconhecida ' + name);
    try { localStorage.setItem(k.ls, k.json ? JSON.stringify(value) : String(value)); } catch (e) {}
    emit(name, value);
  }
  function update(name, fn) { const v = fn(get(name)); set(name, v); return v; }
  function on(name, fn) { (subs[name] = subs[name] || []).push(fn); return () => { subs[name] = subs[name].filter(f => f !== fn); }; }

  /* Mudança feita em outra aba/janela do SIR */
  window.addEventListener('storage', e => { const n = e.key && byLs[e.key]; if (n) emit(n, get(n)); });

  return { get, set, update, on, KEYS };
})();
