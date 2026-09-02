#!/usr/bin/env node
// Regressie escalatie-wachter. REGEL Daimy 02-09-2026: herinnering pas na 4 dagen, en alleen als
// nergens geholpen (geen collega-antwoord op enig ticket van de klant, niet gesloten) en geen interne notitie.
// Draaien: node tests/escalatie-watch-regressie.js  (puur, geen netwerk)
const assert = require('assert');
const { beoordeel, SUNNY_USER_ID } = require('../scripts/ai-ks/escalatie-besluit.js');
let ok = 0, fout = 0;
function test(naam, fn) { try { fn(); ok++; console.log(`  ✓ ${naam}`); } catch (e) { fout++; console.log(`  ✗ ${naam}\n    ${e.message}`); } }
const T0 = Date.parse('2026-08-28T09:04:41Z');
const D = 864e5;
const ts = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const msg = (type, dt, user) => ({ type, created_at: ts(dt), user_id: user });
const MENS = 745487;

// Echt geval John van Krimpen (976931222): Sunny escaleert 28-08 (NOTE van Sunny), klant reageert, verder niets.
const john = [{ id: 976931222, status: 'ASSIGNED', messages: [msg('OUTBOUND', T0 - 1000, SUNNY_USER_ID), msg('NOTE', T0, SUNNY_USER_ID), msg('INBOUND', T0 + 4 * 60e3, null), msg('OUTBOUND', T0 + D, SUNNY_USER_ID), msg('NOTE', T0 + D, SUNNY_USER_ID)] }];
test('John: na 4 werkuren (oude regel) GEEN herinnering meer', () => assert.strictEqual(beoordeel({ escalatieT: T0, tickets: john, nu: T0 + 6 * 36e5 }).alarm, false));
test('John: dag 3 nog niets', () => { const b = beoordeel({ escalatieT: T0, tickets: john, nu: T0 + 3.9 * D }); assert.strictEqual(b.alarm, false); assert.ok(/nog geen 4/.test(b.reden)); });
test('John: dag 4 zonder hulp, zonder notitie → herinnering', () => { const b = beoordeel({ escalatieT: T0, tickets: john, nu: T0 + 4 * D + 60e3 }); assert.strictEqual(b.alarm, true); assert.strictEqual(b.dagen, 4); });
test('Sunny eigen notitie/antwoord telt NIET als hulp', () => assert.strictEqual(beoordeel({ escalatieT: T0, tickets: john, nu: T0 + 5 * D }).alarm, true));
test('interne notitie van collega ná escalatie → NIET (ook na 10 dagen)', () => {
  const t = [{ id: 1, status: 'ASSIGNED', messages: [...john[0].messages, msg('NOTE', T0 + 2 * D, MENS)] }];
  const b = beoordeel({ escalatieT: T0, tickets: t, nu: T0 + 10 * D }); assert.strictEqual(b.alarm, false); assert.strictEqual(b.notitie, '1'); assert.strictEqual(b.open, undefined);
});
test('notitie met internal_note-vlag (mailkanaal) telt ook', () => {
  const t = [{ id: 1, status: 'OPEN', messages: [{ type: 'OUTBOUND', internal_note: true, created_at: ts(T0 + D), user_id: MENS }] }];
  assert.strictEqual(beoordeel({ escalatieT: T0, tickets: t, nu: T0 + 6 * D }).alarm, false);
});
test('collega antwoordt op ANDER ticket van dezelfde klant (mail i.p.v. WhatsApp) → nergens-geholpen is onwaar → NIET', () => {
  const t = [john[0], { id: 2, status: 'OPEN', messages: [msg('OUTBOUND', T0 + D, MENS)] }];
  const b = beoordeel({ escalatieT: T0, tickets: t, nu: T0 + 6 * D }); assert.strictEqual(b.alarm, false); assert.strictEqual(b.geholpen, '2');
});
test('escalatie-ticket zelf gesloten → NIET', () => assert.strictEqual(beoordeel({ escalatieT: T0, tickets: [{ id: 1, zelf: true, status: 'CLOSED', messages: [] }], nu: T0 + 6 * D }).alarm, false));
test('ander ticket van klant al vóór de escalatie gesloten → telt niet als hulp (echt geval 974797599/962338508)', () => assert.strictEqual(beoordeel({ escalatieT: T0, tickets: [{ id: 1, zelf: true, status: 'OPEN', messages: [] }, { id: 2, status: 'CLOSED', closed_at: ts(T0 - 10 * D), messages: [] }], nu: T0 + 6 * D }).alarm, true));
test('ander ticket van klant ná de escalatie gesloten → wel hulp', () => assert.strictEqual(beoordeel({ escalatieT: T0, tickets: [{ id: 1, zelf: true, status: 'OPEN', messages: [] }, { id: 2, status: 'CLOSED', closed_at: ts(T0 + D), messages: [] }], nu: T0 + 6 * D }).alarm, false));
test('collega-antwoord van VÓÓR de escalatie telt niet', () => {
  const t = [{ id: 1, status: 'OPEN', messages: [msg('OUTBOUND', T0 - 2 * D, MENS)] }];
  assert.strictEqual(beoordeel({ escalatieT: T0, tickets: t, nu: T0 + 5 * D }).alarm, true);
});
test('klant zelf schrijft (INBOUND) is geen hulp', () => assert.strictEqual(beoordeel({ escalatieT: T0, tickets: [{ id: 1, status: 'OPEN', messages: [msg('INBOUND', T0 + D, null)] }], nu: T0 + 5 * D }).alarm, true));
test('herhaling: binnen 24u na vorig alarm stil, daarna weer', () => {
  const p = { escalatieT: T0, tickets: john, nu: T0 + 5 * D };
  assert.strictEqual(beoordeel({ ...p, laatsteAlarm: T0 + 5 * D - 3 * 36e5 }).alarm, false);
  assert.strictEqual(beoordeel({ ...p, laatsteAlarm: T0 + 5 * D - 25 * 36e5 }).alarm, true);
});
test('lege/kapotte input crasht niet', () => { assert.strictEqual(beoordeel({ escalatieT: T0, tickets: null, nu: T0 + 5 * D }).alarm, true); assert.strictEqual(beoordeel({ escalatieT: T0, tickets: [{ id: 1, status: 'OPEN' }, null], nu: T0 + 5 * D }).alarm, true); });

// Gegenereerde matrix tegen onafhankelijk orakel: dagen × gebeurtenis × afzender × ticket × wanneer
let n = 0, mis = 0;
for (const dagen of [0, 1, 3.99, 4, 4.5, 9, 20])
  for (const gebeurtenis of ['niets', 'OUTBOUND', 'NOTE', 'INBOUND', 'CLOSED'])
    for (const afzender of ['mens', 'sunny', 'geen'])
      for (const waar of ['zelfde', 'ander'])
        for (const wanneer of ['na', 'voor']) {
          n++;
          const nu = T0 + dagen * D;
          const t = (wanneer === 'na' ? T0 + 36e5 : T0 - 36e5);
          const user = afzender === 'mens' ? MENS : afzender === 'sunny' ? SUNNY_USER_ID : null;
          const basis = { id: 1, zelf: true, status: 'OPEN', messages: [] };
          const extra = { id: 2, status: 'OPEN', messages: [] };
          const doel = waar === 'zelfde' ? basis : extra;
          if (gebeurtenis === 'CLOSED') { doel.status = 'CLOSED'; doel.closed_at = ts(t); }
          else if (gebeurtenis !== 'niets') doel.messages.push(msg(gebeurtenis, t, user));
          const geholpen = (gebeurtenis === 'CLOSED' && (waar === 'zelfde' || wanneer === 'na')) || (wanneer === 'na' && afzender === 'mens' && (gebeurtenis === 'OUTBOUND' || gebeurtenis === 'NOTE'));
          const verwacht = !geholpen && dagen >= 4;
          const kreeg = beoordeel({ escalatieT: T0, tickets: [basis, extra], nu }).alarm;
          if (kreeg !== verwacht) { mis++; if (mis < 6) console.log(`  ✗ matrix d=${dagen} ${gebeurtenis} ${afzender} ${waar} ${wanneer}: ${kreeg} ≠ ${verwacht}`); }
        }
test(`matrix ${n} scenario's tegen orakel`, () => assert.strictEqual(mis, 0));
console.log(`\n${ok} ok, ${fout} fout`);
process.exit(fout ? 1 : 0);
