#!/usr/bin/env node
// MEETBON-AFSPRAKEN-SYNC (Daimy 03-09-2026: "meetbonnen-dashboard per dag op adviseur").
// Zet per meetbon de inmeetafspraak (wanneer + inmeter) op de bon, zodat het dashboard per dag
// per adviseur kan tonen. Bronnen, in volgorde van versheid:
//   1. data/planado-agenda-snapshot.json — live Planado-agenda uit de planner-ronde (elke 30 min);
//      kantoor verzet afspraken in Planado, dus dit is leidend voor datum/tijd/inmeter.
//   2. data/inmeet-boekingen.json — eigen boekingen (grippNr ↔ planadoJobUuid, aankomst, inmeter),
//      ook de koppeling uuid → Gripp-nummer voor de snapshot.
//   3. bon.afspraak.planadoJob (gezet door het dashboard-formulier) → koppeling naar snapshot.
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
function bepaalAfspraken({ snapshot, boekingen, bonnen }) {
  const uuidNaarGripp = new Map();
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

async function main() {
  const snapshot = lees(path.join(D, 'planado-agenda-snapshot.json'), null);
  const boekRaw = lees(path.join(D, 'inmeet-boekingen.json'), []);
  const boekingen = Array.isArray(boekRaw) ? boekRaw : Object.values(boekRaw);
  if (snapshot && Date.now() - Date.parse(snapshot.ts) > 6 * 36e5) console.log('  ! agenda-snapshot ouder dan 6 uur (' + snapshot.ts + ') — planner-ronde draait niet?');
  const r = await fetch(API, { headers: { Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD } });
  if (!r.ok) throw new Error('bonnenlijst ' + r.status);
  const bonnen = (await r.json()).bonnen || [];
  const { lijst, totaal } = bepaalAfspraken({ snapshot, boekingen, bonnen });
  console.log(`${new Date().toISOString()} meetbon-afspraken: ${bonnen.length} bonnen, ${totaal} afspraken bekend (snapshot ${snapshot ? snapshot.items.length : 0}, boekingen ${boekingen.length}), ${lijst.length} te schrijven`);
  if (!lijst.length || DRY) { if (DRY) for (const a of lijst.slice(0, 15)) console.log('  [dry]', a.gripp, a.wanneer, a.inmeter, a.bron); return; }
  const w = await fetch(API + '/afspraak', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD }, body: JSON.stringify({ afspraken: lijst }) });
  const j = await w.json().catch(() => ({}));
  if (!w.ok) throw new Error('schrijven ' + w.status + ' ' + JSON.stringify(j).slice(0, 200));
  console.log(`  geschreven: ${j.bijgewerkt} bijgewerkt, ${j.onbekend} zonder bon`);
}
if (require.main === module) main().catch((e) => { console.log(new Date().toISOString(), 'meetbon-afspraken FOUT:', e.message); process.exit(1); });
module.exports = { bepaalAfspraken };
