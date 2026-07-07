import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import {
  hashPassword, verifyPassword,
  createSession, destroySession, getUserFromToken,
  createAdminSession, requireUser, requireAdmin, bearer
} from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Magasins partenaires accessibles depuis l'app.
const STORES = [
  { id: 'alibaba', name: 'Alibaba', url: 'https://www.alibaba.com', color: '#ff6a00', tagline: 'Grossiste & gros volumes' },
  { id: 'shein',   name: 'Shein',   url: 'https://www.shein.com',   color: '#222222', tagline: 'Mode & vêtements' },
  { id: 'temu',    name: 'Temu',    url: 'https://www.temu.com',    color: '#fb7701', tagline: 'Bons plans variés' },
  { id: 'amazon',  name: 'Amazon',  url: 'https://www.amazon.com',  color: '#ff9900', tagline: 'High-tech & tout le reste' }
];

// Statuts possibles d'une commande (ordre logique).
const STATUSES = [
  'paiement_soumis',   // le client a payé et soumis la référence -> à valider par l'admin
  'paiement_valide',   // l'admin a validé le paiement (pris en charge)
  'en_preparation',    // achat en cours chez le fournisseur
  'expedie',           // colis expédié
  'livre',             // livré au client
  'annule'             // annulé
];

const app = express();
app.use(express.json({ limit: '1mb' }));

// petit logger
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) console.log(`${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, phone: u.phone, address: u.address || '', city: u.city || '' };
}

function publicSettings() {
  const s = db.get().settings;
  return {
    businessName: s.businessName,
    waveNumber: s.waveNumber,
    orangeMoneyNumber: s.orangeMoneyNumber,
    currency: s.currency,
    serviceFeePercent: s.serviceFeePercent,
    deliveryNote: s.deliveryNote
  };
}

// Recalcule le montant des articles côté serveur (sécurité).
function normalizeItems(rawItems) {
  const products = db.get().products;
  const items = [];
  for (const it of rawItems || []) {
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
    if (it.type === 'catalog' && it.productId != null) {
      const p = products.find(pr => pr.id === Number(it.productId));
      if (!p) continue;
      items.push({
        type: 'catalog',
        productId: p.id,
        title: p.title,
        store: p.store || '',
        imageUrl: p.imageUrl || '',
        url: p.url || '',
        options: String(it.options || ''),
        unitPrice: Number(p.price) || 0,
        quantity: qty
      });
    } else {
      // article par lien : le prix est indicatif, l'admin l'ajuste ensuite
      items.push({
        type: 'link',
        title: String(it.title || 'Article par lien').slice(0, 200),
        store: String(it.store || '').slice(0, 40),
        imageUrl: String(it.imageUrl || '').slice(0, 500),
        url: String(it.url || '').slice(0, 1000),
        options: String(it.options || '').slice(0, 300),
        unitPrice: Math.max(0, Number(it.unitPrice) || 0),
        quantity: qty
      });
    }
  }
  return items;
}

function computeTotals(items, feePercent) {
  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const serviceFee = Math.round(subtotal * (Number(feePercent) || 0) / 100);
  const total = subtotal + serviceFee;
  return { subtotal, serviceFee, total };
}

// ---------------------------------------------------------------------------
// Routes publiques
// ---------------------------------------------------------------------------
app.get('/api/stores', (_req, res) => res.json(STORES));
app.get('/api/settings', (_req, res) => res.json(publicSettings()));

app.get('/api/products', (_req, res) => {
  const products = db.get().products.filter(p => p.active !== false);
  res.json(products);
});

// ---------------------------------------------------------------------------
// Authentification client
// ---------------------------------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  const { name, phone, password, address, city } = req.body || {};
  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'Nom, téléphone et mot de passe sont requis.' });
  }
  const normPhone = String(phone).replace(/\s+/g, '');
  if (db.get().users.some(u => u.phone === normPhone)) {
    return res.status(409).json({ error: 'Ce numéro est déjà utilisé.' });
  }
  const user = {
    id: db.nextId('user'),
    name: String(name).trim(),
    phone: normPhone,
    address: String(address || '').trim(),
    city: String(city || '').trim(),
    passwordHash: hashPassword(password),
    createdAt: Date.now()
  };
  db.get().users.push(user);
  db.save();
  const token = createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body || {};
  const normPhone = String(phone || '').replace(/\s+/g, '');
  const user = db.get().users.find(u => u.phone === normPhone);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Numéro ou mot de passe incorrect.' });
  }
  const token = createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(bearer(req));
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserFromToken(bearer(req));
  if (!user) return res.status(401).json({ error: 'Non connecté.' });
  res.json({ user: publicUser(user) });
});

app.put('/api/auth/me', requireUser, (req, res) => {
  const { name, address, city } = req.body || {};
  if (name != null) req.user.name = String(name).trim();
  if (address != null) req.user.address = String(address).trim();
  if (city != null) req.user.city = String(city).trim();
  db.save();
  res.json({ user: publicUser(req.user) });
});

// ---------------------------------------------------------------------------
// Commandes (client)
// ---------------------------------------------------------------------------
app.post('/api/orders', requireUser, async (req, res) => {
  const { items, paymentMethod, paymentRef, deliveryAddress, deliveryCity, phone, note } = req.body || {};
  const normItems = normalizeItems(items);
  if (normItems.length === 0) {
    return res.status(400).json({ error: 'Votre panier est vide.' });
  }
  if (!['wave', 'orange_money'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Choisissez un moyen de paiement (Wave ou Orange Money).' });
  }
  if (!paymentRef || String(paymentRef).trim().length < 4) {
    return res.status(400).json({ error: "Indiquez la référence du paiement (ID de transaction Wave / Orange Money)." });
  }
  const feePercent = db.get().settings.serviceFeePercent;
  const totals = computeTotals(normItems, feePercent);

  const order = {
    id: db.nextId('order'),
    ref: 'FS-' + String(Date.now()).slice(-6) + '-' + Math.floor(Math.random() * 90 + 10),
    userId: req.user.id,
    customerName: req.user.name,
    customerPhone: String(phone || req.user.phone),
    items: normItems,
    subtotal: totals.subtotal,
    serviceFee: totals.serviceFee,
    serviceFeePercent: feePercent,
    total: totals.total,
    currency: db.get().settings.currency,
    paymentMethod,
    paymentRef: String(paymentRef).trim(),
    deliveryAddress: String(deliveryAddress || req.user.address || '').trim(),
    deliveryCity: String(deliveryCity || req.user.city || '').trim(),
    note: String(note || '').trim(),
    status: 'paiement_soumis',
    deliveryDate: null,
    adminNote: '',
    history: [{ status: 'paiement_soumis', at: Date.now(), by: 'client' }],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  db.get().orders.push(order);
  await db.saveNow();
  res.json({ order });
});

app.get('/api/orders/mine', requireUser, (req, res) => {
  const orders = db.get().orders
    .filter(o => o.userId === req.user.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(orders);
});

app.get('/api/orders/:id', requireUser, (req, res) => {
  const order = db.get().orders.find(o => o.id === Number(req.params.id) && o.userId === req.user.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  res.json(order);
});

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe administrateur incorrect.' });
  }
  const token = createAdminSession();
  res.json({ token });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const { status } = req.query;
  let orders = [...db.get().orders].sort((a, b) => b.createdAt - a.createdAt);
  if (status) orders = orders.filter(o => o.status === status);
  res.json(orders);
});

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const orders = db.get().orders;
  const byStatus = {};
  for (const s of STATUSES) byStatus[s] = 0;
  let revenue = 0;
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    if (['paiement_valide', 'en_preparation', 'expedie', 'livre'].includes(o.status)) revenue += o.total;
  }
  res.json({
    totalOrders: orders.length,
    totalCustomers: db.get().users.length,
    pendingValidation: byStatus['paiement_soumis'] || 0,
    revenue,
    currency: db.get().settings.currency,
    byStatus
  });
});

// Mise à jour d'une commande : statut, date de livraison, prix ajusté, note admin.
app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const order = db.get().orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  const { status, deliveryDate, adminNote, items, serviceFeePercent } = req.body || {};

  if (status && STATUSES.includes(status) && status !== order.status) {
    order.status = status;
    order.history.push({ status, at: Date.now(), by: 'admin' });
  }
  if (deliveryDate !== undefined) order.deliveryDate = deliveryDate || null;
  if (adminNote !== undefined) order.adminNote = String(adminNote).trim();

  // l'admin peut corriger les prix réels (surtout pour les articles par lien)
  if (Array.isArray(items)) {
    for (const upd of items) {
      const target = order.items[upd.index];
      if (target) {
        if (upd.unitPrice !== undefined) target.unitPrice = Math.max(0, Number(upd.unitPrice) || 0);
        if (upd.quantity !== undefined) target.quantity = Math.max(1, parseInt(upd.quantity, 10) || 1);
      }
    }
  }
  if (serviceFeePercent !== undefined) order.serviceFeePercent = Math.max(0, Number(serviceFeePercent) || 0);

  const totals = computeTotals(order.items, order.serviceFeePercent);
  order.subtotal = totals.subtotal;
  order.serviceFee = totals.serviceFee;
  order.total = totals.total;
  order.updatedAt = Date.now();
  await db.saveNow();
  res.json({ order });
});

// Catalogue (admin)
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const { title, price, store, imageUrl, url, description, options } = req.body || {};
  if (!title || price == null) return res.status(400).json({ error: 'Titre et prix requis.' });
  const product = {
    id: db.nextId('product'),
    title: String(title).trim(),
    price: Math.max(0, Number(price) || 0),
    store: String(store || '').trim(),
    imageUrl: String(imageUrl || '').trim(),
    url: String(url || '').trim(),
    description: String(description || '').trim(),
    options: String(options || '').trim(),
    active: true,
    createdAt: Date.now()
  };
  db.get().products.push(product);
  await db.saveNow();
  res.json({ product });
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const p = db.get().products.find(pr => pr.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Produit introuvable.' });
  const f = req.body || {};
  if (f.title !== undefined) p.title = String(f.title).trim();
  if (f.price !== undefined) p.price = Math.max(0, Number(f.price) || 0);
  if (f.store !== undefined) p.store = String(f.store).trim();
  if (f.imageUrl !== undefined) p.imageUrl = String(f.imageUrl).trim();
  if (f.url !== undefined) p.url = String(f.url).trim();
  if (f.description !== undefined) p.description = String(f.description).trim();
  if (f.options !== undefined) p.options = String(f.options).trim();
  if (f.active !== undefined) p.active = !!f.active;
  await db.saveNow();
  res.json({ product: p });
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const idx = db.get().products.findIndex(pr => pr.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Produit introuvable.' });
  db.get().products.splice(idx, 1);
  await db.saveNow();
  res.json({ ok: true });
});

// Paramètres (admin) : numéros Wave/OM, marge, etc.
app.get('/api/admin/settings', requireAdmin, (_req, res) => res.json(db.get().settings));
app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  const s = db.get().settings;
  const f = req.body || {};
  for (const key of ['businessName', 'waveNumber', 'orangeMoneyNumber', 'currency', 'deliveryNote']) {
    if (f[key] !== undefined) s[key] = String(f[key]).trim();
  }
  if (f.serviceFeePercent !== undefined) s.serviceFeePercent = Math.max(0, Number(f.serviceFeePercent) || 0);
  await db.saveNow();
  res.json(s);
});

// ---------------------------------------------------------------------------
// Statique (PWA)
// ---------------------------------------------------------------------------
app.use(express.static(PUBLIC_DIR));

// Fallback SPA -> index.html pour les routes inconnues non-API
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((req, res) => res.status(404).json({ error: 'Route inconnue.' }));

await db.init();

const server = app.listen(PORT, () => {
  console.log(`\n  ${db.get().settings.businessName} — serveur démarré`);
  console.log(`  Boutique : http://localhost:${PORT}/`);
  console.log(`  Admin    : http://localhost:${PORT}/admin.html  (mot de passe: ${ADMIN_PASSWORD})\n`);
});

// Arrêt propre : on enregistre les dernières données avant de quitter.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    console.log(`\n${sig} reçu — sauvegarde et arrêt…`);
    try { await db.saveNow(); await db.close(); } catch { /* ignore */ }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
