/* ══════════════════════════════════════════════════════════════
   SIR Push — servidor de notificações (Cloudflare Worker)
   - A cada 2 min (cron) baixa os CSVs de RAL/REC, descobre tickets
     novos e envia notificação push para cada aparelho inscrito,
     filtrando pelas "Minhas Áreas" daquele aparelho.
   - Funciona com o SIR fechado/minimizado (Web Push padrão):
     iPhone (app na Tela de Início, iOS 16.4+), Android, PC.
   - Inscrição protegida pela mesma chave de acesso do SIR
     (comparada pelo hash SHA-256, igual à tela de bloqueio).
   - Chaves VAPID geradas no primeiro uso e guardadas no KV.
   ══════════════════════════════════════════════════════════════ */

const CSV_URLS = {
  ral: 'https://raw.githubusercontent.com/cpralonrj-pralon/embratel-sir/refs/heads/main/dados_ral.csv',
  rec: 'https://raw.githubusercontent.com/cpralonrj-pralon/embratel-sir/refs/heads/main/dados_rec.csv',
};

/* Mesmo mapeamento do SIR (js/config.js). Se mudar lá, mude aqui. */
const REGIONS = {
  'ES':    { MTN: ['RT/VTA /MTN/FFA/FO'], MTS: ['RT/VTA /MTS/FFA/FO'], NOR: ['RT/VTA /NOR/FFA/FO'], SUL: ['RT/VTA /SUL/FFA/FO'] },
  'RIO A': { SUF: ['RT/RJO /SUF/NET/FO','RC/RJO /SUF/NET/FO'], SEF: ['RT/RJO /SEF/NET/FO','RC/RJO /SEF/NET/FO'], NOF: ['RT/RJO /NOF/NET/FO','RC/RJO /NOF/NET/FO'], LGS: ['RT/RJO /LGS/NET/FO','RC/RJO /LGS/NET/FO'], BX1: ['RT/RJO /BX1/NET/FO','RC/RJO /BX1/NET/FO'], MTP: ['RT/RJO /MTP/NET/FO','RC/RJO /MTP/NET/FO'] },
  'RIO B': { NO1: ['RT/RJO /NO1/NET/FO','RC/RJO /NO1/NET/FO'], NO2: ['RT/RJO /NO2/NET/FO','RC/RJO /NO2/NET/FO'], NO3: ['RT/RJO /NO3/PCS/FO','RC/RJO /NO3/NET/FO'], OE1: ['RT/RJO /OE1/NET/FO','RC/RJO /OE1/NET/FO'], SU2: ['RT/RJO /SU2/NET/FO','RC/RJO /SU2/NET/FO'], CZS: ['RT/RJO /CZS/NET/FO','RC/RJO /CZS/NET/FO'] },
};
const PATTERN_TO_CF = {};
for (const cfs of Object.values(REGIONS))
  for (const [cf, pats] of Object.entries(cfs)) for (const p of pats) PATTERN_TO_CF[p] = cf;

const CF_COL = 'CF Exec.';
const MAX_SUBS = 20;

/* ─────────────────────────── Utilidades ─────────────────────────── */
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const concat = (...arrs) => { const n = arrs.reduce((a, x) => a + x.length, 0); const o = new Uint8Array(n); let i = 0; for (const a of arrs) { o.set(a, i); i += a.length; } return o; };
async function sha256Hex(str) { const d = await crypto.subtle.digest('SHA-256', enc.encode(str)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
const normalize = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

function cors(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allowed[0] || '*'),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/* ─────────────────────────── CSV ─────────────────────────── */
function parseCsv(text, isRal) {
  const lines = text.split('\n');
  let hi = lines.findIndex(l => l.trim());
  if (hi < 0) return [];
  const clean = s => s.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  let sep = null, headers = null, cfIdx = -1;
  for (const s of [',', ';']) {
    const h = lines[hi].trim().split(s).map(clean);
    const i = h.findIndex(x => x.toLowerCase() === CF_COL.toLowerCase());
    if (i !== -1) { sep = s; headers = h; cfIdx = i; break; }
  }
  if (!sep) return [];
  const idx = kw => headers.findIndex(h => normalize(h).includes(kw));
  let numIdx = idx('NUM.RECUP'); if (numIdx === -1) numIdx = idx('NUM.RAL');
  const desigIdx = idx('DESIGNACAO'), tipoIdx = idx('TIPO RAL'), cliIdx = idx('CLIENTE'), abIdx = idx('ABERTURA');
  const out = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    if (isRal && line.toUpperCase().includes('QUALIDADE')) continue;   /* igual ao SIR */
    const c = line.split(sep).map(clean);
    const cf = PATTERN_TO_CF[c[cfIdx]];
    if (!cf) continue;
    const ticket = (numIdx > -1 && c[numIdx]) || 'N/D';
    out.push({
      tk: isRal ? 'ral' : 'rec', cf, ticket,
      designacao: (desigIdx > -1 && c[desigIdx]) || '',
      extra: isRal ? ((tipoIdx > -1 && c[tipoIdx]) || '') : ((cliIdx > -1 && c[cliIdx]) || ''),
      abertura: (abIdx > -1 && c[abIdx]) || '',
    });
  }
  return out;
}
const idOf = t => `${t.tk}|${t.ticket}|${t.cf}`;

/* ─────────────────────────── VAPID ─────────────────────────── */
async function getVapid(env) {
  let v = await env.SIR_KV.get('vapid', 'json');
  if (!v) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    const priv = await crypto.subtle.exportKey('jwk', kp.privateKey);
    v = { publicKey: b64u(pub), privateJwk: priv };
    await env.SIR_KV.put('vapid', JSON.stringify(v));
  }
  return v;
}
async function vapidAuth(endpoint, vapid, subject) {
  const aud = new URL(endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${vapid.publicKey}`;
}

/* ─────────────── Criptografia do conteúdo (RFC 8291, aes128gcm) ─────────────── */
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
async function encryptPayload(sub, payload) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);   /* 4096 */
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
async function sendPush(env, vapid, sub, payloadObj) {
  const body = await encryptPayload(sub, JSON.stringify(payloadObj));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await vapidAuth(sub.endpoint, vapid, env.VAPID_SUBJECT),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '3600',
      'Urgency': 'high',
    },
    body,
  });
  /* Registro das últimas tentativas (diagnóstico) */
  try {
    let reason = '';
    if (res.status >= 300) { try { reason = (await res.text()).slice(0, 200); } catch (e) {} }
    const log = (await env.SIR_KV.get('pushlog', 'json')) || [];
    log.unshift({ at: Date.now(), host: new URL(sub.endpoint).host, status: res.status, reason, title: payloadObj.title });
    await env.SIR_KV.put('pushlog', JSON.stringify(log.slice(0, 10)));
  } catch (e) {}
  return res.status;
}

/* ─────────────────────────── Mensagem ─────────────────────────── */
function buildPayload(items) {
  const first = items[0], label = t => (t.tk === 'ral' ? 'RAL' : 'REC');
  if (items.length === 1) {
    return {
      title: `${label(first)} nova · ${first.cf}`,
      body: `${first.ticket} — ${first.designacao}${first.extra ? '\n' + first.extra : ''}${first.abertura ? '\nAbertura ' + first.abertura : ''}`,
      data: { cf: first.cf, tk: first.tk, ticket: first.ticket },
    };
  }
  const ral = items.filter(i => i.tk === 'ral').length, rec = items.length - ral;
  return {
    title: `${items.length} tickets novos nas suas áreas`,
    body: [ral ? `${ral} RAL` : '', rec ? `${rec} REC` : ''].filter(Boolean).join(' · ') + '\n' +
      items.slice(0, 4).map(i => `${label(i)} ${i.cf} · ${i.ticket}`).join('\n') + (items.length > 4 ? `\n+${items.length - 4}` : ''),
    data: { inbox: true },
  };
}

/* ─────────────────────────── Verificação periódica ─────────────────────────── */
async function check(env) {
  const ts = Date.now();
  const [ralTxt, recTxt] = await Promise.all(Object.values(CSV_URLS).map(u =>
    fetch(`${u}?_=${ts}`, { cf: { cacheTtl: 0 } }).then(r => { if (!r.ok) throw new Error('CSV ' + r.status); return r.text(); })));

  /* Nada mudou nos arquivos → nada a fazer (economiza processamento) */
  const fp = await sha256Hex(ralTxt + '\u0001' + recTxt);
  const state = (await env.SIR_KV.get('state', 'json')) || null;
  if (state && state.fp === fp) return { changed: false };

  const tickets = [...parseCsv(ralTxt, true), ...parseCsv(recTxt, false)];
  if (!tickets.length) return { changed: false, warn: 'csv vazio' };   /* não apaga o estado por um CSV ruim */
  const ids = tickets.map(idOf);
  const known = new Set(state ? state.ids : []);
  const fresh = state ? tickets.filter(t => !known.has(idOf(t))) : [];   /* 1ª execução: só memoriza */

  /* Se não conseguir gravar o estado, não envia nada (evita avisar o mesmo ticket de novo) */
  try { await env.SIR_KV.put('state', JSON.stringify({ fp, ids, at: ts })); }
  catch (e) { return { changed: true, erro: 'kv' }; }
  if (!fresh.length) return { changed: true, novos: 0 };

  const list = await env.SIR_KV.list({ prefix: 'sub:' });
  if (!list.keys.length) return { changed: true, novos: fresh.length, enviados: 0 };
  const vapid = await getVapid(env);
  let sent = 0;
  for (const k of list.keys) {
    const rec = await env.SIR_KV.get(k.name, 'json');
    if (!rec || rec.enabled === false) continue;
    const mine = fresh.filter(t => (rec.areas || []).includes(t.cf));
    if (!mine.length) continue;
    try {
      const st = await sendPush(env, vapid, rec.subscription, buildPayload(mine));
      if (st === 404 || st === 410) await env.SIR_KV.delete(k.name);   /* inscrição expirou */
      else if (st < 300) sent++;
    } catch (e) { /* segue para o próximo aparelho */ }
  }
  return { changed: true, novos: fresh.length, enviados: sent };
}

/* ─────────────────────────── API ─────────────────────────── */
async function authorized(env, key) {
  if (!key || !env.KEY_HASH) return false;
  return (await sha256Hex(String(key).trim())) === env.KEY_HASH;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(check(env).catch(async e => {
      console.log('check error', e && e.message);
      try { await env.SIR_KV.put('lasterr', JSON.stringify({ at: Date.now(), msg: String(e && e.message || e) })); } catch (err) {}
    }));
  },

  async fetch(req, env, ctx) {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/vapid') {
      const v = await getVapid(env);
      return json({ publicKey: v.publicKey }, 200, h);
    }
    if (req.method === 'GET' && url.pathname === '/') {
      const st = await env.SIR_KV.get('state', 'json');
      const le = await env.SIR_KV.get('lasterr', 'json');
      const subs = (await env.SIR_KV.list({ prefix: 'sub:' })).keys.length;
      return json({ ok: true, ultimaMudanca: st ? new Date(st.at).toISOString() : null, ticketsConhecidos: st ? st.ids.length : 0,
                    aparelhos: subs, ultimoErro: le ? { em: new Date(le.at).toISOString(), msg: le.msg } : null,
                    envios: ((await env.SIR_KV.get('pushlog', 'json')) || []).map(x => ({ em: new Date(x.at).toISOString(), servico: x.host, status: x.status, motivo: x.reason, titulo: x.title })) }, 200, h);
    }
    /* Diagnóstico: roda a verificação agora e devolve só contagens (sem dados de tickets) */
    if (req.method === 'GET' && url.pathname === '/diag') {
      const t0 = Date.now();
      try { const r = await check(env); return json({ ok: true, ...r, ms: Date.now() - t0 }, 200, h); }
      catch (e) { return json({ ok: false, erro: String(e && e.message || e), ms: Date.now() - t0 }, 200, h); }
    }

    /* ── Endereços de Node (base protegida pela chave; nunca fica no GitHub público) ──
       /nodes     {key, since?} → {at, by, rows} (ou {same:true} se não mudou)
       /nodes/set {key, rows, by} → grava a base enviada pelo SIR (planilha .xlsx lida no aparelho) */
    if (req.method === 'POST' && (url.pathname === '/nodes' || url.pathname === '/nodes/set')) {
      let body; try { body = await req.json(); } catch (e) { return json({ error: 'json' }, 400, h); }
      if (!(await authorized(env, body.key))) return json({ error: 'chave' }, 403, h);
      if (url.pathname === '/nodes') {
        const meta = await env.SIR_KV.get('nodes_meta', 'json');
        if (!meta) return json({ at: 0, rows: [] }, 200, h);
        if (body.since && Number(body.since) === meta.at) return json({ same: true, at: meta.at }, 200, h);
        const rows = (await env.SIR_KV.get('nodes', 'json')) || [];
        return json({ at: meta.at, by: meta.by, count: rows.length, rows }, 200, h);
      }
      const rows = Array.isArray(body.rows) ? body.rows : null;
      if (!rows || !rows.length || rows.length > 30000) return json({ error: 'linhas' }, 400, h);
      const clean = rows.filter(r => Array.isArray(r) && r[0]).map(r => r.slice(0, 9).map(c => String(c ?? '').slice(0, 200)));
      if (!clean.length) return json({ error: 'vazio' }, 400, h);
      const at = Date.now();
      await env.SIR_KV.put('nodes', JSON.stringify(clean));
      await env.SIR_KV.put('nodes_meta', JSON.stringify({ at, by: String(body.by || '').slice(0, 40), count: clean.length }));
      return json({ ok: true, at, count: clean.length }, 200, h);
    }

    /* ── Notas compartilhadas (todos com a chave veem as mesmas notas) ──
       Cada ticket: { list: [{ i, t, by, at, et? }], st, tag, at }
       - list: várias notas por ticket (adicionar, editar, excluir)
       - st:   status OBS     - tag: classificação (bolinha)          */
    if (req.method === 'POST' && (url.pathname === '/notes' || url.pathname === '/note')) {
      let body; try { body = await req.json(); } catch (e) { return json({ error: 'json' }, 400, h); }
      if (!(await authorized(env, body.key))) return json({ error: 'chave' }, 403, h);
      const notes = (await env.SIR_KV.get('notesmap', 'json')) || {};
      const now = Date.now();
      /* Formato antigo (uma nota só em "obs") → lista */
      const norm = n => {
        if (!n) return null;
        if (!Array.isArray(n.list)) n.list = n.obs ? [{ i: 'n' + (n.at || now).toString(36), t: n.obs, by: n.by || '', at: n.at || now }] : [];
        delete n.obs; delete n.by;
        n.st = n.st || 'none'; n.tag = n.tag || 'none';
        return n;
      };
      /* Limpa tickets sem mexer há mais de 15 dias */
      const old = now - 15 * 86400000;
      for (const [k, n] of Object.entries(notes)) { if (!n.at || n.at < old) delete notes[k]; else norm(n); }

      if (url.pathname === '/notes') return json({ notes, at: now }, 200, h);

      const id = String(body.id || '').slice(0, 300);
      if (!id) return json({ error: 'id' }, 400, h);
      const by  = String(body.by || '').slice(0, 40);
      const cur = norm(notes[id]) || { list: [], st: 'none', tag: 'none' };
      const nid = String(body.nid || '').replace(/[^a-z0-9]/gi, '').slice(0, 20);
      const txt = String(body.text || '').trim().slice(0, 300);
      const op  = String(body.op || '');

      if (op === 'add') {
        if (!txt) return json({ error: 'texto' }, 400, h);
        const i = nid && !cur.list.some(x => x.i === nid) ? nid : 'n' + now.toString(36) + Math.random().toString(36).slice(2, 6);
        cur.list.push({ i, t: txt, by, at: now });
        if (cur.list.length > 30) cur.list = cur.list.slice(-30);
      } else if (op === 'edit') {
        const n = cur.list.find(x => x.i === nid);
        if (n && txt) { n.t = txt; n.et = now; if (by) n.eb = by; }
      } else if (op === 'del') {
        cur.list = cur.list.filter(x => x.i !== nid);
      } else if (op === 'meta' || !op) {
        if ('st' in body)  cur.st  = String(body.st || 'none').slice(0, 30);
        if ('tag' in body) cur.tag = String(body.tag || 'none').slice(0, 30);
        /* Versões antigas do app mandavam a nota em "obs" */
        if (!op && body.obs && !cur.list.some(x => x.t === String(body.obs).trim()))
          cur.list.push({ i: 'n' + now.toString(36), t: String(body.obs).trim().slice(0, 300), by, at: now });
      } else return json({ error: 'op' }, 400, h);

      cur.at = now;
      cur.list.sort((a, b) => a.at - b.at);
      if (!cur.list.length && cur.st === 'none' && cur.tag === 'none') delete notes[id];
      else notes[id] = cur;
      await env.SIR_KV.put('notesmap', JSON.stringify(notes));
      return json({ ok: true, note: notes[id] || null }, 200, h);
    }

    if (req.method === 'POST' && ['/subscribe', '/unsubscribe', '/test'].includes(url.pathname)) {
      let body; try { body = await req.json(); } catch (e) { return json({ error: 'json' }, 400, h); }
      if (!(await authorized(env, body.key))) return json({ error: 'chave' }, 403, h);
      const sub = body.subscription;
      if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint)) return json({ error: 'inscricao' }, 400, h);
      const id = 'sub:' + (await sha256Hex(sub.endpoint)).slice(0, 32);

      if (url.pathname === '/unsubscribe') { await env.SIR_KV.delete(id); return json({ ok: true }, 200, h); }

      if (url.pathname === '/subscribe') {
        if (!sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ error: 'inscricao' }, 400, h);
        const exists = await env.SIR_KV.get(id);
        if (!exists && (await env.SIR_KV.list({ prefix: 'sub:' })).keys.length >= MAX_SUBS) return json({ error: 'limite' }, 429, h);
        const areas = Array.isArray(body.areas) ? body.areas.filter(a => typeof a === 'string' && a.length <= 6).slice(0, 40) : [];
        const record = { subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, areas, enabled: body.enabled !== false, device: String(body.device || '').slice(0, 60), at: Date.now() };
        const prev = exists ? JSON.parse(exists) : null;
        /* Só grava se algo mudou (o plano grátis tem limite de gravações por dia) */
        if (!prev || JSON.stringify(prev.areas) !== JSON.stringify(record.areas) || prev.enabled !== record.enabled || prev.subscription.keys.auth !== record.subscription.keys.auth)
          await env.SIR_KV.put(id, JSON.stringify(record));
        return json({ ok: true, areas: areas.length }, 200, h);
      }

      if (url.pathname === '/test') {
        const rec = await env.SIR_KV.get(id, 'json');
        if (!rec) return json({ error: 'nao inscrito' }, 404, h);
        const v = await getVapid(env);
        const payload = { title: 'SIR · notificações ativas', body: 'Teste: as RAL/REC novas das suas áreas vão chegar assim, mesmo com o app fechado.', data: {} };
        /* Atraso opcional (até 15 s) para dar tempo de sair do app e ver a notificação chegar */
        const delay = Math.min(15, Math.max(0, Number(body.delay) || 0));
        if (delay && ctx) {
          ctx.waitUntil(new Promise(r => setTimeout(r, delay * 1000)).then(() => sendPush(env, v, rec.subscription, payload)).catch(() => {}));
          return json({ ok: true, agendado: delay }, 200, h);
        }
        const st = await sendPush(env, v, rec.subscription, payload);
        return json({ ok: st < 300, status: st }, 200, h);
      }
    }
    return json({ error: 'not found' }, 404, h);
  },
};
