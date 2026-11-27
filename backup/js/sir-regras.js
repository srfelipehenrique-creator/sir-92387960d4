/* ══════════════════════════════════════════════════════════════
   Regras do SIR (Auto Embratel adaptado ao SIR Dashboard)
   Áreas (Espírito Santo incl. ESRC, Rio A, Rio B), SLA (RAL 6h / REC 4h),
   Critel, links do SIR (REDE 1 e REDE 2), Rota de Ação, Plantão e Voz.
   ══════════════════════════════════════════════════════════════ */
'use strict';

(function (root) {
  const MIN = 60000;
  const DP = 'DP';

  const SIR_REDES = {
    rede1: {
      id: 'rede1',
      nome: 'REDE 1',
      origem: 'http://10.13.54.150:20020',
      url: 'http://10.13.54.150:20020/index.cfm?nofoc=yes',
      host: '10.13.54.150:20020',
      desc: 'SIR Intranet · REDE 1 (nofoc=yes)'
    },
    rede2: {
      id: 'rede2',
      nome: 'REDE 2',
      origem: 'http://10.53.224.155',
      url: 'http://10.53.224.155/index.cfm?finalizada=sim',
      host: '10.53.224.155',
      desc: 'SIR Intranet · REDE 2 (finalizada=sim)'
    }
  };

  const GRUPOS = [
    {
      cod: 'G_ES', nome: 'Espírito Santo', rotulo: 'ES',
      regioes: [
        { cod: 'MTN',  nome: 'Metropolitana Norte - ES', cfs: ['RT/VTA /MTN/FFA/FO'] },
        { cod: 'MTS',  nome: 'Metropolitana Sul - ES',   cfs: ['RT/VTA /MTS/FFA/FO'] },
        { cod: 'NOR',  nome: 'Norte - ES',               cfs: ['RT/VTA /NOR/FFA/FO'] },
        { cod: 'SUL',  nome: 'Sul - ES',                 cfs: ['RT/VTA /SUL/FFA/FO'] },
        { cod: 'ESRC', nome: 'RC-ES - ES',               cfs: ['RC/VTA /MTP/NET/FO', 'RC/VTA /SUL/NET/FO', 'RC/VTA /NOR/NET/FO', 'RC/VTA /JM/NET/FO'] }
      ]
    },
    {
      cod: 'G_RIOA', nome: 'Rio A', rotulo: 'RIO A',
      regioes: [
        { cod: 'SUF', nome: 'Sul Fluminense - RJ',    cfs: ['RT/RJO /SUF/NET/FO', 'RC/RJO /SUF/NET/FO'] },
        { cod: 'SEF', nome: 'Serra Fluminense - RJ',  cfs: ['RT/RJO /SEF/NET/FO', 'RC/RJO /SEF/NET/FO'] },
        { cod: 'NOF', nome: 'Norte Fluminense - RJ',  cfs: ['RT/RJO /NOF/NET/FO', 'RC/RJO /NOF/NET/FO'] },
        { cod: 'LGS', nome: 'Região Lagos - RJ',      cfs: ['RT/RJO /LGS/NET/FO', 'RC/RJO /LGS/NET/FO'] },
        { cod: 'CZS', nome: 'Centro Zona Sul - RJ',   cfs: ['RT/RJO /CZS/NET/FO', 'RC/RJO /CZS/NET/FO'] },
        { cod: 'SU2', nome: 'Sul 2 - RJ',             cfs: ['RT/RJO /SU2/NET/FO', 'RC/RJO /SU2/NET/FO'] },
        { cod: 'OE1', nome: 'Oeste - RJ',             cfs: ['RT/RJO /OE1/NET/FO', 'RC/RJO /OE1/NET/FO'] }
      ]
    },
    {
      cod: 'G_RIOB', nome: 'Rio B', rotulo: 'RIO B',
      regioes: [
        { cod: 'NO1', nome: 'Norte 1 - RJ',            cfs: ['RT/RJO /NO1/NET/FO', 'RC/RJO /NO1/NET/FO'] },
        { cod: 'NO2', nome: 'Norte 2 - RJ',            cfs: ['RT/RJO /NO2/NET/FO', 'RC/RJO /NO2/NET/FO'] },
        { cod: 'BX1', nome: 'Baixada Fluminense - RJ', cfs: ['RT/RJO /BX1/NET/FO', 'RC/RJO /BX1/NET/FO'] },
        { cod: 'MTP', nome: 'Metropolitana - RJ',      cfs: ['RT/RJO /MTP/NET/FO', 'RC/RJO /MTP/NET/FO'] },
        { cod: 'NO3', nome: 'Norte 3',                 cfs: ['RT/RJO /NO3/PCS/FO', 'RC/RJO /NO3/NET/FO'] }
      ]
    }
  ];

  const NOMES = {};
  GRUPOS.forEach(g => g.regioes.forEach(r => { NOMES[r.cod] = r.nome; }));
  const AREAS = GRUPOS.flatMap(g => g.regioes.map(r => r.cod));

  const SLA_MIN = { RAL: 6 * 60, REC: 4 * 60 };
  const SLA_ALERTA_MIN = { RAL: 30, REC: 30 };

  const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const p2 = n => String(n).padStart(2, '0');

  function parseAberturaMs(txt) {
    const s = String(txt || '').trim();
    if (!s) return null;
    const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*-?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const ano = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      return new Date(ano, +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)).getTime();
    }
    const m2 = s.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (m2) {
      const agora = new Date();
      const d = new Date(agora.getFullYear(), +m2[2] - 1, +m2[1], +m2[3], +m2[4]);
      if (d.getTime() - agora.getTime() > 180 * 86400000) d.setFullYear(d.getFullYear() - 1);
      return d.getTime();
    }
    return null;
  }

  function parseDuracaoMs(txt) {
    const s = String(txt || '').trim();
    if (!s) return null;
    const m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (m) return (+m[1] * 3600 + +m[2] * 60 + +(m[3] || 0)) * 1000;
    const d = s.match(/(\d+)\s*d/i), h = s.match(/(\d+)\s*h/i), min = s.match(/(\d+)\s*m/i);
    if (d || h || min) return ((d ? +d[1] * 1440 : 0) + (h ? +h[1] * 60 : 0) + (min ? +min[1] : 0)) * MIN;
    return null;
  }

  function slaRestante(it, agora) {
    if (it.ab == null) return null;
    return (SLA_MIN[it.tipo] || SLA_MIN.RAL) - ((agora || Date.now()) - it.ab) / MIN;
  }

  function nivelSLA(minRestante, tipo) {
    if (minRestante == null || !isFinite(minRestante)) return null;
    if (minRestante < 0) return 2;
    return minRestante <= (SLA_ALERTA_MIN[tipo] ?? 30) ? 1 : 0;
  }

  function tempoCurto(ms) {
    const min = Math.max(0, Math.round(ms / MIN));
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    if (d) return `${d}d${h ? ' ' + h + 'h' : ''}`;
    if (h) return m ? `${h}h${p2(m)}` : `${h}h`;
    return `${m}min`;
  }

  function formatSlaPill(minRestante) {
    if (minRestante == null || !isFinite(minRestante)) return '—';
    const abs = Math.abs(Math.round(minRestante));
    const h = Math.floor(abs / 60), m = abs % 60;
    const txt = h ? `${h}h${p2(m)}` : `${m}m`;
    return minRestante < 0 ? `-${txt}` : txt;
  }

  function cfResumido(cfRaw, cod) {
    const raw = String(cfRaw || '').trim();
    if (cod === DP || raw.toUpperCase().startsWith('DP/')) {
      const p = raw.split('/').map(s => s.trim());
      if (p[1]) return 'DP ' + (p[1].toUpperCase() === 'VTA' ? 'ES' : p[1].toUpperCase());
      return 'DP RJO';
    }
    const p = raw.split('/').map(s => s.trim());
    if (p.length >= 3 && (p[0] === 'RT' || p[0] === 'RC')) return `${p[0]} ${cod || p[2]}`;
    return cod || raw || '—';
  }

  const CRITEL = 'http://200.255.253.12/grb/critel/index.php?submitted=1&mcid=&query=';
  const CRITEL_FIM = '&cliente=1&backbone=1&grafico=0&exibir=designacao&agrupar=nao&range=0.25&tipo=medias&plotar=1';

  function designacaoCritel(desig) {
    const d = String(desig || '').trim().toUpperCase();
    if (/^\d{4,}$/.test(d)) return d;
    const semEsp = d.replace(/\s*\/\s*/g, '/');
    return /^[A-Z0-9]{2,8}\/[A-Z0-9]{2,6}\/[A-Z0-9]{2,}$/.test(semEsp) ? semEsp : null;
  }

  function urlCritel(designacoes) {
    const lista = [].concat(designacoes).filter(Boolean);
    if (!lista.length) return CRITEL + CRITEL_FIM;
    return CRITEL + encodeURIComponent(lista.join(' OU ')) + CRITEL_FIM;
  }

  const RECUPERACAO_ANO = { 2024: 15664557, 2025: 16465018, 2026: 17267511 };
  function recuperacaoDe(ticket) {
    const m = String(ticket || '').match(/(\d+)\s*\/\s*(\d{4})/);
    if (!m) return null;
    const ano = Number(m[2]), anos = Object.keys(RECUPERACAO_ANO).map(Number);
    const perto = anos.reduce((a, b) => Math.abs(b - ano) < Math.abs(a - ano) ? b : a);
    const soma = RECUPERACAO_ANO[ano] != null ? RECUPERACAO_ANO[ano] : RECUPERACAO_ANO[perto] + (ano - perto) * 801000;
    return String(Number(m[1]) + soma);
  }

  function urlDoTicket(it, redeId) {
    const rede = SIR_REDES[redeId] || SIR_REDES.rede1;
    const m = String(it.num || it.ticket || '').trim().match(/^(RAL|REC)-(\d+)\/(\d{4})$/i);
    if (!m) return rede.url;
    const tipo = m[1].toUpperCase(), num = m[2], ano = m[3];
    const rec = it.rec || recuperacaoDe(`${tipo}-${num}/${ano}`);
    const base = rede.origem + '/navegacao/';
    if (tipo === 'RAL') {
      return `${base}framesetNivel2TarefaRal.cfm?iorigem=Consulta&tipo=RAL&num_recup=${num}&ano_recup=${ano}&recuperacao=${rec}&acaoDesc=&flag=999`;
    }
    return `${base}framesetNivel2TarefaRec.cfm?exibe_msg=SIM&iorigem=Consulta&itemAtual=${encodeURIComponent(/^\d+$/.test(it.item || '') ? it.item : '1')}&tipo=REC&num_recup=${num}&designacao=${encodeURIComponent(it.desig || it.designacao || '')}&ano_recup=${ano}&recuperacao=${rec}&acaoDesc=&flag=999`;
  }

  /* Pronúncia limpa para síntese de voz (Web Speech API) */
  const PRONUNCIA = [
    [/\bRECs\b/g, 'reks'], [/\bREC\b/g, 'rek'], [/\bRALs\b/g, 'raus'], [/\bRAL\b/g, 'rau'],
    [/\bDP\b/g, 'D P'], [/\bCFs?\b/g, 'C F'], [/\bSLA\b/g, 'S L A'],
    [/\bRC\b/g, 'R C'], [/\bES\b/g, 'Espírito Santo'], [/\bRJ\b/g, 'Rio de Janeiro']
  ];
  const textoParaFala = t => PRONUNCIA.reduce((s, [re, dito]) => s.replace(re, dito), String(t || ''));

  function falar(texto) {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(textoParaFala(texto));
      u.lang = 'pt-BR';
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* Converte dados ativos do SIR Dashboard (modalData + qualidadeItems + appState.sirExtra)
     no formato unificado usado por Visualização SIR e Painel Geral */
  function coletarItensAtivos() {
    const agora = Date.now();
    const out = { RAL: [], REC: [], DP: [], QUAL: [] };
    const seen = { RAL: new Set(), REC: new Set() };

    const getState = (tk, item) => {
      try {
        if (typeof makeIdentity === 'function' && typeof appState !== 'undefined' && appState.ticketStates) {
          return appState.ticketStates[makeIdentity(tk, item)] || {};
        }
      } catch (e) {}
      return {};
    };

    const classifStatus = (nota, obs, tagKey) => {
      const txt = String(nota || '').trim();
      const obsObj = (typeof OBS_STATUSES !== 'undefined' ? OBS_STATUSES : []).find(o => o.key === obs);
      if (obsObj) {
        const cls = obs === 'area-de-risco' ? 'so-st-risco' : obs === 'sem-acesso' ? 'so-st-acesso' : 'so-st-ped';
        return { st: cls, sr: obsObj.label, sd: txt || obsObj.label };
      }
      if (txt) {
        const n = semAcento(txt).toUpperCase();
        let cls = 'so-st-ped';
        if (/\bVIDE\b/.test(n)) cls = 'so-st-vide';
        else if (/INDISP/.test(n)) cls = 'so-st-indisp';
        else if (/RISC/.test(n)) cls = 'so-st-risco';
        else if (/\bACESSO\b/.test(n)) cls = 'so-st-acesso';
        else if (/AGEND|#\s*AGE|\bAGE\b/.test(n)) cls = /PEND|REAGEND/.test(n) ? 'so-st-pend' : 'so-st-age';
        else if (/#\s*TEC|\bTEC\b|TECNIC|ACIONAD/.test(n)) cls = 'so-st-tec';
        else if (/#\s*VAL|\bVAL\b|VALIDA/.test(n)) cls = 'so-st-val';
        return { st: cls, sr: txt.length > 42 ? txt.slice(0, 41).trim() + '…' : txt, sd: txt };
      }
      if (tagKey && typeof getTicketTag === 'function') {
        const t = getTicketTag(tagKey);
        if (t) return { st: 'so-st-tec', sr: t.label, sd: t.label };
      }
      return { st: 'so-st-fora', sr: 'SEM INFORMAÇÃO', sd: 'Sem nota ou classificação registrada' };
    };

    const normalizar = (raw, tipo, codOverride, isQual) => {
      const tk = tipo.toLowerCase();
      const num = String(raw.ticket || 'N/D').trim();
      const cod = codOverride || raw.cfOrigem || 'OUTROS';
      const stObj = getState(tk, raw);
      const ab = parseAberturaMs(raw.abertura);
      const durMs = parseDuracaoMs(raw.duracao);
      const cfDesde = durMs != null ? (agora - durMs) : ab;
      const status = classifStatus(stObj.note, stObj.obsStatus, stObj.eventColor);
      const assoc = Array.isArray(raw.recs) ? raw.recs : [];
      return {
        num,
        chave: `${tipo}|${num}|${cod}`,
        tipo,
        cod,
        cf: cfResumido(raw.cfRaw, cod),
        cfRaw: raw.cfRaw || cod,
        desig: String(raw.designacao || 'N/D').trim(),
        ex: isQual ? 'QUALIDADE' : String(raw.extra || 'N/D').trim(),
        abertura: raw.abertura || '',
        ab,
        duracao: raw.duracao || '',
        cfDesde,
        tec: String(raw.tecnico || '').trim(),
        item: String(raw.item || '').trim(),
        assN: Number(raw.ass || assoc.length || 0),
        assoc,
        q: !!isQual,
        cor: stObj.eventColor && stObj.eventColor !== 'none' ? stObj.eventColor : '',
        nota: stObj.note || '',
        obs: stObj.obsStatus || '',
        st: status.st,
        sr: status.sr,
        sd: status.sd,
        origemItem: raw
      };
    };

    ['ral', 'rec'].forEach(tk => {
      const tipo = tk.toUpperCase();
      const list = (typeof modalData !== 'undefined' && modalData[tk] && modalData[tk]['ALL']) || [];
      list.forEach(raw => {
        const it = normalizar(raw, tipo, raw.cfOrigem, false);
        if (seen[tipo].has(it.chave)) return;
        seen[tipo].add(it.chave);
        out[tipo].push(it);
      });
      /* ESRC capturado separadamente para Painel Geral e Visualização SIR */
      const esrcList = (typeof appState !== 'undefined' && appState.sirExtra && appState.sirExtra.esrc && appState.sirExtra.esrc[tk]) || [];
      esrcList.forEach(raw => {
        const it = normalizar(raw, tipo, 'ESRC', false);
        if (seen[tipo].has(it.chave)) return;
        seen[tipo].add(it.chave);
        out[tipo].push(it);
      });
      /* DP capturado separadamente */
      const dpList = (typeof appState !== 'undefined' && appState.sirExtra && appState.sirExtra.dp && appState.sirExtra.dp[tk]) || [];
      dpList.forEach(raw => {
        const it = normalizar(raw, tipo, DP, false);
        out.DP.push(it);
      });
    });

    /* RALs de Qualidade */
    const qList = typeof qualidadeItems !== 'undefined' && Array.isArray(qualidadeItems) ? qualidadeItems : [];
    qList.forEach(raw => {
      out.QUAL.push(normalizar(raw, 'RAL', raw.cfOrigem, true));
    });

    return out;
  }

  /* Cor do total / célula igual ao Painel Geral (Auto Embratel) */
  function corVolumeCF(n) {
    if (!n) return 'c-zero';
    if (n <= 5) return 'c-verde';
    if (n <= 9) return 'c-amarelo';
    return 'c-vermelho';
  }
  function corVolumeTotal(n) {
    if (!n) return 'c-zero';
    if (n < 30) return 'c-verde';
    if (n < 50) return 'c-amarelo';
    return 'c-vermelho';
  }

  root.SirRegrasAE = {
    MIN, DP, SIR_REDES, GRUPOS, NOMES, AREAS, SLA_MIN, SLA_ALERTA_MIN,
    semAcento, p2, parseAberturaMs, parseDuracaoMs, slaRestante, nivelSLA,
    tempoCurto, formatSlaPill, cfResumido, designacaoCritel, urlCritel,
    recuperacaoDe, urlDoTicket, textoParaFala, falar,
    coletarItensAtivos, corVolumeCF, corVolumeTotal
  };
})(window);
