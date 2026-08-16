// Onderdeel: telefoonnummer-normalisatie voor WhatsApp (normaliseerTelefoon).
// Orakel (16-08, WhatsApp "niet afgeleverd"-onderzoek):
//  - NL mobiel in elke notatie (06, +316, 316, 6, 0031, dubbele 0-prefix) → +316XXXXXXXX
//  - het RP-formulier-lek (+31 + 8 cijfers, klant liet 06 weg) → hersteld met 6 ervoor
//    (bewijs: Giel Kooi kapot +3144536548 vs goed +31644536548)
//  - vaste nummers, te kort/te lang en leeg → skip (nooit stil een kansloos WhatsApp-doel)
//  - buitenlandse nummers → onaangeraakt doorlaten, alleen op lengte gecheckt
//  - opmaak (spaties, streepjes, punten, haakjes, tekst eromheen) mag de uitkomst NOOIT veranderen
const { combinaties } = require('../matrix.js');
const { normaliseerTelefoon } = require('../../scripts/lib/telefoon-normalisatie.js');

const dimensies = [
  {
    naam: 'geval',
    waarden: [
      { label: 'nl-mobiel-06', invoer: '0612345678', wil: 'ok', nummer: '+31612345678' },
      { label: 'nl-mobiel-plus31', invoer: '+31612345678', wil: 'ok', nummer: '+31612345678' },
      { label: 'nl-mobiel-31-zonder-plus', invoer: '31612345678', wil: 'ok', nummer: '+31612345678' },
      { label: 'nl-mobiel-zonder-0', invoer: '612345678', wil: 'ok', nummer: '+31612345678' },
      { label: 'nl-mobiel-0031', invoer: '0031612345678', wil: 'ok', nummer: '+31612345678' },
      { label: 'dubbele-prefix-plus310', invoer: '+310612345678', wil: 'ok', nummer: '+31612345678' },
      { label: 'haakjes-nul-notatie', invoer: '+31(0)612345678', wil: 'ok', nummer: '+31612345678' },
      { label: 'formulier-lek-giel', invoer: '+3144536548', wil: 'hersteld', nummer: '+31644536548' },
      { label: 'formulier-lek-cas', invoer: '+3122422242', wil: 'hersteld', nummer: '+31622422242' },
      { label: 'formulier-lek-start-6', invoer: '+3164876442', wil: 'hersteld', nummer: '+31664876442' },
      { label: 'formulier-lek-kaal-8', invoer: '44536548', wil: 'hersteld', nummer: '+31644536548' },
      { label: 'vast-nummer-06-vorm', invoer: '0714031720', wil: 'blokkeer' },
      { label: 'vast-nummer-plus31', invoer: '+31714031720', wil: 'blokkeer' },
      { label: 'vast-nummer-010', invoer: '0104567890', wil: 'blokkeer' },
      { label: 'te-kort', invoer: '+31622', wil: 'blokkeer' },
      { label: 'te-kort-7-cijfers', invoer: '0622422', wil: 'blokkeer' },
      { label: 'te-lang', invoer: '+316123456789', wil: 'blokkeer' },
      { label: 'leeg', invoer: '', wil: 'blokkeer' },
      { label: 'alleen-tekst', invoer: 'onbekend', wil: 'blokkeer' },
      { label: 'buitenlands-belgie', invoer: '+32475123456', wil: 'ok', nummer: '+32475123456' },
      { label: 'buitenlands-duits-00', invoer: '004915112345678', wil: 'ok', nummer: '+4915112345678' },
      { label: 'buitenlands-te-kort', invoer: '+3247', wil: 'blokkeer' },
    ],
  },
  {
    naam: 'opmaak',
    waarden: [
      { label: 'kaal', vorm: (s) => s },
      { label: 'spaties', vorm: (s) => s.replace(/(\d{2})(?=\d)/g, '$1 ') },
      { label: 'streepjes', vorm: (s) => s.replace(/(\d{3})(?=\d)/g, '$1-') },
      { label: 'punten', vorm: (s) => s.replace(/(\d{2})(?=\d)/g, '$1.') },
      { label: 'rand-spaties', vorm: (s) => '  ' + s + ' ' },
      { label: 'tekst-erom', vorm: (s) => (s ? 'tel: ' + s : s) },
      { label: 'mix', vorm: (s) => s.replace(/(\d{4})(?=\d)/g, '$1 - ') },
    ],
  },
];

module.exports = {
  naam: 'telefoon-normalisatie',
  scenarios: () => combinaties(dimensies),
  orakel: (s) => (s.geval.wil === 'blokkeer'
    ? { wil: 'blokkeer' }
    : { wil: s.geval.wil, nummer: s.geval.nummer }),
  voerUit: (s) => {
    const r = normaliseerTelefoon(s.opmaak.vorm(s.geval.invoer));
    // skip en hersteld zijn allebei zichtbaar: V4 logt en meldt ze in de run-samenvatting
    return { uitkomst: r.actie, nummer: r.nummer, melding: r.actie !== 'ok' };
  },
  vergelijk: (wil, echt) => (wil.wil === 'blokkeer'
    ? echt.uitkomst === 'skip'
    : echt.uitkomst === wil.wil && echt.nummer === wil.nummer),
};
