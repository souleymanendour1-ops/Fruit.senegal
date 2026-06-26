import { API, money, statusLabel, statusColor, escapeHtml } from './api.js';

// ---------------------------------------------------------------------------
// État global
// ---------------------------------------------------------------------------
const state = {
  tab: 'home',
  user: null,
  settings: { currency: 'FCFA', serviceFeePercent: 10, waveNumber: '', orangeMoneyNumber: '', deliveryNote: '' },
  stores: [],
  products: [],
  cart: loadCart()
};

const view = document.getElementById('view');
const modalRoot = document.getElementById('modalRoot');

// ---------------------------------------------------------------------------
// Panier (localStorage)
// ---------------------------------------------------------------------------
function loadCart() {
  try { return JSON.parse(localStorage.getItem('fs_cart')) || []; } catch { return []; }
}
function saveCart() {
  localStorage.setItem('fs_cart', JSON.stringify(state.cart));
  updateCartCount();
}
function cartTotal() {
  return state.cart.reduce((s, it) => s + (Number(it.unitPrice) || 0) * it.quantity, 0);
}
function updateCartCount() {
  const n = state.cart.reduce((s, it) => s + it.quantity, 0);
  const el = document.getElementById('cartCount');
  el.textContent = n;
  el.classList.toggle('hidden', n === 0);
}
function addToCart(item) {
  // fusionne les articles identiques du catalogue
  if (item.type === 'catalog') {
    const ex = state.cart.find(c => c.type === 'catalog' && c.productId === item.productId && c.options === item.options);
    if (ex) { ex.quantity += item.quantity; saveCart(); toast('Quantité mise à jour dans le panier'); return; }
  }
  state.cart.push(item);
  saveCart();
  toast('Ajouté au panier ✅');
}

// ---------------------------------------------------------------------------
// Utilitaires UI
// ---------------------------------------------------------------------------
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
  document.getElementById('backdrop').addEventListener('click', e => {
    if (e.target.id === 'backdrop') closeModal();
  });
  document.getElementById('modalClose').addEventListener('click', closeModal);
}
function closeModal() { modalRoot.innerHTML = ''; }

function storeBadge(name) {
  const s = state.stores.find(s => s.name.toLowerCase() === String(name).toLowerCase());
  const color = s ? s.color : '#888';
  return `<span class="product-store" style="color:${color}">${escapeHtml(name || '')}</span>`;
}

// ---------------------------------------------------------------------------
// Vues
// ---------------------------------------------------------------------------
function render() {
  document.querySelectorAll('.nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === state.tab));
  ({ home: renderHome, catalog: renderCatalog, link: renderLink, orders: renderOrders, account: renderAccount }[state.tab] || renderHome)();
}

function renderHome() {
  const stores = state.stores.map(s => `
    <div class="store-card" data-url="${escapeHtml(s.url)}" data-name="${escapeHtml(s.name)}">
      <div class="store-logo" style="background:${s.color}">${escapeHtml(s.name[0])}</div>
      <div class="store-name">${escapeHtml(s.name)}</div>
      <div class="store-tag">${escapeHtml(s.tagline)}</div>
    </div>`).join('');

  const featured = state.products.slice(0, 4).map(productCard).join('') ||
    `<p class="muted small">Le catalogue arrive bientôt. Utilisez « Par lien » pour commander n'importe quel produit.</p>`;

  view.innerHTML = `
    <div class="hero">
      <h1>Commandez le monde entier 🌍</h1>
      <p>Vos produits Alibaba, Shein, Temu et Amazon livrés au Sénégal. Payez avec Wave ou Orange Money.</p>
    </div>
    <h2 class="section-title">Nos boutiques partenaires</h2>
    <div class="stores-grid">${stores}</div>
    <h2 class="section-title" style="margin-top:20px">Comment ça marche ?</h2>
    <div class="card small">
      <div class="row"><b>1.</b><span style="flex:1;margin-left:8px">Parcourez une boutique ou collez le lien d'un produit.</span></div>
      <div class="row"><b>2.</b><span style="flex:1;margin-left:8px">Ajoutez au panier et validez votre commande.</span></div>
      <div class="row"><b>3.</b><span style="flex:1;margin-left:8px">Payez via Wave / Orange Money et envoyez la référence.</span></div>
      <div class="row"><b>4.</b><span style="flex:1;margin-left:8px">Nous confirmons et vous donnons la date de livraison.</span></div>
    </div>
    <h2 class="section-title" style="margin-top:20px">Sélection du moment</h2>
    <div class="products-grid">${featured}</div>`;

  view.querySelectorAll('.store-card').forEach(c =>
    c.addEventListener('click', () => openStore(c.dataset.url, c.dataset.name)));
  bindProductCards();
}

function openStore(url, name) {
  openModal(`
    <h3>${escapeHtml(name)}</h3>
    <p class="small muted">Ouvrez la boutique, trouvez le produit qui vous plaît, puis copiez son lien pour le commander ici.</p>
    <a class="btn btn-primary" href="${escapeHtml(url)}" target="_blank" rel="noopener" style="display:block;text-align:center;margin-bottom:10px">Ouvrir ${escapeHtml(name)} ↗</a>
    <button class="btn btn-yellow" id="goLink">📋 J'ai copié un lien → commander</button>`);
  document.getElementById('goLink').addEventListener('click', () => { closeModal(); switchTab('link'); });
}

function productCard(p) {
  const img = p.imageUrl
    ? `<img class="product-img" src="${escapeHtml(p.imageUrl)}" alt="" loading="lazy" onerror="this.classList.add('placeholder');this.removeAttribute('src');this.textContent='🛍️'">`
    : `<div class="product-img placeholder">🛍️</div>`;
  return `<div class="product-card" data-id="${p.id}">
    ${img}
    <div class="product-body">
      ${storeBadge(p.store)}
      <div class="product-title">${escapeHtml(p.title)}</div>
      <div class="product-price">${money(p.price, cur())}</div>
    </div>
  </div>`;
}

function bindProductCards() {
  view.querySelectorAll('.product-card').forEach(c =>
    c.addEventListener('click', () => openProduct(Number(c.dataset.id))));
}

function openProduct(id) {
  const p = state.products.find(p => p.id === id);
  if (!p) return;
  const img = p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" alt="" style="width:100%;border-radius:12px;margin-bottom:12px" onerror="this.style.display='none'">` : '';
  openModal(`
    <h3>${escapeHtml(p.title)}</h3>
    ${img}
    ${storeBadge(p.store)}
    <div class="product-price" style="font-size:22px;margin:8px 0">${money(p.price, cur())}</div>
    ${p.description ? `<p class="small muted">${escapeHtml(p.description)}</p>` : ''}
    ${p.options ? `<div class="field"><label>Option (${escapeHtml(p.options)})</label><input id="pOpt" placeholder="ex: taille M, couleur rouge"></div>` : ''}
    <div class="field"><label>Quantité</label><input id="pQty" type="number" min="1" value="1"></div>
    ${p.url ? `<a class="tag-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">Voir sur ${escapeHtml(p.store || 'la boutique')} ↗</a>` : ''}
    <button class="btn btn-primary mt" id="addBtn">Ajouter au panier</button>`);
  document.getElementById('addBtn').addEventListener('click', () => {
    const qty = Math.max(1, parseInt(document.getElementById('pQty').value, 10) || 1);
    const options = document.getElementById('pOpt')?.value.trim() || '';
    addToCart({ type: 'catalog', productId: p.id, title: p.title, store: p.store, imageUrl: p.imageUrl, url: p.url, unitPrice: p.price, options, quantity: qty });
    closeModal();
  });
}

function renderCatalog() {
  if (state.products.length === 0) {
    view.innerHTML = `<div class="empty"><div class="big">🛍️</div><p>Le catalogue est vide pour le moment.<br>Commandez n'importe quel produit via l'onglet <b>« Par lien »</b>.</p>
      <button class="btn btn-primary" style="max-width:260px;margin:10px auto" onclick="location.hash=''">Commander par lien</button></div>`;
    document.querySelector('.empty button').addEventListener('click', () => switchTab('link'));
    return;
  }
  view.innerHTML = `<h2 class="section-title">Catalogue</h2>
    <div class="products-grid">${state.products.map(productCard).join('')}</div>`;
  bindProductCards();
}

function renderLink() {
  view.innerHTML = `
    <h2 class="section-title">Commander par lien 🔗</h2>
    <div class="notice">Collez le lien d'un produit depuis Alibaba, Shein, Temu, Amazon (ou tout autre site). Indiquez le prix affiché : nous le vérifions et l'ajustons si besoin avant validation.</div>
    <div class="card">
      <div class="field"><label>Lien du produit *</label><input id="lUrl" placeholder="https://..." inputmode="url"></div>
      <div class="field"><label>Nom du produit *</label><input id="lTitle" placeholder="ex: Montre connectée"></div>
      <div class="field"><label>Boutique</label>
        <select id="lStore">
          <option value="">— choisir —</option>
          ${state.stores.map(s => `<option>${escapeHtml(s.name)}</option>`).join('')}
          <option>Autre</option>
        </select></div>
      <div class="row" style="gap:10px">
        <div class="field" style="flex:1"><label>Prix affiché (${cur()}) *</label><input id="lPrice" type="number" min="0" inputmode="numeric" placeholder="0"></div>
        <div class="field" style="width:90px"><label>Quantité</label><input id="lQty" type="number" min="1" value="1"></div>
      </div>
      <div class="field"><label>Taille / couleur / précisions</label><input id="lOpt" placeholder="ex: taille L, couleur noir"></div>
      <div class="field"><label>Lien de l'image (optionnel)</label><input id="lImg" placeholder="https://..."></div>
      <button class="btn btn-primary" id="lAdd">Ajouter au panier</button>
    </div>`;
  document.getElementById('lAdd').addEventListener('click', () => {
    const url = document.getElementById('lUrl').value.trim();
    const title = document.getElementById('lTitle').value.trim();
    const price = Number(document.getElementById('lPrice').value) || 0;
    if (!url || !title) return toast('Lien et nom du produit obligatoires.', true);
    addToCart({
      type: 'link', url, title,
      store: document.getElementById('lStore').value,
      unitPrice: price,
      quantity: Math.max(1, parseInt(document.getElementById('lQty').value, 10) || 1),
      options: document.getElementById('lOpt').value.trim(),
      imageUrl: document.getElementById('lImg').value.trim()
    });
    switchTab('home');
  });
}

// ---------------------------------------------------------------------------
// Panier (modale)
// ---------------------------------------------------------------------------
function openCart() {
  if (state.cart.length === 0) {
    openModal(`<h3>Mon panier</h3><div class="empty"><div class="big">🛒</div><p>Votre panier est vide.</p></div>`);
    return;
  }
  const items = state.cart.map((it, i) => {
    const thumb = it.imageUrl
      ? `<img class="cart-thumb" src="${escapeHtml(it.imageUrl)}" onerror="this.style.display='none'">`
      : `<div class="cart-thumb" style="display:flex;align-items:center;justify-content:center;font-size:24px">🛍️</div>`;
    return `<div class="cart-item">
      ${thumb}
      <div class="cart-info">
        <div class="t">${escapeHtml(it.title)}</div>
        ${it.options ? `<div class="small muted">${escapeHtml(it.options)}</div>` : ''}
        <div class="small" style="color:var(--green);font-weight:700">${money(it.unitPrice, cur())}</div>
        <div class="qty">
          <button data-act="dec" data-i="${i}">−</button>
          <span>${it.quantity}</span>
          <button data-act="inc" data-i="${i}">+</button>
          <button data-act="del" data-i="${i}" style="margin-left:auto;color:var(--red);border:none">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');

  const fee = Math.round(cartTotal() * (state.settings.serviceFeePercent || 0) / 100);
  openModal(`
    <h3>Mon panier</h3>
    ${items}
    <div class="row total-row"><span>Sous-total</span><span>${money(cartTotal(), cur())}</span></div>
    <div class="row small muted"><span>Frais de service (${state.settings.serviceFeePercent || 0}%)</span><span>${money(fee, cur())}</span></div>
    <div class="row total-row"><span>Total estimé</span><span>${money(cartTotal() + fee, cur())}</span></div>
    <p class="small muted">Frais de livraison communiqués lors de la confirmation.</p>
    <button class="btn btn-primary mt" id="checkoutBtn">Commander & payer</button>`);

  modalRoot.querySelectorAll('.qty button').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.i), act = b.dataset.act;
    if (act === 'inc') state.cart[i].quantity++;
    else if (act === 'dec') state.cart[i].quantity = Math.max(1, state.cart[i].quantity - 1);
    else if (act === 'del') state.cart.splice(i, 1);
    saveCart();
    openCart();
  }));
  document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (!state.user) { closeModal(); openAuth(() => openCheckout()); return; }
    openCheckout();
  });
}

// ---------------------------------------------------------------------------
// Paiement / validation
// ---------------------------------------------------------------------------
function openCheckout() {
  const fee = Math.round(cartTotal() * (state.settings.serviceFeePercent || 0) / 100);
  const total = cartTotal() + fee;
  openModal(`
    <h3>Livraison & paiement</h3>
    <div class="field"><label>Téléphone *</label><input id="coPhone" value="${escapeHtml(state.user.phone || '')}" inputmode="tel"></div>
    <div class="field"><label>Adresse de livraison *</label><input id="coAddr" value="${escapeHtml(state.user.address || '')}" placeholder="Quartier, rue, repère"></div>
    <div class="field"><label>Ville *</label><input id="coCity" value="${escapeHtml(state.user.city || '')}" placeholder="ex: Dakar"></div>

    <h3 style="margin-top:18px">Moyen de paiement</h3>
    <div class="pay-option" data-m="wave">
      <div class="pay-logo" style="background:#1dc4ff">Wave</div>
      <div><b>Wave</b><div class="small muted">${escapeHtml(state.settings.waveNumber || 'Numéro communiqué')}</div></div>
    </div>
    <div class="pay-option" data-m="orange_money">
      <div class="pay-logo" style="background:#ff7900">OM</div>
      <div><b>Orange Money</b><div class="small muted">${escapeHtml(state.settings.orangeMoneyNumber || 'Numéro communiqué')}</div></div>
    </div>

    <div id="payInstr" class="hidden">
      <div class="copy-box">
        <div><div class="small muted">Envoyez <b>${money(total, cur())}</b> à</div><div class="num" id="payNum">—</div></div>
        <button class="btn btn-yellow btn-sm" id="copyNum">Copier</button>
      </div>
      <div class="field"><label>Référence / ID de la transaction *</label><input id="coRef" placeholder="ex: TXN12345 ou capture d'écran"></div>
      <p class="small muted">Après avoir payé, copiez l'ID de transaction reçu par SMS et collez-le ci-dessus.</p>
    </div>

    <div class="row total-row"><span>Total à payer</span><span>${money(total, cur())}</span></div>
    <button class="btn btn-primary mt" id="placeOrder" disabled>Confirmer la commande</button>`);

  let method = null;
  modalRoot.querySelectorAll('.pay-option').forEach(o => o.addEventListener('click', () => {
    modalRoot.querySelectorAll('.pay-option').forEach(x => x.classList.remove('selected'));
    o.classList.add('selected');
    method = o.dataset.m;
    document.getElementById('payInstr').classList.remove('hidden');
    document.getElementById('payNum').textContent =
      method === 'wave' ? (state.settings.waveNumber || 'Numéro communiqué après commande')
                        : (state.settings.orangeMoneyNumber || 'Numéro communiqué après commande');
    document.getElementById('placeOrder').disabled = false;
  }));
  document.getElementById('copyNum')?.addEventListener('click', () => {
    const num = document.getElementById('payNum').textContent;
    navigator.clipboard?.writeText(num).then(() => toast('Numéro copié')).catch(() => {});
  });

  document.getElementById('placeOrder').addEventListener('click', async () => {
    const phone = document.getElementById('coPhone').value.trim();
    const deliveryAddress = document.getElementById('coAddr').value.trim();
    const deliveryCity = document.getElementById('coCity').value.trim();
    const paymentRef = document.getElementById('coRef')?.value.trim() || '';
    if (!method) return toast('Choisissez un moyen de paiement.', true);
    if (!phone || !deliveryAddress || !deliveryCity) return toast('Renseignez vos coordonnées de livraison.', true);
    if (paymentRef.length < 4) return toast('Indiquez la référence du paiement.', true);

    const btn = document.getElementById('placeOrder');
    btn.disabled = true; btn.textContent = 'Envoi...';
    try {
      const { order } = await API.post('/api/orders', {
        items: state.cart, paymentMethod: method, paymentRef,
        deliveryAddress, deliveryCity, phone
      });
      state.cart = []; saveCart();
      closeModal();
      openOrderConfirmed(order);
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false; btn.textContent = 'Confirmer la commande';
    }
  });
}

function openOrderConfirmed(order) {
  openModal(`
    <div class="center">
      <div style="font-size:54px">🎉</div>
      <h3>Commande envoyée !</h3>
      <p class="muted">Référence <b>${escapeHtml(order.ref)}</b></p>
    </div>
    <div class="notice">Votre paiement est en cours de vérification par notre équipe. Vous recevrez la confirmation et la <b>date de livraison</b> dans l'onglet « Commandes ».</div>
    <div class="row total-row"><span>Total</span><span>${money(order.total, order.currency)}</span></div>
    <button class="btn btn-primary mt" id="seeOrders">Voir mes commandes</button>`);
  document.getElementById('seeOrders').addEventListener('click', () => { closeModal(); switchTab('orders'); });
}

// ---------------------------------------------------------------------------
// Mes commandes
// ---------------------------------------------------------------------------
async function renderOrders() {
  if (!state.user) {
    view.innerHTML = authPrompt('Connectez-vous pour suivre vos commandes.');
    bindAuthPrompt();
    return;
  }
  view.innerHTML = `<h2 class="section-title">Mes commandes</h2><p class="muted small">Chargement…</p>`;
  try {
    const orders = await API.get('/api/orders/mine');
    if (orders.length === 0) {
      view.innerHTML = `<h2 class="section-title">Mes commandes</h2><div class="empty"><div class="big">📦</div><p>Aucune commande pour le moment.</p></div>`;
      return;
    }
    view.innerHTML = `<h2 class="section-title">Mes commandes</h2>` + orders.map(orderCard).join('');
    view.querySelectorAll('[data-order]').forEach(c =>
      c.addEventListener('click', () => openOrderDetail(orders.find(o => o.id === Number(c.dataset.order)))));
  } catch (e) {
    view.innerHTML = `<div class="empty"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

function orderCard(o) {
  return `<div class="card" data-order="${o.id}" style="cursor:pointer">
    <div class="row">
      <b>${escapeHtml(o.ref)}</b>
      <span class="badge" style="background:${statusColor(o.status)}">${statusLabel(o.status)}</span>
    </div>
    <div class="small muted mt">${o.items.length} article(s) · ${new Date(o.createdAt).toLocaleDateString('fr-FR')}</div>
    <div class="row mt"><span class="muted small">Total</span><b>${money(o.total, o.currency)}</b></div>
    ${o.deliveryDate ? `<div class="row mt"><span class="muted small">📅 Livraison prévue</span><b>${escapeHtml(o.deliveryDate)}</b></div>` : ''}
  </div>`;
}

function openOrderDetail(o) {
  if (!o) return;
  const items = o.items.map(it => `<div class="item-line row">
    <span>${escapeHtml(it.title)} ${it.options ? '· ' + escapeHtml(it.options) : ''} ×${it.quantity}</span>
    <b>${money(it.unitPrice * it.quantity, o.currency)}</b></div>`).join('');
  const steps = ['paiement_soumis', 'paiement_valide', 'en_preparation', 'expedie', 'livre'];
  const curIdx = steps.indexOf(o.status);
  const timeline = steps.map((s, i) => `<div class="row" style="padding:5px 0">
      <span style="font-size:18px">${i <= curIdx && o.status !== 'annule' ? '✅' : '⚪'}</span>
      <span style="flex:1;margin-left:8px;${i === curIdx ? 'font-weight:700' : 'color:var(--muted)'}">${statusLabel(s)}</span>
    </div>`).join('');
  openModal(`
    <h3>${escapeHtml(o.ref)}</h3>
    <span class="badge" style="background:${statusColor(o.status)}">${statusLabel(o.status)}</span>
    ${o.deliveryDate ? `<div class="notice mt">📅 Date de livraison prévue : <b>${escapeHtml(o.deliveryDate)}</b></div>` : ''}
    ${o.adminNote ? `<div class="notice">💬 ${escapeHtml(o.adminNote)}</div>` : ''}
    <h4>Articles</h4>${items}
    <div class="row total-row"><span>Sous-total</span><span>${money(o.subtotal, o.currency)}</span></div>
    <div class="row small muted"><span>Frais de service</span><span>${money(o.serviceFee, o.currency)}</span></div>
    <div class="row total-row"><span>Total</span><span>${money(o.total, o.currency)}</span></div>
    <h4 style="margin-top:16px">Suivi</h4>${o.status === 'annule' ? `<div class="notice">Commande annulée.</div>` : timeline}
    <h4 style="margin-top:16px">Livraison</h4>
    <p class="small muted">${escapeHtml(o.deliveryAddress)}, ${escapeHtml(o.deliveryCity)}<br>📞 ${escapeHtml(o.customerPhone)}</p>
    <p class="small muted">Paiement : ${o.paymentMethod === 'wave' ? 'Wave' : 'Orange Money'} · Réf : ${escapeHtml(o.paymentRef)}</p>`);
}

// ---------------------------------------------------------------------------
// Compte / authentification
// ---------------------------------------------------------------------------
function authPrompt(msg) {
  return `<div class="empty"><div class="big">👤</div><p>${msg}</p>
    <button class="btn btn-primary" id="promptLogin" style="max-width:240px;margin:10px auto">Se connecter / S'inscrire</button></div>`;
}
function bindAuthPrompt() {
  document.getElementById('promptLogin')?.addEventListener('click', () => openAuth());
}

function renderAccount() {
  if (!state.user) {
    view.innerHTML = authPrompt('Connectez-vous pour gérer votre compte.');
    bindAuthPrompt();
    return;
  }
  const u = state.user;
  view.innerHTML = `
    <h2 class="section-title">Mon compte</h2>
    <div class="card">
      <div class="field"><label>Nom</label><input id="acName" value="${escapeHtml(u.name)}"></div>
      <div class="field"><label>Téléphone</label><input value="${escapeHtml(u.phone)}" disabled></div>
      <div class="field"><label>Adresse</label><input id="acAddr" value="${escapeHtml(u.address || '')}"></div>
      <div class="field"><label>Ville</label><input id="acCity" value="${escapeHtml(u.city || '')}"></div>
      <button class="btn btn-primary" id="acSave">Enregistrer</button>
    </div>
    <button class="btn btn-outline" id="acLogout">Se déconnecter</button>
    <p class="center small muted mt"><a href="/admin.html">Accès administrateur →</a></p>`;
  document.getElementById('acSave').addEventListener('click', async () => {
    try {
      const { user } = await API.put('/api/auth/me', {
        name: document.getElementById('acName').value.trim(),
        address: document.getElementById('acAddr').value.trim(),
        city: document.getElementById('acCity').value.trim()
      });
      state.user = user; toast('Profil mis à jour ✅');
    } catch (e) { toast(e.message, true); }
  });
  document.getElementById('acLogout').addEventListener('click', async () => {
    await API.post('/api/auth/logout').catch(() => {});
    API.setToken(null); state.user = null; switchTab('home'); toast('Déconnecté');
  });
}

function openAuth(onSuccess) {
  const form = (login) => login ? `
      <div class="field"><label>Téléphone</label><input id="aPhone" inputmode="tel" placeholder="ex: 77 123 45 67"></div>
      <div class="field"><label>Mot de passe</label><input id="aPass" type="password"></div>`
    : `
      <div class="field"><label>Nom complet</label><input id="aName"></div>
      <div class="field"><label>Téléphone</label><input id="aPhone" inputmode="tel" placeholder="ex: 77 123 45 67"></div>
      <div class="field"><label>Mot de passe</label><input id="aPass" type="password"></div>
      <div class="field"><label>Ville</label><input id="aCity" placeholder="ex: Dakar"></div>`;

  const draw = (login) => {
    openModal(`
      <h3>${login ? 'Connexion' : 'Créer un compte'}</h3>
      ${form(login)}
      <button class="btn btn-primary mt" id="aSubmit">${login ? 'Se connecter' : "S'inscrire"}</button>
      <p class="center small mt">${login ? "Pas de compte ?" : 'Déjà inscrit ?'}
        <a href="#" id="aSwitch">${login ? "S'inscrire" : 'Se connecter'}</a></p>`);
    document.getElementById('aSwitch').addEventListener('click', e => { e.preventDefault(); draw(!login); });
    document.getElementById('aSubmit').addEventListener('click', async () => {
      const phone = document.getElementById('aPhone').value.trim();
      const password = document.getElementById('aPass').value;
      if (!phone || !password) return toast('Téléphone et mot de passe requis.', true);
      try {
        let r;
        if (login) r = await API.post('/api/auth/login', { phone, password });
        else r = await API.post('/api/auth/register', {
          name: document.getElementById('aName').value.trim(),
          phone, password, city: document.getElementById('aCity').value.trim()
        });
        API.setToken(r.token); state.user = r.user;
        closeModal(); toast('Bienvenue ' + r.user.name + ' 👋');
        if (onSuccess) onSuccess(); else render();
      } catch (e) { toast(e.message, true); }
    });
  };
  draw(true);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function switchTab(tab) { state.tab = tab; render(); }

document.querySelectorAll('.nav-item').forEach(b =>
  b.addEventListener('click', () => switchTab(b.dataset.tab)));
document.getElementById('cartBtn').addEventListener('click', openCart);

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  updateCartCount();
  try {
    const [stores, settings, products] = await Promise.all([
      API.get('/api/stores'),
      API.get('/api/settings'),
      API.get('/api/products')
    ]);
    state.stores = stores;
    state.settings = settings;
    state.products = products;
  } catch (e) { console.error(e); }
  if (API.getToken()) {
    try { state.user = (await API.get('/api/auth/me')).user; }
    catch { API.setToken(null); }
  }
  render();
}
init();

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
