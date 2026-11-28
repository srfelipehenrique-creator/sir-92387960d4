/* ══════════════════════════════════════════════════════════════
   v107 — Pessoas ativas agora
   - Cada aparelho com o painel aberto avisa o servidor a cada 2 min
     (e ao voltar para a tela). O servidor conta quem avisou nos últimos
     5 min — só na memória, nada fica gravado.
   - Rodapé: "N ativos agora" (principal e backup). Ao tocar, a lista de
     nomes para Desenvolvedor/Gerência (backup) ou quem tem a chave (principal).
   ══════════════════════════════════════════════════════════════ */

const PRES_MS = 120000;
const _pres = { dados: null, timer: null };

function _presDev() {
  try {
    let id = localStorage.getItem('sir_dev_id');
    if (!id) { id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); localStorage.setItem('sir_dev_id', id); }
    return id;
  } catch (e) { return ''; }
}
const _presVer = () => /\/backup\//.test(location.pathname) ? 'backup' : 'principal';

async function presencaAvisar(verNomes) {
  if (typeof _pushUrl !== 'function' || !_pushUrl() || typeof _pushKey !== 'function' || !_pushKey() || location.protocol !== 'https:') return null;
  try {
    const nome = localStorage.getItem('sir_user_name') || '';
    const r = await fetch(_pushUrl() + '/presenca', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: _pushKey(), dev: document.hidden ? '' : _presDev(), nome, ver: _presVer(), verNomes: !!verNomes })
    });
    if (!r.ok) return null;
    _pres.dados = await r.json();
    _presRender();
    return _pres.dados;
  } catch (e) { return null; }
}

function _presRender() {
  const d = _pres.dados;
  let el = document.getElementById('presenca-ativos');
  if (!d) { if (el) el.remove(); return; }
  if (!el) {
    const footer = document.querySelector('.page-footer');
    if (!footer) return;
    el = document.createElement('button');
    el.type = 'button'; el.id = 'presenca-ativos'; el.className = 'presenca-ativos';
    el.addEventListener('click', presencaLista);
    footer.insertBefore(el, footer.querySelector('.footer-ctrls'));
  }
  el.innerHTML = `<i class="presenca-dot" aria-hidden="true"></i><b>${d.pessoas}</b> ativo${d.pessoas === 1 ? '' : 's'} agora`;
  el.title = `${d.pessoas} pessoa${d.pessoas === 1 ? '' : 's'} com o painel aberto nos últimos 5 min · principal: ${d.principal} aparelho${d.principal === 1 ? '' : 's'} · backup: ${d.backup}`;
  el.setAttribute('aria-label', el.title);
}

/* Toque no contador: lista de quem está ativo (se o nível permitir) */
async function presencaLista() {
  const d = await presencaAvisar(true);
  if (!d) return;
  if (!d.lista) {
    if (typeof showActionToast === 'function') showActionToast(`${d.pessoas} ativo(s) agora · principal ${d.principal} · backup ${d.backup}. A lista de nomes é só para Desenvolvedor e Gerência.`, 'info');
    return;
  }
  document.getElementById('presenca-pop')?.remove();
  const pop = document.createElement('div');
  pop.id = 'presenca-pop'; pop.className = 'presenca-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Pessoas ativas agora');
  const min = at => Math.max(0, Math.round((Date.now() - at) / 60000));
  pop.innerHTML = `<div class="presenca-pop-h"><b>Ativos agora</b><span>${d.pessoas} pessoa${d.pessoas === 1 ? '' : 's'} · ${d.aparelhos} aparelho${d.aparelhos === 1 ? '' : 's'}</span>
      <button type="button" class="presenca-x" aria-label="Fechar">&times;</button></div>
    <ul>${d.lista.map(p => `<li><span class="presenca-nome">${escapeHtml(p.nome)}</span>
      <span class="presenca-ver ver-${p.ver}">${p.ver === 'backup' ? 'BACKUP' : 'PRINCIPAL'}</span>
      <span class="presenca-min">${min(p.at) ? 'há ' + min(p.at) + ' min' : 'agora'}</span></li>`).join('')}</ul>`;
  document.body.appendChild(pop);
  const fechar = () => { pop.remove(); document.removeEventListener('click', fora, true); };
  const fora = e => { if (!pop.contains(e.target) && e.target.id !== 'presenca-ativos') fechar(); };
  pop.querySelector('.presenca-x').onclick = fechar;
  setTimeout(() => document.addEventListener('click', fora, true), 0);
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => presencaAvisar(false), 4000);
  _pres.timer = setInterval(() => { if (!document.hidden) presencaAvisar(false); }, PRES_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) presencaAvisar(false); });
});
