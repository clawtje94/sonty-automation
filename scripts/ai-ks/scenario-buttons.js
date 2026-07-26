#!/usr/bin/env node
/**
 * SCENARIO-RUN voor de knoppen van de A/B-templates (Daimy 2026-07-26).
 *
 * Simuleert per knop dat een klant erop tikt en laat zien wat de bot dan antwoordt en welke
 * acties hij zou uitvoeren. Raakt Trengo NIET aan en verstuurt niets: liveTest staat uit, dus
 * de tools draaien in schaduwmodus en melden alleen wat ze zouden doen.
 *
 * Waarom eerst dit: een knop-tik is straks het eerste wat honderden klanten doen. Gaat de bot
 * daar de mist in, dan gebeurt dat meteen op schaal. Beter hier zien wat er komt.
 *
 * Gebruik: node scripts/ai-ks/scenario-buttons.js
 */
const fs = require('fs');
const path = require('path');
const { beantwoord } = require('./agent.js');

const LINK = 'https://document.reuzenpanda.nl/nl/731483fa-ef6b-4aae-afcf-883ec09219dd/06e2db64-fd5d-4cb7-b6d4-8f5e02931e75/latest';
const TEMPLATE_TEKST = (slot) => `Hi Marieke, Jaimy hier van Sonty. Leuk dat ik je mag helpen!

Je prijsindicatie staat klaar. Aan producten en montage zit een waarde van 4.572 euro, maar met de actie die nu loopt betaal je 3.886 euro. Daar zit alles in, ook de btw, dus je komt niet voor verrassingen te staan. Deze prijs geldt nog tot maandag 3 augustus.

Bekijk je offerte hier: ${LINK} — offertenummer: 202610377

${slot}`;

const SLOTS = {
  inmeten: 'Ga je akkoord, dan plannen we het inmeten in. Onze adviseur neemt alle stalen en kleuren mee, dus je kiest gewoon thuis in je eigen licht. Pas na het inmeten staat de definitieve prijs vast.',
  garantie: 'Onze monteurs zijn bij ons in dienst, dus er komt geen onderaannemer over de vloer. Je krijgt 3 jaar garantie op de montage en 5 jaar op het product.',
  check: 'Wil je even kijken of de maten en kleuren kloppen? Die heb je zelf ingeschat bij de aanvraag, dus daar zit vaak nog een verschil in. Ik pas het zo voor je aan.',
  kortweg: 'Wat wil je doen?',
};

// Elke unieke knoptekst uit de vier templates, met de template waar hij bij hoort.
const SCENARIOS = [
  ['offerte_ab1_inmeten', 'inmeten', 'Dit is akkoord'],
  ['offerte_ab1_inmeten', 'inmeten', 'Ik twijfel nog'],
  ['offerte_ab1_inmeten', 'inmeten', 'Ik heb een vraag'],
  ['offerte_ab2_garantie', 'garantie', 'Dit is akkoord'],
  ['offerte_ab3_check', 'check', 'Alles klopt'],
  ['offerte_ab3_check', 'check', 'Er moet iets anders'],
  ['offerte_ab4_kortweg', 'kortweg', 'Inmeten inplannen'],
  ['offerte_ab4_kortweg', 'kortweg', 'Eerst showroom'],
];

(async () => {
  const regels = [`# Scenario-run knoppen A/B-templates\n\nGedraaid op ${new Date().toISOString()}. Niets verstuurd, Trengo niet aangeraakt.\n`];
  for (const [template, slot, knop] of SCENARIOS) {
    process.stderr.write(`  ${template} / "${knop}" ...\n`);
    const gesprek = {
      kanaal: 'WA',
      klant: { naam: 'Marieke Meijer', email: 'marieke@example.nl', phone: '+31612345678' },
      berichten: [
        { van: 'sonty', tekst: TEMPLATE_TEKST(SLOTS[slot]), tijd: '2026-07-27 09:12:00' },
        { van: 'klant', tekst: knop, tijd: '2026-07-27 09:31:00' },
      ],
      liveTest: false,      // schaduwmodus: tools voeren niets echt uit
      sonny: false,
      teamNotities: [],
      ticketId: 999000001,
    };
    let res;
    try { res = await beantwoord(gesprek); }
    catch (e) { res = { antwoord: null, acties: [], fout: e.message }; }

    regels.push(`\n## ${template} — knop "${knop}"\n`);
    if (res.fout) regels.push(`FOUT: ${res.fout}\n`);
    regels.push('**Antwoord van de bot:**\n\n' + (res.antwoord ? res.antwoord.trim() : '(geen antwoord)') + '\n');
    const acties = (res.acties || []).map((a) => a.type).join(', ') || 'geen';
    regels.push(`\n**Acties:** ${acties}\n`);
    const tools = (res.toolCalls || []).map((t) => (typeof t === 'string' ? t : (t.name || t.tool || JSON.stringify(t).slice(0, 40)))).join(', ') || 'geen';
    regels.push(`**Tools aangeroepen:** ${tools}\n`);
  }
  const uit = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'scenario-buttons.md');
  fs.writeFileSync(uit, regels.join('\n'));
  console.log('\nklaar, rapport: ' + uit);
})();
