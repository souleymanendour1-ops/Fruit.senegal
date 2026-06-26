// Helper d'appel API partagé entre la boutique et l'admin.
export const API = {
  tokenKey: 'fs_token',
  adminKey: 'fs_admin_token',

  getToken() { return localStorage.getItem(this.tokenKey); },
  setToken(t) { t ? localStorage.setItem(this.tokenKey, t) : localStorage.removeItem(this.tokenKey); },
  getAdminToken() { return localStorage.getItem(this.adminKey); },
  setAdminToken(t) { t ? localStorage.setItem(this.adminKey, t) : localStorage.removeItem(this.adminKey); },

  async req(method, path, body, { admin = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = admin ? this.getAdminToken() : this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch { /* pas de corps */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Erreur ' + res.status);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get(p, o) { return this.req('GET', p, null, o); },
  post(p, b, o) { return this.req('POST', p, b, o); },
  put(p, b, o) { return this.req('PUT', p, b, o); },
  patch(p, b, o) { return this.req('PATCH', p, b, o); },
  del(p, o) { return this.req('DELETE', p, null, o); }
};

// Formatage monétaire
export function money(n, currency = 'FCFA') {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('fr-FR') + ' ' + currency;
}

export function statusLabel(s) {
  return {
    paiement_soumis: 'Paiement à valider',
    paiement_valide: 'Paiement validé / pris en charge',
    en_preparation: 'En préparation',
    expedie: 'Expédié',
    livre: 'Livré',
    annule: 'Annulé'
  }[s] || s;
}

export function statusColor(s) {
  return {
    paiement_soumis: '#b8860b',
    paiement_valide: '#1b8a5a',
    en_preparation: '#2563eb',
    expedie: '#7c3aed',
    livre: '#15803d',
    annule: '#b91c1c'
  }[s] || '#555';
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
