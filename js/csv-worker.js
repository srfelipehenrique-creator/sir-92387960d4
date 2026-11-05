/* Web Worker — fetch + parse CSV off main thread */

const CF_COL = 'CF Exec.';

const normalizeStr = s => String(s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

const REGIONS = {
  'ES':    { 'MTN':['RT/VTA /MTN/FFA/FO'], 'MTS':['RT/VTA /MTS/FFA/FO'], 'NOR':['RT/VTA /NOR/FFA/FO'], 'SUL':['RT/VTA /SUL/FFA/FO'] },
  'RIO A': { 'SUF':['RT/RJO /SUF/NET/FO','RC/RJO /SUF/NET/FO'], 'SEF':['RT/RJO /SEF/NET/FO','RC/RJO /SEF/NET/FO'], 'NOF':['RT/RJO /NOF/NET/FO','RC/RJO /NOF/NET/FO'], 'LGS':['RT/RJO /LGS/NET/FO','RC/RJO /LGS/NET/FO'], 'BX1':['RT/RJO /BX1/NET/FO','RC/RJO /BX1/NET/FO'], 'MTP':['RT/RJO /MTP/NET/FO','RC/RJO /MTP/NET/FO'] },
  'RIO B': { 'NO1':['RT/RJO /NO1/NET/FO','RC/RJO /NO1/NET/FO'], 'NO2':['RT/RJO /NO2/NET/FO','RC/RJO /NO2/NET/FO'], 'NO3':['RT/RJO /NO3/PCS/FO','RC/RJO /NO3/NET/FO'], 'OE1':['RT/RJO /OE1/NET/FO','RC/RJO /OE1/NET/FO'], 'SU2':['RT/RJO /SU2/NET/FO','RC/RJO /SU2/NET/FO'], 'CZS':['RT/RJO /CZS/NET/FO','RC/RJO /CZS/NET/FO'] }
};

const patternToCF = {};
for (const [, cfs] of Object.entries(REGIONS))
  for (const [cfKey, patterns] of Object.entries(cfs))
    for (const p of patterns) patternToCF[p] = cfKey;

function parseRaw(text, isRal) {
  const lines = text.split('\n');
  if (lines.length < 2) return { counts:{}, details:{}, total:0, rawText: text };
  let headerLine = '', headerIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t) { headerLine = t; headerIdx = i; break; }
  }
  const clean = s => s.replace(/^["'\s]+|["'\s]+$/g,'').trim();
  const check = sep => {
    const a = headerLine.split(sep).map(clean);
    const i = a.findIndex(h => h.toLowerCase() === CF_COL.toLowerCase());
    return i !== -1 ? { sep, idx: i, hArray: a } : null;
  };
  const vs = check(',') || check(';');
  if (!vs) return { counts:{}, details:{}, total:0, rawText: text };
  return { ...parseWithSep(lines, headerIdx, vs.idx, vs.sep, isRal, vs.hArray), rawText: text };
}

function parseWithSep(lines, headerIdx, cfIdx, sep, isRal, headers) {
  const clean   = s => s.replace(/^["'\s]+|["'\s]+$/g,'').trim();
  const getIdx  = kw => headers.findIndex(h => normalizeStr(h).includes(kw));

  let numIdx = getIdx('NUM.RECUP');
  if (numIdx === -1) numIdx = getIdx('NUM.RAL');
  if (numIdx === -1) {
    numIdx = headers.findIndex(h => {
      const n = normalizeStr(h);
      return n === 'TICKET' || n === 'NUMERO' || n === 'NUM';
    });
  }

  const desigIdx    = getIdx('DESIGNACAO');
  const tipoIdx     = getIdx('TIPO RAL');
  const cliIdx      = getIdx('CLIENTE');
  const aberturaIdx = getIdx('ABERTURA');

  const allP = Object.keys(patternToCF);
  const counts = {}, details = {}, qualidadeDetails = {};
  allP.forEach(p => { counts[p] = 0; details[p] = []; qualidadeDetails[p] = []; });
  let total = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    if (isRal && line.toUpperCase().indexOf('QUALIDADE') !== -1) {
      /* Captura RALs de Qualidade em estrutura separada em vez de descartar */
      const qCells = line.split(sep).map(clean);
      if (qCells.length > cfIdx) {
        const qcf = qCells[cfIdx];
        for (const p of allP) {
          if (qcf === p) {
            qualidadeDetails[p].push({
              ticket:     numIdx > -1 && qCells[numIdx]     ? qCells[numIdx]     : 'N/D',
              designacao: desigIdx > -1 && qCells[desigIdx] ? qCells[desigIdx]   : 'N/D',
              cfOrigem:   patternToCF[p],
              abertura:   aberturaIdx > -1 && qCells[aberturaIdx] ? qCells[aberturaIdx] : '',
            });
            break;
          }
        }
      }
      continue;
    }
    const cells = line.split(sep).map(clean);
    if (cells.length <= cfIdx) continue;
    const cf = cells[cfIdx];
    if (!cf) continue;

    for (const p of allP) {
      if (cf === p) {
        counts[p]++; total++;
        const ticket   = numIdx > -1 && cells[numIdx]     ? cells[numIdx]     : 'N/D';
        const desig    = desigIdx > -1 && cells[desigIdx] ? cells[desigIdx]   : 'N/D';
        const abertura = aberturaIdx > -1 && cells[aberturaIdx] ? cells[aberturaIdx] : '';
        let extra = 'N/D';
        if (isRal && tipoIdx > -1 && cells[tipoIdx])  extra = cells[tipoIdx];
        else if (!isRal && cliIdx > -1 && cells[cliIdx]) extra = cells[cliIdx];
        details[p].push({ ticket, designacao: desig, extra, cfOrigem: patternToCF[p], abertura });
      }
    }
  }
  return { counts, details, total, qualidadeDetails };
}

self.onmessage = async function(e) {
  const { type } = e.data;

  if (type === 'FETCH_PARSE') {
    const { ralUrl, recUrl } = e.data;
    try {
      const ts = Date.now();
      const [ralResp, recResp] = await Promise.all([
        fetch(`${ralUrl}?_=${ts}`, { cache: 'no-store' }),
        fetch(`${recUrl}?_=${ts}`, { cache: 'no-store' })
      ]);
      if (!ralResp.ok || !recResp.ok) throw new Error(`HTTP ${ralResp.status}/${recResp.status}`);
      const [ralText, recText] = await Promise.all([ralResp.text(), recResp.text()]);
      const ralRes = parseRaw(ralText, true);
      const recRes = parseRaw(recText, false);
      self.postMessage({ type: 'RESULT', ralRes, recRes, ralText, recText });
    } catch(err) {
      self.postMessage({ type: 'ERROR', message: err.message });
    }
  }

  if (type === 'PARSE_TEXT') {
    const { ralText, recText } = e.data;
    try {
      const ralRes = parseRaw(ralText, true);
      const recRes = parseRaw(recText, false);
      self.postMessage({ type: 'RESULT', ralRes, recRes, ralText: null, recText: null });
    } catch(err) {
      self.postMessage({ type: 'ERROR', message: err.message });
    }
  }
};
