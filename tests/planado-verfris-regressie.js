#!/usr/bin/env node
// Regressie verfris-stap Outlook → Planado (03-09-2026). Puur, geen netwerk.
const assert = require('assert');
const { verfrisPatch, notitieBlokUit, zonderNotitieBlok, metTekenLink, KOP, TEKEN_KOP } = require('../scripts/lib/planado-verfris.js');
let ok = 0, fout = 0;
function test(naam, fn) { try { fn(); ok++; console.log(`  ✓ ${naam}`); } catch (e) { fout++; console.log(`  ✗ ${naam}\n    ${e.message}`); } }
const BASIS = 'Montage Sonty - Max Blaauboer\n(gesynct uit Outlook)\n\nGripp: 5127\nTE MONTEREN:\n- 1x Zip Design 1800 breed\n\nAdres (Outlook): Graaf arnulfpad  3 2553 GW Den haag';
test('Blaauboer: notities ontbreken → toegevoegd vóór de adresregel, rest ongemoeid', () => {
  const { patch, redenen } = verfrisPatch({ huidig: { description: BASIS, address: { formatted: 'Graaf arnulfpad 3 Den Haag' }, contacts: [{ type: 'phone', value: '+31612115951' }] }, notities: 'Windsensor plaatsen voor bestaand scherm.\nfactuur maken. 0612115951', adresTekst: 'Graaf arnulfpad 3 2553 GW Den haag', telNr: '+31612115951' });
  assert.deepStrictEqual(redenen, ['notities toegevoegd']);
  assert.strictEqual(patch.description, 'Montage Sonty - Max Blaauboer\n(gesynct uit Outlook)\n\nGripp: 5127\nTE MONTEREN:\n- 1x Zip Design 1800 breed\n\n' + KOP + '\nWindsensor plaatsen voor bestaand scherm.\nfactuur maken. 0612115951\n\nAdres (Outlook): Graaf arnulfpad  3 2553 GW Den haag');
  assert.strictEqual(patch.address, undefined); assert.strictEqual(patch.contacts, undefined);
});
test('Schrooten: notities gewijzigd → blok vervangen, niets dubbel', () => {
  const desc = 'Montage Sonty - Daniel Schrooten\n(gesynct uit Outlook)\n\nGripp: 4703\n\n' + KOP + '\nScreendoek vervangen.\nT 06 17123487\n\nAdres (Outlook): Mildenburgallee 70, Spijkenisse';
  const { patch, redenen } = verfrisPatch({ huidig: { description: desc, address: { formatted: 'Mildenburgallee 70 Spijkenisse' }, contacts: [{}] }, notities: 'Screendoek vervangen. al twee keer eerder verzet (dus niet nogmaals is wenselijk)\nT 06 17123487', adresTekst: 'Mildenburgallee 70, Spijkenisse' });
  assert.deepStrictEqual(redenen, ['notities gewijzigd']);
  assert.strictEqual((patch.description.match(/Interne notities/g) || []).length, 1);
  assert.ok(patch.description.includes('al twee keer eerder verzet')); assert.ok(!patch.description.includes('\nScreendoek vervangen.\nT 06 17123487\n\n' + KOP));
  assert.ok(patch.description.endsWith('Adres (Outlook): Mildenburgallee 70, Spijkenisse'));
});
test('ongewijzigd → geen patch (idempotent)', () => {
  const desc = 'X\n\n' + KOP + '\nScreendoek vervangen.\n\nAdres (Outlook): Straat 1';
  const { patch, redenen } = verfrisPatch({ huidig: { description: desc, address: { formatted: 'Straat 1' }, contacts: [{}] }, notities: 'Screendoek vervangen.', adresTekst: 'Straat 1', telNr: '+316' });
  assert.deepStrictEqual(redenen, []); assert.deepStrictEqual(patch, {});
  const { patch: p2 } = verfrisPatch({ huidig: { description: verfrisPatch({ huidig: { description: 'X' }, notities: 'A\nB' }).patch.description }, notities: 'A\nB' });
  assert.deepStrictEqual(p2, {}, 'tweede keer geen patch meer');
});
test('notities leeg in Outlook → blok verwijderd', () => {
  const { patch, redenen } = verfrisPatch({ huidig: { description: 'X\n\n' + KOP + '\noud\n\nAdres (Outlook): Straat 1' }, notities: '' });
  assert.deepStrictEqual(redenen, ['notities verwijderd (leeg in Outlook)']); assert.strictEqual(patch.description, 'X\n\nAdres (Outlook): Straat 1');
});
test('adres: alleen aanvullen als Planado géén huisnummer heeft (Schipper); kantoor-adres nooit overschrijven', () => {
  assert.deepStrictEqual(verfrisPatch({ huidig: { description: 'X', address: { formatted: '1567 GB Assendelft, Nederland' } }, adresTekst: 'J.M. van der Meydenstraat 30, 1567 GB Assendelft' }).patch.address, { formatted: 'J.M. van der Meydenstraat 30, 1567 GB Assendelft' });
  assert.strictEqual(verfrisPatch({ huidig: { description: 'X', address: { formatted: 'Kerkstraat 9 Leiden' } }, adresTekst: 'Kerkstraat 11 Leiden' }).patch.address, undefined);
  assert.strictEqual(verfrisPatch({ huidig: { description: 'X', address: { formatted: '' } }, adresTekst: '(adres in Gripp 6475).' }).patch.address, undefined, 'geen huisnummer in Outlook-tekst → niets');
});
test('telefoon: alleen als er nog geen contact is en geen winkelafspraak', () => {
  assert.deepStrictEqual(verfrisPatch({ huidig: { description: 'X', contacts: [] }, telNr: '+31612345678', wieKlant: 'Charentestroom' }).patch.contacts, [{ type: 'phone', name: 'Charentestroom', value: '+31612345678' }]);
  assert.strictEqual(verfrisPatch({ huidig: { description: 'X', contacts: [{}] }, telNr: '+31612345678' }).patch.contacts, undefined);
  assert.strictEqual(verfrisPatch({ huidig: { description: 'X', contacts: [] }, telNr: '+31612345678', soortKlus: 'winkel' }).patch.contacts, undefined);
});
test('kapotte input crasht niet', () => { for (const h of [null, {}, { description: null }, { description: 5 }]) assert.ok(Array.isArray(verfrisPatch({ huidig: h, notities: 'x' }).redenen)); });
test('tekenlink: alleen montage/service, één keer, onderaan; inmeten/winkel niet; samen met notities in één patch', () => {
  const link = 'https://sonty-website.vercel.app/werkbon/u1?t=abc';
  const p1 = verfrisPatch({ huidig: { description: 'Montage Sonty - X\n\nAdres (Outlook): Straat 1' }, soortKlus: 'montage', tekenLink: link });
  assert.deepStrictEqual(p1.redenen, ['tekenlink toegevoegd']); assert.ok(p1.patch.description.endsWith(TEKEN_KOP + '\n' + link));
  assert.deepStrictEqual(verfrisPatch({ huidig: { description: p1.patch.description }, soortKlus: 'montage', tekenLink: link }).patch, {}, 'tweede keer niets');
  assert.deepStrictEqual(verfrisPatch({ huidig: { description: 'Inmeten Sonty - X' }, soortKlus: 'inmeet', tekenLink: link }).patch, {});
  assert.deepStrictEqual(verfrisPatch({ huidig: { description: 'Winkel' }, soortKlus: 'winkel', tekenLink: link }).patch, {});
  const p2 = verfrisPatch({ huidig: { description: 'Service afspraak Sonty - Y' }, notities: 'let op', soortKlus: 'service', tekenLink: link });
  assert.deepStrictEqual(p2.redenen, ['notities toegevoegd', 'tekenlink toegevoegd']); assert.ok(p2.patch.description.includes(KOP + '\nlet op') && p2.patch.description.endsWith(link));
  assert.strictEqual(metTekenLink('x', null), 'x');
});
// Matrix: notities {gelijk, anders, leeg, ontbreekt} × adres {planado met nr, zonder nr, leeg} × outlook-adres {met nr, zonder} × tel {ja, nee} × contacts {ja, nee} = 96
let n = 0, mis = 0;
for (const notS of ['gelijk', 'anders', 'leegOutlook', 'ontbreektPlanado'])
  for (const pAdr of ['Straat 5', 'Alleen Plaats', ''])
    for (const oAdr of ['Straat 5, 1234 AB Plaats', 'Plaats'])
      for (const tel of ['+31611111111', null])
        for (const cont of [[{}], []]) {
          n++;
          const inPlanado = notS === 'ontbreektPlanado' ? '' : 'oud';
          const inOutlook = notS === 'gelijk' ? 'oud' : notS === 'anders' ? 'nieuw' : notS === 'leegOutlook' ? '' : 'nieuw';
          const desc = 'Kop\n\nGripp: 1' + (inPlanado ? '\n\n' + KOP + '\n' + inPlanado : '') + '\n\nAdres (Outlook): ' + (pAdr || 'x');
          const { patch, redenen } = verfrisPatch({ huidig: { description: desc, address: { formatted: pAdr }, contacts: cont }, notities: inOutlook, adresTekst: oAdr, telNr: tel });
          const verwNot = inPlanado !== inOutlook; const verwAdr = /\d/.test(oAdr) && !/\d/.test(pAdr); const verwTel = !!tel && !cont.length;
          const goed = (!!patch.description === verwNot) && (!!patch.address === verwAdr) && (!!patch.contacts === verwTel) && (redenen.length === [verwNot, verwAdr, verwTel].filter(Boolean).length)
            && (!verwNot || (inOutlook ? notitieBlokUit(patch.description) === inOutlook : !patch.description.includes(KOP)));
          if (!goed) { mis++; if (mis < 6) console.log(`  ✗ matrix ${notS} p="${pAdr}" o="${oAdr}" tel=${tel} cont=${cont.length}: ${JSON.stringify(redenen)} ${JSON.stringify(patch).slice(0, 120)}`); }
        }
test(`matrix ${n} scenario's tegen orakel`, () => assert.strictEqual(mis, 0));
console.log(`\n${ok} ok, ${fout} fout`);
process.exit(fout ? 1 : 0);
