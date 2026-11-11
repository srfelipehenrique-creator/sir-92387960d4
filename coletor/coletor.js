/* ══════════════════════════════════════════════════════════════
   Coletor SIR (roda no SEU navegador, com o SEU login)
   ──────────────────────────────────────────────────────────────
   Como funciona:
   - Você entra no SIR normalmente (usuário e senha digitados por
     você, na tela do próprio SIR). Este coletor NÃO conhece nem
     guarda a sua senha: ele só usa a sessão já aberta.
   - Ao clicar no favorito "Coletor SIR", abre esta janelinha.
     Ela carrega as listas de REC e RAL (como você faria na mão),
     monta os dois arquivos e envia para o seu servidor.
   - Repete a cada 5 minutos enquanto a janelinha estiver aberta.

   Configuração (vem do favorito): window.SIR_COLETOR = { url, token }
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var CFG = window.SIR_COLETOR || {};
  var VERSION = 'c2';
  var EVERY_MS = 5 * 60000;

  /* Caminhos das listas dentro do SIR (relativos: valem para o endereço em que você está logado) */
  var REC_PATH = '/generico/NOVAlistaDeTarefasItensRecebidos.cfm';
  var RAL_PATH = '/navegacao/NOVAframesetNivel2ListaDeTarefas.cfm';
  var F_FILTRO = 'frameFiltro';
  var F_LISTA  = ['framesetNivel2ListaDeTarefas', 'frameNivel3ItensRecebidos', 'frameNivel2ItensRecebidosPrincipal'];
  var SEL_TIPO = 'indic_tipo_recup';
  var BTN_EXIBIR = 'confirma';

  var HEADERS = {
    13: ['Designação', 'Tipo Ral', 'Anorm.', 'Num.Recup.', 'Abertura', 'Duração', 'Item', 'CF Exec.', 'Ass.', 'Técn.', 'Resp.', 'Anatel', 'Prejuízo'],
    9:  ['ID', 'Prioridade', 'Num.Recup.', 'Cliente', 'Designação', 'Abertura', 'CF Exec.', 'Resp.', 'Técnico']
  };

  var doc = document, timer = null, running = false, diag = {}, nextAt = 0, okCount = 0;

  /* ─────────── Tela ─────────── */
  doc.title = 'Coletor SIR';
  doc.body.innerHTML =
    '<style>' +
    'body{margin:0;font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif;background:#f4f5f8;color:#1c1f26}' +
    '.w{padding:14px 16px}h1{font-size:16px;margin:0 0 2px}.sub{color:#667;font-size:12px;margin-bottom:12px}' +
    '.st{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #dde0e7;font-weight:600}' +
    '.dot{width:10px;height:10px;border-radius:50%;background:#9aa;flex:none}' +
    '.ok .dot{background:#2e7d32}.run .dot{background:#d49800}.err .dot{background:#c62828}.err{border-color:#e7b4b4;background:#fff5f5}' +
    '.kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:12px 2px;font-size:13px}.kv b{font-weight:600}.kv span{color:#556}' +
    '.bt{display:flex;gap:8px;flex-wrap:wrap}button{font:inherit;padding:7px 12px;border-radius:8px;border:1px solid #c9cdd6;background:#fff;cursor:pointer}' +
    'button.p{background:#4f46e5;border-color:#4f46e5;color:#fff}' +
    '.help{margin-top:10px;padding:9px 11px;border-radius:8px;background:#fff8e1;border:1px solid #f0d98a;font-size:13px;display:none}' +
    '#log{margin-top:12px;font:11px/1.5 ui-monospace,Consolas,monospace;color:#556;max-height:150px;overflow:auto;white-space:pre-wrap}' +
    '.fr{position:absolute;left:-9999px;top:0;width:1200px;height:800px;border:0}' +
    '</style>' +
    '<div class="w"><h1>Coletor SIR</h1><div class="sub">Deixe esta janela aberta (pode minimizar). Ela envia as RAL/REC para o seu servidor a cada 5 min.</div>' +
    '<div class="st" id="st"><i class="dot"></i><span id="stt">Iniciando…</span></div>' +
    '<div class="help" id="help"></div>' +
    '<div class="kv"><span>Último envio</span><b id="k-last">—</b><span>RAL / REC lidas</span><b id="k-cnt">—</b><span>Próxima coleta</span><b id="k-next">—</b><span>Envios nesta sessão</span><b id="k-ok">0</b></div>' +
    '<div class="bt"><button class="p" id="b-now">Coletar agora</button><button id="b-stop">Pausar</button><button id="b-diag">Copiar diagnóstico</button><button id="b-mode" style="display:none"></button></div>' +
    '<div id="log"></div></div><div id="frames"></div>';

  var $ = function (id) { return doc.getElementById(id); };
  function hhmm(t) { return new Date(t).toLocaleTimeString('pt-BR'); }
  function log(m) { var el = $('log'); el.textContent = '[' + hhmm(Date.now()) + '] ' + m + '\n' + el.textContent.slice(0, 4000); }
  function status(cls, txt, help) {
    $('st').className = 'st ' + cls; $('stt').textContent = txt;
    var h = $('help'); h.style.display = help ? 'block' : 'none'; h.textContent = help || '';
    doc.title = (cls === 'err' ? '⚠ ' : cls === 'ok' ? '● ' : '') + 'Coletor SIR';
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ─────────── Carregar páginas do SIR em quadros invisíveis ─────────── */
  /* Dois modos de abrir as telas do SIR:
     - "embutido" (padrão): num quadro invisível dentro desta janela;
     - "janela": numa janelinha separada, igual a uma aba normal do SIR
       (para o caso de o SIR não funcionar embutido). */
  var LS_MODE = 'sir_coletor_modo';
  var useWin = false; try { useWin = localStorage.getItem(LS_MODE) === 'win'; } catch (e) {}
  var workWin = null;
  var WORK_NAME = 'sirColetorTrabalho';

  function loadFrame(path) {
    var url = path + (path.indexOf('?') < 0 ? '?' : '&') + '_c=' + Date.now();
    if (useWin) return loadInWindow(url);
    return new Promise(function (resolve, reject) {
      var box = $('frames'); box.innerHTML = '';
      var f = doc.createElement('iframe');
      f.className = 'fr'; f.name = WORK_NAME;
      var done = false;
      var to = setTimeout(function () { if (!done) { done = true; reject(new Error('tempo')); } }, 45000);
      f.onload = function () { if (!done) { done = true; clearTimeout(to); resolve(f.contentWindow); } };
      f.onerror = function () { if (!done) { done = true; clearTimeout(to); reject(new Error('rede')); } };
      f.src = url;
      box.appendChild(f);
    });
  }
  function loadInWindow(url) {
    return new Promise(function (resolve, reject) {
      if (!workWin || workWin.closed) return reject(new Error('janela'));
      var stamp = url.slice(url.indexOf('_c='));
      try { workWin.location.href = url; } catch (e) { return reject(new Error('janela')); }
      var n = 0, t = setInterval(function () {
        n++;
        if (!workWin || workWin.closed) { clearInterval(t); return reject(new Error('janela')); }
        if (n > 90) { clearInterval(t); return reject(new Error('tempo')); }
        try {
          if (String(workWin.location.href).indexOf(stamp) < 0) return;
          if (workWin.document.readyState !== 'complete') return;
        } catch (e) { return; }
        clearInterval(t); resolve(workWin);
      }, 500);
    });
  }
  function docOf(win) {
    try { return win.document; } catch (e) { throw new Error('origem'); }   /* página de outro endereço: não está no SIR */
  }
  function isLogin(d) { return !!(d && d.querySelector && d.querySelector('input[type="password"]')); }
  /* Procura um quadro pelo NAME (o SIR repete IDs, então o NAME é o confiável) */
  function childFrame(win, name) {
    var d = docOf(win);
    var els = d.querySelectorAll('frame, iframe');
    for (var i = 0; i < els.length; i++) if (els[i].getAttribute('name') === name) return els[i].contentWindow;
    return null;
  }
  function frameTree(win, depth) {
    var out = [];
    try {
      var els = win.document.querySelectorAll('frame, iframe');
      for (var i = 0; i < els.length; i++) {
        var n = els[i].getAttribute('name') || '(sem nome)';
        var sub = depth < 4 ? frameTree(els[i].contentWindow, depth + 1) : [];
        var info = '';
        try { var dd = els[i].contentWindow.document; info = ' tabelas=' + dd.querySelectorAll('table').length + ' forms=' + dd.forms.length; } catch (e) { info = ' (sem acesso)'; }
        out.push(new Array(depth + 1).join('  ') + n + info);
        out = out.concat(sub);
      }
    } catch (e) { out.push('(erro ao ler quadros)'); }
    return out;
  }

  /* ─────────── Tabela → linhas (mesma regra do robô original) ─────────── */
  function cellText(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function extractRows(d) {
    var tables = d.querySelectorAll('table');
    if (!tables.length) return { rows: [], cols: 0, tables: 0 };
    var best = tables[0], bestLen = -1;
    for (var i = 0; i < tables.length; i++) { var l = (tables[i].textContent || '').length; if (l > bestLen) { bestLen = l; best = tables[i]; } }
    var trs = best.querySelectorAll('tr'), all = [], count = {};
    for (var r = 0; r < trs.length; r++) {
      var cells = trs[r].querySelectorAll('td, th'), row = [];
      /* só as células desta linha (ignora as de tabelas internas) */
      for (var c = 0; c < cells.length; c++) if (cells[c].closest('tr') === trs[r]) row.push(cellText(cells[c]));
      if (row.length && row.some(function (x) { return x; })) { all.push(row); count[row.length] = (count[row.length] || 0) + 1; }
    }
    var cols = 0, max = 0;
    for (var k in count) if (count[k] > max) { max = count[k]; cols = Number(k); }
    return { rows: all.filter(function (x) { return x.length === cols; }), cols: cols, tables: tables.length };
  }
  function toCsv(res, expected) {
    if (res.cols !== expected) throw new Error('formato:' + expected + ':' + res.cols + ':' + res.rows.length);
    var head = HEADERS[expected];
    /* tira uma eventual linha de títulos repetida dentro da tabela */
    var rows = res.rows.filter(function (r) { return !(r[0] === head[0] && r[1] === head[1]); });
    if (!rows.length) throw new Error('vazio:' + expected);
    var esc = function (v) { return String(v).replace(/;/g, ',').replace(/[\r\n"]/g, ' '); };
    return { csv: [head.join(';')].concat(rows.map(function (r) { return r.map(esc).join(';'); })).join('\n') + '\n', n: rows.length };
  }

  /* ─────────── Coletas ─────────── */
  async function collectRec() {
    var win = await loadFrame(REC_PATH);
    await wait(1500);
    var d = docOf(win);
    if (isLogin(d)) throw new Error('login');
    var res = extractRows(d);
    diag.rec = { cols: res.cols, linhas: res.rows.length, tabelas: res.tables };
    return toCsv(res, 9);
  }
  async function collectRal() {
    var top = await loadFrame(RAL_PATH);
    await wait(2500);
    if (isLogin(docOf(top))) throw new Error('login');
    var filtro = childFrame(top, F_FILTRO);
    if (!filtro) { diag.ral = { erro: 'sem ' + F_FILTRO, quadros: frameTree(top, 0) }; throw new Error('estrutura:filtro'); }
    var fd = docOf(filtro);
    if (isLogin(fd)) throw new Error('login');
    var sel = fd.getElementsByName(SEL_TIPO)[0], btn = fd.getElementsByName(BTN_EXIBIR)[0];
    if (!sel || !btn) { diag.ral = { erro: 'sem campo', select: !!sel, botao: !!btn, quadros: frameTree(top, 0) }; throw new Error('estrutura:campo'); }
    sel.value = 'RAL';
    if (sel.value !== 'RAL') { diag.ral = { erro: 'opcao RAL', opcoes: [].map.call(sel.options, function (o) { return o.value; }) }; throw new Error('estrutura:opcao'); }
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(800);
    /* No modo embutido, um formulário que manda o resultado para "a página de cima" (_top)
       trocaria esta janela do coletor. Redireciona para o quadro de trabalho (mesmo efeito no SIR). */
    if (!useWin) {
      var form = btn.form || sel.form, base = fd.querySelector('base[target]');
      var tg = String((form && form.getAttribute('target')) || (base && base.getAttribute('target')) || '').toLowerCase();
      if (form && tg === '_top') { form.target = WORK_NAME; diag.alvo = '_top→quadro'; }
    }
    btn.click();

    /* Espera a lista aparecer (até 40 s) */
    var res = null, lastErr = 'sem quadro';
    for (var i = 0; i < 40; i++) {
      await wait(1000);
      try {
        var w = top;
        for (var j = 0; j < F_LISTA.length && w; j++) w = childFrame(w, F_LISTA[j]);
        if (!w) { lastErr = 'sem quadro da lista'; continue; }
        var d = docOf(w);
        if (isLogin(d)) throw new Error('login');
        if (d.readyState !== 'complete') { lastErr = 'carregando'; continue; }
        var r = extractRows(d);
        if (r.cols === 13 && r.rows.length) { if (res && res.rows.length === r.rows.length) { res = r; break; } res = r; }   /* 2 leituras iguais = terminou de carregar */
        else lastErr = 'colunas=' + r.cols + ' linhas=' + r.rows.length;
      } catch (e) { if (e.message === 'login') throw e; lastErr = e.message; }
    }
    if (!res) { diag.ral = { erro: lastErr, quadros: frameTree(top, 0) }; throw new Error('estrutura:lista'); }
    diag.ral = { cols: res.cols, linhas: res.rows.length };
    return toCsv(res, 13);
  }

  async function send(ral, rec) {
    var body = JSON.stringify({ token: CFG.token, ral: ral, rec: rec, by: 'Coletor (navegador) ' + VERSION });
    var r;
    try { r = await fetch(CFG.url + '/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }); }
    catch (e) { throw new Error('servidor:rede'); }
    if (r.status === 403) throw new Error('servidor:codigo');
    var j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j || j.ok === false) throw new Error('servidor:' + r.status + (j && (j.error || j.warn || j.erro) ? ':' + (j.error || j.warn || j.erro) : ''));
    return j;
  }

  var HELP = {
    login: ['Sessão do SIR encerrada', 'Volte à aba do SIR, faça login de novo e clique em "Coletar agora".'],
    origem: ['Esta janela não está no SIR', 'Feche esta janela, abra o SIR, faça login e clique no favorito "Coletor SIR" de novo.'],
    tempo: ['O SIR demorou para responder', 'Vou tentar de novo na próxima coleta.'],
    rede: ['Não consegui abrir a página do SIR', 'Confira se o SIR está abrindo normalmente nesta máquina.'],
    estrutura: ['A tela do SIR está diferente do esperado', 'Confira se você clicou no favorito estando na aba do SIR, já logado. Se sim, clique em "Copiar diagnóstico" e envie o texto para o Claude ajustar o coletor.'],
    formato: ['A lista do SIR veio com colunas diferentes', 'Confira se você clicou no favorito estando na aba do SIR, já logado. Se sim, clique em "Copiar diagnóstico" e envie o texto para o Claude ajustar o coletor.'],
    vazio: ['A lista do SIR veio vazia', 'Vou tentar de novo na próxima coleta.'],
    janela: ['A janela de trabalho foi fechada', 'Clique em "Usar janela separada" para abri-la de novo.'],
    servidor: ['Não consegui entregar ao seu servidor', '']
  };
  function explain(e) {
    var p = String(e && e.message || e).split(':'), h = HELP[p[0]] || ['Erro inesperado', String(e && e.message || e)];
    var help = h[1];
    if (p[0] === 'servidor') help = p[1] === 'codigo' ? 'O código do coletor não vale mais. Gere um novo no SIR Dashboard (rodapé → Fonte) e recrie o favorito.'
      : p[1] === 'rede' ? 'Esta máquina não alcançou o seu servidor na internet (pode ser bloqueio da rede). Clique em "Copiar diagnóstico" e envie ao Claude.'
      : 'Resposta do servidor: ' + p.slice(1).join(' ');
    return { title: h[0], help: help };
  }

  async function cycle() {
    if (running) return;
    running = true; clearTimeout(timer);
    status('run', 'Coletando no SIR…');
    diag = { versao: VERSION, em: new Date().toISOString(), pagina: location.host, modo: useWin ? 'janela' : 'embutido' };
    try {
      if (!CFG.url || !CFG.token) throw new Error('servidor:codigo');
      var rec = await collectRec();
      var ral = await collectRal();
      $('frames').innerHTML = '';
      status('run', 'Enviando para o seu servidor…');
      var j = await send(ral.csv, rec.csv);
      okCount++;
      diag.envio = j;
      $('k-last').textContent = hhmm(Date.now()); $('k-cnt').textContent = ral.n + ' / ' + rec.n; $('k-ok').textContent = okCount;
      status('ok', 'Funcionando — dados entregues às ' + hhmm(Date.now()));
      log('ok · RAL ' + ral.n + ' · REC ' + rec.n + (j.novos ? ' · ' + j.novos + ' ticket(s) novo(s)' : ''));
    } catch (e) {
      $('frames').innerHTML = '';
      diag.erro = String(e && e.message || e);
      var x = explain(e), kind = diag.erro.split(':')[0];
      status('err', x.title, x.help);
      /* Tela diferente no modo embutido → oferece tentar numa janela separada */
      if ((kind === 'estrutura' || kind === 'formato' || kind === 'janela') || useWin) showModeBtn();
      log('erro · ' + diag.erro);
    }
    running = false;
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (paused) { $('k-next').textContent = 'pausado'; return; }
    nextAt = Date.now() + EVERY_MS;
    $('k-next').textContent = hhmm(nextAt);
    timer = setTimeout(cycle, EVERY_MS);
  }

  function showModeBtn() {
    var bm = $('b-mode'); bm.style.display = '';
    bm.textContent = (useWin && workWin && !workWin.closed) ? 'Voltar ao modo embutido' : 'Usar janela separada';
  }
  $('b-mode').onclick = function () {
    if (useWin && workWin && !workWin.closed) {
      try { workWin.close(); } catch (e) {}
      workWin = null; useWin = false; try { localStorage.removeItem(LS_MODE); } catch (e) {}
    } else {
      /* aberta por um clique seu (o navegador só permite abrir janelas assim) */
      workWin = window.open(REC_PATH, WORK_NAME + 'Janela', 'width=520,height=360,left=0,top=0');
      if (!workWin) { status('err', 'O navegador bloqueou a janela', 'Permita pop-ups para o SIR e clique de novo.'); return; }
      useWin = true; try { localStorage.setItem(LS_MODE, 'win'); } catch (e) {}
      try { window.focus(); } catch (e) {}
    }
    this.style.display = 'none';
    setTimeout(cycle, 1500);
  };
  if (useWin) { status('err', 'Falta abrir a janela de trabalho', 'Este computador usa o modo "janela separada". Clique no botão abaixo para abri-la.'); }

  var paused = false;
  $('b-now').onclick = function () { cycle(); };
  $('b-stop').onclick = function () {
    paused = !paused; this.textContent = paused ? 'Retomar' : 'Pausar';
    if (paused) { clearTimeout(timer); $('k-next').textContent = 'pausado'; if (!running) status('', 'Pausado'); }
    else cycle();
  };
  $('b-diag').onclick = function () {
    /* Só estrutura e contagens — nenhum dado de ticket, nenhuma senha, nem o código do coletor */
    var txt = 'DIAGNÓSTICO COLETOR SIR\n' + JSON.stringify(diag, null, 1);
    var done = function () { log('diagnóstico copiado'); };
    try { navigator.clipboard.writeText(txt).then(done, fallback); } catch (e) { fallback(); }
    function fallback() { var t = doc.createElement('textarea'); t.value = txt; doc.body.appendChild(t); t.select(); try { doc.execCommand('copy'); done(); } catch (e) { log(txt); } t.remove(); }
  };
  /* Se o computador dormiu e voltou, coleta logo */
  doc.addEventListener('visibilitychange', function () { if (!paused && !running && nextAt && Date.now() > nextAt + 30000) cycle(); });
  setInterval(function () { if (!paused && !running && nextAt && Date.now() > nextAt + 60000) cycle(); }, 60000);

  if (useWin) showModeBtn(); else cycle();
})();
