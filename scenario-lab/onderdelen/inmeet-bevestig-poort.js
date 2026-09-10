// Scenario-lab: INMEET-BEVESTIG-POORT (10-09, Saskia Badloe). Orakel:
// O1 bevestigt een inmeetmoment (datum/dag/tijd) als vaststaand zonder boeking in deze beurt
//    en zonder bestaande boeking → blokkeren;
// O2 in deze beurt geboekt (inmeet_boeken) → door;
// O3 bestaande geboekte afspraak op hetzelfde moment → door; op een ANDER moment → blokkeren;
// O4 boeking met status 'verzet' telt niet als geboekt → blokkeren;
// O5 geen bevestigende formulering, geen inmeetcontext, showroom, notitie-"genoteerd" of geen
//    concreet moment → altijd door (de poort mag nooit gewone antwoorden tegenhouden).
const { combinaties } = require('../matrix.js');
const { beoordeel } = require('../../scripts/lib/inmeet-bevestig-poort.js');

// moment: wat de tekst noemt (null = niet genoemd)
const TEKSTEN = {
  'inmeet-datum-tijd': { tekst: 'Top, dan staat maandag 21 september om 13:40 voor je genoteerd. Onze adviseur komt dan bij je langs om in te meten. Fijne dag!', claim: true, moment: { dag: 21, maand: 9, weekdag: 1, uur: 13, minuut: 40 } },
  'inmeet-staat-vast': { tekst: 'Je hebt helemaal gelijk, sorry daarvoor! Maandag 21 september om 13:40 staat vast voor het inmeten.', claim: true, moment: { dag: 21, maand: 9, weekdag: 1, uur: 13, minuut: 40 } },
  'inmeet-datum': { tekst: 'Je inmeetafspraak staat vast op 21 september, onze adviseur komt dan langs.', claim: true, moment: { dag: 21, maand: 9, weekdag: null, uur: null, minuut: null } },
  'inmeet-weekdag': { tekst: 'Ik heb het inmeten voor je vastgezet op maandag, de adviseur komt in de middag.', claim: true, moment: { dag: null, maand: null, weekdag: 1, uur: null, minuut: null } },
  'inmeet-tijd': { tekst: 'De adviseur komt om 13:40 bij je langs om in te meten, dat staat ingepland.', claim: true, moment: { dag: null, maand: null, weekdag: null, uur: 13, minuut: 40 } },
  'inmeet-zet-vast': { tekst: 'Dan zet ik hem nu voor je vast: woensdag 23 september om 09:10 komt onze adviseur inmeten.', claim: true, moment: { dag: 23, maand: 9, weekdag: 3, uur: 9, minuut: 10 } },
  'engels': { tekst: 'Great, your measuring appointment is booked for Monday 21 September at 13:40. Our advisor will come by.', claim: true, moment: { dag: 21, maand: 9, weekdag: 1, uur: 13, minuut: 40 } },
  'inmeet-geen-moment': { tekst: 'Fijn, het inmeten staat genoteerd. De planning stuurt je de tijd zodra die bekend is.', claim: true, moment: null },
  'showroom': { tekst: 'Top, ik heb je afspraak vastgezet: donderdag 27 augustus om 14:30 in onze showroom aan de Frijdastraat.', claim: false, moment: { dag: 27, maand: 8 } },
  'notitie-nummer': { tekst: 'Ik heb je telefoonnummer 06 12 34 56 78 genoteerd. De adviseur belt je maandag even over de zolderramen.', claim: false, moment: { weekdag: 1 } },
  'notitie-voorkeur': { tekst: 'Je voorkeur voor de ochtend heb ik genoteerd voor de planning. Zodra er een moment is, hoor je het van onze adviseur, waarschijnlijk rond 21 september.', claim: false, moment: { dag: 21, maand: 9 } },
  'geen-claim': { tekst: 'Goeie vraag! Onze adviseur bekijkt maandag 21 september ter plekke of er een steiger nodig is. Kun je me een foto van de zolderramen sturen?', claim: false, moment: { dag: 21, maand: 9 } },
  'doorgeven': { tekst: 'Dank je! Ik geef je keuze voor maandag 21 september 13:40 nu door aan de planning. Zodra de afspraak vaststaat krijg je de definitieve bevestiging voor het inmeten.', claim: false, moment: { dag: 21, maand: 9 } },
};
const BOEKINGEN = {
  'geen': null,
  'zelfde': { aankomst: '2026-09-21T11:40:00.000Z', status: 'geboekt', d: { dag: 21, maand: 9, weekdag: 1, uur: 13, minuut: 40 } },
  'andere-datum': { aankomst: '2026-09-23T07:10:00.000Z', status: 'geboekt', d: { dag: 23, maand: 9, weekdag: 3, uur: 9, minuut: 10 } },
  'zelfde-dag-andere-tijd': { aankomst: '2026-09-21T08:00:00.000Z', status: 'geboekt', d: { dag: 21, maand: 9, weekdag: 1, uur: 10, minuut: 0 } },
  'verzet': { aankomst: '2026-09-21T11:40:00.000Z', status: 'verzet', d: { dag: 21, maand: 9, weekdag: 1, uur: 13, minuut: 40 } },
};
const dims = [
  { naam: 'tekst', waarden: Object.keys(TEKSTEN).map((k) => ({ label: k })) },
  { naam: 'beurt', waarden: [{ label: 'geboekt', v: true }, { label: 'niet-geboekt', v: false }] },
  { naam: 'boeking', waarden: Object.keys(BOEKINGEN).map((k) => ({ label: k })) },
];
function scenarios() { return combinaties(dims); }
function past(m, d) {
  if (m.dag != null && (m.dag !== d.dag || m.maand !== d.maand)) return false;
  if (m.dag == null && m.weekdag != null && m.weekdag !== d.weekdag) return false;
  if (m.uur != null && (m.uur !== d.uur || m.minuut !== d.minuut)) return false;
  return true;
}
function orakel(s) {
  const t = TEKSTEN[s.tekst.label];
  const b = BOEKINGEN[s.boeking.label];
  let blok = false;
  if (t.claim && t.moment && !s.beurt.v) {
    const geboekt = b && b.status === 'geboekt';
    blok = !(geboekt && past(t.moment, b.d));
  }
  return { wil: blok ? 'blokkeer' : 'ok', blok };
}
function voerUit(s) {
  const b = BOEKINGEN[s.boeking.label];
  const r = beoordeel({ tekst: TEKSTEN[s.tekst.label].tekst, inmeetGeboektDezeBeurt: s.beurt.v, bestaandeBoeking: b ? { aankomst: b.aankomst, status: b.status } : null });
  return { blok: r.blok, reden: r.reden, melding: r.blok };
}
function vergelijk(w, e) { return w.blok === e.blok; }
module.exports = { naam: 'inmeet-bevestig-poort (geen "staat genoteerd" zonder echte boeking)', scenarios, orakel, voerUit, vergelijk };
