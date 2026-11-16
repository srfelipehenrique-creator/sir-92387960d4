/* ══════════════════════════════════════════════════════════════
   Fonte dos dados / Meu coletor
   - Abre ao tocar em "Fonte: …" no rodapé.
   - Mostra de onde os dados estão vindo e se o seu coletor está ativo.
   - Gera o "código do coletor": um favorito para o navegador da
     máquina que abre o SIR da Claro. Com você logado no SIR, o
     favorito abre a janelinha que lê as RAL/REC e envia direto
     para o seu servidor. A senha do SIR não é guardada em lugar nenhum.
   ══════════════════════════════════════════════════════════════ */

function _colUrl() { return typeof _pushUrl === 'function' ? _pushUrl() : ''; }
function _colKey() { return typeof _pushKey === 'function' ? _pushKey() : ''; }

/* Monta o favorito (javascript:) que abre a janela do coletor */
function _colBookmarklet(token) {
  const base = location.origin + location.pathname.replace(/[^/]*$/, '');
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Coletor SIR</title></head>' +
    '<body style="font:14px system-ui,Arial;padding:16px">Carregando coletor…</body></html>';
  /* A janelinha abre numa página do próprio SIR (endereço real, mesma sessão) e, quando
     ela termina de carregar, o conteúdo é trocado pelo coletor. */
  const code = "(function(){var w=window.open('/generico/NOVAlistaDeTarefasItensRecebidos.cfm','coletorSIR','width=440,height=640');" +
    "if(!w){alert('O navegador bloqueou a janela do coletor. Permita pop-ups para o SIR e clique no favorito de novo.');return;}" +
    "var n=0,t=setInterval(function(){n++;if(n>240){clearInterval(t);return;}var d;" +
    "try{d=w.document;if(d.readyState!=='complete'||String(w.location.href).indexOf('about:')===0)return;}catch(e){return;}" +
    "clearInterval(t);d.open();d.write(" + JSON.stringify(html) + ");d.close();" +
    "w.SIR_COLETOR=" + JSON.stringify({ url: _colUrl(), token }) + ";" +
    "var s=d.createElement('script');s.charset='utf-8';s.src=" + JSON.stringify(base + 'coletor/coletor.js') + "+'?v='+Date.now();" +
    "s.onerror=function(){d.body.textContent='Não consegui baixar o coletor. Esta rede pode estar bloqueando o endereço github.io.';};" +
    "d.body.appendChild(s);w.focus();},250);})();";
  return 'javascript:' + encodeURIComponent(code);
}

function _colModal() {
  let ov = document.getElementById('coletor-modal');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'coletor-modal';
  ov.addEventListener('click', closeColetor);
  ov.innerHTML = `
    <div class="modal-content coletor-modal-content" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">Fonte dos dados</div>
        <div class="modal-tools"><button class="modal-close-btn" onclick="closeColetor()">&times;</button></div>
      </div>
      <div class="coletor-body">
        <div class="col-status" id="col-status">Consultando o servidor…</div>

        <h4>Coletor para Windows — o jeito fácil</h4>
        <p class="col-p">No <b>computador do trabalho</b> (o que abre o SIR da Claro):</p>
        <ol class="col-steps">
          <li>Abra este dashboard nele e toque em <b>Baixar coletor</b>.</li>
          <li>Dê <b>dois cliques</b> no arquivo baixado <b>Coletor SIR.cmd</b>. Se o Windows avisar, clique em <b>Mais informações → Executar assim mesmo</b>.</li>
          <li>Na janela preta, digite o seu <b>usuário e senha do SIR</b> (só na primeira vez, se pedir para lembrar).</li>
          <li><b>Deixe a janela aberta</b> (pode minimizar). Ela envia as RAL/REC a cada 5 minutos. Não precisa deixar o SIR nem o navegador abertos.</li>
        </ol>
        <div class="col-actions">
          <button type="button" class="col-btn col-btn-primary" id="col-win">Baixar coletor</button>
          <a href="#" class="col-alt" id="col-win-zip">O navegador bloqueou? Baixar em .zip</a>
        </div>
        <div class="col-note" id="col-note"></div>
        <p class="col-p col-small">O arquivo leva um código que só serve para <b>enviar</b> dados ao seu servidor. Baixar de novo cancela o código anterior. A senha só fica guardada se você pedir, criptografada pelo Windows para a sua conta. Com o coletor fechado por mais de 25 minutos, o servidor volta sozinho para a fonte pública.</p>

        <details class="col-more">
          <summary>Outro jeito: favorito no navegador</summary>
          <ol class="col-steps">
            <li>Toque em <b>Gerar código do favorito</b> e crie um favorito com esse código no endereço (URL).</li>
            <li>Abra o SIR, faça login e, <b>estando na aba do SIR</b>, clique no favorito.</li>
          </ol>
          <div class="col-actions">
            <button type="button" class="col-btn" id="col-gen">Gerar código do favorito</button>
            <button type="button" class="col-btn" id="col-copy" hidden>Copiar código</button>
            <a class="col-drag" id="col-drag" hidden title="Arraste para a barra de favoritos">Coletor SIR</a>
          </div>
          <textarea id="col-code" class="col-code" readonly hidden spellcheck="false"></textarea>
        </details>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#col-win').addEventListener('click', () => _colWindows(false));
  ov.querySelector('#col-win-zip').addEventListener('click', e => { e.preventDefault(); _colWindows(true); });
  ov.querySelector('#col-gen').addEventListener('click', _colGenerate);
  ov.querySelector('#col-copy').addEventListener('click', _colCopy);
  ov.querySelector('#col-drag').addEventListener('click', e => { e.preventDefault(); _colNote('Arraste este botão até a barra de favoritos (não clique aqui).'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('active')) closeColetor(); });
  return ov;
}
function _colNote(t, err) { const n = document.getElementById('col-note'); if (n) { n.textContent = t || ''; n.classList.toggle('err', !!err); } }

async function _colRefreshStatus() {
  const el = document.getElementById('col-status');
  if (!el) return;
  const cur = (typeof appState !== 'undefined' && appState.dataSource) ? appState.dataSource.src : '';
  const curTxt = { coletor: 'o seu coletor (direto do SIR, com o seu login)', espelho: 'o seu servidor, com a cópia da fonte pública', publica: 'a fonte pública (reserva) — seu servidor não respondeu ou falta a chave neste aparelho' }[cur] || '—';
  let col = '';
  try {
    const s = await fetch(_colUrl() + '/', { cache: 'no-store' }).then(r => r.json());
    const fmt = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
    if (s.coletor && s.coletor.ativo) col = `<span class="col-pill ok">ativo</span> último envio ${fmt(s.coletor.ultimoEnvio)}`;
    else if (s.coletor) col = `<span class="col-pill off">parado</span> último envio ${fmt(s.coletor.ultimoEnvio)}`;
    else if (s.coletorConfigurado) col = `<span class="col-pill off">aguardando</span> código gerado, mas nenhum envio ainda`;
    else col = `<span class="col-pill off">não configurado</span>`;
  } catch (e) { col = '<span class="col-pill off">sem resposta do servidor</span>'; }
  el.innerHTML = `<div><span class="col-k">Em uso agora</span>${curTxt}</div><div><span class="col-k">Meu coletor</span>${col}</div>`;
}

async function _colGenerate() {
  const btn = document.getElementById('col-gen');
  if (!_colUrl() || !_colKey()) { _colNote('Este aparelho ainda não tem a chave de acesso salva. Entre de novo pela tela de bloqueio e tente outra vez.', true); return; }
  if (!confirm('Gerar o código do favorito cancela o código anterior (um coletor do Windows já baixado para de funcionar). Continuar?')) return;
  btn.disabled = true; _colNote('Gerando…');
  try {
    const code = _colBookmarklet(await _colToken());
    const ta = document.getElementById('col-code');
    ta.value = code; ta.hidden = false;
    document.getElementById('col-copy').hidden = false;
    const drag = document.getElementById('col-drag');
    drag.href = code; drag.hidden = false;
    btn.textContent = 'Gerar outro código';
    _colNote('Pronto. Copie o código e cole no endereço de um favorito — ou, no computador, arraste o botão "Coletor SIR" para a barra de favoritos.');
    _colRefreshStatus();
  } catch (e) {
    _colNote(e.message === 'chave' ? 'A chave de acesso deste aparelho não foi aceita.' : 'Não consegui falar com o servidor. Tente de novo em instantes.', true);
  }
  btn.disabled = false;
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
    _colNote(zip ? 'Baixado. Abra o .zip, tire o "Coletor SIR.cmd" de dentro e dê dois cliques nele.' : 'Baixado. Dê dois cliques em "Coletor SIR.cmd" (na pasta Downloads).');
    _colRefreshStatus();
  } catch (e) {
    _colNote(e.message === 'chave' ? 'A chave de acesso deste aparelho não foi aceita.' : 'Não consegui preparar o coletor. Tente de novo em instantes.', true);
  }
  btn.disabled = false;
}

async function _colCopy() {
  const ta = document.getElementById('col-code');
  try { await navigator.clipboard.writeText(ta.value); }
  catch (e) { ta.focus(); ta.select(); try { document.execCommand('copy'); } catch (err) {} }
  _colNote('Código copiado. Cole no campo de endereço (URL) do favorito "Coletor SIR".');
}

function openColetor() { const ov = _colModal(); ov.classList.add('active'); _colRefreshStatus(); }
function closeColetor() { document.getElementById('coletor-modal')?.classList.remove('active'); }

/* O texto "Fonte: …" do rodapé abre esta janela */
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#data-source')) openColetor(); });
