#!/usr/bin/env node
/**
 * A/B-VERDELER voor de offerte-WhatsApptemplates (Daimy 2026-07-26).
 *
 * Verdeelt de uitgaande offerte-berichten strikt om en om over de varianten en legt per klant
 * vast welke variant hij kreeg. Zonder die registratie valt achteraf niet te meten welke
 * template het beste werkte, en dat is precies het doel van de test.
 *
 * Bewust round-robin en geen toeval: bij ongeveer 45 offertes per dag en 4 varianten levert
 * toeval scheve groepen op (de een 60, de ander 100), en dan meet je het verschil tussen de
 * groepsgroottes in plaats van tussen de teksten.
 *
 * Vul TEMPLATES zodra Meta de vier heeft goedgekeurd; zolang de lijst leeg is geeft
 * kiesTemplate() null terug en valt de aanroeper terug op de oude template.
 */
const fs = require('fs');
const path = require('path');

const STATE = path.join(__dirname, '..', 'data', 'ab-test-state.json');

// Vullen met de echte Trengo-template-id's zodra ze zijn goedgekeurd.
// naam = alleen voor het rapport, aantalVars = controle dat we de juiste params meesturen.
const TEMPLATES = [
  // { id: 0, naam: 'inmeten',    aantalVars: 5 },
  // { id: 0, naam: 'vertrouwen', aantalVars: 5 },
  // { id: 0, naam: 'klopt',      aantalVars: 5 },
  // { id: 0, naam: 'kort',       aantalVars: 5 },
];

function laad() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); }
  catch { return { teller: 0, toewijzingen: {} }; }
}
function bewaar(s) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s, null, 1));
}

/**
 * Kiest de volgende variant en legt de toewijzing vast.
 * Dezelfde klant krijgt bij een tweede offerte dezelfde variant, anders vervuilt hij twee
 * groepen tegelijk en weet je bij een reactie niet welke tekst hem overhaalde.
 */
function kiesTemplate({ telefoon, ticketId, offertenummer }) {
  if (!TEMPLATES.length) return null;
  const s = laad();
  const sleutel = String(telefoon || '').replace(/[^0-9]/g, '');

  if (sleutel && s.toewijzingen[sleutel]) {
    const eerder = TEMPLATES.find((t) => t.naam === s.toewijzingen[sleutel].naam);
    if (eerder) return eerder;
  }

  const gekozen = TEMPLATES[s.teller % TEMPLATES.length];
  s.teller++;
  if (sleutel) {
    s.toewijzingen[sleutel] = {
      naam: gekozen.naam,
      templateId: gekozen.id,
      tijd: new Date().toISOString(),
      ticketId: ticketId || null,
      offertenummer: offertenummer || null,
    };
  }
  bewaar(s);
  return gekozen;
}

/** Alle toewijzingen sinds een bepaald moment, voor het rapport. */
function toewijzingenSinds(sindsMs) {
  const s = laad();
  return Object.entries(s.toewijzingen)
    .map(([tel, v]) => ({ telefoon: tel, ...v }))
    .filter((v) => new Date(v.tijd).getTime() >= sindsMs);
}

module.exports = { kiesTemplate, toewijzingenSinds, TEMPLATES, laad };

// Snelle controle: verdeelt hij echt gelijk?
if (require.main === module) {
  const nep = [
    { id: 1, naam: 'inmeten', aantalVars: 5 }, { id: 2, naam: 'vertrouwen', aantalVars: 5 },
    { id: 3, naam: 'klopt', aantalVars: 5 }, { id: 4, naam: 'kort', aantalVars: 5 },
  ];
  const telling = {};
  let teller = 0;
  for (let i = 0; i < 320; i++) {
    const t = nep[teller++ % nep.length];
    telling[t.naam] = (telling[t.naam] || 0) + 1;
  }
  console.log('320 offertes over 4 varianten:', JSON.stringify(telling));
  const waarden = Object.values(telling);
  console.log(new Set(waarden).size === 1 ? 'Precies gelijk verdeeld.' : 'SCHEEF VERDEELD');
}
