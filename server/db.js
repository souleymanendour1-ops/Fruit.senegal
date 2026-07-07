// Base de données à double mode :
//   - LOCAL / téléphone : fichier JSON (aucune dépendance, zéro configuration).
//   - EN LIGNE (hébergement cloud) : PostgreSQL dès que la variable
//     d'environnement DATABASE_URL est définie → les données sont conservées
//     durablement, même après un redémarrage du serveur.
//
// Le reste de l'application ne change pas : db.get() renvoie toujours l'objet
// en mémoire (source de vérité pendant l'exécution) ; la persistance ne fait
// que sauvegarder cet objet (dans le fichier ou dans Postgres).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_DATA = {
  users: [],
  products: [],
  orders: [],
  sessions: {},      // token -> { userId, createdAt }
  adminSessions: {}, // token -> { createdAt }
  settings: {
    businessName: 'Fruit Sénégal',
    waveNumber: '',
    orangeMoneyNumber: '',
    currency: 'FCFA',
    // marge appliquée par défaut sur les commandes par lien (en %)
    serviceFeePercent: 10,
    deliveryNote: 'Délai de livraison international estimé : 10 à 25 jours.'
  },
  meta: { seq: { product: 0, order: 0, user: 0 } }
};

const USE_PG = !!process.env.DATABASE_URL;

let data = null;
let pool = null;

function mergeDefaults(loaded) {
  loaded.settings = { ...DEFAULT_DATA.settings, ...(loaded.settings || {}) };
  loaded.meta = loaded.meta || structuredClone(DEFAULT_DATA.meta);
  loaded.meta.seq = { ...DEFAULT_DATA.meta.seq, ...(loaded.meta.seq || {}) };
  for (const k of ['users', 'products', 'orders']) loaded[k] = loaded[k] || [];
  loaded.sessions = loaded.sessions || {};
  loaded.adminSessions = loaded.adminSessions || {};
  return loaded;
}

// ---------------------------------------------------------------------------
// Mode FICHIER
// ---------------------------------------------------------------------------
function loadFromFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      data = mergeDefaults(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
    } catch (err) {
      console.error('DB fichier corrompue, réinitialisation:', err.message);
      data = structuredClone(DEFAULT_DATA);
      writeFileNow();
    }
  } else {
    data = structuredClone(DEFAULT_DATA);
    writeFileNow();
  }
}

function writeFileNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// ---------------------------------------------------------------------------
// Mode POSTGRESQL (tout l'état stocké dans une seule ligne JSONB)
// ---------------------------------------------------------------------------
async function initPg() {
  const pg = await import('pg');
  const url = process.env.DATABASE_URL;
  const ssl = /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false };
  pool = new pg.default.Pool({ connectionString: url, ssl, max: 3 });
  await pool.query(`CREATE TABLE IF NOT EXISTS app_state (
    id int PRIMARY KEY,
    data jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
  )`);
  const res = await pool.query('SELECT data FROM app_state WHERE id = 1');
  if (res.rows.length) {
    data = mergeDefaults(res.rows[0].data);
  } else {
    data = structuredClone(DEFAULT_DATA);
    await pool.query('INSERT INTO app_state (id, data) VALUES (1, $1)', [JSON.stringify(data)]);
  }
  console.log('Base de données : PostgreSQL (données persistantes) ✅');
}

async function writePgNow() {
  await pool.query(
    'INSERT INTO app_state (id, data, updated_at) VALUES (1, $1, now()) ' +
    'ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
    [JSON.stringify(data)]
  );
}

// ---------------------------------------------------------------------------
// Persistance commune (écriture différée non bloquante + flush immédiat)
// ---------------------------------------------------------------------------
let writeTimer = null;
let flushing = null;

async function flush() {
  if (flushing) { await flushing; return; }
  flushing = (USE_PG ? writePgNow() : Promise.resolve().then(writeFileNow))
    .catch(err => console.error('Erreur de persistance:', err.message))
    .finally(() => { flushing = null; });
  await flushing;
}

function scheduleFlush() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => { writeTimer = null; flush(); }, 60);
}

function flushNow() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  return flush();
}

function nextId(kind) {
  data.meta.seq[kind] = (data.meta.seq[kind] || 0) + 1;
  return data.meta.seq[kind];
}

export const db = {
  async init() {
    if (USE_PG) await initPg();
    else { loadFromFile(); console.log('Base de données : fichier local (server/data/db.json)'); }
  },
  get() {
    if (!data) loadFromFile(); // sécurité si init() n'a pas été appelé (usage local)
    return data;
  },
  save() { scheduleFlush(); },        // écriture différée non bloquante
  saveNow() { return flushNow(); },   // à await pour les données critiques (commandes)
  nextId,
  async close() { if (pool) await pool.end(); }
};
