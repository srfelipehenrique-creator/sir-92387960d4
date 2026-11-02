const MASCARAS_KEY   = 'minhas_variacoes_bw';
const NOME_KEY       = 'usuario_nome_bw';
const mascarasPadrao = ['EQUIPE ACIONADA, EM DESLOCAMENTO.'];

let variacoesMascara    = JSON.parse(localStorage.getItem(MASCARAS_KEY)) || mascarasPadrao;
let mascaraPreviewTimer = null;

function openMascaras() {
  const nome = localStorage.getItem(NOME_KEY) || '';
  document.getElementById('m_userName').value = nome;
  atualizarPreviewMascara(); atualizarChipsMascara();
  document.getElementById('mascaras-modal').classList.add('active');
  mascaraPreviewTimer = setInterval(atualizarPreviewMascara, 1000);
  document.getElementById('m_userName').focus();
}

function closeMascaras() {
  document.getElementById('mascaras-modal').classList.remove('active');
  if (mascaraPreviewTimer) { clearInterval(mascaraPreviewTimer); mascaraPreviewTimer = null; }
}

function obterHorarioArredondado() {
  const agora = new Date();
  let min = agora.getMinutes(), h = agora.getHours();
  const resto = min % 5;
  if (resto !== 0) min += (5 - resto);
  if (min >= 60) { min = 0; h += 1; }
  if (h >= 24) h = 0;
  return `@@ ${String(agora.getDate()).padStart(2,'0')}/${String(agora.getMonth()+1).padStart(2,'0')} ${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

function gerarMascaraBase() {
  const nome = (document.getElementById('m_userName').value || 'NOME').toUpperCase();
  return `${obterHorarioArredondado()} ${nome}:`;
}

function atualizarPreviewMascara() {
  const el = document.getElementById('m_preview');
  if (el) el.textContent = gerarMascaraBase();
}

function salvarNomeMascara() {
  localStorage.setItem(NOME_KEY, document.getElementById('m_userName').value.toUpperCase());
}

function copiarMascaraTexto(texto) {
  navigator.clipboard.writeText(texto).then(() => {
    const el = document.getElementById('m_lastCopied');
    if (el) el.textContent = texto.length > 60 ? texto.substring(0,60)+'…' : texto;
  });
}

function copiarMascaraVazia() {
  copiarMascaraTexto(gerarMascaraBase() + ' ');
  const btn = event?.target?.closest('button');
  if (btn) { const orig = btn.textContent; btn.textContent = '✓'; setTimeout(() => btn.textContent = orig, 1200); }
}

function copiarMascaraCustom() {
  const custom = document.getElementById('m_customText').value.trim();
  copiarMascaraTexto(`${gerarMascaraBase()} ${custom}`);
  const btn = document.querySelector('#mascaras-modal .btn-mascaras.primary');
  if (btn) { const orig = btn.textContent; btn.textContent = '✓ Copiado!'; btn.style.background = '#10b981'; btn.style.color = '#000'; btn.style.borderColor = '#10b981'; setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }, 1300); }
}

function copiarDoChipMascara(valor, chip) {
  copiarMascaraTexto(`${gerarMascaraBase()} ${valor}`);
  chip.classList.add('mcopiado');
  const txt = chip.querySelector('.mchip-text');
  const orig = txt.textContent; txt.textContent = '✓ Copiado';
  setTimeout(() => { chip.classList.remove('mcopiado'); txt.textContent = orig; }, 1000);
}

function limparMascaraCustom() {
  document.getElementById('m_customText').value = '';
  document.getElementById('m_customText').focus();
}

function atualizarChipsMascara() {
  const container = document.getElementById('m_chips');
  if (!container) return;
  if (!variacoesMascara.length) {
    container.innerHTML = `<span style="font-size:12px;color:#3d4754;font-style:italic;">Nenhuma variação. Adicione uma abaixo.</span>`;
    return;
  }
  container.innerHTML = '';
  variacoesMascara.forEach((v, idx) => {
    const display = v.length > 35 ? v.substring(0,35)+'…' : v;
    const chip = document.createElement('div');
    chip.className = 'mchip'; chip.title = v;
    chip.innerHTML = `<span class="mchip-text">${escapeHtml(display)}</span><button class="mchip-del" title="Excluir">×</button>`;
    chip.querySelector('.mchip-text').onclick = () => copiarDoChipMascara(v, chip);
    chip.querySelector('.mchip-del').onclick  = e => { e.stopPropagation(); deletarMascaraVariacao(idx); };
    container.appendChild(chip);
  });
}

function adicionarMascaraVariacao() {
  const inp  = document.getElementById('m_newVariation');
  const nova = inp.value.trim().toUpperCase();
  if (!nova) return;
  variacoesMascara.push(nova);
  localStorage.setItem(MASCARAS_KEY, JSON.stringify(variacoesMascara));
  inp.value = ''; inp.focus();
  atualizarChipsMascara();
}

function deletarMascaraVariacao(idx) {
  variacoesMascara.splice(idx, 1);
  localStorage.setItem(MASCARAS_KEY, JSON.stringify(variacoesMascara));
  atualizarChipsMascara();
}
