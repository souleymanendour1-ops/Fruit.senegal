// Utilitaires d'authentification : hachage de mot de passe (scrypt) et jetons.
import crypto from 'node:crypto';
import { db } from './db.js';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

// --- Sessions client ---
export function createSession(userId) {
  const token = newToken();
  db.get().sessions[token] = { userId, createdAt: Date.now() };
  db.save();
  return token;
}

export function getUserFromToken(token) {
  if (!token) return null;
  const sess = db.get().sessions[token];
  if (!sess) return null;
  return db.get().users.find(u => u.id === sess.userId) || null;
}

export function destroySession(token) {
  if (token && db.get().sessions[token]) {
    delete db.get().sessions[token];
    db.save();
  }
}

// --- Sessions admin ---
export function createAdminSession() {
  const token = newToken();
  db.get().adminSessions[token] = { createdAt: Date.now() };
  db.save();
  return token;
}

export function isAdminToken(token) {
  return !!(token && db.get().adminSessions[token]);
}

// Middleware Express
export function bearer(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export function requireUser(req, res, next) {
  const user = getUserFromToken(bearer(req));
  if (!user) return res.status(401).json({ error: 'Connexion requise.' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (!isAdminToken(bearer(req))) return res.status(401).json({ error: 'Accès administrateur requis.' });
  next();
}
