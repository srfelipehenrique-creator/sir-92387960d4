/* ══════════════════════════════════════════════════════════════
   Meu coletor — de onde vêm os dados do painel
   - Abre pelo aviso de "dados parados", por Configurações → Dados
     ou tocando em "Fonte: …" no rodapé.
   - No topo, em uma frase: o painel está recebendo dados ou não.
   - Em um computador Windows: 3 passos para ligar o coletor
     (baixar → abrir → digitar o login do SIR). A própria janela
     avisa quando o primeiro envio chega.
   - No celular: só mostra a situação (o coletor roda no computador).
   ══════════════════════════════════════════════════════════════ */

function _colUrl() { return typeof _pushUrl === 'function' ? _pushUrl() : ''; }
function _colKey() { return typeof _pushKey === 'function' ? _pushKey() : ''; }
const _colIsWindows = /Windows/i.test(navigator.userAgent || '');
let _colWaiting = 0, _colTimer = null, _colWasActive = false;

function _colModal() {
  let ov = document.getElementById('coletor-modal');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'coletor-modal';
  ov.addEventListener('click', closeColetor);
  const passos = `
        <div class="col-intro">Para o painel receber dados, um <b>computador com Windows e a VPN da Claro ligada</b> precisa ficar com o coletor aberto. Ele lê as RAL e REC do SIR com o seu login e envia para o painel a cada 5 minutos. Com ele ligado, o painel funciona no computador e no celular, em qualquer rede.</div>
        <div class="col-step" id="col-step-1">
          <div class="col-num">1</div>
          <div class="col-step-bd">
            <div class="col-step-t">Baixe o coletor</div>
            <div class="col-actions">
              <button type="button" class="col-btn col-btn-primary" id="col-win">Baixar coletor</button>
            </div>
            <div class="col-step-d">Se o navegador avisar que o arquivo pode ser perigoso, escolha <b>Manter</b>. <a href="#" class="col-alt" id="col-win-zip">Não deixou baixar? Tente em .zip</a></div>
            <div class="col-note" id="col-note"></div>
          </div>
        </div>
        <div class="col-step" id="col-step-2">
          <div class="col-num">2</div>
          <div class="col-step-bd">
            <div class="col-step-t">Abra o arquivo baixado</div>
            <div class="col-step-d">Na pasta <b>Downloads</b>, dê <b>dois cliques</b> em <b>Coletor SIR</b>. Se aparecer a tela azul “O Windows protegeu o computador”, clique em <b>Mais informações</b> e depois em <b>Executar assim mesmo</b>.</div>
          </div>
        </div>
        <div class="col-step" id="col-step-3">
          <div class="col-num">3</div>
          <div class="col-step-bd">
            <div class="col-step-t">Digite o seu login do SIR</div>
            <div class="col-step-d">Na janela preta que abriu, digite o <b>usuário</b>, aperte Enter, digite a <b>senha</b> (ela não aparece na tela) e aperte Enter. <b>Deixe a janela aberta</b> — pode minimizar.</div>
          </div>
        </div>
        <div class="col-wait" id="col-wait" hidden></div>
        <div class="col-after"><b>Nos próximos dias:</b> ligue a VPN e dê dois cliques no ícone <b>Coletor SIR</b> que foi criado na Área de Trabalho. Não precisa baixar nem digitar o login de novo. Com a janela fechada ou o computador desligado, o painel para de atualizar.</div>`;
  const celular = `
        <div class="col-intro">O coletor é ligado em um <b>computador com Windows e a VPN da Claro</b>. Abra este painel nesse computador, toque em <b>Configurações → Dados → Meu coletor</b> e siga os 3 passos. Depois disso, o celular recebe os dados sozinho, em qualquer rede.</div>`;
  ov.innerHTML = `
    <div class="modal-content coletor-modal-content" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">Meu coletor</div>
        <div class="modal-tools"><button class="modal-close-btn" onclick="closeColetor()">&times;</button></div>
      </div>
      <div class="coletor-body">
        <div class="col-status" id="col-status">Consultando…</div>
        ${_colIsWindows ? passos : celular}
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#col-win')?.addEventListener('click', () => _colWindows(false));
  ov.querySelector('#col-win-zip')?.addEventListener('click', e => { e.preventDefault(); _colWindows(true); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('active')) closeColetor(); });
  return ov;
}
function _colNote(t, err) { const n = document.getElementById('col-note'); if (n) { n.textContent = t || ''; n.classList.toggle('err', !!err); } }
function _colStepDone(n) { document.getElementById('col-step-' + n)?.classList.add('done'); }
function _colFmt(ms) { return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às'); }

/* Situação em uma frase + espera pelo primeiro envio depois de baixar */
async function _colRefreshStatus() {
  const el = document.getElementById('col-status');
  if (!el) return;
  let s = null;
  try { s = await fetch(_colUrl() + '/', { cache: 'no-store' }).then(r => r.json()); } catch (e) {}
  const wait = document.getElementById('col-wait');
  if (!s) {
    el.className = 'col-status bad';
    el.innerHTML = '<b>Sem resposta do servidor do painel.</b><span>Confira a internet deste aparelho e tente de novo.</span>';
    return;
  }
  const ativo = !!(s.coletor && s.coletor.ativo);
  if (ativo) {
    el.className = 'col-status ok';
    el.innerHTML = `<b>✅ Coletor ligado — o painel está recebendo dados.</b><span>Último envio: ${_colFmt(Date.parse(s.coletor.ultimoEnvio))}.</span>`;
    [1, 2, 3].forEach(_colStepDone);
    if (wait) { wait.hidden = !_colWaiting; wait.className = 'col-wait ok'; wait.textContent = '✅ Pronto! O primeiro envio chegou. Pode fechar esta janela do painel — a janela preta do coletor fica aberta.'; }
    if (!_colWasActive && typeof loadNow === 'function') loadNow();   /* acabou de ligar: atualiza o painel na hora */
    _colWaiting = 0;
  } else {
    const ult = s.ultimaMudanca ? Date.parse(s.ultimaMudanca) : 0;
    el.className = 'col-status bad';
    el.innerHTML = `<b>⛔ Coletor desligado — o painel não está sendo atualizado.</b><span>${ult ? 'Os dados na tela são de ' + _colFmt(ult) + '.' : ''}${s.coletor ? ' Último envio do coletor: ' + _colFmt(Date.parse(s.coletor.ultimoEnvio)) + '.' : ''}</span>`;
    if (wait) {
      const esperando = _colWaiting && Date.now() - _colWaiting < 20 * 60000;
      wait.hidden = !esperando; wait.className = 'col-wait';
      wait.textContent = '⏳ Aguardando o primeiro envio do coletor… Esta mensagem muda sozinha quando ele chegar (leva até 1 minuto depois do login).';
    }
  }
  _colWasActive = ativo;
}

/* ── Coletor para Windows: arquivo .cmd pronto (o código do coletor já vai dentro) ── */
async function _colToken() {
  const r = await fetch(_colUrl() + '/collector/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: _colKey() }) });
  if (r.status === 403) throw new Error('chave');
  const j = await r.json();
  if (!j.token) throw new Error('resposta');
  return j.token;
}
async function _colWindows(zip) {
  const btn = document.getElementById('col-win');
  if (!_colUrl() || !_colKey()) { _colNote('Este aparelho ainda não tem a chave de acesso salva. Entre de novo pela tela de bloqueio e tente outra vez.', true); return; }
  btn.disabled = true; _colNote('Preparando o coletor…');
  try {
    const tpl = await fetch('coletor/coletor-windows.ps1?v=' + Date.now(), { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('modelo'); return r.text(); });
    const token = await _colToken();
    const ps = tpl.replace("'__SIR_URL__'", "'" + _colUrl() + "'").replace("'__SIR_TOKEN__'", "'" + token + "'");
    /* Arquivo "duplo": as primeiras linhas são para o Windows (cmd) e chamam o PowerShell,
       que lê o resto deste mesmo arquivo. Nada para instalar. */
    const head = [
      '<# :',
      '@echo off',
      'title Coletor SIR',
      'set "SIR_SELF=%~f0"',
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText($env:SIR_SELF, [Text.Encoding]::UTF8))"',
      'echo.',
      'echo O coletor parou. Feche esta janela ou aperte uma tecla.',
      'pause >nul',
      'exit /b',
      '#>',
      ''
    ].join('\r\n');
    const body = head + ps.replace(/\r?\n/g, '\r\n');
    const bytes = new TextEncoder().encode(body);
    let blob, name;
    if (zip && typeof JSZip !== 'undefined') {
      const z = new JSZip(); z.file('Coletor SIR.cmd', bytes);
      blob = await z.generateAsync({ type: 'blob' }); name = 'Coletor SIR.zip';
    } else { blob = new Blob([bytes], { type: 'application/octet-stream' }); name = 'Coletor SIR.cmd'; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    _colNote(zip ? 'Baixado. Abra o .zip, arraste o "Coletor SIR.cmd" para a Área de Trabalho e siga para o passo 2.' : 'Baixado (pasta Downloads). Agora siga para o passo 2.');
    _colWaiting = Date.now(); _colStepDone(1);
    _colRefreshStatus();
  } catch (e) {
    _colNote(e.message === 'chave' ? 'A chave de acesso deste aparelho não foi aceita.' : 'Não consegui preparar o coletor. Tente de novo em instantes.', true);
  }
  btn.disabled = false;
}

function openColetor() {
  const ov = _colModal(); ov.classList.add('active');
  if (typeof dismissToast === 'function') { try { dismissToast(); } catch (e) {} }
  _colRefreshStatus();
  clearInterval(_colTimer);
  _colTimer = setInterval(_colRefreshStatus, 10000);
}
function closeColetor() {
  document.getElementById('coletor-modal')?.classList.remove('active');
  clearInterval(_colTimer); _colTimer = null;
}

/* O texto "Fonte: …" do rodapé abre esta janela */
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#data-source')) openColetor(); });
