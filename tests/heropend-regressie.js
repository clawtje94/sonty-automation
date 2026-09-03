#!/usr/bin/env node
// Regressie "heropend na sluiting" (Daimy 03-09-2026, +31610729433). Puur, geen netwerk.
const assert = require('assert');
const { isHeropendNaSluiting, tijdSleutel } = require('../scripts/lib/collega-toewijzing.js');
let ok = 0, fout = 0;
function test(naam, fn) { try { fn(); ok++; console.log(`  ✓ ${naam}`); } catch (e) { fout++; console.log(`  ✗ ${naam}\n    ${e.message}`); } }
const BOT = 747786;
test('echt geval Andrii: closed_by staat, closed_at null, laatste = hartje 27-08 → NIET heropend, niet toewijzen', () => {
  const b = isHeropendNaSluiting({ closedAt: null, closedBy: 745487, laatsteKlantOp: '2026-08-27 07:26:04', laatsteBerichtType: 'INBOUND', huidigeUserId: BOT, botUserId: BOT });
  assert.strictEqual(b.heropend, false); assert.strictEqual(b.toewijzen, false); assert.ok(/sluitmoment onbekend/.test(b.reden));
});
test('klant schreef vóór het sluiten (collega sloot na het lezen) → niet heropend', () => {
  assert.strictEqual(isHeropendNaSluiting({ closedAt: '2026-08-27 09:00:00', closedBy: 1, laatsteKlantOp: '2026-08-27 07:26:04', laatsteBerichtType: 'INBOUND', huidigeUserId: null, botUserId: BOT }).heropend, false);
});
test('klant schreef ná het sluiten → heropend, toewijzen als bot het nog niet heeft', () => {
  const b = isHeropendNaSluiting({ closedAt: '2026-08-27 09:00:00', closedBy: 1, laatsteKlantOp: '2026-08-28 10:00:00', laatsteBerichtType: 'INBOUND', huidigeUserId: null, botUserId: BOT });
  assert.strictEqual(b.heropend, true); assert.strictEqual(b.toewijzen, true);
  const c = isHeropendNaSluiting({ closedAt: '2026-08-27 09:00:00', closedBy: 1, laatsteKlantOp: '2026-08-28 10:00:00', laatsteBerichtType: 'INBOUND', huidigeUserId: BOT, botUserId: BOT });
  assert.strictEqual(c.heropend, true); assert.strictEqual(c.toewijzen, false, 'bot heeft het al: geen assign-call (die veroorzaakte de updated_at-churn)');
});
test('laatste bericht is van de bot/collega → niet heropend', () => {
  assert.strictEqual(isHeropendNaSluiting({ closedAt: '2026-08-27 09:00:00', closedBy: 1, laatsteKlantOp: '2026-08-28 10:00:00', laatsteBerichtType: 'OUTBOUND', huidigeUserId: null, botUserId: BOT }).heropend, false);
});
test('nooit gesloten → niet heropend', () => assert.strictEqual(isHeropendNaSluiting({ closedAt: null, closedBy: null, laatsteKlantOp: '2026-08-28 10:00:00', laatsteBerichtType: 'INBOUND', botUserId: BOT }).heropend, false));
test('tijdformaten: ISO met Z / met T / Trengo-string vergelijken gelijk', () => {
  assert.strictEqual(tijdSleutel('2026-08-27T09:00:00Z'), '2026-08-27 09:00:00');
  assert.strictEqual(tijdSleutel('2026-08-27 09:00:00'), '2026-08-27 09:00:00');
  assert.strictEqual(tijdSleutel('2026-08-27T09:00:00.123+00:00'), '2026-08-27 09:00:00');
  assert.strictEqual(isHeropendNaSluiting({ closedAt: '2026-08-27T09:00:00Z', closedBy: 1, laatsteKlantOp: '2026-08-27 09:00:01', laatsteBerichtType: 'inbound', botUserId: BOT }).heropend, true);
});
test('kapotte input crasht niet', () => { for (const x of [{}, { closedAt: 'x', closedBy: 1, laatsteKlantOp: 'y', laatsteBerichtType: 'INBOUND' }, { closedAt: 5, closedBy: {}, laatsteKlantOp: null }]) assert.strictEqual(typeof isHeropendNaSluiting(x).heropend, 'boolean'); });
// Matrix tegen orakel: closedAt {null, voor, na} × closedBy {null, set} × type {INBOUND, OUTBOUND} × huidige {null, bot, mens} = 36
let n = 0, mis = 0;
for (const ca of [null, '2026-08-27 09:00:00', '2026-08-29 09:00:00'])
  for (const cb of [null, 745487])
    for (const type of ['INBOUND', 'OUTBOUND'])
      for (const huidige of [null, BOT, 736327]) {
        n++;
        const klant = '2026-08-28 10:00:00';
        const verwacht = type === 'INBOUND' && !!ca && klant > ca; // heropend alleen met bekend sluitmoment vóór het klantbericht
        const b = isHeropendNaSluiting({ closedAt: ca, closedBy: cb, laatsteKlantOp: klant, laatsteBerichtType: type, huidigeUserId: huidige, botUserId: BOT });
        const goed = b.heropend === verwacht && b.toewijzen === (verwacht && huidige !== BOT);
        if (!goed) { mis++; if (mis < 6) console.log(`  ✗ matrix ca=${ca} cb=${cb} ${type} huidige=${huidige}: ${JSON.stringify(b)} verwacht heropend=${verwacht}`); }
      }
test(`matrix ${n} scenario's tegen orakel`, () => assert.strictEqual(mis, 0));
console.log(`\n${ok} ok, ${fout} fout`);
process.exit(fout ? 1 : 0);
