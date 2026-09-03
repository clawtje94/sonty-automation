#!/usr/bin/env node
// Regressie meetbon-afspraken-sync (dashboard per dag/adviseur, 03-09-2026). Puur, geen netwerk.
const assert = require('assert');
const { bepaalAfspraken } = require('../scripts/meetbon-afspraken-sync.js');
let ok = 0, fout = 0;
function test(naam, fn) { try { fn(); ok++; console.log(`  ✓ ${naam}`); } catch (e) { fout++; console.log(`  ✗ ${naam}\n    ${e.message}`); } }
const bon = (gripp, afspraak = null) => ({ gripp: String(gripp), afspraak });
const boeking = (grippNr, aankomst, inmeter, uuid, status = 'geboekt') => ({ grippNr, aankomst, inmeter, planadoJobUuid: uuid, status });

test('boeking zonder snapshot → afspraak uit boeking', () => {
  const { lijst } = bepaalAfspraken({ snapshot: null, boekingen: [boeking('6522', '2026-09-28T07:00:00.000Z', 'Joey', 'u1')], bonnen: [bon(6522)] });
  assert.strictEqual(lijst.length, 1); assert.strictEqual(lijst[0].wanneer, '2026-09-28T07:00:00.000Z'); assert.strictEqual(lijst[0].inmeter, 'Joey'); assert.strictEqual(lijst[0].bron, 'boeking');
});
test('Planado-snapshot (verzet + andere inmeter) wint van de boeking', () => {
  const snapshot = { ts: new Date().toISOString(), items: [{ uuid: 'u1', externalId: 'ol-x', start: '2026-10-01T08:00:00.000Z', inmeter: 'Sjoerd' }] };
  const { lijst } = bepaalAfspraken({ snapshot, boekingen: [boeking('6522', '2026-09-28T07:00:00.000Z', 'Joey', 'u1')], bonnen: [bon(6522)] });
  assert.strictEqual(lijst.length, 1); assert.strictEqual(lijst[0].wanneer, '2026-10-01T08:00:00.000Z'); assert.strictEqual(lijst[0].inmeter, 'Sjoerd'); assert.strictEqual(lijst[0].bron, 'planado');
});
test('snapshot-job zonder boeking maar met external_id gripp-/meetbon- → gekoppeld', () => {
  const snapshot = { ts: 'x', items: [{ uuid: 'u2', externalId: 'gripp-7001', start: '2026-09-10T09:00:00Z', inmeter: 'Joey' }, { uuid: 'u3', externalId: 'meetbon-7002', start: '2026-09-11T09:00:00Z', inmeter: 'Sjoerd' }, { uuid: 'u4', externalId: 'ol-abc', start: '2026-09-12T09:00:00Z', inmeter: 'Joey' }] };
  const { lijst } = bepaalAfspraken({ snapshot, boekingen: [], bonnen: [bon(7001), bon(7002), bon(7003)] });
  assert.deepStrictEqual(lijst.map((a) => a.gripp).sort(), ['7001', '7002']);
});
test('koppeling via bon.afspraak.planadoJob (plan-formulier) → snapshot-tijd volgt Planado', () => {
  const snapshot = { ts: 'x', items: [{ uuid: 'u9', externalId: null, start: '2026-09-15T12:00:00.000Z', inmeter: 'Joey' }] };
  const { lijst } = bepaalAfspraken({ snapshot, boekingen: [], bonnen: [bon(8001, { wanneer: '2026-09-15T08:00:00.000Z', inmeter: null, planadoJob: 'u9' })] });
  assert.strictEqual(lijst.length, 1); assert.strictEqual(lijst[0].inmeter, 'Joey');
});
test('bon zonder bekende afspraak → niets sturen; afspraak zonder bon → niets sturen', () => {
  const { lijst } = bepaalAfspraken({ snapshot: null, boekingen: [boeking('1', '2026-09-28T07:00:00.000Z', 'Joey', 'u1')], bonnen: [bon(2)] });
  assert.strictEqual(lijst.length, 0);
});
test('ongewijzigd → niet opnieuw sturen (idempotent)', () => {
  const b = bon(6522, { wanneer: '2026-09-28T07:00:00.000Z', inmeter: 'Joey', planadoJob: 'u1' });
  const { lijst } = bepaalAfspraken({ snapshot: null, boekingen: [boeking('6522', '2026-09-28T07:00:00.000Z', 'Joey', 'u1')], bonnen: [b] });
  assert.strictEqual(lijst.length, 0);
});
test('geannuleerde boeking telt niet; gripp met niet-cijfers wordt genormaliseerd', () => {
  const { lijst } = bepaalAfspraken({ snapshot: null, boekingen: [boeking('6522', '2026-09-28T07:00:00.000Z', 'Joey', 'u1', 'geannuleerd'), boeking('#6523', '2026-09-29T07:00:00.000Z', 'Sjoerd', 'u2')], bonnen: [bon(6522), bon(6523)] });
  assert.deepStrictEqual(lijst.map((a) => a.gripp), ['6523']);
});
test('kapotte input crasht niet', () => {
  const { lijst } = bepaalAfspraken({ snapshot: { items: [null, {}, { uuid: 'x' }] }, boekingen: [null, {}, { grippNr: '1' }], bonnen: [null, {}, bon(1)] });
  assert.strictEqual(lijst.length, 0);
});
// Matrix: 3 bronnen-combinaties × 3 bon-standen × 2 statussen × 2 koppelwijzen = 36, orakel onafhankelijk
let n = 0, mis = 0;
for (const bronnen of ['boeking', 'snapshot', 'beide'])
  for (const stand of ['geen', 'zelfde', 'anders'])
    for (const status of ['geboekt', 'geannuleerd'])
      for (const koppel of ['uuid', 'external']) {
        n++;
        const bk = bronnen !== 'snapshot' ? [boeking('5000', '2026-09-20T07:00:00.000Z', 'Joey', 'uu', status)] : [];
        const items = bronnen !== 'boeking' ? [{ uuid: 'uu', externalId: koppel === 'external' ? 'gripp-5000' : 'ol-1', start: '2026-09-21T07:00:00.000Z', inmeter: 'Sjoerd' }] : [];
        // orakel: verwachte afspraak
        let verwacht = null;
        if (bk.length && status === 'geboekt') verwacht = { wanneer: '2026-09-20T07:00:00.000Z', inmeter: 'Joey', planadoJob: 'uu' };
        // een job die nog in de live Planado-agenda staat is een echte afspraak, ook als de eigen boeking 'geannuleerd' zegt (Planado leidend)
        const snapshotKoppelt = items.length && (koppel === 'external' || bk.length);
        if (snapshotKoppelt) verwacht = { wanneer: '2026-09-21T07:00:00.000Z', inmeter: 'Sjoerd', planadoJob: 'uu' };
        const opBon = stand === 'geen' ? null : stand === 'zelfde' && verwacht ? { ...verwacht } : { wanneer: '2026-01-01T00:00:00.000Z', inmeter: null, planadoJob: null };
        const verwachtSturen = !!verwacht && !(opBon && opBon.wanneer === verwacht.wanneer && opBon.inmeter === verwacht.inmeter && opBon.planadoJob === verwacht.planadoJob);
        const { lijst } = bepaalAfspraken({ snapshot: { ts: 'x', items }, boekingen: bk, bonnen: [bon(5000, opBon)] });
        const kreeg = lijst.length === 1;
        const goed = kreeg === verwachtSturen && (!kreeg || (lijst[0].wanneer === verwacht.wanneer && lijst[0].inmeter === verwacht.inmeter));
        if (!goed) { mis++; if (mis < 6) console.log(`  ✗ matrix ${bronnen} ${stand} ${status} ${koppel}: kreeg ${JSON.stringify(lijst[0] || null)} verwacht ${JSON.stringify(verwacht)} sturen=${verwachtSturen}`); }
      }
test(`matrix ${n} scenario's tegen orakel`, () => assert.strictEqual(mis, 0));
console.log(`\n${ok} ok, ${fout} fout`);
process.exit(fout ? 1 : 0);
