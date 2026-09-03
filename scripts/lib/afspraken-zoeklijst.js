'use strict';
// ZOEKLIJST INMEETAFSPRAKEN (Daimy 03-09, geval Markus Naumer: "waarom kan ik hier niet een klant
// opzoeken"). De winkelpagina /admin/inmeet-mutatie kon alleen blind een naam/telefoon insturen; een
// klant die alleen in Outlook/Planado stond (kantoor-afspraak) was onvindbaar en een gemiste afspraak
// van vandaag stond nergens meer. Deze lijst bundelt ALLE inmeetafspraken uit twee bronnen:
//   - bot-boekingen (data/inmeet-boekingen.json): geboekt / verzet / geannuleerd
//   - kantoor-afspraken (data/planado-agenda-snapshot.json): "Inmeten … - <naam>" uit Outlook→Planado
// en onthoudt wat hij eerder zag (data/afspraken-zoeklijst.json), zodat een afspraak die geweest is
// (en dus uit de agenda-snapshot verdwijnt) nog 45 dagen terug te vinden is.
// Puur deel: bouwLijst() — lab: ~/sonty/scenario-lab/onderdelen/afspraken-zoeklijst.js
const fs = require('fs');
const path = require('path');

const D = path.join(__dirname, '..', '..', 'data');
const BOEKINGEN = path.join(D, 'inmeet-boekingen.json');
const SNAPSHOT = path.join(D, 'planado-agenda-snapshot.json');
const KOPPEL_CACHE = path.join(D, 'meetbon-planado-gripp-cache.json');
const LIJST = path.join(D, 'afspraken-zoeklijst.json');
const VENSTER_TERUG_MS = 45 * 86400e3;

const lees = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
const laatste9 = (t) => String(t || '').replace(/\D/g, '').slice(-9);
/** "Inmeten Sonty - Markus Naumer" / "Inmeten — Tim Mesman" → "Markus Naumer" */
function klantNaam(klant) {
  return String(klant || '').replace(/^\s*inmeten(\s+sonty)?\s*[-—–:]?\s*/i, '').replace(/\s+/g, ' ').trim();
}

/**
 * Puur. Geeft de zoeklijst: één regel per afspraak, nieuwste eerst.
 * @param {object} p
 * @param {object} p.boekingen   inhoud inmeet-boekingen.json ({ rpItemId: {...} })
 * @param {object} p.snapshot    inhoud planado-agenda-snapshot.json ({ ts, items })
 * @param {object} p.koppelCache inhoud meetbon-planado-gripp-cache.json ({ uuid: { tel: ['6…'] } })
 * @param {object[]} p.eerder    de vorige lijst (zelfde vorm als de uitkomst)
 * @param {number} p.nu          Date.now()
 */
function bouwLijst({ boekingen = {}, snapshot = { items: [] }, koppelCache = {}, eerder = [], nu = Date.now() }) {
  const grens = nu - VENSTER_TERUG_MS;
  const uit = new Map(); // sleutel → regel
  const tijdStatus = (aankomst) => (Date.parse(aankomst) < nu ? 'geweest' : 'komend');

  // 1. bot-boekingen: de rijkste bron (rpItemId, telefoon, e-mail, Gripp)
  for (const [rpItemId, b] of Object.entries(boekingen || {})) {
    if (!b || !b.aankomst || Number.isNaN(Date.parse(b.aankomst)) || Date.parse(b.aankomst) < grens) continue;
    const status = b.status === 'geboekt' ? tijdStatus(b.aankomst) : (b.status === 'verzet' ? 'verzet' : (b.status === 'geannuleerd' ? 'geannuleerd' : (b.status === 'bezig' ? 'bezig' : null)));
    if (!status) continue;
    uit.set('bot:' + rpItemId + ':' + b.aankomst, {
      sleutel: 'bot:' + rpItemId + ':' + b.aankomst, bron: 'bot', rpItemId, planadoJobUuid: b.planadoJobUuid || null,
      naam: String(b.naam || '').trim() || 'klant', telefoon: b.telefoon || null, email: b.email || null,
      aankomst: b.aankomst, inmeter: b.inmeter || null, duurMin: b.duurMin || null, grippNr: b.grippNr || null, status,
    });
  }
  const botUuids = new Set([...uit.values()].map((r) => r.planadoJobUuid).filter(Boolean));

  // 2. kantoor-afspraken uit de agenda-snapshot (alleen "Inmeten …", niet OPTIE/montage)
  const snapUuids = new Set();
  for (const it of (snapshot && snapshot.items) || []) {
    if (!it || !it.uuid || !it.start || !/inmeten/i.test(it.klant || '')) continue;
    snapUuids.add(it.uuid);
    if (botUuids.has(it.uuid) || Date.parse(it.start) < grens) continue;
    const tel9 = (Array.isArray(koppelCache[it.uuid]?.tel) ? koppelCache[it.uuid].tel : []).find((t) => laatste9(t).length === 9) || null;
    const sleutel = 'kantoor:' + it.uuid;
    uit.set(sleutel, {
      sleutel, bron: 'kantoor', rpItemId: /^rp-/.test(it.externalId || '') ? it.externalId.slice(3) : null, planadoJobUuid: it.uuid,
      naam: klantNaam(it.klant) || 'klant', telefoon: tel9 ? '0' + laatste9(tel9) : null, email: null,
      aankomst: it.start, inmeter: it.inmeter || null, duurMin: it.eind ? Math.round((Date.parse(it.eind) - Date.parse(it.start)) / 60000) : null, grippNr: null, status: tijdStatus(it.start),
    });
  }

  // 3. geheugen: telefoon/e-mail die eerder (via Planado) gevonden zijn meenemen, en wat nu niet meer in een bron staat
  for (const r of eerder || []) {
    if (!r || !r.sleutel) continue;
    const vers = uit.get(r.sleutel);
    if (vers) { if (!vers.telefoon && r.telefoon) vers.telefoon = r.telefoon; if (!vers.email && r.email) vers.email = r.email; if (r.telefoonGezocht && !vers.telefoon) vers.telefoonGezocht = r.telefoonGezocht; continue; }
    if (!r.aankomst || Date.parse(r.aankomst) < grens) continue;
    if (r.bron === 'bot') continue; // bot-boekingen staan altijd in het boekingenbestand; weg = echt weg
    const snapshotIsVers = !!(snapshot && snapshot.ts && Date.parse(snapshot.ts) > nu - 3 * 3600e3);
    // in de toekomst en uit de snapshot verdwenen terwijl die vers is → in Outlook verwijderd
    const status = Date.parse(r.aankomst) < nu ? 'geweest' : (snapshotIsVers && !snapUuids.has(r.planadoJobUuid) ? 'verwijderd' : r.status);
    uit.set(r.sleutel, { ...r, status });
  }

  return [...uit.values()].sort((a, b) => String(b.aankomst).localeCompare(String(a.aankomst)));
}

/** Bouw uit de bestanden op schijf, bewaar het geheugen en geef de lijst terug. */
function bouwVanSchijf(nu = Date.now()) {
  const lijst = bouwLijst({ boekingen: lees(BOEKINGEN, {}), snapshot: lees(SNAPSHOT, { items: [] }), koppelCache: lees(KOPPEL_CACHE, {}), eerder: lees(LIJST, { lijst: [] }).lijst || [], nu });
  try { fs.writeFileSync(LIJST, JSON.stringify({ bijgewerkt: new Date(nu).toISOString(), lijst })); } catch { /* geheugen is extra */ }
  return lijst;
}

/** Kantoor-regels zonder telefoon: nummer uit de Planado-opdracht halen (max `max` per ronde; blijft via het geheugen bewaard). */
async function vulTelefoonsAan(lijst, { max = 12, opUuid } = {}) {
  const haal = opUuid || require('./kantoor-afspraak.js').kantoorAfspraakOpUuid;
  let n = 0;
  for (const r of lijst) {
    if (n >= max) break;
    if (r.bron !== 'kantoor' || r.telefoon || !r.planadoJobUuid || r.telefoonGezocht) continue;
    n++;
    try {
      const k = await haal(r.planadoJobUuid);
      if (k?.telefoon) r.telefoon = k.telefoon;
      if (k?.klant && (!r.naam || r.naam === 'klant')) r.naam = k.klant;
    } catch { /* volgende ronde opnieuw */ }
    r.telefoonGezocht = new Date().toISOString(); // ook zonder nummer: niet elke ronde opnieuw bevragen
  }
  return n;
}

/** Publiceer naar de site (KV), zodat /admin/inmeet-mutatie direct kan zoeken. */
async function publiceer({ dashApi, meetCode, nu = Date.now() } = {}) {
  const lijst = bouwVanSchijf(nu);
  try {
    if (await vulTelefoonsAan(lijst)) fs.writeFileSync(LIJST, JSON.stringify({ bijgewerkt: new Date(nu).toISOString(), lijst }));
  } catch { /* nummers zijn extra; de lijst zelf gaat altijd door */ }
  const r = await fetch(dashApi || 'https://sonty-website.vercel.app/api/inmeet-dashboard', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': meetCode || process.env.MEETBON_CODE || '2288' },
    body: JSON.stringify({ afspraken: lijst, afsprakenBijgewerkt: new Date(nu).toISOString() }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error('zoeklijst publiceren: HTTP ' + r.status);
  return lijst.length;
}

module.exports = { bouwLijst, klantNaam, bouwVanSchijf, vulTelefoonsAan, publiceer, laatste9 };

if (require.main === module) {
  publiceer().then((n) => console.log('zoeklijst gepubliceerd:', n, 'afspraken')).catch((e) => { console.error(e.message); process.exit(1); });
}
