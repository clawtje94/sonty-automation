#!/usr/bin/env node
// MEETBON-AFSPRAKEN-SYNC (Daimy 03-09-2026: "meetbonnen-dashboard per dag op adviseur").
// Zet per meetbon de inmeetafspraak (wanneer + inmeter) op de bon, zodat het dashboard per dag
// per adviseur kan tonen. Bronnen, in volgorde van versheid:
//   1. data/planado-agenda-snapshot.json — live Planado-agenda uit de planner-ronde (elke 30 min);
//      kantoor verzet afspraken in Planado, dus dit is leidend voor datum/tijd/inmeter.
//   2. data/inmeet-boekingen.json — eigen boekingen (grippNr ↔ planadoJobUuid, aankomst, inmeter),
//      ook de koppeling uuid → Gripp-nummer voor de snapshot.
//   3. bon.afspraak.planadoJob (gezet door het dashboard-formulier) → koppeling naar snapshot.
//   4. Planado-jobdetail: omschrijving bevat "Gripp: <nr>" of de meetbon-link (Outlook/Bookings-afspraken, external_id ol-…)
//      → data/meetbon-planado-gripp-cache.json, één detail-call per afspraak (rate-limit Planado: 2,6 s tussen calls, max 40 per run).
// Schrijft via POST /api/meetbon/afspraak (alleen het veld afspraak, status blijft ongemoeid).
// Draait via launchd nl.sonty.meetbon-afspraken (elke 15 min) + interval-runner-vangnet. --dry = niet schrijven.
const fs = require('fs');
const path = require('path');
const SECRETS = require('./secrets.js');
const API = 'https://sonty-website.vercel.app/api/meetbon';
const DRY = process.argv.includes('--dry');
const D = path.join(__dirname, '..', 'data');

function lees(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
/** Pure functie (getest in tests/meetbon-afspraken-regressie.js): bronnen → lijst afspraken per gripp. */
function bepaalAfspraken({ snapshot, boekingen, bonnen, koppelingen = {} }) {
  const uuidNaarGripp = new Map();
  // 4. uit de Planado-omschrijving ("Gripp: 6278" / meetbon-link) — Outlook/Bookings-afspraken hebben geen eigen boeking
  for (const [uuid, gripp] of Object.entries(koppelingen || {})) if (uuid && gripp) uuidNaarGripp.set(uuid, String(gripp).replace(/\D/g, ''));
  for (const b of boekingen || []) if (b && b.planadoJobUuid && b.grippNr) uuidNaarGripp.set(b.planadoJobUuid, String(b.grippNr).replace(/\D/g, ''));
  for (const b of bonnen || []) if (b && b.afspraak?.planadoJob && b.gripp) uuidNaarGripp.set(b.afspraak.planadoJob, String(b.gripp));
  const uit = new Map();
  // 2. eigen boekingen als basis (ook historie)
  for (const b of boekingen || []) {
    if (!b || !b.grippNr || !b.aankomst || b.status === 'geannuleerd') continue;
    const gripp = String(b.grippNr).replace(/\D/g, '');
    uit.set(gripp, { gripp, wanneer: new Date(b.aankomst).toISOString(), inmeter: b.inmeter || null, planadoJob: b.planadoJobUuid || null, bron: 'boeking' });
  }
  // 1. live Planado-agenda overschrijft (verzet/andere inmeter)
  for (const it of (snapshot && snapshot.items) || []) {
    if (!it) continue;
    let gripp = uuidNaarGripp.get(it.uuid) || null;
    const m = /^(?:gripp|meetbon)-(\d+)$/.exec(it.externalId || '');
    if (!gripp && m) gripp = m[1];
    if (!gripp || !it.start) continue;
    uit.set(gripp, { gripp, wanneer: new Date(it.start).toISOString(), inmeter: it.inmeter || null, planadoJob: it.uuid, bron: 'planado' });
  }
  // alleen sturen wat anders is dan wat er al op de bon staat
  const huidig = new Map((bonnen || []).filter((b) => b && b.gripp).map((b) => [String(b.gripp), b.afspraak || null]));
  const lijst = [...uit.values()].filter((a) => {
    if (!huidig.has(a.gripp)) return false; // geen bon → niets om op te zetten
    const h = huidig.get(a.gripp);
    return !h || h.wanneer !== a.wanneer || (h.inmeter || null) !== (a.inmeter || null) || (h.planadoJob || null) !== (a.planadoJob || null);
  });
  return { lijst, totaal: uit.size };
}

const KOPPEL_CACHE = path.join(D, 'meetbon-planado-gripp-cache.json');
const MAX_AANMAKEN = 25; // per run: elke aanmaak is een Gripp-call (offer.get) — zuinig
/** Pure: gekoppelde afspraken in het venster waarvoor nog geen bon bestaat (Outlook/Bookings-afspraken krijgen
 * anders pas een bon als de inmeter de link opent, en staan tot die tijd niet op het dashboard — Daimy 03-09). */
function bonnenOmAanTeMaken({ snapshot, boekingen, bonnen, koppelingen, nu = Date.now() }) {
  const bestaat = new Set((bonnen || []).filter((b) => b && b.gripp).map((b) => String(b.gripp)));
  const uuidNaarGripp = new Map(Object.entries(koppelingen || {}).map(([u, g]) => [u, String(g).replace(/\D/g, '')]));
  for (const b of boekingen || []) if (b && b.planadoJobUuid && b.grippNr && b.status !== 'geannuleerd') uuidNaarGripp.set(b.planadoJobUuid, String(b.grippNr).replace(/\D/g, ''));
  const uit = new Map();
  for (const it of (snapshot && snapshot.items) || []) {
    if (!it || !it.uuid || !it.start) continue;
    const m = /^(?:gripp|meetbon)-(\d+)$/.exec(it.externalId || '');
    const gripp = uuidNaarGripp.get(it.uuid) || (m ? m[1] : null);
    if (!gripp || bestaat.has(gripp) || uit.has(gripp)) continue;
    const t = Date.parse(it.start); if (!(t > nu - 864e5 && t < nu + VENSTER_DAGEN * 864e5)) continue;
    uit.set(gripp, { gripp, start: it.start, klant: it.klant || '' });
  }
  return [...uit.values()].sort((a, b) => a.start.localeCompare(b.start));
}
async function maakBonnen(lijst) {
  let gemaakt = 0, fout = 0;
  for (const x of lijst.slice(0, MAX_AANMAKEN)) {
    const r = await fetch(API + '/bon/' + x.gripp, { headers: { 'x-meet-code': process.env.MEETBON_CODE || '2288' } }).catch(() => null);
    if (r && r.ok) gemaakt++; else fout++;
  }
  return { gemaakt, fout, nogTeDoen: Math.max(0, lijst.length - MAX_AANMAKEN) };
}
const MAX_CALLS = 40, WACHT_MS = 2600, HERCHECK_UUR = 6, VENSTER_DAGEN = 60;
/** Pure: Gripp-nummer uit een Planado-omschrijving. */
function grippUitOmschrijving(tekst) {
  const t = String(tekst || '');
  const m = /admin\/meetbon\/(\d+)/.exec(t) || /\bGripp:?\s*#?(\d{3,6})\b/i.exec(t);
  return m ? m[1] : null;
}
/** Pure: welke snapshot-jobs nog een detail-call nodig hebben (ongekoppeld, inmeten, in venster, niet vers in cache). */
function teBevragen({ snapshot, boekingen, bonnen, cache, nu = Date.now() }) {
  const bekend = new Set();
  for (const b of boekingen || []) if (b && b.planadoJobUuid && b.grippNr) bekend.add(b.planadoJobUuid);
  for (const b of bonnen || []) if (b && b.afspraak?.planadoJob) bekend.add(b.afspraak.planadoJob);
  const uit = [];
  for (const it of (snapshot && snapshot.items) || []) {
    if (!it || !it.uuid || !it.start || bekend.has(it.uuid)) continue;
    if (/^(gripp|meetbon)-\d+$/.test(it.externalId || '')) continue;
    if (!/inmeten/i.test(it.klant || '')) continue;
    const t = Date.parse(it.start); if (!(t > nu - 864e5 && t < nu + VENSTER_DAGEN * 864e5)) continue;
    const c = cache[it.uuid];
    if (c && (c.gripp || nu - Date.parse(c.op) < HERCHECK_UUR * 36e5)) continue;
    uit.push(it.uuid);
  }
  return uit;
}
async function planadoDetail(uuid) {
  const key = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
  for (let p = 0; p < 4; p++) {
    const r = await fetch('https://api.planadoapp.com/v2/jobs/' + uuid, { headers: { Authorization: 'Bearer ' + key } });
    const t = await r.text();
    if (r.ok) { try { const j = JSON.parse(t); return j.job || j; } catch { /* rate-limit-tekst */ } }
    else if (r.status !== 429 && r.status < 500) return null;
    await new Promise((res) => setTimeout(res, 15000 * (p + 1)));
  }
  return null;
}
async function koppelViaPlanado({ snapshot, boekingen, bonnen }) {
  const cache = lees(KOPPEL_CACHE, {});
  const lijst = teBevragen({ snapshot, boekingen, bonnen, cache });
  let calls = 0, gevonden = 0;
  for (const uuid of lijst.slice(0, MAX_CALLS)) {
    if (DRY) break;
    const det = await planadoDetail(uuid); calls++;
    const gripp = det ? grippUitOmschrijving(det.description) : null;
    // telefoons erbij: lib/kantoor-afspraak.js vindt hiermee een afspraak op nummer zonder naam (Lotte Vos 03-09)
    const tel = det ? (det.contacts || []).map((c) => String(c.value || '').replace(/\D/g, '').slice(-9)).filter((x) => x.length === 9) : [];
    cache[uuid] = { gripp, tel, op: new Date().toISOString() };
    if (gripp) gevonden++;
    await new Promise((res) => setTimeout(res, WACHT_MS));
  }
  if (calls) fs.writeFileSync(KOPPEL_CACHE, JSON.stringify(cache));
  const koppelingen = {};
  for (const [u, c] of Object.entries(cache)) if (c && c.gripp) koppelingen[u] = c.gripp;
  return { koppelingen, calls, gevonden, nogTeDoen: Math.max(0, lijst.length - calls), inCache: Object.keys(koppelingen).length };
}

async function main() {
  const snapshot = lees(path.join(D, 'planado-agenda-snapshot.json'), null);
  const boekRaw = lees(path.join(D, 'inmeet-boekingen.json'), []);
  const boekingen = Array.isArray(boekRaw) ? boekRaw : Object.values(boekRaw);
  if (snapshot && Date.now() - Date.parse(snapshot.ts) > 6 * 36e5) console.log('  ! agenda-snapshot ouder dan 6 uur (' + snapshot.ts + ') — planner-ronde draait niet?');
  const r = await fetch(API, { headers: { Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD } });
  if (!r.ok) throw new Error('bonnenlijst ' + r.status);
  const bonnen = (await r.json()).bonnen || [];
  const k = await koppelViaPlanado({ snapshot, boekingen, bonnen });
  // Bonnen vooraf aanmaken (voorgevuld uit Gripp) zodat ze op het dashboard staan vóór de inmeter de link opent.
  const aanmaken = bonnenOmAanTeMaken({ snapshot, boekingen, bonnen, koppelingen: k.koppelingen });
  let a = { gemaakt: 0, fout: 0, nogTeDoen: aanmaken.length };
  if (aanmaken.length && !DRY) {
    a = await maakBonnen(aanmaken);
    for (const x of aanmaken.slice(0, a.gemaakt + a.fout)) bonnen.push({ gripp: x.gripp, afspraak: null }); // zelfde run de afspraak erop
  }
  const { lijst, totaal } = bepaalAfspraken({ snapshot, boekingen, bonnen, koppelingen: k.koppelingen });
  console.log(`${new Date().toISOString()} meetbon-afspraken: ${bonnen.length} bonnen, ${totaal} afspraken bekend (snapshot ${snapshot ? snapshot.items.length : 0}, boekingen ${boekingen.length}, planado-koppelingen ${k.inCache}; ${k.calls} detail-calls, ${k.gevonden} nieuw, ${k.nogTeDoen} volgende run; bonnen aangemaakt ${a.gemaakt}, mislukt ${a.fout}, nog ${a.nogTeDoen}), ${lijst.length} te schrijven`);
  if (!lijst.length || DRY) { if (DRY) for (const a of lijst.slice(0, 15)) console.log('  [dry]', a.gripp, a.wanneer, a.inmeter, a.bron); return; }
  const w = await fetch(API + '/afspraak', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD }, body: JSON.stringify({ afspraken: lijst }) });
  const j = await w.json().catch(() => ({}));
  if (!w.ok) throw new Error('schrijven ' + w.status + ' ' + JSON.stringify(j).slice(0, 200));
  console.log(`  geschreven: ${j.bijgewerkt} bijgewerkt, ${j.onbekend} zonder bon`);
}
if (require.main === module) main().catch((e) => { console.log(new Date().toISOString(), 'meetbon-afspraken FOUT:', e.message); process.exit(1); });
module.exports = { bepaalAfspraken, grippUitOmschrijving, teBevragen, bonnenOmAanTeMaken };
