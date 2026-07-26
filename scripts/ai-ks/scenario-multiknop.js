#!/usr/bin/env node
/**
 * SCENARIO-RUN: klant tikt MEERDERE knoppen (Daimy 2026-07-26).
 *
 * Aanleiding: Joey tikte in het testgesprek (ticket 963502035) om 17:21 binnen een minuut op
 * "Ik twijfel nog", "Dit is akkoord" en "Ik heb een vraag", plus een los bericht. Twee daarvan
 * spreken elkaar tegen. Dat gaat straks vaker gebeuren, dus de bot moet er goed mee omgaan:
 * niet drie keer antwoorden, en niet doorzetten naar de planning op basis van een akkoord dat
 * meteen daarna wordt tegengesproken.
 *
 * Raakt Trengo niet aan en verstuurt niets.
 */
const fs = require('fs');
const path = require('path');
const { beantwoord } = require('./agent.js');

const LINK = 'https://document.reuzenpanda.nl/nl/731483fa-ef6b-4aae-afcf-883ec09219dd/06e2db64/latest';
const TEMPLATE = `Hi Joey, Jaimy hier van Sonty. Leuk dat ik je mag helpen!

Je prijsindicatie staat klaar. Aan producten en montage zit een waarde van 9.000 euro, maar met de actie die nu loopt betaal je 7.650 euro. Daar zit alles in, ook de btw, dus je komt niet voor verrassingen te staan. Deze prijs geldt nog tot maandag 3 augustus.

Bekijk je offerte hier: ${LINK} — offertenummer: 20269902

Ga je akkoord, dan plannen we het inmeten in. Onze adviseur neemt alle stalen en kleuren mee, dus je kiest gewoon thuis in je eigen licht. Pas na het inmeten staat de definitieve prijs vast.`;

const SCENARIOS = [
  ['Precies het Joey-geval', ['ZIEKKKK', 'Ik twijfel nog', 'Dit is akkoord', 'Ik heb een vraag']],
  ['Tegenstrijdig: twijfel dan akkoord', ['Ik twijfel nog', 'Dit is akkoord']],
  ['Tegenstrijdig: akkoord dan twijfel', ['Dit is akkoord', 'Ik twijfel nog']],
  ['Zelfde knop drie keer', ['Dit is akkoord', 'Dit is akkoord', 'Dit is akkoord']],
  ['Knop plus echte vraag erna', ['Ik heb een vraag', 'Kan het ook in het wit?']],
];

(async () => {
  const uit = [`# Scenario-run: meerdere knoppen achter elkaar\n\nGedraaid ${new Date().toISOString()}. Niets verstuurd.\n`];
  for (const [naam, knoppen] of SCENARIOS) {
    process.stderr.write(`  ${naam} ...\n`);
    const berichten = [{ van: 'sonty', tekst: TEMPLATE, tijd: '2026-07-27 17:14:00' }];
    knoppen.forEach((k, i) => berichten.push({ van: 'klant', tekst: k, tijd: `2026-07-27 17:2${i + 1}:00` }));
    let res;
    try { res = await beantwoord({ kanaal: 'WA', klant: { naam: 'Joey Engelen', email: 'j@example.nl', phone: '+31628209480' }, berichten, liveTest: false, sonny: false, teamNotities: [], ticketId: 999000002 }); }
    catch (e) { res = { antwoord: null, acties: [], fout: e.message }; }

    uit.push(`\n## ${naam}\n\nKlant tikte achter elkaar: ${knoppen.map((k) => `"${k}"`).join(', ')}\n`);
    if (res.fout) uit.push(`FOUT: ${res.fout}\n`);
    uit.push('**Antwoord:**\n\n' + (res.antwoord ? res.antwoord.trim() : '(geen antwoord)') + '\n');
    const acties = (res.acties || []).map((a) => a.type).join(', ') || 'geen';
    uit.push(`\n**Acties:** ${acties}\n`);
    // Dit is het risico: doorzetten naar de planning terwijl de klant ook twijfel uitte.
    const zetDoor = (res.acties || []).some((a) => a.type === 'inmeet_afspraak');
    const twijfel = knoppen.some((k) => /twijfel/i.test(k));
    uit.push(`**Zet door naar planning:** ${zetDoor ? 'JA' : 'nee'}${zetDoor && twijfel ? '  <-- LET OP: klant uitte ook twijfel' : ''}\n`);
  }
  const p = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'scenario-multiknop.md');
  fs.writeFileSync(p, uit.join('\n'));
  console.log('\nrapport: ' + p);
})();
