import { API, money, statusLabel, statusColor, escapeHtml } from './api.js';

const state = { tab: 'orders', filter: '', orders: [], products: [], settings: {}, stats: {} };
const view = document.getElementById('view');
const modalRoot = document.getElementById('modalRoot');
const nav = document.getElementById('adminNav');
const logoutBtn = document.getElementById('logoutBtn');

const STATUSES = ['paiement_soumis', 'paiement_valide', 'en_preparation', 'expedie', 'livre', 'annule'];

let toastTimer = null;
function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
}
function cur() { return state.settings.currency || 'FCFA'; }

function openModal(html) {
  modalRoot.innerHTML = `<div class="modal-backdrop" id="backdrop"><div class="modal">
    <button class="modal-close" id="modalClose">✕</button>${html}</div></div>`;
  document.getElementById('backdrop').addEventListener('click', e => { if (e.target.id === 'backdrop') closeModal(); });
  document.getElementById('modalClose').addEventListener('click', closeModal);
}
function closeModal() { modalRoot.innerHTML = ''; }

// ---------------------------------------------------------------------------
// Connexion admin
// ---------------------------------------------------------------------------
function renderLogin() {
  nav.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  view.innerHTML = `
    <div class="card" style="margin-top:30px">
      <h2 class="section-title">Connexion administrateur</h2>
      <div class="field"><label>Mot de passe</label><input id="pass" type="password" placeholder="••••••"></div>
      <button class="btn btn-dark" id="loginBtn">Se connecter</button>
      <p class="small muted mt center">Espace réservé à la gestion des commandes.</p>
    </div>`;
  const submit = async () => {
    try {
      const { token } = await API.post('/api/admin/login', { password: document.getElementById('pass').value });
      API.setAdminToken(token);
      boot();
    } catch (e) { toast(e.message, true); }
  };
  document.getElementById('loginBtn').addEventListener('click', submit);
  document.getElementById('pass').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

// ---------------------------------------------------------------------------
// Vues admin
// ---------------------------------------------------------------------------
function render() {
  document.querySelectorAll('#adminNav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  ({ orders: renderOrders, catalog: renderCatalog, settings: renderSettings }[state.tab])();
}

async function renderOrders() {
  view.innerHTML = `<p class="muted small">Chargement…</p>`;
  try {
    [state.stats, state.orders] = await Promise.all([
      API.get('/api/admin/stats', { admin: true }),
      API.get('/api/admin/orders' + (state.filter ? '?status=' + state.filter : ''), { admin: true })
    ]);
  } catch (e) {
    if (e.status === 401) return renderLogin();
    return view.innerHTML = `<p>${escapeHtml(e.message)}</p>`;
  }
  const s = state.stats;
  const tabs = [['', 'Toutes'], ...STATUSES.map(st => [st, statusLabel(st)])]
    .map(([v, l]) => `<button class="tab ${state.filter === v ? 'active' : ''}" data-f="${v}">${l}${v === 'paiement_soumis' && s.pendingValidation ? ' (' + s.pendingValidation + ')' : ''}</button>`).join('');

  view.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><div class="v">${s.totalOrders}</div><div class="l">Commandes</div></div>
      <div class="stat"><div class="v" style="color:var(--red)">${s.pendingValidation}</div><div class="l">À valider</div></div>
      <div class="stat"><div class="v">${s.totalCustomers}</div><div class="l">Clients</div></div>
      <div class="stat"><div class="v">${money(s.revenue, s.currency)}</div><div class="l">Chiffre d'affaires</div></div>
    </div>
    <div class="tabs">${tabs}</div>
    <div id="ordersList">${state.orders.length ? state.orders.map(orderCard).join('') : '<div class="empty"><div class="big">📭</div><p>Aucune commande.</p></div>'}</div>`;

  view.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { state.filter = t.dataset.f; renderOrders(); }));
  view.querySelectorAll('[data-order]').forEach(c => c.addEventListener('click', () =>
    openOrder(state.orders.find(o => o.id === Number(c.dataset.order)))));
}

function orderCard(o) {
  return `<div class="order-card" data-order="${o.id}" style="cursor:pointer">
    <div class="row">
      <b>${escapeHtml(o.ref)}</b>
      <span class="badge" style="background:${statusColor(o.status)}">${statusLabel(o.status)}</span>
    </div>
    <div class="small muted mt">${escapeHtml(o.customerName)} · 📞 ${escapeHtml(o.customerPhone)}</div>
    <div class="small muted">${o.items.length} article(s) · ${new Date(o.createdAt).toLocaleString('fr-FR')}</div>
    <div class="row mt">
      <span class="small">💳 ${o.paymentMethod === 'wave' ? 'Wave' : 'Orange Money'} · réf ${escapeHtml(o.paymentRef)}</span>
      <b>${money(o.total, o.currency)}</b>
    </div>
    ${o.deliveryDate ? `<div class="small mt" style="color:var(--green)">📅 Livraison : ${escapeHtml(o.deliveryDate)}</div>` : ''}
  </div>`;
}

function openOrder(o) {
  if (!o) return;
  const items = o.items.map((it, i) => `
    <div class="item-line">
      <div class="row"><b>${escapeHtml(it.title)}</b><span class="badge" style="background:#888;font-size:10px">${escapeHtml(it.store || (it.type === 'link' ? 'lien' : ''))}</span></div>
      ${it.options ? `<div class="muted">${escapeHtml(it.options)}</div>` : ''}
      ${it.url ? `<a class="tag-link" href="${escapeHtml(it.url)}" target="_blank" rel="noopener">Ouvrir le produit ↗</a>` : ''}
      <div class="row mt">
        <span>Prix unitaire (${cur()})</span>
        <input type="number" min="0" value="${it.unitPrice}" data-price="${i}" style="width:120px;padding:6px;border:1px solid var(--border);border-radius:8px">
      </div>
      <div class="row mt">
        <span>Quantité</span>
        <input type="number" min="1" value="${it.quantity}" data-qty="${i}" style="width:80px;padding:6px;border:1px solid var(--border);border-radius:8px">
      </div>
    </div>`).join('');

  const statusOpts = STATUSES.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('');

  openModal(`
    <h3>${escapeHtml(o.ref)}</h3>
    <span class="badge" style="background:${statusColor(o.status)}">${statusLabel(o.status)}</span>
    <div class="card mt small">
      <b>${escapeHtml(o.customerName)}</b><br>
      📞 ${escapeHtml(o.customerPhone)}<br>
      📍 ${escapeHtml(o.deliveryAddress)}, ${escapeHtml(o.deliveryCity)}<br>
      💳 ${o.paymentMethod === 'wave' ? 'Wave' : 'Orange Money'} — <b>réf : ${escapeHtml(o.paymentRef)}</b>
      ${o.note ? `<br>📝 ${escapeHtml(o.note)}` : ''}
    </div>

    <h4>Articles <span class="small muted">(ajustez les prix réels si besoin)</span></h4>
    ${items}

    <div class="field mt"><label>Frais de service (%)</label><input id="feePct" type="number" min="0" value="${o.serviceFeePercent}"></div>
    <div class="row total-row"><span>Total recalculé après enregistrement</span></div>

    <h4 style="margin-top:16px">Traitement</h4>
    <div class="field"><label>Statut de la commande</label><select id="oStatus">${statusOpts}</select></div>
    <div class="field"><label>📅 Date de livraison prévue</label><input id="oDate" type="text" value="${escapeHtml(o.deliveryDate || '')}" placeholder="ex: 15 juillet 2026 ou 10-15 jours"></div>
    <div class="field"><label>Message au client (optionnel)</label><textarea id="oNote" placeholder="ex: Commande confirmée, expédition sous 3 jours.">${escapeHtml(o.adminNote || '')}</textarea></div>

    <div class="row" style="gap:8px">
      <button class="btn btn-yellow" id="quickValidate" style="flex:1">✅ Valider le paiement</button>
    </div>
    <button class="btn btn-primary mt" id="saveOrder">Enregistrer</button>`);

  document.getElementById('quickValidate').addEventListener('click', () => {
    document.getElementById('oStatus').value = 'paiement_valide';
    saveOrder(o);
  });
  document.getElementById('saveOrder').addEventListener('click', () => saveOrder(o));
}

async function saveOrder(o) {
  const items = o.items.map((_, i) => ({
    index: i,
    unitPrice: Number(modalRoot.querySelector(`[data-price="${i}"]`).value) || 0,
    quantity: Number(modalRoot.querySelector(`[data-qty="${i}"]`).value) || 1
  }));
  try {
    await API.patch('/api/admin/orders/' + o.id, {
      status: document.getElementById('oStatus').value,
      deliveryDate: document.getElementById('oDate').value.trim(),
      adminNote: document.getElementById('oNote').value.trim(),
      serviceFeePercent: Number(document.getElementById('feePct').value) || 0,
      items
    }, { admin: true });
    toast('Commande mise à jour ✅');
    closeModal();
    renderOrders();
  } catch (e) { toast(e.message, true); }
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------
async function renderCatalog() {
  view.innerHTML = `<p class="muted small">Chargement…</p>`;
  try { state.products = await API.get('/api/products'); }
  catch (e) { return view.innerHTML = `<p>${escapeHtml(e.message)}</p>`; }
  view.innerHTML = `
    <div class="row"><h2 class="section-title">Catalogue (${state.products.length})</h2>
      <button class="btn btn-primary btn-sm" id="addProd">+ Produit</button></div>
    ${state.products.length ? state.products.map(p => `
      <div class="order-card" data-prod="${p.id}" style="cursor:pointer">
        <div class="row">
          <b>${escapeHtml(p.title)}</b>
          <b style="color:var(--green)">${money(p.price, cur())}</b>
        </div>
        <div class="small muted">${escapeHtml(p.store || '')} ${p.active === false ? '· (masqué)' : ''}</div>
      </div>`).join('') : '<div class="empty"><div class="big">🛍️</div><p>Aucun produit. Ajoutez-en pour proposer un catalogue.</p></div>'}`;
  document.getElementById('addProd').addEventListener('click', () => openProductForm());
  view.querySelectorAll('[data-prod]').forEach(c => c.addEventListener('click', () =>
    openProductForm(state.products.find(p => p.id === Number(c.dataset.prod)))));
}

function openProductForm(p) {
  const isEdit = !!p;
  p = p || {};
  openModal(`
    <h3>${isEdit ? 'Modifier' : 'Nouveau'} produit</h3>
    <div class="field"><label>Titre *</label><input id="fTitle" value="${escapeHtml(p.title || '')}"></div>
    <div class="field"><label>Prix (${cur()}) *</label><input id="fPrice" type="number" min="0" value="${p.price ?? ''}"></div>
    <div class="field"><label>Boutique</label><input id="fStore" value="${escapeHtml(p.store || '')}" placeholder="Alibaba, Shein…"></div>
    <div class="field"><label>Lien image</label><input id="fImg" value="${escapeHtml(p.imageUrl || '')}"></div>
    <div class="field"><label>Lien produit</label><input id="fUrl" value="${escapeHtml(p.url || '')}"></div>
    <div class="field"><label>Options proposées</label><input id="fOpt" value="${escapeHtml(p.options || '')}" placeholder="ex: tailles S,M,L"></div>
    <div class="field"><label>Description</label><textarea id="fDesc">${escapeHtml(p.description || '')}</textarea></div>
    ${isEdit ? `<label class="row" style="margin-bottom:12px"><span>Visible dans la boutique</span><input type="checkbox" id="fActive" ${p.active !== false ? 'checked' : ''}></label>` : ''}
    <button class="btn btn-primary" id="fSave">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
    ${isEdit ? `<button class="btn btn-danger mt" id="fDel">Supprimer</button>` : ''}`);

  document.getElementById('fSave').addEventListener('click', async () => {
    const body = {
      title: document.getElementById('fTitle').value.trim(),
      price: Number(document.getElementById('fPrice').value) || 0,
      store: document.getElementById('fStore').value.trim(),
      imageUrl: document.getElementById('fImg').value.trim(),
      url: document.getElementById('fUrl').value.trim(),
      options: document.getElementById('fOpt').value.trim(),
      description: document.getElementById('fDesc').value.trim()
    };
    if (isEdit) body.active = document.getElementById('fActive').checked;
    if (!body.title) return toast('Le titre est requis.', true);
    try {
      if (isEdit) await API.put('/api/admin/products/' + p.id, body, { admin: true });
      else await API.post('/api/admin/products', body, { admin: true });
      toast('Enregistré ✅'); closeModal(); renderCatalog();
    } catch (e) { toast(e.message, true); }
  });
  document.getElementById('fDel')?.addEventListener('click', async () => {
    if (!confirm('Supprimer ce produit ?')) return;
    try { await API.del('/api/admin/products/' + p.id, { admin: true }); toast('Supprimé'); closeModal(); renderCatalog(); }
    catch (e) { toast(e.message, true); }
  });
}

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------
async function renderSettings() {
  view.innerHTML = `<p class="muted small">Chargement…</p>`;
  try { state.settings = await API.get('/api/admin/settings', { admin: true }); }
  catch (e) { if (e.status === 401) return renderLogin(); return view.innerHTML = `<p>${escapeHtml(e.message)}</p>`; }
  const s = state.settings;
  view.innerHTML = `
    <h2 class="section-title">Réglages</h2>
    <div class="card">
      <div class="field"><label>Nom de la boutique</label><input id="sName" value="${escapeHtml(s.businessName || '')}"></div>
      <div class="field"><label>📱 Numéro Wave (qui reçoit les paiements)</label><input id="sWave" value="${escapeHtml(s.waveNumber || '')}" placeholder="ex: +221 77 000 00 00"></div>
      <div class="field"><label>📱 Numéro Orange Money</label><input id="sOM" value="${escapeHtml(s.orangeMoneyNumber || '')}" placeholder="ex: +221 77 000 00 00"></div>
      <div class="field"><label>Devise</label><input id="sCur" value="${escapeHtml(s.currency || 'FCFA')}"></div>
      <div class="field"><label>Frais de service par défaut (%)</label><input id="sFee" type="number" min="0" value="${s.serviceFeePercent ?? 10}"></div>
      <div class="field"><label>Note de livraison</label><textarea id="sNote">${escapeHtml(s.deliveryNote || '')}</textarea></div>
      <button class="btn btn-primary" id="sSave">Enregistrer</button>
    </div>
    <div class="notice">Le mot de passe administrateur se configure via la variable d'environnement <b>ADMIN_PASSWORD</b> sur le serveur.</div>`;
  document.getElementById('sSave').addEventListener('click', async () => {
    try {
      await API.put('/api/admin/settings', {
        businessName: document.getElementById('sName').value.trim(),
        waveNumber: document.getElementById('sWave').value.trim(),
        orangeMoneyNumber: document.getElementById('sOM').value.trim(),
        currency: document.getElementById('sCur').value.trim(),
        serviceFeePercent: Number(document.getElementById('sFee').value) || 0,
        deliveryNote: document.getElementById('sNote').value.trim()
      }, { admin: true });
      toast('Réglages enregistrés ✅');
    } catch (e) { toast(e.message, true); }
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.querySelectorAll('#adminNav .nav-item').forEach(b =>
  b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); }));
logoutBtn.addEventListener('click', () => { API.setAdminToken(null); renderLogin(); });

async function boot() {
  if (!API.getAdminToken()) return renderLogin();
  try { await API.get('/api/admin/settings', { admin: true }); }
  catch { return renderLogin(); }
  nav.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  state.tab = 'orders';
  render();
}
boot();
