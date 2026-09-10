#!/usr/bin/env node
// Regressie op ECHTE historie: laat elk Sunny-antwoord van de laatste N dagen (default 30) door de
// inmeet-bevestig-poort, met de echte boekingsadministratie van dat moment als context.
// Doel: (1) geen valse blokkades op normale antwoorden, (2) de Saskia-gevallen worden gepakt.
// Gebruik: node tests/inmeet-bevestig-regressie.js [dagen] [--alles]
const fs = require('fs');
const path = require('path');
const { beoordeel, zoekInmeetInAgenda, momentDatum } = require('../scripts/lib/inmeet-bevestig-poort.js');

const dagen = Number(process.argv[2]) || 30;
const alles = process.argv.includes('--alles');
const sinds = Date.now() - dagen * 864e5;
const bo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeet-boekingen.json'), 'utf8'));
const boekingen = Object.values(bo);

function boekingVoor(klant, tijd) {
  const t9 = String(klant?.phone || '').replace(/\D/g, '').slice(-9);
  const ln = String(klant?.naam || '').trim().toLowerCase();
  const grens = Date.parse(tijd) + 3 * 3600000; // de verwerker boekt soms pas minuten na het antwoord
  const kandidaten = boekingen.filter((b) =>
    ((t9.length === 9 && String(b.telefoon || '').replace(/\D/g, '').slice(-9) === t9) || (ln && String(b.naam || '').trim().toLowerCase() === ln)) &&
    Date.parse(b.geboektOp || 0) <= grens);
  if (!kandidaten.length) return null;
  kandidaten.sort((a, b) => Date.parse(b.geboektOp || 0) - Date.parse(a.geboektOp || 0));
  const k = kandidaten[0];
  return { aankomst: k.aankomst, status: ['geboekt', 'afgerond'].includes(k.status) ? 'geboekt' : k.status };
}

(async () => {
let n = 0, claims = 0, blok = 0, agenda = 0;
const regels = [];
for (const l of fs.readFileSync(path.join(__dirname, '..', 'data', 'ai-ks', 'log.jsonl'), 'utf8').split('\n')) {
  if (!l) continue;
  let o; try { o = JSON.parse(l); } catch { continue; }
  if (!o.antwoord || Date.parse(o.tijd) < sinds) continue;
  n++;
  const tc = (o.toolCalls || []).map((t) => t.tool);
  const basis = { tekst: o.antwoord, context: o.laatsteKlantBericht || '', inmeetGeboektDezeBeurt: tc.includes('inmeet_boeken') };
  let r = beoordeel({ ...basis, bestaandeBoeking: boekingVoor(o.klant, o.tijd) });
  if (r.blok) { // net als live: dan pas de agenda (historisch venster rond het antwoord)
    let ag = null;
    try { ag = await zoekInmeetInAgenda({ naam: o.klant?.naam, email: o.klant?.email, telefoon: o.klant?.phone, rond: momentDatum(o.antwoord, new Date(o.tijd)), van: new Date(Date.parse(o.tijd) - 864e5), tot: new Date(Date.parse(o.tijd) + 150 * 864e5) }); } catch (e) { ag = null; regels.push('   (agenda niet leesbaar: ' + e.message.slice(0, 60) + ')'); }
    if (ag) { agenda++; r = beoordeel({ ...basis, bestaandeBoeking: ag }); }
  }
  if (r.claim) claims++;
  if (r.blok) blok++;
  if (r.blok || (alles && r.claim)) regels.push(`${r.blok ? 'BLOK' : 'ok  '} ${o.tijd.slice(0, 16)} t${o.ticket} [${tc.join(',')}] ${r.reden} :: ${String(o.antwoord).replace(/\s+/g, ' ').slice(0, 130)}`);
}
console.log(`antwoorden ${n} | inmeet-bevestigingen ${claims} | via agenda gered ${agenda} | geblokkeerd ${blok}`);
regels.forEach((x) => console.log(x));
})();
