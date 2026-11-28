/* ══════════════════════════════════════════════════════════════
   SIR — Contas, níveis de acesso e 2 fatores (v104)
   Níveis: dev (Desenvolvedor) > gerencia > gestor > apoio (padrão).
   - Senha: PBKDF2-SHA256 (100 mil voltas, sal por usuário).
   - 2º fator: código de 6 dígitos do Google/Microsoft Authenticator (TOTP, 30 s).
   - Entrada por convite (link de uso único, 48 h) ou cadastro pendente
     de aprovação. Todo cadastro entra como "apoio", exceto e-mails
     pré-autorizados pelo Desenvolvedor ou pela Gerência.
   - O 1º Desenvolvedor se cadastra com a chave de acesso atual do SIR
     (só enquanto não existir nenhum Desenvolvedor).
   - Sessão: 12 h. O token da sessão também vale como chave nas rotas atuais.
   KV: user:<email> · inv:<hash> · pre:<email> · sess:<hash> · tent:<email> · audit · auth:dev
   ══════════════════════════════════════════════════════════════ */

const enc = new TextEncoder();
const RANK = { apoio: 1, gestor: 2, gerencia: 3, dev: 4 };
const NOME_NIVEL = { apoio: 'Apoio técnico', gestor: 'Gestor', gerencia: 'Gerência', dev: 'Desenvolvedor' };
const SESS_TTL = 12 * 3600;            /* segundos */
const INV_TTL = 48 * 3600;
const MAX_TENT = 5, BLOQ_S = 15 * 60;  /* 5 erros → 15 min parado */
const SAL_FALSO = '00112233445566778899aabbccddeeff';
const MAX_TENT_IP = 50;                /* v105: 50 erros do mesmo IP (qualquer e-mail) → 15 min parado; alto porque a rede da empresa pode sair por um IP só */
const MAX_IPS = 2;                     /* v105: cada pessoa fica conectada em até 2 IPs ao mesmo tempo */

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256Hex(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const b64u = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const normEmail = e => String(e || '').trim().toLowerCase();
const emailOk = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e);
const areasOk = a => (Array.isArray(a) ? a : []).map(x => String(x).toUpperCase().trim()).filter(x => /^[A-Z0-9]{2,5}$/.test(x)).slice(0, 40);
const now = () => Date.now();

/* ── Senha ── */
async function pbkdf2(senha, salHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const sal = Uint8Array.from(salHex.match(/../g).map(h => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 100000 }, key, 256));
}
function igual(a, b) {   /* comparação em tempo constante */
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ── TOTP (RFC 6238) ── */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(u8) { let bits = 0, v = 0, o = ''; for (const b of u8) { v = (v << 8) | b; bits += 8; while (bits >= 5) { o += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) o += B32[(v << (5 - bits)) & 31]; return o; }
function b32dec(s) { let bits = 0, v = 0; const o = []; for (const c of s.replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(c); if (i < 0) continue; v = (v << 5) | i; bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(o); }
async function totpCodigo(segredo, passo) {
  const key = await crypto.subtle.importKey('raw', b32dec(segredo), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8); new DataView(msg).setUint32(4, passo);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1000000;
  return String(n).padStart(6, '0');
}
/* Aceita o código atual e o vizinho (±30 s); não deixa o mesmo passo ser usado 2 vezes */
async function totpOk(u, codigo) {
  codigo = String(codigo || '').replace(/\D/g, '');
  if (codigo.length !== 6 || !u.totp) return false;
  const p = Math.floor(now() / 30000);
  for (const d of [0, -1, 1]) {
    if (u.totpUlt && p + d <= u.totpUlt) continue;
    if (igual(await totpCodigo(u.totp, p + d), codigo)) { u.totpUlt = p + d; return true; }
  }
  return false;
}

/* ── Armazenamento ── */
const getU = (env, e) => env.SIR_KV.get('user:' + e, 'json');
const putU = (env, u) => env.SIR_KV.put('user:' + u.email, JSON.stringify(u));
async function listarUsuarios(env) {
  const out = []; let cursor;
  do {
    const r = await env.SIR_KV.list({ prefix: 'user:', cursor });
    for (const k of r.keys) { const u = await env.SIR_KV.get(k.name, 'json'); if (u) out.push(u); }
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return out;
}
async function auditar(env, quem, acao, alvo, extra) {
  try {
    const log = (await env.SIR_KV.get('audit', 'json')) || [];
    log.unshift({ at: now(), quem, acao, alvo: alvo || '', extra: extra || '' });
    await env.SIR_KV.put('audit', JSON.stringify(log.slice(0, 500)));
  } catch (e) {}
}
const publico = u => ({ email: u.email, nome: u.nome, nivel: u.nivel, nomeNivel: NOME_NIVEL[u.nivel], areas: u.areas || [],
  status: u.status, criado: u.criado, aprovadoPor: u.aprovadoPor || '', ultimoAcesso: u.ultimoAcesso || 0, totpAtivo: !!u.totpAtivo,
  ipsAtivos: ipsAtivos(u).map(mascaraIp) });

/* ── Sessão ── */
/* Cria a sessão e mantém a pessoa em até MAX_IPS IPs: entrando de um 3º IP,
   as sessões do IP usado há mais tempo são encerradas. Devolve { token, encerrados } */
async function criarSessao(env, u, ipReq) {
  const token = 'S1.' + b64u(rand(32)), hTok = await sha256Hex(token), ip = ipReq || '?';
  const lim = now() - SESS_TTL * 1000;
  let ses = (u.sessoes || []).filter(s => s.at > lim);
  const ips = [...new Set(ses.map(s => s.ip))].filter(x => x !== ip);
  const encerrados = [];
  while (ips.length >= MAX_IPS) {
    /* IP com o acesso mais antigo */
    const ultimo = x => Math.max(...ses.filter(s => s.ip === x).map(s => s.at));
    ips.sort((a, b) => ultimo(a) - ultimo(b));
    const sai = ips.shift();
    for (const s of ses.filter(s => s.ip === sai)) await env.SIR_KV.delete('sess:' + s.h);
    ses = ses.filter(s => s.ip !== sai);
    encerrados.push(sai);
  }
  ses.push({ h: hTok, ip, at: now() });
  /* guarda as 10 mais novas; as que saem da lista são encerradas também */
  for (const s of ses.slice(0, Math.max(0, ses.length - 10))) await env.SIR_KV.delete('sess:' + s.h);
  u.sessoes = ses.slice(-10);
  await env.SIR_KV.put('sess:' + hTok, JSON.stringify({ email: u.email, ip, at: now() }), { expirationTtl: SESS_TTL });
  await putU(env, u);
  if (encerrados.length) await auditar(env, u.email, 'sessão encerrada (limite de 2 IPs)', u.email, encerrados.map(mascaraIp).join(', '));
  return { token, encerrados: encerrados.length };
}
const mascaraIp = ip => String(ip).includes(':') ? String(ip).split(':').slice(0, 3).join(':') + ':…' : String(ip).replace(/\.\d+$/, '.x');
const ipsAtivos = u => [...new Set((u.sessoes || []).filter(s => s.at > now() - SESS_TTL * 1000).map(s => s.ip))];
export async function usuarioDaSessao(env, token) {
  if (typeof token !== 'string' || !token.startsWith('S1.')) return null;
  const s = await env.SIR_KV.get('sess:' + await sha256Hex(token), 'json');
  if (!s) return null;
  const u = await getU(env, s.email);
  return u && u.status === 'ativo' ? u : null;
}

/* ── Regras da tabela de permissões ── */
const sobrepoe = (a, b) => (a || []).some(x => (b || []).includes(x));
const vêTodos = u => u.nivel === 'dev' || u.nivel === 'gerencia';
function podeVer(quem, alvo) {
  if (vêTodos(quem)) return true;
  if (quem.nivel === 'gestor') return alvo.email === quem.email || (alvo.nivel === 'apoio' && sobrepoe(alvo.areas, quem.areas));
  return alvo.email === quem.email;
}
/* Até que nível "quem" pode dar a alguém (convite, aprovação, promoção) */
function nivelMax(quem) { return quem.nivel === 'dev' ? 'dev' : quem.nivel === 'gerencia' ? 'gestor' : quem.nivel === 'gestor' ? 'apoio' : null; }
function podeDarNivel(quem, nivel) { const m = nivelMax(quem); return !!m && RANK[nivel] && RANK[nivel] <= RANK[m]; }
function podeGerir(quem, alvo) {   /* promover / rebaixar / bloquear */
  if (alvo.email === quem.email) return false;
  if (quem.nivel === 'dev') return true;
  if (quem.nivel === 'gerencia') return RANK[alvo.nivel] <= RANK.gestor;
  return false;
}
function podeAprovar(quem, alvo) {
  if (alvo.status !== 'pendente') return false;
  if (vêTodos(quem)) return RANK[alvo.nivel] <= RANK[nivelMax(quem)];
  return quem.nivel === 'gestor' && alvo.nivel === 'apoio' && sobrepoe(alvo.areas, quem.areas);
}
/* Áreas que um gestor pode dar: só as dele */
const areasPermitidas = (quem, areas) => vêTodos(quem) ? areas : areas.filter(a => (quem.areas || []).includes(a));

/* ── Respostas ── */
function resp(h) { return (obj, st = 200) => new Response(JSON.stringify(obj), { status: st, headers: { ...h, 'Content-Type': 'application/json' } }); }

async function _conta(env, k, ok) {
  if (ok) { await env.SIR_KV.delete(k); return; }
  const t = (await env.SIR_KV.get(k, 'json')) || { n: 0 };
  t.n++; t.at = now();
  await env.SIR_KV.put(k, JSON.stringify(t), { expirationTtl: BLOQ_S });
}
async function tentativa(env, email, ok, ip) {
  await _conta(env, 'tent:' + email, ok);
  if (ip && !ok) await _conta(env, 'tentip:' + ip, false);   /* o contador do IP só zera sozinho (15 min) */
}
async function bloqueado(env, email, ip) {
  const t = await env.SIR_KV.get('tent:' + email, 'json');
  if (t && t.n >= MAX_TENT) return true;
  if (!ip) return false;
  const ti = await env.SIR_KV.get('tentip:' + ip, 'json');
  return !!(ti && ti.n >= MAX_TENT_IP);
}

/* ══════════════════════ Rotas /auth/* ══════════════════════ */
export async function rotasAuth(req, env, h, url, chaveValida, ip) {
  const J = resp(h);
  ip = String(ip || '').slice(0, 64);
  if (req.method !== 'POST') return J({ error: 'metodo' }, 405);
  let b; try { b = await req.json(); } catch (e) { return J({ error: 'json' }, 400); }
  const rota = url.pathname.slice('/auth/'.length);

  /* ── Cadastro (passo 1): cria a conta e devolve o segredo do autenticador ── */
  if (rota === 'cadastro') {
    const email = normEmail(b.email), nome = String(b.nome || '').trim().slice(0, 60), senha = String(b.senha || '');
    if (!emailOk(email)) return J({ error: 'E-mail inválido' }, 400);
    if (nome.length < 3) return J({ error: 'Informe seu nome' }, 400);
    if (senha.length < 10) return J({ error: 'A senha precisa ter pelo menos 10 caracteres' }, 400);
    if (senha.length > 200) return J({ error: 'Senha longa demais' }, 400);
    const ja = await getU(env, email);
    if (ja && ja.totpAtivo) return J({ error: 'Não foi possível concluir o cadastro com este e-mail. Se você já tem acesso, use a aba Entrar.' }, 409);
    /* Cadastro começado e não terminado: só quem começou (com o código do passo 1) refaz antes de 30 min */
    if (ja && !ja.totpAtivo && now() - (ja.criado || 0) < 30 * 60000 && !(b.regToken && ja.regToken && igual(await sha256Hex(String(b.regToken)), ja.regToken)))
      return J({ error: 'Já há um cadastro em andamento com este e-mail. Tente de novo em 30 minutos.' }, 409);

    let nivel = 'apoio', status = 'pendente', areas = areasOk(b.areas), origem = 'cadastro', por = '';
    /* Convite */
    if (b.convite) {
      const k = 'inv:' + await sha256Hex(String(b.convite));
      const inv = await env.SIR_KV.get(k, 'json');
      if (!inv) return J({ error: 'Convite inválido ou vencido' }, 400);
      if (inv.email && inv.email !== email) return J({ error: 'Este convite foi feito para outro e-mail' }, 400);
      nivel = inv.nivel; areas = inv.areas.length ? inv.areas : areas; status = 'ativo'; origem = 'convite'; por = inv.por;
      await env.SIR_KV.delete(k);   /* uso único */
    } else {
      const pre = await env.SIR_KV.get('pre:' + email, 'json');
      /* Pré-autorizado: o nível reservado já vem marcado, mas a entrada ainda passa por aprovação
         (ninguém consegue tomar o lugar de outra pessoa só sabendo o e-mail dela) */
      if (pre) { nivel = pre.nivel; if (pre.areas && pre.areas.length) areas = pre.areas; origem = 'pre-autorizado'; por = pre.por; }
    }
    /* Refazendo um cadastro que não terminou: mantém o que convite/pré-autorização já deram */
    if (ja && !ja.totpAtivo && ja.status === 'ativo' && origem === 'cadastro') { nivel = ja.nivel; status = ja.status; areas = ja.areas; origem = ja.origem; por = ja.aprovadoPor || ''; }
    /* 1º Desenvolvedor: com a chave atual do SIR, só enquanto não houver nenhum */
    if (b.chave && !(await env.SIR_KV.get('auth:dev'))) {
      if (!(await chaveValida(b.chave))) return J({ error: 'Chave de acesso incorreta' }, 403);
      nivel = 'dev'; status = 'ativo'; origem = 'primeiro-dev'; areas = [];
    }
    const sal = hex(rand(16)), regToken = b64u(rand(18));
    const u = { email, nome, nivel, areas, status, origem, aprovadoPor: status === 'ativo' ? por : '',
      sal, senha: await pbkdf2(senha, sal), totp: b32enc(rand(20)), totpAtivo: false, criado: now(), regToken: await sha256Hex(regToken) };
    await putU(env, u);
    return J({ ok: true, regToken, segredo: u.totp, otpauth: `otpauth://totp/SIR:${encodeURIComponent(email)}?secret=${u.totp}&issuer=SIR&digits=6&period=30` });
  }

  /* ── Cadastro (passo 2): confirma o 1º código do autenticador ── */
  if (rota === 'confirmar') {
    const email = normEmail(b.email);
    if (await bloqueado(env, email, ip)) return J({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
    const u = await getU(env, email);
    const hs = await pbkdf2(String(b.senha || ''), u ? u.sal : SAL_FALSO);
    if (!u || u.totpAtivo || !igual(hs, u.senha)) { await tentativa(env, email, false, ip); return J({ error: 'Dados não conferem' }, 403); }
    if (!(await totpOk(u, b.codigo))) { await tentativa(env, email, false, ip); return J({ error: 'Código incorreto. Confira o horário do celular e tente o código novo.' }, 403); }
    u.totpAtivo = true;
    await putU(env, u); await tentativa(env, email, true, ip);
    if (u.origem === 'primeiro-dev') await env.SIR_KV.put('auth:dev', email);
    await auditar(env, email, 'cadastro', email, `${u.origem} · ${NOME_NIVEL[u.nivel]} · ${u.status}`);
    if (u.status !== 'ativo') return J({ ok: true, pendente: true });
    u.ultimoAcesso = now();
    const ss = await criarSessao(env, u, ip);
    return J({ ok: true, token: ss.token, encerrados: ss.encerrados, usuario: publico(u), expira: now() + SESS_TTL * 1000 });
  }

  /* ── Entrar ── */
  if (rota === 'entrar') {
    const email = normEmail(b.email);
    if (await bloqueado(env, email, ip)) return J({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
    if (String(b.senha || '').length > 200) return J({ error: 'E-mail ou senha incorretos' }, 403);
    const u = await getU(env, email);
    const hs = await pbkdf2(String(b.senha || ''), u ? u.sal : SAL_FALSO);   /* mesmo tempo com ou sem conta */
    const senhaOk = !!u && igual(hs, u.senha);
    if (!senhaOk) { await tentativa(env, email, false, ip); return J({ error: 'E-mail ou senha incorretos' }, 403); }
    if (!u.totpAtivo) return J({ error: 'Cadastro incompleto: refaça o cadastro para ativar o autenticador.' }, 403);
    if (!(await totpOk(u, b.codigo))) { await tentativa(env, email, false, ip); return J({ error: 'Código do autenticador incorreto' }, 403); }
    await tentativa(env, email, true, ip);
    await putU(env, u);   /* guarda o último código usado */
    if (u.status === 'pendente') return J({ ok: true, pendente: true });
    if (u.status !== 'ativo') return J({ error: 'Acesso bloqueado. Fale com seu gestor.' }, 403);
    u.ultimoAcesso = now();
    await auditar(env, email, 'entrou', email);
    const ss = await criarSessao(env, u, ip);
    return J({ ok: true, token: ss.token, encerrados: ss.encerrados, usuario: publico(u), expira: now() + SESS_TTL * 1000 });
  }

  /* Daqui para baixo: precisa de sessão */
  const eu = await usuarioDaSessao(env, b.token);
  if (!eu) return J({ error: 'sessao' }, 401);

  if (rota === 'eu') return J({ ok: true, usuario: publico(eu) });

  if (rota === 'sair') {
    const hTok = await sha256Hex(b.token);
    await env.SIR_KV.delete('sess:' + hTok);
    eu.sessoes = (eu.sessoes || []).filter(x => x.h !== hTok); await putU(env, eu);
    return J({ ok: true });
  }

  if (rota === 'usuarios') {
    if (eu.nivel === 'apoio') return J({ error: 'permissao' }, 403);
    const todos = (await listarUsuarios(env)).filter(u => u.totpAtivo && podeVer(eu, u));
    const lista = todos.map(u => ({ ...publico(u), podeGerir: podeGerir(eu, u), podeAprovar: podeAprovar(eu, u) }));
    const pre = [];
    if (vêTodos(eu)) { const r = await env.SIR_KV.list({ prefix: 'pre:' }); for (const k of r.keys) { const p = await env.SIR_KV.get(k.name, 'json'); if (p) pre.push({ email: k.name.slice(4), ...p }); } }
    let audit = ((await env.SIR_KV.get('audit', 'json')) || []);
    if (!vêTodos(eu)) { const vis = new Set(todos.map(u => u.email)); audit = audit.filter(a => vis.has(a.quem) || vis.has(a.alvo)); }
    return J({ ok: true, usuarios: lista, preAutorizados: pre, registro: audit.slice(0, 200), nivelMax: nivelMax(eu) });
  }

  if (rota === 'aprovar' || rota === 'recusar') {
    const alvo = await getU(env, normEmail(b.email));
    if (!alvo || !podeAprovar(eu, alvo)) return J({ error: 'permissao' }, 403);
    if (rota === 'recusar') { await env.SIR_KV.delete('user:' + alvo.email); await auditar(env, eu.email, 'recusou', alvo.email); return J({ ok: true }); }
    const nivel = b.nivel && podeDarNivel(eu, b.nivel) ? b.nivel : alvo.nivel;
    if (!podeDarNivel(eu, nivel)) return J({ error: 'permissao' }, 403);
    alvo.nivel = nivel; alvo.status = 'ativo'; alvo.aprovadoPor = eu.email;
    alvo.areas = areasPermitidas(eu, Array.isArray(b.areas) ? areasOk(b.areas) : (alvo.areas || []));
    await putU(env, alvo);
    await auditar(env, eu.email, 'aprovou', alvo.email, NOME_NIVEL[nivel]);
    return J({ ok: true });
  }

  if (rota === 'alterar') {   /* nível, áreas, bloquear/desbloquear */
    const alvo = await getU(env, normEmail(b.email));
    if (!alvo || !podeGerir(eu, alvo)) return J({ error: 'permissao' }, 403);
    if (b.nivel !== undefined) {
      if (!podeDarNivel(eu, b.nivel)) return J({ error: 'permissao' }, 403);
      if (alvo.nivel === 'dev' && b.nivel !== 'dev') {
        const devs = (await listarUsuarios(env)).filter(u => u.nivel === 'dev' && u.status === 'ativo');
        if (devs.length <= 1) return J({ error: 'Precisa ficar pelo menos um Desenvolvedor' }, 400);
      }
      alvo.nivel = b.nivel;
    }
    if (Array.isArray(b.areas)) alvo.areas = areasPermitidas(eu, areasOk(b.areas));
    if (b.status === 'bloqueado' || b.status === 'ativo') alvo.status = b.status;
    if (alvo.status === 'bloqueado') { for (const x of alvo.sessoes || []) await env.SIR_KV.delete('sess:' + x.h); alvo.sessoes = []; }
    await putU(env, alvo);
    await auditar(env, eu.email, 'alterou', alvo.email, [b.nivel && NOME_NIVEL[b.nivel], b.status, Array.isArray(b.areas) && 'áreas'].filter(Boolean).join(' · '));
    return J({ ok: true });
  }

  if (rota === 'convidar') {
    const nivel = b.nivel || 'apoio';
    if (!podeDarNivel(eu, nivel)) return J({ error: 'permissao' }, 403);
    const email = b.email ? normEmail(b.email) : '';
    if (email && !emailOk(email)) return J({ error: 'E-mail inválido' }, 400);
    const areas = areasPermitidas(eu, areasOk(b.areas));
    if (eu.nivel === 'gestor' && !areas.length) return J({ error: 'Escolha pelo menos uma das suas áreas' }, 400);
    const codigo = b64u(rand(18));
    await env.SIR_KV.put('inv:' + await sha256Hex(codigo), JSON.stringify({ nivel, areas, email, por: eu.email, at: now() }), { expirationTtl: INV_TTL });
    await auditar(env, eu.email, 'convidou', email || '(link)', NOME_NIVEL[nivel]);
    return J({ ok: true, codigo, validade: now() + INV_TTL * 1000 });
  }

  if (rota === 'pre-autorizar' || rota === 'remover-pre') {
    if (!vêTodos(eu)) return J({ error: 'permissao' }, 403);
    const email = normEmail(b.email);
    if (!emailOk(email)) return J({ error: 'E-mail inválido' }, 400);
    if (rota === 'remover-pre') { await env.SIR_KV.delete('pre:' + email); await auditar(env, eu.email, 'removeu pré-autorização', email); return J({ ok: true }); }
    if (!podeDarNivel(eu, b.nivel)) return J({ error: 'permissao' }, 403);
    await env.SIR_KV.put('pre:' + email, JSON.stringify({ nivel: b.nivel, areas: areasOk(b.areas), por: eu.email, at: now() }));
    await auditar(env, eu.email, 'pré-autorizou', email, NOME_NIVEL[b.nivel]);
    return J({ ok: true });
  }

  return J({ error: 'rota' }, 404);
}
