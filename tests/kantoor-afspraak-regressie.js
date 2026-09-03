#!/usr/bin/env node
// Regressie kantoor-afspraken annuleren (Daimy 03-09-2026, Lotte Vos +31651680187). Puur, geen netwerk.
const assert = require('assert');
const { matchKantoorAfspraken, kiesOutlookEvents, achternaamVan } = require('../scripts/lib/kantoor-afspraak.js');
let ok = 0, fout = 0;
function test(naam, fn) { try { fn(); ok++; console.log(`  ✓ ${naam}`); } catch (e) { fout++; console.log(`  ✗ ${naam}\n    ${e.message}`); } }
const NU = Date.parse('2026-09-03T08:00:00Z');
const items = [
  { uuid: 'lotte', externalId: 'ol-1', start: '2026-09-03T11:00:00Z', inmeter: 'Joey', klant: 'Inmeten Sonty - Lotte Vos' },
  { uuid: 'jan', externalId: 'ol-2', start: '2026-09-03T11:00:00Z', inmeter: 'Joey', klant: 'Inmeten Sonty - Jan van Grimbergen' },
  { uuid: 'vos2', externalId: 'ol-3', start: '2026-09-10T11:00:00Z', inmeter: 'Sjoerd', klant: 'Inmeten — Peter de Vos' },
  { uuid: 'oud', externalId: 'ol-4', start: '2026-08-20T11:00:00Z', inmeter: 'Joey', klant: 'Inmeten Sonty - Lotte Vos' },
  { uuid: 'montage', externalId: 'ol-5', start: '2026-09-04T11:00:00Z', inmeter: 'Joey', klant: 'Montage Sonty - Lotte Vos' },
  { uuid: 'vossen', externalId: 'ol-6', start: '2026-09-05T11:00:00Z', inmeter: 'Joey', klant: 'Inmeten Sonty - Kees Vossen' },
  null,
];
test('achternaam: laatste woord ≥3 letters, tussenvoegsels tellen mee als laatste woord', () => {
  assert.strictEqual(achternaamVan('Lotte Vos'), 'Vos'); assert.strictEqual(achternaamVan('Jan van Grimbergen'), 'Grimbergen'); assert.strictEqual(achternaamVan('Wu'), ''); assert.strictEqual(achternaamVan(null), '');
});
test('Lotte: alleen haar inmeet-items van vandaag/komend, niet Jan om dezelfde tijd, niet de oude, niet montage', () => {
  const m = matchKantoorAfspraken({ items, naam: 'Lotte Vos', nu: NU });
  assert.deepStrictEqual(m.map((x) => x.uuid), ['lotte', 'vos2']); // Peter de Vos is een KANDIDAAT; de telefooncheck beslist
});
test('"Vos" matcht niet in "Vossen" (woordgrens)', () => assert.ok(!matchKantoorAfspraken({ items, naam: 'Lotte Vos', nu: NU }).some((x) => x.uuid === 'vossen')));
test('afspraak van 1,5 uur geleden telt nog (inmeter onderweg/op locatie)', () => {
  assert.strictEqual(matchKantoorAfspraken({ items, naam: 'Lotte Vos', nu: Date.parse('2026-09-03T12:30:00Z') }).some((x) => x.uuid === 'lotte'), true);
  assert.strictEqual(matchKantoorAfspraken({ items, naam: 'Lotte Vos', nu: Date.parse('2026-09-03T13:30:00Z') }).some((x) => x.uuid === 'lotte'), false);
});
test('geen naam → geen kandidaten op naam (telefoon-cache is dan de enige weg)', () => assert.deepStrictEqual(matchKantoorAfspraken({ items, naam: '', nu: NU }), []));
const events = [
  { Id: 'e1', Subject: 'Inmeten Sonty - Lotte Vos', Start: { DateTime: '2026-09-03T11:00:00.0000000' } },
  { Id: 'e2', Subject: 'Inmeten Sonty - Jan van Grimbergen', Start: { DateTime: '2026-09-03T11:00:00.0000000' } },
  { Id: 'e3', Subject: 'OPTIE bot Lotte Vos', Start: { DateTime: '2026-09-03T11:00:00.0000000' } },
  { Id: 'e4', Subject: 'Inmeten Sonty - Lotte Vos', Start: { DateTime: '2026-09-03T14:00:00.0000000' } },
  { Id: 'e5', Subject: 'Lotte Vos rijtijd', Start: { DateTime: '2026-09-03T10:30:00.0000000' } },
  { Subject: 'kapot' }, null,
];
test('Outlook: alleen events van deze klant binnen 90 min; NIET de ander om 13:00, NIET het optie-blokje, NIET 3 uur later', () => {
  assert.deepStrictEqual(kiesOutlookEvents({ events, naam: 'Lotte Vos', aankomst: '2026-09-03T11:00:00Z' }).map((e) => e.Id), ['e1', 'e5']);
});
test('Outlook: zonder naam of zonder geldige tijd niets verwijderen', () => {
  assert.deepStrictEqual(kiesOutlookEvents({ events, naam: '', aankomst: '2026-09-03T11:00:00Z' }), []);
  assert.deepStrictEqual(kiesOutlookEvents({ events, naam: 'Lotte Vos', aankomst: 'x' }), []);
});
// Matrix: naam-match × tijdsverschil × soort tegen orakel (120 gevallen)
let n = 0, mis = 0;
for (const subj of ['Inmeten Sonty - Lotte Vos', 'Inmeten — Vos', 'Inmeten Sonty - Jan Jansen', 'OPTIE bot Lotte Vos', 'Vossen inmeten'])
  for (const min of [-120, -90, -60, 0, 30, 89, 91, 200])
    for (const naam of ['Lotte Vos', 'L. Vos', 'Jan Jansen']) {
      n++;
      const t = new Date(Date.parse('2026-09-03T11:00:00Z') + min * 60e3).toISOString().replace('.000Z', '.0000000');
      const kreeg = kiesOutlookEvents({ events: [{ Id: 'x', Subject: subj, Start: { DateTime: t } }], naam, aankomst: '2026-09-03T11:00:00Z' }).length === 1;
      const an = naam.endsWith('Vos') ? 'Vos' : 'Jansen';
      const naamOk = new RegExp('(^|[^a-zA-Z])' + an + '([^a-zA-Z]|$)', 'i').test(subj) && !/^OPTIE bot/i.test(subj);
      const verwacht = naamOk && Math.abs(min) <= 90;
      if (kreeg !== verwacht) { mis++; if (mis < 6) console.log(`  ✗ matrix "${subj}" ${min}min naam=${naam}: ${kreeg} ≠ ${verwacht}`); }
    }
test(`matrix ${n} scenario's tegen orakel`, () => assert.strictEqual(mis, 0));
console.log(`\n${ok} ok, ${fout} fout`);
process.exit(fout ? 1 : 0);
