/* ══════════════════════════════════════════════════════════════
   Entrada animada do painel (v91)
   Toca a cada carregamento/recarga da página (F5, botão do navegador,
   abrir o app). Não toca nas atualizações automáticas de dados.
   - Fibras de luz correm até o núcleo, uma onda em anéis se espalha
     e a cortina some, revelando o painel.
   - Clique, toque, tecla ou "Pular" encerram na hora.
   - "Reduzir movimento" do aparelho: não toca.
   - Logo depois do login (a tela de acesso já mostrou): não repete.
   Precisa ser carregado logo após <body>, antes do resto do painel.
   ══════════════════════════════════════════════════════════════ */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { if (sessionStorage.getItem('sir_intro_skip') === '1') { sessionStorage.removeItem('sir_intro_skip'); return; } } catch (e) {}

  const claro = document.documentElement.getAttribute('data-mode') === 'light';
  const FUNDO = claro ? '#ECE8E1' : '#141414';
  const CORES = claro ? ['184,37,46', '120,104,90'] : ['229,9,20', '255,107,114'];
  const ANEL = claro ? '54,46,38' : '255,255,255';
  const DUR = 2000;

  const st = document.createElement('style');
  st.textContent =
    '#sir-intro{position:fixed;inset:0;z-index:2147483000;background:' + FUNDO + ';transition:opacity .6s cubic-bezier(.16,1,.3,1)}' +
    '#sir-intro.sai{opacity:0;pointer-events:none}' +
    '#sir-intro canvas{position:absolute;inset:0;width:100%;height:100%}' +
    '#sir-intro .nome{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.92);opacity:0;' +
      'font:700 13px "JetBrains Mono",ui-monospace,monospace;letter-spacing:5px;color:' + (claro ? '#17191d' : '#e2e2e2') + ';' +
      'transition:opacity .5s,transform .7s cubic-bezier(.16,1,.3,1);white-space:nowrap}' +
    '#sir-intro .nome.on{opacity:1;transform:translate(-50%,-50%) scale(1)}' +
    '#sir-intro button{position:absolute;right:20px;bottom:calc(20px + env(safe-area-inset-bottom));' +
      'font:600 12px Inter,system-ui,sans-serif;color:' + (claro ? 'rgba(23,25,29,.76)' : 'rgba(226,226,226,.8)') + ';' +
      'background:' + (claro ? '#fff' : '#1c1c1f') + ';border:1px solid ' + (claro ? 'rgba(15,23,42,.16)' : 'rgba(255,255,255,.14)') + ';' +
      'border-radius:999px;padding:9px 16px;cursor:pointer}' +
    '#sir-intro button:focus-visible{outline:2px solid #6366f1;outline-offset:2px}';
  document.head.appendChild(st);

  const ov = document.createElement('div');
  ov.id = 'sir-intro'; ov.setAttribute('aria-hidden', 'true');
  ov.innerHTML = '<canvas></canvas><div class="nome">SIR · COP REDE</div><button type="button">Pular</button>';
  (document.body || document.documentElement).appendChild(ov);
  /* trava extra: se algo der erro abaixo, a cortina sai sozinha e o painel nunca fica coberto */
  setTimeout(() => { if (ov.isConnected) { ov.remove(); st.remove(); } }, DUR + 2500);
  const cv = ov.querySelector('canvas'), cx = cv.getContext('2d'), nome = ov.querySelector('.nome');

  let W, H, R, fibras = [], t0 = 0, raf = 0, fim = false;
  function medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight; R = Math.hypot(W, H) / 2;
    cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  medir();
  const n = W < 600 ? 14 : 22;
  for (let i = 0; i < n; i++) fibras.push({
    a: (i / n) * Math.PI * 2 + Math.random() * 0.35, curva: (Math.random() - 0.5) * 0.9,
    atraso: Math.random() * 0.35, vel: 0.75 + Math.random() * 0.5, cor: Math.random() < 0.7 ? 0 : 1
  });
  const ponto = (f, s) => {
    const r = R * (1 - s) + 34 * s, ang = f.a + f.curva * (1 - s) * (1 - s);
    return [W / 2 + Math.cos(ang) * r, H / 2 + Math.sin(ang) * r];
  };
  function fibra(f, cab, comp) {
    const ini = Math.max(0, cab - comp), fimS = Math.min(1, cab), c = CORES[f.cor];
    const a = ponto(f, ini), b = ponto(f, fimS), g = cx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, 'rgba(' + c + ',0)'); g.addColorStop(1, 'rgba(' + c + ',.95)');
    cx.beginPath();
    for (let k = 0; k <= 12; k++) { const p = ponto(f, ini + (fimS - ini) * k / 12); k ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }
    cx.strokeStyle = g; cx.lineWidth = 2; cx.lineCap = 'round';
    cx.shadowColor = 'rgba(' + c + ',.9)'; cx.shadowBlur = 12; cx.stroke(); cx.shadowBlur = 0;
  }

  function quadro(now) {
    const t = (now - t0) / DUR;
    cx.clearRect(0, 0, W, H);
    for (let i = 1; i <= 7; i++) {                         /* anéis de fundo */
      cx.beginPath(); cx.arc(W / 2, H / 2, (60 + i * i * 14) * (1 + 0.06 * (1 - Math.min(1, t))), 0, Math.PI * 2);
      cx.strokeStyle = 'rgba(' + ANEL + ',' + Math.min(1, t * 3) * (0.09 - i * 0.008) + ')'; cx.lineWidth = 1.5; cx.stroke();
    }
    fibras.forEach(f => { const c = (t / 0.65 - f.atraso) * f.vel * 1.4; if (c > 0 && c < 1.35) fibra(f, c, 0.35); });
    const carga = Math.max(0, Math.min(1, (t - 0.35) / 0.3));
    if (carga > 0) {                                        /* núcleo acende */
      const g = cx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 70 + 40 * carga);
      g.addColorStop(0, 'rgba(' + CORES[0] + ',' + 0.5 * carga + ')'); g.addColorStop(1, 'rgba(' + CORES[0] + ',0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(W / 2, H / 2, 110, 0, Math.PI * 2); cx.fill();
    }
    if (t > 0.5) nome.classList.add('on');
    if (t > 0.65) {                                         /* onda em anéis */
      const u = (t - 0.65) / 0.35;
      for (let k = 0; k < 3; k++) {
        const v = u - k * 0.12; if (v <= 0) continue;
        cx.beginPath(); cx.arc(W / 2, H / 2, 40 + v * R, 0, Math.PI * 2);
        cx.strokeStyle = 'rgba(' + CORES[1] + ',' + 0.5 * (1 - v) + ')'; cx.lineWidth = 2.5 - k * 0.6; cx.stroke();
      }
    }
    if (t >= 1) { encerrar(); return; }
    raf = requestAnimationFrame(quadro);
  }

  function encerrar() {
    if (fim) return; fim = true;
    ['pointerdown', 'keydown'].forEach(ev => removeEventListener(ev, pular, true));
    removeEventListener('resize', medir);
    ov.classList.add('sai');
    setTimeout(() => { cancelAnimationFrame(raf); ov.remove(); st.remove(); }, 650);
  }
  function pular(e) { if (e.type === 'keydown' && e.key === 'Tab') return; encerrar(); }

  addEventListener('resize', medir);
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, pular, true));
  ov.querySelector('button').addEventListener('click', encerrar);
  setTimeout(encerrar, DUR + 1500);   /* rede de segurança: aba em 2º plano não deixa a cortina presa */
  t0 = performance.now();
  raf = requestAnimationFrame(quadro);
})();
