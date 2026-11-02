const DB_NAME    = 'sir-dashboard';
const DB_VERSION = 1;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('historico')) {
        const hs = db.createObjectStore('historico', { keyPath: 'id', autoIncrement: true });
        hs.createIndex('designacao', 'designacao', { unique: false });
        hs.createIndex('ts', 'ts', { unique: false });
      }
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

function tx(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t  = db.transaction(storeName, mode);
    const st = t.objectStore(storeName);
    const req = fn(st);
    if (req) {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    } else {
      t.oncomplete = () => resolve();
      t.onerror    = () => reject(t.error);
    }
  }));
}

/* ── Histórico ── */
async function dbGetAllHistorico() {
  return tx('historico', 'readonly', st => st.getAll());
}

async function dbSaveHistorico(entry) {
  return tx('historico', 'readwrite', st => st.add(entry));
}

async function dbUpdateHistorico(entry) {
  return tx('historico', 'readwrite', st => st.put(entry));
}

async function dbDeleteHistorico(id) {
  return tx('historico', 'readwrite', st => st.delete(id));
}

async function dbClearHistorico() {
  const db = await openDB();
  const t  = db.transaction('historico', 'readwrite');
  t.objectStore('historico').clear();
  return new Promise((res, rej) => { t.oncomplete = res; t.onerror = rej; });
}

async function dbMigrateHistoricoFromLS() {
  const key = 'cop_rede_historicos_v1';
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const items = JSON.parse(raw);
    if (!Array.isArray(items) || !items.length) return;
    const existing = await dbGetAllHistorico();
    if (existing.length > 0) return;
    const db = await openDB();
    const t  = db.transaction('historico', 'readwrite');
    const st = t.objectStore('historico');
    items.forEach(h => st.add({ designacao: h.designacao||'', observacao: h.observacao||'', texto: h.texto||'', ts: h.ts || Date.now() }));
    await new Promise((res, rej) => { t.oncomplete = res; t.onerror = rej; });
    localStorage.removeItem(key);
  } catch(e) { console.warn('Historico migration:', e); }
}

/* ── Snapshots CSV (modo offline) ── */
async function dbSaveSnapshot(ralText, recText) {
  return tx('snapshots', 'readwrite', st => st.put({ key: 'latest', ralText, recText, ts: Date.now() }));
}

async function dbGetSnapshot() {
  return tx('snapshots', 'readonly', st => st.get('latest'));
}
