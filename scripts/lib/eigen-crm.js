// EIGEN CRM (sonty-website) als bron naast Reuzenpanda — blok 1 van "Reuzenpanda uitzetten" (30-08-2026).
// Eigen leads komen via /api/eigen-crm in de vorm van een RP-backlog-item binnen, met id "LEAD-…".
// Alles wat een RP-item verwacht (planner, Sunny, verzoek-daemon) kan daardoor met minimale aanpassing eigen leads aan.
//   isEigen(id)                      → 'LEAD-…' = eigen lead
//   bronAan()                        → vlag data/.eigen-crm-bron (uit = eigen leads worden genegeerd)
//   haalInmeetItems()                → eigen leads op "Inmeten inplannen" (RP-vorm)
//   haalItem(id)                     → één eigen lead (RP-vorm)
//   zoek({telefoon,email})           → eigen leads (RP-vorm) voor de klantcontext van Sunny
//   verstuurd(dagen)                 → eigen offertes verstuurd in de laatste N dagen (+ .sheet-velden voor het register)
//   zetKolom(id, kolomId)            → i.p.v. rpZetStatus voor eigen leads
//   zetAdres(id, adres)              → adres uit de winkel terugschrijven (i.p.v. RP fields.address)
//   notitie(id, tekst)               → i.p.v. description-PATCH in RP
const fs = require('fs');
const path = require('path');

const BASIS = process.env.EIGEN_CRM_BASIS || 'https://sonty-website.vercel.app/api/eigen-crm';
const VLAG = path.join(__dirname, '..', '..', 'data', '.eigen-crm-bron');
let TOKEN = null;
function token() {
  if (TOKEN) return TOKEN;
  try { TOKEN = require('../secrets.js').ADMIN_PASSWORD; } catch { TOKEN = process.env.ADMIN_PASSWORD || ''; }
  return TOKEN;
}
function isEigen(id) { return typeof id === 'string' && id.startsWith('LEAD-'); }
function bronAan() { return fs.existsSync(VLAG); }

async function api(pad, init = {}) {
  const r = await fetch(BASIS + pad, { ...init, headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`eigen-crm ${r.status} op ${pad}`);
  return r.json();
}
async function haalInmeetItems() { if (!bronAan()) return []; const d = await api('?kolom=inmeten'); return d.items || []; }
async function haalKolom(kolomId) { if (!bronAan()) return []; const d = await api('?kolom=' + encodeURIComponent(kolomId)); return d.items || []; }
async function haalItem(id) { const d = await api('?id=' + encodeURIComponent(id)); return d.item || null; }
async function zoek({ telefoon, email }) {
  if (!bronAan()) return [];
  const uit = [];
  if (telefoon) { try { uit.push(...((await api('?telefoon=' + encodeURIComponent(telefoon))).items || [])); } catch { /* geen match */ } }
  if (email) { try { for (const it of (await api('?email=' + encodeURIComponent(email))).items || []) if (!uit.some((x) => x.id === it.id)) uit.push(it); } catch { /* geen match */ } }
  return uit;
}
async function verstuurd(dagen = 45) { if (!bronAan()) return []; const d = await api('?verstuurd=' + Number(dagen)); return d.items || []; }
async function zetKolom(id, kolomId) { const d = await api('', { method: 'PATCH', body: JSON.stringify({ id, kolomId }) }); return !!d.ok; }
async function zetAdres(id, adres) { const d = await api('', { method: 'PATCH', body: JSON.stringify({ id, adres }) }); return !!d.ok; }
async function notitie(id, tekst, actor = 'automation') { const d = await api('', { method: 'PATCH', body: JSON.stringify({ id, notitie: tekst, actor }) }); return !!d.ok; }

module.exports = { isEigen, bronAan, haalInmeetItems, haalKolom, haalItem, zoek, verstuurd, zetKolom, zetAdres, notitie, VLAG, BASIS };
