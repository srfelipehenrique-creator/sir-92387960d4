/* ══════════════════════════════════════════════════════════════
   Novidades com chave de ligar/desligar (v83)
   Cada recurso novo pode ser desfeito separadamente em
   Configurações → "Novidades — ligar/desligar", sem mexer no código.
   - Ligado/desligado fica salvo neste aparelho (sir_recursos).
   - Cada recurso ativo vira uma classe no <html> (ex.: rec-hud),
     que os arquivos CSS/JS de cada recurso usam.
   - Para remover de vez um recurso, também dá para desfazer o
     commit dele no GitHub (cada um foi enviado separado).
   ══════════════════════════════════════════════════════════════ */
const SirRecursos = (function () {
  const KEY = 'sir_recursos';
  const LISTA = [
    { id: 'hud',       nome: 'Visual HUD',                 desc: 'Fundo com grade, cantos em colchete, células planas, linha de status e medidores de prazo.' },
    { id: 'mini',      nome: 'Gráfico dentro dos cards',   desc: 'Linhas de RAL e REC abertas nas últimas 24h em cada área.' },
    { id: 'comando',   nome: 'Busca rápida (Ctrl K)',      desc: 'Buscar área, ticket ou comando e ver os tickets mais perto do prazo.' },
    { id: 'navcel',    nome: 'Barra inferior no celular',  desc: 'Painel, Entradas, Buscar e Torpedos ao alcance do polegar.' },
    { id: 'fhd',       nome: 'Layout Full HD',             desc: 'Em telas de 1920×1080, as três regiões lado a lado ocupando a tela inteira.' },
    { id: 'contraste', nome: 'Textos com mais contraste',  desc: 'Textos secundários e rótulos pequenos mais legíveis em todos os temas.' }
  ];
  let estado = {};
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') estado = s; } catch (e) {}
  const ativo = id => estado[id] !== false;   /* padrão: ligado */

  function aplicarClasses() {
    const h = document.documentElement;
    LISTA.forEach(r => h.classList.toggle('rec-' + r.id, ativo(r.id)));
  }
  aplicarClasses();

  function set(id, v) {
    estado[id] = !!v;
    try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch (e) {}
    aplicarClasses();
    document.dispatchEvent(new CustomEvent('sir-recursos', { detail: { id, ativo: !!v } }));
    if (typeof _rerender === 'function') { try { _rerender(); } catch (e) {} }
    render();
    const b = document.querySelector(`#cfg-recursos [data-recurso="${id}"]`); if (b) b.focus();   /* o foco fica na chave */
  }

  /* Lista de chaves dentro das Configurações */
  function render() {
    const box = document.getElementById('cfg-recursos');
    if (!box) return;
    box.innerHTML = LISTA.map(r => {
      const on = ativo(r.id);
      return `<div class="cfg-toggle-row">
        <div class="cfg-toggle-info">
          <span class="cfg-toggle-label" id="rec-lbl-${r.id}">${r.nome}</span>
          <span class="cfg-toggle-desc">${r.desc}</span>
        </div>
        <button type="button" class="cfg-toggle-btn" role="switch" aria-checked="${on}" aria-labelledby="rec-lbl-${r.id}" data-recurso="${r.id}">
          <span class="cfg-toggle-track${on ? ' on' : ''}"><span class="cfg-toggle-thumb"></span></span>
        </button>
      </div>`;
    }).join('');
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-recurso]');
    if (b) set(b.dataset.recurso, !ativo(b.dataset.recurso));
  });
  document.addEventListener('DOMContentLoaded', render);

  return { ativo, set, render, LISTA };
})();
