#!/usr/bin/env node
// Regressie: eigen Outlook-agenda van een inmeter telt als bezet (Joey 28-09-2026:
// Tandarts + WINKEL stonden alleen in zijn eigen agenda, 4 inmetingen eroverheen geboekt).
// Draaien: node tests/eigen-agenda-regressie.js  (puur, geen netwerk)
const assert = require('assert');
const { eigenAgendaBlokken } = require('../scripts/cron-inmeten-planner.js');
const { bezetteBlokken } = require('../scripts/lib/slotzoeker');
let ok = 0, fout = 0;
function test(naam, fn) { try { fn(); ok++; console.log(`  ✓ ${naam}`); } catch (e) { fout++; console.log(`  ✗ ${naam}\n    ${e.message}`); } }
const ev = (Subject, s, e, extra = {}) => ({ Subject, Start: { DateTime: s }, End: { DateTime: e }, ShowAs: 'Busy', ...extra });

// Echte dag 28-09 (UTC-tijden zoals de OWA-API ze teruggeeft)
const dag = [
  ev('Tandarts', '2026-09-28T06:30:00.0000000', '2026-09-28T07:30:00.0000000'),
  ev('Inmeten Sonty - Steven Leeuwerink', '2026-09-28T07:00:00.0000000', '2026-09-28T08:00:00.0000000'),
  ev('WINKEL', '2026-09-28T07:45:00.0000000', '2026-09-28T13:30:00.0000000'),
  ev('Tandarts', '2026-09-28T13:30:00.0000000', '2026-09-28T15:00:00.0000000'),
];
test('28-09: tandarts+winkel worden bezette blokken, Inmeten-events niet (Planado is bron)', () => {
  const b = eigenAgendaBlokken(dag);
  assert.strictEqual(b.length, 3);
  assert.ok(b.every((x) => x.eigenAgenda && x.klant.startsWith('eigen agenda: ')));
  const winkel = b.find((x) => /WINKEL/.test(x.klant));
  assert.strictEqual(winkel.start, '2026-09-28T07:45:00.000Z');
  assert.strictEqual(winkel.eind, '2026-09-28T13:30:00.000Z');
  assert.ok(/Rijswijk/.test(winkel.adres), 'winkeldienst ankert op de winkel');
  assert.ok(/Berkel/.test(b[0].adres), 'zonder adres ankert op magazijn');
});
test('28-09: winkeldienst dekt de hele werkdag als bezet blok', () => {
  const blokken = bezetteBlokken(eigenAgendaBlokken(dag), new Date('2026-09-28T07:00:00Z'), new Date('2026-09-28T13:00:00Z'));
  // 07:30-07:45Z is een echt gat van 15 min (tussen tandarts en winkel); de winkeldienst zelf moet 07:45-13:30Z dekken
  const winkel = blokken.find((b) => new Date(b.start) <= new Date('2026-09-28T07:45:00Z') && new Date(b.eind) >= new Date('2026-09-28T13:00:00Z'));
  assert.ok(winkel, JSON.stringify(blokken));
});
test('geannuleerd / vrij / leeg / kapotte datum tellen niet', () => {
  const b = eigenAgendaBlokken([
    ev('Tandarts', '2026-09-14T13:00:00', '2026-09-14T14:00:00', { IsCancelled: true }),
    ev('Geannuleerd: Inmeten Sonty - Steve', '2026-09-17T07:45:00', '2026-09-17T08:10:00', { ShowAs: 'Free' }),
    ev('Canceled: Telefonisch advies', '2026-09-17T07:45:00', '2026-09-17T08:10:00'),
    ev('Lunch', '2026-09-17T10:00:00', '2026-09-17T11:00:00', { ShowAs: 'Free' }),
    ev('Kapot', 'nope', '2026-09-17T11:00:00'),
    ev('Achterstevoren', '2026-09-17T12:00:00', '2026-09-17T11:00:00'),
    { Subject: 'Zonder tijden' },
  ]);
  assert.strictEqual(b.length, 0);
});
test('hele-dag-event (Vakantie Disney) blokkeert de hele werkdag, meerdaags elke dag', () => {
  const b = eigenAgendaBlokken([ev('Vakantie - Disney (Joey)', '2026-09-07T00:00:00.0000000', '2026-09-09T00:00:00.0000000', { IsAllDay: true })]);
  assert.strictEqual(b.length, 1);
  for (const d of ['2026-09-07', '2026-09-08']) {
    const bl = bezetteBlokken(b, new Date(d + 'T07:00:00Z'), new Date(d + 'T13:00:00Z'));
    assert.ok(bl.length && new Date(bl[0].start) <= new Date(d + 'T07:00:00Z') && new Date(bl[0].eind) >= new Date(d + 'T13:00:00Z'), d);
  }
  const bl9 = bezetteBlokken(b, new Date('2026-09-09T07:00:00Z'), new Date('2026-09-09T13:00:00Z'));
  assert.strictEqual(bl9.length, 0, '09-09 is weer vrij');
});
test('Tentative en Oof tellen als bezet; hoofdletters in ShowAs maken niet uit', () => {
  const b = eigenAgendaBlokken([ev('Optie', '2026-09-17T10:00:00', '2026-09-17T11:00:00', { ShowAs: 'Tentative' }), ev('Uit', '2026-09-17T12:00:00', '2026-09-17T13:00:00', { ShowAs: 'Oof' }), ev('X', '2026-09-17T13:00:00', '2026-09-17T14:00:00', { ShowAs: 'FREE' })]);
  assert.strictEqual(b.length, 2);
});
// Gegenereerde matrix: 4 soorten × 3 statussen × 3 ShowAs × 2 allday = 72 scenario's, orakel = zelfde regels onafhankelijk opgeschreven
let n = 0, mis = 0;
for (const soort of ['Tandarts', 'WINKEL', 'Inmeten Sonty - Klant', 'Inmeten — Klant'])
  for (const cancel of [null, 'IsCancelled', 'prefix'])
    for (const showAs of ['Busy', 'Free', 'Tentative'])
      for (const allDay of [false, true]) {
        n++;
        const subj = (cancel === 'prefix' ? 'Geannuleerd: ' : '') + soort;
        const e = ev(subj, allDay ? '2026-10-05T00:00:00' : '2026-10-05T08:00:00', allDay ? '2026-10-06T00:00:00' : '2026-10-05T09:00:00', { ShowAs: showAs, IsAllDay: allDay, IsCancelled: cancel === 'IsCancelled' });
        const verwacht = !cancel && showAs !== 'Free' && !/^Inmeten/.test(soort) ? 1 : 0;
        const kreeg = eigenAgendaBlokken([e]).length;
        if (kreeg !== verwacht) { mis++; console.log(`  ✗ matrix ${subj} ${showAs} allday=${allDay} cancel=${cancel}: ${kreeg} ≠ ${verwacht}`); }
      }
test(`matrix ${n} scenario's tegen orakel`, () => assert.strictEqual(mis, 0));
console.log(`\n${ok} ok, ${fout} fout`);
process.exit(fout ? 1 : 0);
