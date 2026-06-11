#!/usr/bin/env node
/**
 * Simuleer 100 klantgesprekken om de bot te trainen
 * Output: JSON met scenario + bot antwoord → review door Daimy
 */

const fs = require('fs');
const path = require('path');

const CLAUDE_KEY = fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
const PRODUCT_KNOWLEDGE = JSON.parse(fs.readFileSync(path.join(__dirname, 'sonty-product-knowledge.json'), 'utf8'));

const SCENARIOS = [
  // === PRIJSVRAGEN ===
  { category: 'prijs', msg: 'Wat kost een knikarmscherm?' },
  { category: 'prijs', msg: 'Hoeveel is een screen van 2 bij 2 meter?' },
  { category: 'prijs', msg: 'Wat kost een rolluik voor mijn slaapkamer?' },
  { category: 'prijs', msg: 'Prijsindicatie voor zipscreen 3x2.5m?' },
  { category: 'prijs', msg: 'Wat betaal ik voor een uitvalscherm?' },
  { category: 'prijs', msg: 'Pergola prijs?' },
  { category: 'prijs', msg: 'Wat kost montage erbij?' },
  { category: 'prijs', msg: 'Is de montage bij de prijs inbegrepen?' },
  { category: 'prijs', msg: 'Wat kost een complete set knikarmscherm met sensor en app bediening?' },
  { category: 'prijs', msg: 'Hebben jullie ook goedkopere opties?' },

  // === BEZWAREN ===
  { category: 'bezwaar', msg: 'Best wel duur eigenlijk' },
  { category: 'bezwaar', msg: 'Bij de concurrent is het goedkoper' },
  { category: 'bezwaar', msg: 'Ik moet er even over nadenken' },
  { category: 'bezwaar', msg: 'We moeten eerst overleggen met mijn partner' },
  { category: 'bezwaar', msg: 'Kan de prijs niet wat lager?' },
  { category: 'bezwaar', msg: 'Hornbach heeft zonwering voor de helft van de prijs' },
  { category: 'bezwaar', msg: 'Ik heb geen haast, misschien volgend jaar' },
  { category: 'bezwaar', msg: 'Ik twijfel tussen jullie en Verano' },
  { category: 'bezwaar', msg: 'Ik vind het allemaal nogal duur voor een zonnescherm' },
  { category: 'bezwaar', msg: 'Een kennis van me heeft het zelf gemonteerd, scheelt veel' },

  // === PRODUCT VRAGEN ===
  { category: 'product', msg: 'Wat is het verschil tussen een screen en zipscreen?' },
  { category: 'product', msg: 'Hebben jullie lamellen pergolas?' },
  { category: 'product', msg: 'Welke kleuren hebben jullie voor knikarmschermen?' },
  { category: 'product', msg: 'Is een screen ook goed tegen insecten?' },
  { category: 'product', msg: 'Wat is beter: rolluik of screen?' },
  { category: 'product', msg: 'Kan ik het scherm bedienen met mijn telefoon?' },
  { category: 'product', msg: 'Hoe lang gaat zonwering mee?' },
  { category: 'product', msg: 'Wat voor materiaal gebruiken jullie?' },
  { category: 'product', msg: 'Is het windbestendig?' },
  { category: 'product', msg: 'Kunnen jullie ook gordijnen en vouwgordijnen?' },

  // === SHOWROOM / AFSPRAAK ===
  { category: 'afspraak', msg: 'Kan ik langskomen om het te bekijken?' },
  { category: 'afspraak', msg: 'Waar zitten jullie?' },
  { category: 'afspraak', msg: 'Zijn jullie ook op zaterdag open?' },
  { category: 'afspraak', msg: 'We willen graag een inmeetafspraak' },
  { category: 'afspraak', msg: 'Komen jullie ook in Rotterdam?' },
  { category: 'afspraak', msg: 'Hoe lang duurt zo een inmeting?' },
  { category: 'afspraak', msg: 'We willen deze week nog langskomen, kan dat?' },
  { category: 'afspraak', msg: 'Vrijdag om 14u?' },
  { category: 'afspraak', msg: 'Kunnen we morgen al terecht?' },
  { category: 'afspraak', msg: 'Is inmeten gratis?' },

  // === VERGELIJKING / CONCURRENTIE ===
  { category: 'concurrentie', msg: 'Ik heb ook een offerte van Verano, waarom zou ik voor jullie kiezen?' },
  { category: 'concurrentie', msg: 'Wat maakt jullie beter dan andere aanbieders?' },
  { category: 'concurrentie', msg: 'Bij Leen Bakker hebben ze ook zonwering' },
  { category: 'concurrentie', msg: 'Kan ik het zelf monteren en alleen het product kopen?' },
  { category: 'concurrentie', msg: 'Brustor schijnt ook goed te zijn?' },

  // === TECHNISCH ===
  { category: 'technisch', msg: 'Mijn muur is van gipsblokken, kan dat?' },
  { category: 'technisch', msg: 'We hebben een plat dak, kan daar een pergola op?' },
  { category: 'technisch', msg: 'Is er ook zonnepaneel bediening mogelijk?' },
  { category: 'technisch', msg: 'Hoeveel stroom verbruikt een gemotoriseerd scherm?' },
  { category: 'technisch', msg: 'Kan het ook op een huurwoning?' },

  // === LEVERTIJD / SERVICE ===
  { category: 'service', msg: 'Hoe lang is de levertijd?' },
  { category: 'service', msg: 'Hoeveel jaar garantie zit erop?' },
  { category: 'service', msg: 'Wat als er iets kapot gaat?' },
  { category: 'service', msg: 'Doen jullie ook reparaties?' },
  { category: 'service', msg: 'Hoe snel kunnen jullie monteren na bestelling?' },

  // === CLOSING ===
  { category: 'closing', msg: 'Oké ik wil het bestellen' },
  { category: 'closing', msg: 'We gaan akkoord, hoe nu verder?' },
  { category: 'closing', msg: 'Ik wil graag doorgaan maar dan wel met korting' },
  { category: 'closing', msg: 'Als ik 3 screens bestel, krijg ik dan korting?' },
  { category: 'closing', msg: 'Ik wil dezelfde dag nog bestellen' },

  // === MOEILIJKE SITUATIES ===
  { category: 'moeilijk', msg: 'Ik heb vorige keer slecht advies gekregen' },
  { category: 'moeilijk', msg: 'Ben je een bot of een echt persoon?' },
  { category: 'moeilijk', msg: 'Ik wil alleen per telefoon communiceren' },
  { category: 'moeilijk', msg: 'Dit is oplichterij deze prijzen' },
  { category: 'moeilijk', msg: 'Ik heb al 3 keer gebeld maar niemand neemt op' },
  { category: 'moeilijk', msg: 'Kunnen jullie het ook in Groningen monteren?' },

  // === FOLLOW-UP na prijsindicatie ===
  { category: 'followup', msg: 'Ik heb de offerte ontvangen, ziet er goed uit' },
  { category: 'followup', msg: 'De offerte is duurder dan verwacht' },
  { category: 'followup', msg: 'Kunnen jullie de offerte aanpassen? Ik wil een ander model' },
  { category: 'followup', msg: 'Ik heb de offerte doorgestuurd naar mijn partner' },
  { category: 'followup', msg: 'Hoe lang is de offerte geldig?' },

  // === SEIZOEN / TIMING ===
  { category: 'timing', msg: 'Is het nu een goed moment om zonwering te kopen?' },
  { category: 'timing', msg: 'Hebben jullie zomeractie?' },
  { category: 'timing', msg: 'In de winter is het toch niet nodig?' },
  { category: 'timing', msg: 'Kan het nog voor de zomer geleverd worden?' },

  // === MEERDERE PRODUCTEN ===
  { category: 'multi', msg: 'We willen screens voor 5 ramen, krijgen we dan volumekorting?' },
  { category: 'multi', msg: 'Kunnen jullie het hele huis doen? Zonwering + gordijnen + behang?' },
  { category: 'multi', msg: 'We willen een knikarmscherm voor het terras en screens voor de slaapkamers' },

  // === ZAKELIJK ===
  { category: 'zakelijk', msg: 'Wij zijn een horecabedrijf en zoeken zonwering voor ons terras' },
  { category: 'zakelijk', msg: 'Kan ik de BTW terugvragen?' },
  { category: 'zakelijk', msg: 'Hebben jullie ervaring met bedrijfspanden?' },

  // === EDGE CASES ===
  { category: 'edge', msg: 'Hallo' },
  { category: 'edge', msg: '👍' },
  { category: 'edge', msg: 'Bedankt!' },
  { category: 'edge', msg: 'Nee laat maar' },
  { category: 'edge', msg: 'Stop met berichten sturen' },
  { category: 'edge', msg: 'Haha die is goed' },
  { category: 'edge', msg: '?' },

  // TOTAAL: 87 scenarios - aangevuld tot ~100
  { category: 'prijs', msg: 'Wat is de goedkoopste zonwering die jullie hebben?' },
  { category: 'prijs', msg: 'Serre zonwering 4 bij 3 meter, wat kost dat?' },
  { category: 'product', msg: 'Hebben jullie ook veranda screens?' },
  { category: 'product', msg: 'Wat is het verschil tussen SunBasic en SunEye?' },
  { category: 'afspraak', msg: 'Ik wil met het hele gezin langskomen, mag dat?' },
  { category: 'bezwaar', msg: 'Ik heb nu even geen budget, misschien over een paar maanden' },
  { category: 'moeilijk', msg: 'Ik wil een klacht indienen over de montage' },
  { category: 'closing', msg: 'We gaan ervoor! Wat zijn de volgende stappen?' },
  { category: 'followup', msg: 'Ik heb de offerte bekeken, kunnen we de kleur nog wijzigen?' },
  { category: 'multi', msg: 'Wat kost het als ik 2 rolluiken en 3 screens bestel inclusief montage?' },
  { category: 'edge', msg: 'Spreken jullie ook Engels?' },
  { category: 'edge', msg: 'Ik zoek eigenlijk een schilder' },
  { category: 'concurrentie', msg: 'Knikarmschermgigant.nl heeft het voor de helft' },
];

async function simulate() {
  const results = [];
  const si = PRODUCT_KNOWLEDGE.sonty_info;
  const prods = PRODUCT_KNOWLEDGE.producten;

  const systemPrompt = `Je bent Jaimy, verkoopassistent van Sonty.
BELANGRIJKSTE REGEL: VERZIN NOOIT informatie.
${si.klanten} klanten, ${si.reviews}, showroom ${si.showroom}, tel ${si.telefoon}.
Inmeting: bij afname gratis, anders €75.
Eigen monteurs. Sunmaster premium dealer.
Actie: ${si.actie}

Producten: ${Object.entries(prods).map(([k,p]) => k + ': ' + (typeof p.prijsindicatie_incl_btw === 'string' ? p.prijsindicatie_incl_btw : JSON.stringify(p.prijsindicatie_incl_btw))).join('. ')}

NOOIT: bellen aanbieden, booking link sturen, korting geven, openingstijden noemen, prijzen verzinnen, lamellen pergola noemen.
ALTIJD: sturen op afspraak (showroom/inmeting), kort antwoorden (max 3 zinnen), menselijk en warm.
Bij afspraak: ZELF inplannen, GEEN link sturen. Navigatie: Frijdastraat 6D, hofje in, rechterhand, gratis parkeren.`;

  console.log('Simuleer ' + SCENARIOS.length + ' gesprekken...\n');

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    process.stdout.write((i + 1) + '/' + SCENARIOS.length + ' [' + s.category + '] ');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': CLAUDE_KEY, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: systemPrompt,
        messages: [
          { role: 'assistant', content: 'Hi! Jaimy hier van Sonty. Ik zag dat je een offerte hebt ontvangen. Heb je vragen? Ik help je graag!' },
          { role: 'user', content: s.msg }
        ],
      }),
    });

    const data = await res.json();
    let reply = data.content?.[0]?.text || 'ERROR: ' + JSON.stringify(data).substring(0, 100);

    // Veiligheidsfilter — zelfde als de echte bot
    reply = reply.replace(/gratis inmet(ing|en)/gi, 'inmeting (€75, bij afname verrekend)');
    reply = reply.replace(/gratis opmeting/gi, 'inmeting (€75, bij afname verrekend)');
    reply = reply.replace(/kosteloz?e? inmet/gi, 'inmeting (€75, bij afname verrekend)');
    reply = reply.replace(/4-6 weken/g, '6-8 weken');
    reply = reply.replace(/4 tot 6 weken/g, '6 tot 8 weken');
    reply = reply.replace(/lamellen ?pergola/gi, 'pergola met ZIP-screen');

    results.push({ id: i + 1, category: s.category, klant: s.msg, bot: reply });
    console.log(reply.substring(0, 70));

    await new Promise(r => setTimeout(r, 500)); // Rate limit
  }

  // Save results
  const outFile = path.join(__dirname, '..', 'data', 'bot-training-100.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log('\n✅ Opgeslagen in ' + outFile);

  // Print summary
  const categories = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = 0;
    categories[r.category]++;
  }
  console.log('\nCategorie verdeling:');
  for (const [cat, count] of Object.entries(categories)) {
    console.log('  ' + cat + ': ' + count);
  }
}

simulate().catch(console.error);

// Dit wordt NIET uitgevoerd - de filter zit al in de main functie
// Maar we moeten de filter VOOR het opslaan toepassen
