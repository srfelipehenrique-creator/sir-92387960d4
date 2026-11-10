// Uso: node worker/encrypt-nodes.mjs <chave-publica de /nodes/pubkey> linhas.json data/nodes.enc.json
// Tranca rows.json com a chave pública do servidor (ECDH P-256 + HKDF + AES-GCM)
import fs from 'node:fs';
const [,, pubB64u, inFile, outFile] = process.argv;
const b64u = b => Buffer.from(b).toString('base64url');
const pub = await crypto.subtle.importKey('raw', Buffer.from(pubB64u, 'base64url'), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, eph.privateKey, 256));
const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
const k = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
const aesRaw = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('SIR nodes v1') }, k, 256));
const aes = await crypto.subtle.importKey('raw', aesRaw, 'AES-GCM', false, ['encrypt']);
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, fs.readFileSync(inFile));
const pkg = { v: 1, note: 'Base de nodes criptografada. Só o servidor do SIR consegue abrir.', createdAt: Date.now(),
  epk: b64u(await crypto.subtle.exportKey('raw', eph.publicKey)), salt: b64u(salt), iv: b64u(iv), ct: b64u(ct) };
fs.writeFileSync(outFile, JSON.stringify(pkg));
console.log('ok', outFile, fs.statSync(outFile).size, 'bytes');
