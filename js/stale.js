/* ══════════════════════════════════════════════════════════════
   Aviso de dados parados
   A fonte normal atualiza a cada ~6 min. Se passar de 20 min sem
   nenhuma atualização, aparece uma faixa no topo do painel:
     amarela  → 20 min ou mais
     vermelha → 60 min ou mais
   Hora da última atualização:
     - lendo do seu servidor: a última mudança que ele recebeu
     - na reserva pública: a data do último envio no GitHub da fonte
   O rodapé também mostra "atualizado há X min".
   ══════════════════════════════════════════════════════════════ */

const STALE_WARN_MIN = 20, STALE_CRIT_MIN = 60;
const STALE_GH_API = 'https://api.github.com/repos/cpralonrj-pralon/embratel-sir/commits?path=dados_ral.csv&per_page=1';
let _staleGh = { at: 0, checked: 0 }, _staleDismissed = 0;

async function _staleSourceTime() {
  const ds = appState.dataSource || {};
  if (ds.src && ds.src !== 'publica' && ds.at) return ds.at;
  /* Reserva pública: pergunta ao GitHub quando os arquivos foram enviados (no máx. a cada 4 min) */
  if (Date.now() - _staleGh.checked > 4 * 60000) {
    _staleGh.checked = Date.now();
    try {
      const r = await fetch(STALE_GH_API, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
      if (r.ok) { const j = await r.json(); const d = j && j[0] && j[0].commit && j[0].commit.committer && j[0].commit.committer.date; if (d) _staleGh.at = Date.parse(d); }
    } catch (e) {}
  }
  return _staleGh.at || 0;
}

function _staleAgo(min) {
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return `há ${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

async function updateStaleWarning() {
  const at = await _staleSourceTime();
  const foot = document.getElementById('data-source');
  let bar = document.getElementById('stale-banner');
  if (!at) { bar?.remove(); return; }
  const min = Math.max(0, Math.floor((Date.now() - at) / 60000));
  const hhmm = new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');

  /* Rodapé: idade dos dados */
  if (foot) {
    let age = document.getElementById('data-age');
    if (!age) { age = document.createElement('span'); age.id = 'data-age'; foot.insertAdjacentElement('afterend', age); }
    age.textContent = `atualizado ${_staleAgo(min)}`;
    age.className = 'data-age' + (min >= STALE_CRIT_MIN ? ' crit' : min >= STALE_WARN_MIN ? ' warn' : '');
    age.title = `Última atualização da fonte: ${hhmm}`;
  }

  if (min < STALE_WARN_MIN) { bar?.remove(); _staleDismissed = 0; return; }
  /* Fechado pelo usuário: volta a aparecer quando piorar (passar para vermelho) */
  const level = min >= STALE_CRIT_MIN ? 'crit' : 'warn';
  if (_staleDismissed && !(level === 'crit' && _staleDismissed === 1)) { bar?.remove(); return; }

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'stale-banner'; bar.setAttribute('role', 'alert');
    /* No topo da coluna do painel (acima dos totais), nos dois layouts */
    const anchor = document.getElementById('main-grid');
    anchor?.parentNode.insertBefore(bar, anchor);
  }
  bar.className = 'stale-banner ' + level;
  bar.innerHTML = `
    <span class="stale-ic" aria-hidden="true">${level === 'crit' ? '⛔' : '⚠️'}</span>
    <div class="stale-txt"><b>Dados sem atualizar ${_staleAgo(min)}</b>
      <span>Última atualização: ${hhmm}. A fonte normal atualiza a cada ~6 min — os números podem estar desatualizados.</span></div>
    <button type="button" class="stale-btn" id="stale-reload">Atualizar agora</button>
    <button type="button" class="stale-x" id="stale-x" aria-label="Fechar aviso" title="Fechar (volta se piorar)">&times;</button>`;
  bar.querySelector('#stale-reload').onclick = () => { _staleGh.checked = 0; if (typeof loadNow === 'function') loadNow(); else location.reload(); };
  bar.querySelector('#stale-x').onclick = () => { _staleDismissed = level === 'crit' ? 2 : 1; bar.remove(); };
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof setDataSource === 'function') {
    const _sds = setDataSource;
    setDataSource = function () { const r = _sds.apply(this, arguments); setTimeout(updateStaleWarning, 0); return r; };
  }
  setInterval(updateStaleWarning, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateStaleWarning(); });
});
