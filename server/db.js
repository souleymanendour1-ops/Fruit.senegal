// Base de données simple basée sur un fichier JSON.
// Volontairement sans dépendance native pour rester portable et facile à déployer.
// Pour un usage à plus grande échelle, on pourra remplacer ce module par PostgreSQL.

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

let data = null;

function ensureLoaded() {
  if (data) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // fusionne les nouveaux champs de settings ajoutés après coup
      data.settings = { ...DEFAULT_DATA.settings, ...(data.settings || {}) };
      data.meta = data.meta || DEFAULT_DATA.meta;
    } catch (err) {
      console.error('DB corrompue, réinitialisation:', err.message);
      data = structuredClone(DEFAULT_DATA);
      persist();
    }
  } else {
    data = structuredClone(DEFAULT_DATA);
    persist();
  }
}

let writeTimer = null;
function persist() {
  // écriture atomique différée pour éviter les écritures concurrentes
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 30);
}

function persistNow() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function nextId(kind) {
  ensureLoaded();
  data.meta.seq[kind] = (data.meta.seq[kind] || 0) + 1;
  return data.meta.seq[kind];
}

export const db = {
  get() { ensureLoaded(); return data; },
  save() { persist(); },
  saveNow() { persistNow(); },
  nextId
};
