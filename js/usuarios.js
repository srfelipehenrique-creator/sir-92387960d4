/* ══════════════════════════════════════════════════════════════
   v104 — Usuários e acessos (Gestor para cima)
   Abas: Pendentes · Equipe · Convidar · Pré-autorizados (Gerência/Dev) · Registro
   Tudo passa pelo servidor (/auth/*), que confere o que cada nível pode fazer:
   - Gestor: aprova Apoio das áreas dele, convida Apoio para as áreas dele, vê a equipe.
   - Gerência: aprova/convida/promove até Gestor, bloqueia, pré-autoriza e-mails.
   - Desenvolvedor: tudo, em qualquer nível.
   ══════════════════════════════════════════════════════════════ */

const _us = { aba: 'pend', dados: null, carregando: false };
const _US_NIVEIS = ['apoio', 'gestor', 'gerencia', 'dev'];

function _usTodasAreas() {
  const out = [];
  if (typeof REGIONS !== 'undefined') for (const [rn, cfs] of Object.entries(REGIONS)) for (const cf of Object.keys(cfs)) out.push({ cf, rn });
  return out;
}
function _usAreasDisponiveis() {
  const eu = sirUsuario();
  const todas = _usTodasAreas();
  return eu && eu.nivel === 'gestor' ? todas.filter(a => (eu.areas || []).includes(a.cf)) : todas;
}
function _usNiveisPermitidos() {
  const max = _us.dados ? _us.dados.nivelMax : null;
  return max ? _US_NIVEIS.slice(0, _US_NIVEIS.indexOf(max) + 1) : [];
}
function _usQuando(ms) { return ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—'; }

async function _usApi(rota, corpo) {
  const s = sirSessao();
  if (!s) { sirSair('expirou'); throw new Error('sessão'); }
  const r = await fetch(SIR_PUSH_URL.replace(/\/+$/, '') + '/auth/' + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s.token, ...corpo }) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (r.status === 401) { sirSair('expirou'); throw new Error('sessão'); }
  if (!r.ok) throw new Error(j.error === 'permissao' ? 'Seu nível de acesso não permite esta ação' : (j.error || 'Falha ' + r.status));
  return j;
}
const _usToast = (t, ok = true) => typeof showActionToast === 'function' && showActionToast(t, ok ? 'success' : 'error');

async function abrirUsuarios() {
  if (!sirPode('usuarios')) return;
  const ov = _usJanela();
  ov.classList.add('active');
  await _usCarregar();
}
function fecharUsuarios() { document.getElementById('usuarios-modal')?.classList.remove('active'); }

async function _usCarregar() {
  _us.carregando = true; _usRender();
  try { _us.dados = await _usApi('usuarios', {}); }
  catch (e) { _us.dados = null; _us.erro = e.message; }
  _us.carregando = false; _usRender();
}

function _usJanela() {
  let ov = document.getElementById('usuarios-modal');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.className = 'modal-overlay mpe-overlay'; ov.id = 'usuarios-modal';
  ov.innerHTML = `<div class="modal-content mpe-box us-box" role="dialog" aria-modal="true" aria-labelledby="us-tit" onclick="event.stopPropagation()">
    <div class="modal-header">
      <div><div class="modal-title" id="us-tit">Usuários e acessos</div><div class="mpe-sub" id="us-sub"></div></div>
      <button class="modal-close-btn" onclick="fecharUsuarios()" aria-label="Fechar">&times;</button>
    </div>
    <div class="us-abas" role="tablist" aria-label="Seções"></div>
    <div class="mpe-body us-corpo" aria-live="polite"></div>
  </div>`;
  ov.addEventListener('click', fecharUsuarios);
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') fecharUsuarios(); });
  ov.querySelector('.us-abas').addEventListener('click', e => { const b = e.target.closest('[data-aba]'); if (b) { _us.aba = b.dataset.aba; _usRender(); } });
  ov.querySelector('.us-corpo').addEventListener('click', _usAcao);
  document.body.appendChild(ov);
  return ov;
}

function _usSelNivel(atual, attrs = '') {
  return `<select class="mpe-input us-sel" ${attrs}>${_usNiveisPermitidos().map(n => `<option value="${n}"${n === atual ? ' selected' : ''}>${SIR_NIVEIS[n]}</option>`).join('')}</select>`;
}
function _usChipsAreas(marcadas, nome) {
  const disp = _usAreasDisponiveis();
  return `<div class="us-areas" data-areas="${nome}">${disp.map(a => `<label class="us-area"><input type="checkbox" value="${a.cf}"${(marcadas || []).includes(a.cf) ? ' checked' : ''}>${a.cf}</label>`).join('')}</div>`;
}
const _usAreasMarcadas = el => [...el.querySelectorAll('input:checked')].map(i => i.value);

function _usRender() {
  const ov = document.getElementById('usuarios-modal');
  if (!ov) return;
  const eu = sirUsuario() || {};
  const d = _us.dados;
  const vêTudo = eu.nivel === 'dev' || eu.nivel === 'gerencia';
  ov.querySelector('#us-sub').textContent = `Você: ${eu.nome || ''} · ${SIR_NIVEIS[eu.nivel] || ''}${eu.nivel === 'gestor' ? ' · áreas ' + (eu.areas || []).join(', ') : ''}`;
  const pend = d ? d.usuarios.filter(u => u.status === 'pendente') : [];
  const abas = [['pend', `Pendentes${pend.length ? ' (' + pend.length + ')' : ''}`], ['equipe', vêTudo ? 'Todos' : 'Minha equipe'], ['convidar', 'Convidar'],
    ...(vêTudo ? [['pre', 'Pré-autorizados']] : []), ['registro', 'Registro']];
  ov.querySelector('.us-abas').innerHTML = abas.map(([k, t]) => `<button type="button" role="tab" data-aba="${k}" aria-selected="${_us.aba === k}">${t}</button>`).join('');
  const c = ov.querySelector('.us-corpo');
  if (_us.carregando) { c.innerHTML = '<div class="mpe-dica">Carregando…</div>'; return; }
  if (!d) { c.innerHTML = `<div class="mt-aviso">${escapeHtml(_us.erro || 'Não foi possível carregar')}</div><button type="button" class="mpe-btn" data-act="recarregar">Tentar de novo</button>`; return; }

  if (_us.aba === 'pend') {
    c.innerHTML = pend.length ? pend.map(u => `<div class="us-item" data-email="${escapeHtml(u.email)}">
        <div class="us-linha"><b>${escapeHtml(u.nome)}</b><span class="us-mail">${escapeHtml(u.email)}</span><span class="us-quando">pediu em ${_usQuando(u.criado)}</span></div>
        ${u.podeAprovar ? `<div class="us-linha us-form">
          <label>Nível ${_usSelNivel(u.nivel, 'data-campo="nivel"')}</label>
        </div>
        <div class="us-rot">Áreas</div>${_usChipsAreas(u.areas, 'pend')}
        <div class="mpe-acoes"><span class="mpe-esp"></span>
          <button type="button" class="mpe-btn mpe-del" data-act="recusar">Recusar</button>
          <button type="button" class="mpe-btn mpe-btn-pri" data-act="aprovar">Aprovar</button></div>`
        : `<div class="mpe-dica">Áreas pedidas: ${escapeHtml((u.areas || []).join(', ') || '—')} · aprovação da gerência</div>`}
      </div>`).join('') : '<div class="mpe-dica">Nenhum cadastro aguardando aprovação.</div>';
    return;
  }
  if (_us.aba === 'equipe') {
    const lista = d.usuarios.filter(u => u.status !== 'pendente').sort((a, b) => _US_NIVEIS.indexOf(b.nivel) - _US_NIVEIS.indexOf(a.nivel) || a.nome.localeCompare(b.nome));
    c.innerHTML = lista.map(u => `<div class="us-item${u.status === 'bloqueado' ? ' us-bloq' : ''}" data-email="${escapeHtml(u.email)}">
        <div class="us-linha"><b>${escapeHtml(u.nome)}</b><span class="menu-conta-nivel nivel-${u.nivel}">${SIR_NIVEIS[u.nivel]}</span>${u.status === 'bloqueado' ? '<span class="us-tag-bloq">Bloqueado</span>' : ''}
          <span class="us-mail">${escapeHtml(u.email)}</span></div>
        <div class="us-linha us-meta">Áreas: ${escapeHtml((u.areas || []).join(', ') || (u.nivel === 'dev' || u.nivel === 'gerencia' ? 'todas' : '—'))} · último acesso ${_usQuando(u.ultimoAcesso)}${(u.ipsAtivos || []).length ? ' · conectado em ' + escapeHtml(u.ipsAtivos.join(', ')) : ''}${u.aprovadoPor ? ' · aprovado por ' + escapeHtml(u.aprovadoPor) : ''}</div>
        ${u.podeGerir ? `<details class="us-gerir"><summary>Alterar</summary>
          <div class="us-linha us-form"><label>Nível ${_usSelNivel(u.nivel, 'data-campo="nivel"')}</label></div>
          <div class="us-rot">Áreas</div>${_usChipsAreas(u.areas, 'eq')}
          <div class="mpe-acoes">
            <button type="button" class="mpe-btn mpe-del" data-act="${u.status === 'bloqueado' ? 'desbloquear' : 'bloquear'}">${u.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear acesso'}</button>
            <span class="mpe-esp"></span><button type="button" class="mpe-btn mpe-btn-pri" data-act="salvar">Salvar</button></div>
        </details>` : ''}
      </div>`).join('') || '<div class="mpe-dica">Ninguém por aqui ainda.</div>';
    return;
  }
  if (_us.aba === 'convidar') {
    c.innerHTML = `<div class="us-item">
      <div class="mpe-dica">O convite é um link de uso único, válido por 48 h. Quem abrir já entra com o nível e as áreas escolhidos aqui (sem precisar de aprovação), depois de ativar o autenticador.</div>
      <div class="mt-grid"><label class="mt-campo"><span>Nível</span>${_usSelNivel('apoio', 'id="us-conv-nivel"')}</label>
        <label class="mt-campo"><span>E-mail (opcional — trava o convite neste e-mail)</span><input id="us-conv-email" class="mpe-input" type="email" autocomplete="off"></label></div>
      <div class="us-rot">Áreas</div>${_usChipsAreas(eu.nivel === 'gestor' ? eu.areas : [], 'conv')}
      <div class="mpe-acoes"><span class="mpe-esp"></span><button type="button" class="mpe-btn mpe-btn-pri" data-act="convidar">Gerar link de convite</button></div>
      <div id="us-conv-link"></div></div>`;
    return;
  }
  if (_us.aba === 'pre') {
    c.innerHTML = `<div class="us-item">
      <div class="mpe-dica">E-mails pré-autorizados já se cadastram com o nível reservado (não entram como Apoio). Por segurança, a entrada ainda aparece em Pendentes para uma confirmação rápida — assim ninguém usa o e-mail de outra pessoa.</div>
      <div class="mt-grid"><label class="mt-campo"><span>E-mail</span><input id="us-pre-email" class="mpe-input" type="email" autocomplete="off"></label>
        <label class="mt-campo"><span>Nível</span>${_usSelNivel('gestor', 'id="us-pre-nivel"')}</label></div>
      <div class="us-rot">Áreas</div>${_usChipsAreas([], 'pre')}
      <div class="mpe-acoes"><span class="mpe-esp"></span><button type="button" class="mpe-btn mpe-btn-pri" data-act="pre">Pré-autorizar</button></div></div>
      ${(d.preAutorizados || []).map(p => `<div class="us-item" data-email="${escapeHtml(p.email)}"><div class="us-linha"><b>${escapeHtml(p.email)}</b><span class="menu-conta-nivel nivel-${p.nivel}">${SIR_NIVEIS[p.nivel]}</span>
        <span class="us-meta">${escapeHtml((p.areas || []).join(', '))} · por ${escapeHtml(p.por)}</span><span class="mpe-esp"></span><button type="button" class="mpe-btn mpe-del" data-act="remover-pre">Remover</button></div></div>`).join('')}`;
    return;
  }
  if (_us.aba === 'registro') {
    c.innerHTML = (d.registro || []).length ? `<table class="us-reg"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Alvo</th></tr></thead><tbody>${d.registro.map(r => `<tr><td>${_usQuando(r.at)}</td><td>${escapeHtml(r.quem)}</td><td>${escapeHtml(r.acao)}${r.extra ? ' · ' + escapeHtml(r.extra) : ''}</td><td>${escapeHtml(r.alvo)}</td></tr>`).join('')}</tbody></table>` : '<div class="mpe-dica">Sem registros ainda.</div>';
  }
}

async function _usAcao(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, item = b.closest('[data-email]'), email = item ? item.dataset.email : '';
  const box = b.closest('.us-item');
  const nivel = () => (box.querySelector('[data-campo="nivel"]') || {}).value;
  const areas = () => _usAreasMarcadas(box.querySelector('[data-areas]') || document.createElement('div'));
  b.disabled = true;
  try {
    if (act === 'recarregar') return await _usCarregar();
    if (act === 'aprovar') { await _usApi('aprovar', { email, nivel: nivel(), areas: areas() }); _usToast('Acesso aprovado'); }
    else if (act === 'recusar') { if (!confirm(`Recusar o cadastro de ${email}?`)) return; await _usApi('recusar', { email }); _usToast('Cadastro recusado'); }
    else if (act === 'salvar') { await _usApi('alterar', { email, nivel: nivel(), areas: areas() }); _usToast('Alterações salvas'); }
    else if (act === 'bloquear' || act === 'desbloquear') {
      if (act === 'bloquear' && !confirm(`Bloquear o acesso de ${email}? A pessoa sai na próxima conferência (até 10 min).`)) return;
      await _usApi('alterar', { email, status: act === 'bloquear' ? 'bloqueado' : 'ativo' }); _usToast(act === 'bloquear' ? 'Acesso bloqueado' : 'Acesso liberado');
    }
    else if (act === 'convidar') {
      const j = await _usApi('convidar', { nivel: document.getElementById('us-conv-nivel').value, email: document.getElementById('us-conv-email').value.trim() || undefined, areas: areas() });
      const link = new URL('pages/login.html?convite=' + encodeURIComponent(j.codigo), location.href).href;
      document.getElementById('us-conv-link').innerHTML = `<div class="us-link"><input class="mpe-input" readonly value="${escapeHtml(link)}" aria-label="Link do convite"><button type="button" class="mpe-btn mpe-btn-pri" data-act="copiar-link">Copiar</button></div>
        <div class="mpe-dica">Vale até ${_usQuando(j.validade)} e só pode ser usado uma vez.</div>`;
      return;
    }
    else if (act === 'copiar-link') {
      const inp = box.querySelector('.us-link input');
      try { await navigator.clipboard.writeText(inp.value); _usToast('Link copiado — envie para a pessoa'); } catch (err) { inp.select(); }
      return;
    }
    else if (act === 'pre') { await _usApi('pre-autorizar', { email: document.getElementById('us-pre-email').value.trim(), nivel: document.getElementById('us-pre-nivel').value, areas: areas() }); _usToast('E-mail pré-autorizado'); }
    else if (act === 'remover-pre') { await _usApi('remover-pre', { email }); _usToast('Pré-autorização removida'); }
    await _usCarregar();
  } catch (err) { if (err.message !== 'sessão') _usToast(err.message, false); }
  finally { b.disabled = false; }
}
