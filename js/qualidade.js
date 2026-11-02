/* ── RALs de Qualidade ── Módulo de acompanhamento e análise ── */

const LS_QUALIDADE = 'sir_qualidade_v1';

let qualidadeItems = [];   /* [{ticket, designacao, cfOrigem, abertura}] */
let qlSelectedCf   = 'ALL';

/* ── Dados vindos do parser ── */
function buildQualidadeData(qualidadeDetails) {
  const seen = new Set();
  qualidadeItems = [];

  for (const pattern in qualidadeDetails) {
    for (const item of (qualidadeDetails[pattern] || [])) {
      const uid = `${item.cfOrigem}::${item.ticket}`;
      if (!seen.has(uid)) {
        seen.add(uid);
        qualidadeItems.push(item);
      }
    }
  }

  /* Mais antigos primeiro (mais dias em tela = mais urgente) */
  qualidadeItems.sort((a, b) => calcDiasEmTela(b.abertura) - calcDiasEmTela(a.abertura));

  _updateQlIndicators();
}

function _updateQlIndicators() {
  const n        = qualidadeItems.length;
  const critical = qualidadeItems.filter(i => calcDiasEmTela(i.abertura) >= 7).length;

  /* Badge no botão do toolbar */
  document.querySelectorAll('.tool-group-btn').forEach(btn => {
    if ((btn.getAttribute('onclick') || '').includes('openQualidade')) {
      let badge = btn.querySelector('.ql-tb-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ql-tb-badge';
        btn.appendChild(badge);
      }
      badge.textContent = n;
      badge.style.display = n ? '' : 'none';
    }
  });

  /* Easter egg no rodapé */
  const trigger  = document.getElementById('footer-ql-trigger');
  const countEl  = document.getElementById('footer-ql-count');
  if (!trigger) return;

  trigger.classList.toggle('ql-has-rals',     n > 0);
  trigger.classList.toggle('ql-has-critical', critical > 0);

  if (countEl) {
    countEl.textContent     = n;
    countEl.style.display   = n ? '' : 'none';
  }
}

/* ── Persistência ── */
function _qlKey(item) {
  return `${item.cfOrigem}::${item.ticket}`.replace(/[^A-Za-z0-9:./-]/g, '_');
}

function _loadQlData() {
  try { return JSON.parse(localStorage.getItem(LS_QUALIDADE) || '{}'); }
  catch { return {}; }
}

function saveQlField(key, field, value) {
  const data = _loadQlData();
  if (!data[key]) data[key] = {};
  data[key][field] = value;
  data[key]._updatedAt = Date.now();
  localStorage.setItem(LS_QUALIDADE, JSON.stringify(data));
}

/* ── Data util ── */
function calcDiasEmTela(abertura) {
  if (!abertura) return 0;
  /* Tenta extrair "dd/mm/yyyy" do início da string */
  const m = String(abertura).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return 0;
  const abDate = new Date(+m[3], +m[2] - 1, +m[1]);
  if (isNaN(abDate.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - abDate) / 86400000));
}

/* ── Modal: abrir / fechar ── */
let _qlClickBound = false;
function openQualidade() {
  qlSelectedCf = 'ALL';
  renderQlSidebar();
  renderQlCards();
  document.getElementById('qualidade-modal').classList.add('active');
  if (!_qlClickBound) {
    const area = document.getElementById('ql-cards-area');
    if (area) {
      area.addEventListener('click', e => {
        const tl = e.target.closest('.ticket-link');
        if (tl && tl.dataset.url) { e.stopPropagation(); openTicketWindow(tl.dataset.url); }
      });
      _qlClickBound = true;
    }
  }
}

function closeQualidade() {
  document.getElementById('qualidade-modal').classList.remove('active');
  const sumOv = document.getElementById('ql-summary-overlay');
  if (sumOv) sumOv.remove();
}

function selectQlCf(cf) {
  qlSelectedCf = cf;
  renderQlSidebar();
  renderQlCards();
}

/* ── Sidebar ── */
function renderQlSidebar() {
  const sidebar = document.getElementById('ql-sidebar');
  if (!sidebar) return;

  const total = qualidadeItems.length;
  let html = `
    <button class="ql-cf-btn${qlSelectedCf === 'ALL' ? ' ql-cf-active' : ''}"
            onclick="selectQlCf('ALL')">
      <span class="ql-cf-btn-name" style="font-weight:600;">Todos os CFs</span>
      <span class="ql-cf-btn-count">${total}</span>
    </button>`;

  for (const reg in REGIONS) {
    const cfKeys = Object.keys(REGIONS[reg]);
    const regHasItems = cfKeys.some(cf => qualidadeItems.some(i => i.cfOrigem === cf));
    if (!regHasItems) continue;

    html += `<div class="ql-region-sep">${escapeHtml(reg)}</div>`;

    for (const cf of cfKeys) {
      const count = qualidadeItems.filter(i => i.cfOrigem === cf).length;
      if (!count) continue;
      const critCount = qualidadeItems.filter(i => i.cfOrigem === cf && calcDiasEmTela(i.abertura) >= 7).length;

      html += `
        <button class="ql-cf-btn${qlSelectedCf === cf ? ' ql-cf-active' : ''}"
                onclick="selectQlCf('${cf}')">
          <div class="ql-cf-btn-info">
            <span class="ql-cf-btn-code">${cf}</span>
            <span class="ql-cf-btn-fname">${escapeHtml(CF_NAMES[cf] || '')}</span>
          </div>
          <div class="ql-cf-btn-meta">
            ${critCount ? `<span class="ql-urgency-dot" title="${critCount} crítica(s)"></span>` : ''}
            <span class="ql-cf-btn-count">${count}</span>
          </div>
        </button>`;
    }
  }

  sidebar.innerHTML = html;
}

/* ── Cards ── */
function renderQlCards() {
  const area = document.getElementById('ql-cards-area');
  if (!area) return;

  const items = qlSelectedCf === 'ALL'
    ? qualidadeItems
    : qualidadeItems.filter(i => i.cfOrigem === qlSelectedCf);

  if (!items.length) {
    area.innerHTML = `
      <div class="ql-empty">
        <i data-lucide="check-circle-2"></i>
        <p>Nenhuma RAL de Qualidade em tela${qlSelectedCf !== 'ALL' ? ' para esta CF' : ''}.</p>
      </div>`;
    if (typeof lucide !== 'undefined')
      lucide.createIcons({ nodes: Array.from(area.querySelectorAll('[data-lucide]')) });
    return;
  }

  const saved = _loadQlData();
  let html = '';

  if (qlSelectedCf === 'ALL') {
    /* Visão resumida — só lista de CFs com count + botão resumo */
    const byCf = {};
    items.forEach(i => { (byCf[i.cfOrigem] = byCf[i.cfOrigem] || []).push(i); });
    html += '<div class="ql-all-list">';
    for (const reg in REGIONS) {
      const cfKeys = Object.keys(REGIONS[reg]).filter(cf => byCf[cf]);
      if (!cfKeys.length) continue;
      html += `<div class="ql-all-region">${escapeHtml(reg)}</div>`;
      for (const cf of cfKeys) {
        const cnt = byCf[cf].length;
        const crit = byCf[cf].filter(i => calcDiasEmTela(i.abertura) >= 7).length;
        html += `
          <div class="ql-all-row">
            <div class="ql-all-row-info">
              <span class="ql-all-cf-code">${cf}</span>
              <span class="ql-all-cf-name">${escapeHtml(CF_NAMES[cf] || '')}</span>
              ${crit ? `<span class="ql-all-crit" title="${crit} crítica(s) ≥7d">●</span>` : ''}
            </div>
            <div class="ql-all-row-right">
              <span class="ql-all-count">${cnt} RAL${cnt !== 1 ? 's' : ''}</span>
              <button class="ql-gen-btn" onclick="openQlSummary('${cf}')">
                <i data-lucide="clipboard-list"></i> Gerar resumo
              </button>
              <button class="ql-view-btn" onclick="selectQlCf('${cf}')">
                <i data-lucide="eye"></i> Ver RALs
              </button>
            </div>
          </div>`;
      }
    }
    html += '</div>';
  } else {
    html += _qlGroupHeader(qlSelectedCf, items.length);
    items.forEach(item => { html += _renderQlCard(item, saved); });
  }

  area.innerHTML = html;
  if (typeof lucide !== 'undefined')
    lucide.createIcons({ nodes: Array.from(area.querySelectorAll('[data-lucide]')) });
}

function _qlGroupHeader(cf, count) {
  return `
    <div class="ql-group-hd">
      <div class="ql-group-hd-left">
        <span class="ql-group-cf-code">${cf}</span>
        <span class="ql-group-cf-name">${escapeHtml(CF_NAMES[cf] || '')}</span>
        <span class="ql-group-count">${count} RAL${count !== 1 ? 's' : ''}</span>
      </div>
      <button class="ql-gen-btn" onclick="openQlSummary('${cf}')">
        <i data-lucide="clipboard-list"></i>
        Gerar resumo
      </button>
    </div>`;
}

function toggleQlCard(hd, ev) {
  if (ev && ev.target.closest('.ticket-link')) return;
  hd.closest('.ql-card').classList.toggle('ql-open');
}

function _renderQlCard(item, saved) {
  const key      = _qlKey(item);
  const s        = saved[key] || {};
  const dias     = calcDiasEmTela(item.abertura);
  const urgClass = dias >= 7 ? 'ql-urg-high' : dias >= 3 ? 'ql-urg-mid' : 'ql-urg-low';
  const diasTxt  = dias === 0 ? 'hoje' : `${dias}d`;

  const tecOpts = [
    '', 'TELLABS', 'CISCO', 'PADTEC', 'NOKIA', 'HUAWEI', 'ZTE', 'LUCENT', 'OLT', 'NODEB', 'IPRAN', 'DATACOM', 'OUTROS',
  ];
  const stOpts = [
    ['', '— Selecionar —'],
    ['EM ANÁLISE',          'EM ANÁLISE'],
    ['AGUARDANDO RETORNO',  'AGUARDANDO RETORNO'],
    ['PLANO EM EXECUÇÃO',   'PLANO EM EXECUÇÃO'],
    ['INDEFINIDO',          'INDEFINIDO'],
  ];
  const motivoOpts = [
    '', 'ALTA REINCIÊNCIA', 'DEGRADAÇÃO', 'SPANLOSS',
    'FORA DO LIMIAR', 'LOSS', 'TAXANDO ERROS',
  ];

  return `
    <div class="ql-card ${urgClass}">

      <!-- Cabeçalho clicável — sempre visível -->
      <div class="ql-card-hd" onclick="toggleQlCard(this,event)" title="Clique para expandir / minimizar">
        <div class="ql-card-auto">
          <span class="ql-h-ticket">${makeTicketHTML(item.ticket, true, item.designacao)}</span>
          <span class="ql-h-desig">${escapeHtml(item.designacao)}</span>
          <span class="ql-h-abertura">${escapeHtml(item.abertura || '—')}</span>
          <span class="ql-h-dias ${urgClass}">${diasTxt}</span>
        </div>
        <i data-lucide="chevron-down" class="ql-card-chevron"></i>
      </div>

      <!-- Formulário de análise — oculto até expandir -->
      <div class="ql-card-form">
        <div class="ql-form-inner">

          <div class="ql-field-row ql-row-2">
            <div>
              <label class="ql-label">Motivo de Abertura</label>
              <select class="ql-select" onchange="saveQlField('${key}','motivo',this.value)">
                ${motivoOpts.map(o =>
                  `<option value="${o}" ${s.motivo === o ? 'selected' : ''}>${o || '— Selecionar —'}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="ql-label">Tecnologia</label>
              <select class="ql-select" onchange="saveQlField('${key}','tecnologia',this.value)">
                ${tecOpts.map(o =>
                  `<option value="${o}" ${s.tecnologia === o ? 'selected' : ''}>${o || '— Selecionar —'}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="ql-field-row">
            <label class="ql-label">Status</label>
            <select class="ql-select ql-status-sel"
                    data-status="${escapeHtml(s.status || '')}"
                    onchange="saveQlField('${key}','status',this.value);this.dataset.status=this.value;">
              ${stOpts.map(([v, l]) =>
                `<option value="${v}" ${s.status === v ? 'selected' : ''}>${l}</option>`
              ).join('')}
            </select>
          </div>

          <div class="ql-field-row">
            <label class="ql-label">Observação</label>
            <input class="ql-input" type="text"
                   value="${escapeHtml(s.observacao || '')}"
                   placeholder="Situação atual, impacto, informações relevantes..."
                   onchange="saveQlField('${key}','observacao',this.value)">
          </div>

          <div class="ql-field-row">
            <label class="ql-label">Plano de Ação</label>
            <textarea class="ql-textarea" rows="2"
                      placeholder="Próximos passos, responsável, previsão de resolução..."
                      onchange="saveQlField('${key}','planoAcao',this.value)">${escapeHtml(s.planoAcao || '')}</textarea>
          </div>

        </div>
      </div>

    </div>`;
}

/* ── Resumo para coordenador ── */
function openQlSummary(cf) {
  const items = qualidadeItems.filter(i => i.cfOrigem === cf);
  if (!items.length) return;

  const saved   = _loadQlData();
  const cfName  = CF_NAMES[cf] || cf;
  const date    = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time    = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const stLabel = {
    'sem-plano':   'Sem plano de ação',
    'aguardando':  'Aguardando responsável',
    'em-execucao': 'Plano em execução',
    'concluida':   'Concluída / aguardando fechamento',
  };

  let text = `RELATÓRIO DE QUALIDADE — ${cf} | ${cfName}\n`;
  text += `Data: ${date} às ${time}  |  ${items.length} RAL${items.length !== 1 ? 's' : ''} em tela\n`;
  text += `${'─'.repeat(52)}\n\n`;

  items.forEach((item, idx) => {
    const key  = _qlKey(item);
    const s    = saved[key] || {};
    const dias = calcDiasEmTela(item.abertura);
    const st   = stLabel[s.status] || 'Não classificada';

    text += `${idx + 1}. ${item.ticket}\n`;
    text += `   Designação : ${item.designacao}\n`;
    text += `   Dias em tela: ${dias} dia${dias !== 1 ? 's' : ''} (abertura: ${item.abertura || '—'})\n`;
    if (s.tecnologia) text += `   Tecnologia : ${s.tecnologia}\n`;
    if (s.motivo)     text += `   Motivo      : ${s.motivo}\n`;
    text += `   Status      : ${st}\n`;
    if (s.observacao) text += `   Observação  : ${s.observacao}\n`;
    if (s.planoAcao)  text += `   Plano       : ${s.planoAcao}\n`;
    text += '\n';
  });

  text += `${'─'.repeat(52)}\n`;
  text += `Gerado por SIR Dashboard — COP REDE FIBRA RJ/ES`;

  /* Overlay de cópia */
  let overlay = document.getElementById('ql-summary-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'ql-summary-overlay';
  overlay.className = 'ql-summary-overlay';
  overlay.addEventListener('click', () => overlay.remove());

  overlay.innerHTML = `
    <div class="ql-summary-box" onclick="event.stopPropagation()">
      <div class="ql-summary-hd">
        <div>
          <div class="ql-summary-title">Resumo — ${cf} | ${escapeHtml(cfName)}</div>
          <div class="ql-summary-sub">Texto pronto para envio ao coordenador da CF</div>
        </div>
        <button class="ql-summary-close" onclick="document.getElementById('ql-summary-overlay').remove()">&times;</button>
      </div>
      <textarea class="ql-summary-ta" id="ql-summary-text" readonly spellcheck="false">${escapeHtml(text)}</textarea>
      <div class="ql-summary-ft">
        <span class="ql-summary-hint">Copie e cole no canal do coordenador de ${cf}.</span>
        <button class="ql-copy-btn" onclick="copyQlSummary()">
          <i data-lucide="copy"></i>
          Copiar texto
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined')
    lucide.createIcons({ nodes: Array.from(overlay.querySelectorAll('[data-lucide]')) });
}

function copyQlSummary() {
  const ta = document.getElementById('ql-summary-text');
  if (!ta) return;
  navigator.clipboard.writeText(ta.value)
    .then(() => {
      if (typeof showActionToast === 'function')
        showActionToast('Resumo copiado para a área de transferência!', 'success');
    })
    .catch(() => {
      ta.select();
      document.execCommand('copy');
      if (typeof showActionToast === 'function')
        showActionToast('Resumo copiado!', 'success');
    });
}
