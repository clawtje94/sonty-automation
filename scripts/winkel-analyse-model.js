#!/usr/bin/env node
// Winkellocatie-onderzoek stap 3: uplift-model per kandidaat-stad.
// Kern: conversie is sterk afstandsafhankelijk (gemeten curve rond Rijswijk).
// Een nieuwe winkel trekt de verwachte conversie in zijn verzorgingsgebied
// naar de curve-waarde op de (kortere) afstand tot die winkel.
// Output: ../sonty-website/data/winkel-analyse.json
const fs = require('fs');
const geo = require('../data/winkel-geo.json');
const leads = require('../data/winkel-leads.json');

const RIJSWIJK = { lat: 52.0365, lon: 4.3253 };
const RUIS = new Set(['nb', 'onbekend', '-', 'x', 'test']);

// gemeten conversie-curve per afstandsband tot showroom (uit 19.6k leads)
const CURVE = [
  { tot: 10, conv: 0.266 },
  { tot: 20, conv: 0.151 },
  { tot: 30, conv: 0.107 },
  { tot: 50, conv: 0.079 },
  { tot: 80, conv: 0.040 },
  { tot: 9999, conv: 0.016 },
];
const curveAt = (km) => CURVE.find((b) => km < b.tot).conv;

const ORDERWAARDE = 3609;      // gemiddelde omzet per akkoord (gemeten)
const MARGE = 0.458;           // brutomarge op inkoop (gemeten, 1.986 deals)
const CATCHMENT_KM = 20;

// jaarbasis: leads per plaats in de laatste 12 maanden
const JAAR_TABS = new Set(['Juli 2025', 'Aug 2025', 'Sep 2025', 'Okt 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Maart 2026', 'April 2026', 'Mei 2026', 'Juni 2026 ']);
function normPlaats(p) {
  return String(p || '').trim().toLowerCase().replace(/\s+/g, ' ')
    .replace(/^den haag.*/, 'den haag').replace(/^'?s[- ]gravenhage$/, 'den haag')
    .replace(/^hoek van holland.*/, 'hoek van holland');
}
const jaarLeadsPerPlaats = {};
const jaarTeVerPerPlaats = {};
for (const l of leads) {
  if (!JAAR_TABS.has(l.tab)) continue;
  const p = normPlaats(l.plaats);
  if (!p) continue;
  jaarLeadsPerPlaats[p] = (jaarLeadsPerPlaats[p] || 0) + 1;
  if (l.teVer) jaarTeVerPerPlaats[p] = (jaarTeVerPerPlaats[p] || 0) + 1;
}

function dist(a, b) {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const plaatsen = geo.filter((r) => !RUIS.has(r.plaats));

// Kandidaat-steden: voldoende volume, >25 km van Rijswijk (anders kannibalisatie)
const kandidaten = [
  'rotterdam', 'amsterdam', 'dordrecht', 'hoofddorp', 'haarlem', 'utrecht', 'gouda',
  'barendrecht', 'almere', 'breda', 'tilburg', 'alphen aan den rijn', 'amstelveen',
  'purmerend', 'amersfoort', 'spijkenisse', 'hellevoetsluis', 'nieuwegein', 'zaandam',
].map((naam) => plaatsen.find((p) => p.plaats === naam)).filter(Boolean);

// kosten per winkel per jaar (schattingen, bronnen in rapport)
// huur: 200m2 showroom op PDV/woonboulevard-locatie; grote stad duurder
const DUUR = new Set(['amsterdam', 'utrecht', 'haarlem', 'amstelveen']);
function kosten(plaats) {
  const m2 = 200;
  const huurM2 = DUUR.has(plaats) ? 140 : 100;   // €/m2/jr PDV-range CBRE 60-150
  const huur = m2 * huurM2;
  const service = 10000;                          // energie/verzekering/overig
  const personeel = 72000;                        // 1,5 FTE verkoop incl. werkgeverslasten
  const marketing = 12000;                        // lokale campagnes
  const inrichtingJr = 16000;                     // €80k inrichting, 5 jr afschrijving
  return { m2, huurM2, huur, service, personeel, marketing, inrichtingJr, totaal: huur + service + personeel + marketing + inrichtingJr, eenmalig: 80000 };
}

const resultaten = [];
for (const k of kandidaten) {
  const catchment = [];
  for (const p of plaatsen) {
    const dK = dist(p, k);
    if (dK > CATCHMENT_KM) continue;
    if (dK >= p.kmRijswijk) continue; // Rijswijk blijft dichterbij → geen effect
    const jaarLeads = jaarLeadsPerPlaats[p.plaats] || 0;
    if (!jaarLeads) continue;
    const huidigeConv = p.leads >= 10 ? p.akkoord / p.leads : curveAt(p.kmRijswijk);
    const nieuweConv = curveAt(dK);
    const upliftConv = Math.max(0, nieuweConv - huidigeConv);
    const jaarTeVer = jaarTeVerPerPlaats[p.plaats] || 0;
    // TE VER-leads converteren nu 0 → volledige curve-waarde is winst
    const extraAkkoordFull = (jaarLeads - jaarTeVer) * upliftConv + jaarTeVer * nieuweConv;
    catchment.push({ plaats: p.plaats, km: Math.round(dK), jaarLeads, jaarTeVer, huidigeConv, nieuweConv, extraAkkoordFull });
  }
  if (!catchment.length) continue;
  const jaarLeads = catchment.reduce((s, c) => s + c.jaarLeads, 0);
  const jaarTeVer = catchment.reduce((s, c) => s + c.jaarTeVer, 0);
  const extraAkkoordFull = catchment.reduce((s, c) => s + c.extraAkkoordFull, 0);
  const kost = kosten(k.plaats);
  const scen = (f) => {
    const extraAkkoord = extraAkkoordFull * f;
    const extraOmzet = extraAkkoord * ORDERWAARDE;
    const brutowinst = extraOmzet * MARGE;
    return { f, extraAkkoord: Math.round(extraAkkoord), extraOmzet: Math.round(extraOmzet), brutowinst: Math.round(brutowinst), netto: Math.round(brutowinst - kost.totaal) };
  };
  resultaten.push({
    stad: k.naam ? k.naam.replace('Woonplaats ', '') : k.plaats,
    key: k.plaats, lat: k.lat, lon: k.lon,
    kmRijswijk: Math.round(k.kmRijswijk),
    jaarLeads, jaarTeVer,
    plaatsenInGebied: catchment.length,
    huidigeAkkoordJr: Math.round(catchment.reduce((s, c) => s + c.jaarLeads * c.huidigeConv, 0)),
    kosten: kost,
    scenarios: { conservatief: scen(0.5), realistisch: scen(0.75), vol: scen(1.0) },
    topPlaatsen: catchment.sort((a, b) => b.jaarLeads - a.jaarLeads).slice(0, 8)
      .map((c) => ({ plaats: c.plaats, km: c.km, jaarLeads: c.jaarLeads, teVer: c.jaarTeVer, huidigeConv: +(100 * c.huidigeConv).toFixed(1), nieuweConv: +(100 * c.nieuweConv).toFixed(1) })),
  });
}
resultaten.sort((a, b) => b.scenarios.realistisch.netto - a.scenarios.realistisch.netto);

// context-cijfers voor de pagina
const totalen = {
  leads: leads.length,
  akkoord: leads.filter((l) => l.akkoord).length,
  teVer: leads.filter((l) => l.teVer).length,
  omzetAkkoord: Math.round(leads.filter((l) => l.akkoord).reduce((s, l) => s + (l.omzet || 0), 0)),
  jaarLeads: Object.values(jaarLeadsPerPlaats).reduce((s, n) => s + n, 0),
  orderwaarde: ORDERWAARDE, marge: MARGE,
  winkelConv: 0.655, onlineConv: 0.086,
  curve: CURVE,
  periode: 'mei 2024 t/m juli 2026 (jaarprognoses op basis van juli 2025–juni 2026)',
};

fs.writeFileSync('/Users/clawdboot/sonty-website/data/winkel-analyse.json', JSON.stringify({ gegenereerd: new Date().toISOString().slice(0, 10), totalen, resultaten }, null, 1));
resultaten.forEach((r) => console.log(
  r.key.padEnd(20), String(r.jaarLeads).padStart(5) + ' leads/jr', ('teVer ' + r.jaarTeVer).padStart(10),
  ('real: +€' + (r.scenarios.realistisch.extraOmzet / 1000).toFixed(0) + 'k omzet').padStart(22),
  ('netto ' + (r.scenarios.realistisch.netto >= 0 ? '+' : '') + '€' + (r.scenarios.realistisch.netto / 1000).toFixed(0) + 'k').padStart(14)
));
console.log('\nOK → sonty-website/data/winkel-analyse.json');
