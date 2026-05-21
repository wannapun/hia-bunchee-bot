// storage.js — Firestore wrapper for per-user expense entries

const admin = require('firebase-admin');

let db;
function init() {
  if (db) return db;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing');
  const credentials = typeof svc === 'string' ? JSON.parse(svc) : svc;
  admin.initializeApp({ credential: admin.credential.cert(credentials) });
  db = admin.firestore();
  return db;
}

async function addEntry(userId, entry) {
  const d = init();
  const doc = await d.collection('users').doc(userId).collection('entries').add({
    ...entry,
    date: entry.date || new Date(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return doc.id;
}

async function getEntries(userId, { limit = 500 } = {}) {
  const d = init();
  const snap = await d.collection('users').doc(userId).collection('entries')
    .orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map(s => ({ id: s.id, ...s.data(), date: s.data().date?.toDate?.() || s.data().date }));
}

async function deleteEntry(userId, entryId) {
  const d = init();
  await d.collection('users').doc(userId).collection('entries').doc(entryId).delete();
}

async function getLastEntry(userId) {
  const d = init();
  const snap = await d.collection('users').doc(userId).collection('entries')
    .orderBy('createdAt', 'desc').limit(1).get();
  if (snap.empty) return null;
  const s = snap.docs[0];
  return { id: s.id, ...s.data(), date: s.data().date?.toDate?.() || s.data().date };
}

async function getBudgets(userId) {
  const d = init();
  const doc = await d.collection('users').doc(userId).get();
  return doc.exists ? (doc.data().budgets || {}) : {};
}

async function setBudget(userId, category, amount) {
  const d = init();
  await d.collection('users').doc(userId).set(
    { budgets: { [category]: amount } },
    { merge: true }
  );
}

async function getPersonality(userId) {
  const d = init();
  const doc = await d.collection('users').doc(userId).get();
  return (doc.exists && doc.data().personality) || 'ใจดี';
}

async function setPersonality(userId, mode) {
  const d = init();
  await d.collection('users').doc(userId).set({ personality: mode }, { merge: true });
}

module.exports = {
  addEntry, getEntries, deleteEntry, getLastEntry,
  getBudgets, setBudget, getPersonality, setPersonality,
};
