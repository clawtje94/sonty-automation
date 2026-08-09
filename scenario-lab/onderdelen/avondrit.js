// Onderdeel: AVONDRIT NA 15:00 (Daimy 09-08: "als opdrachten heel dicht bij de
// laatste opdracht zijn of op de weg naar huis toe, dan mag je ze bij Sjoerd en Joey
// nog na 15:00 inplannen").
//
// Invarianten (hard):
//  - alleen ná de dienst plannen als het écht nauwelijks omrijden is (≤15 min)
//  - nooit een avondrit zonder klus die dag (het moet aansluiten op iets)
//  - nooit later aankomen dan 90 minuten na het einde van de dienst
//  - een klus die binnen de dienst past hoort NIET als avondrit te verschijnen
const { combinaties } = require('../matrix.js');
const { zoekSlots, AVOND_MAX_EXTRA_MIN, AVOND_MAX_NA_MIN } = require('../../scripts/lib/slotzoeker.js');

const DAG = '2026-09-14';
const WERKDAG = [{ datum: DAG, van: '09:00', tot: '15:00' }];
const THUIS = 'Magazijnweg 1, 2651 AA Berkel en Rodenrijs';
const KLUS = (vanUur, totUur, pc) => ({
  start: `${DAG}T${String(vanUur).padStart(2, '0')}:00:00`,
  eind: `${DAG}T${String(totUur).padStart(2, '0')}:00:00`,
  adres: `Bestaandelaan 1, ${pc} XX Plaats`, klant: 'bestaand',
});

const dimensies = [
  {
    naam: 'agenda',
    waarden: [
      // stub-reistijd: minuten ≈ |postcodeverschil| / 25
      { label: 'vol-tot-1430', maak: () => [KLUS(9, 14.5, 2652)], laatsteEind: 14.5, laatstePc: 2652 },
      { label: 'vol-tot-15', maak: () => [KLUS(9, 15, 2652)], laatsteEind: 15, laatstePc: 2652 },
      { label: 'lege-dag', maak: () => [], laatsteEind: null, laatstePc: null },
      { label: 'klus-in-de-ochtend', maak: () => [KLUS(9, 10, 2652)], laatsteEind: 10, laatstePc: 2652 },
    ],
  },
  {
    naam: 'klant',
    waarden: [
      { label: 'om-de-hoek', pc: 2653 },   // ~0-1 min van de laatste klus
      { label: 'onderweg', pc: 2651 },     // richting thuis: nauwelijks omweg
      { label: 'ver-weg', pc: 4800 },      // grote omweg: mag nooit na de dienst
    ],
  },
  {
    naam: 'duur',
    waarden: [{ label: 'kort', duurMin: 25 }, { label: 'lang', duurMin: 90 }],
  },
];

function orakel(s) {
  const heeftKlus = s.agenda.laatsteEind !== null;
  // Zonder klus die dag mag er nooit een avondrit zijn; ver weg ook niet.
  return { avondMag: heeftKlus && s.klant.label !== 'ver-weg' };
}

async function voerUit(s) {
  const agenda = s.agenda.maak();
  const slots = await zoekSlots({
    agenda, adres: `Klantstraat 3, ${s.klant.pc} AB Plaats`, duurMin: s.duur.duurMin,
    werkdagen: WERKDAG, startAdres: THUIS, eindAdres: THUIS,
  });
  const avond = slots.filter((x) => x.naDienst);
  const dagEind = new Date(`${DAG}T15:00:00`);
  return {
    avondAantal: avond.length,
    teDuur: avond.filter((x) => x.extraRijtijdMin > AVOND_MAX_EXTRA_MIN).length,
    teLaat: avond.filter((x) => +x.aankomst > +dagEind + AVOND_MAX_NA_MIN * 60000).length,
    // een avondrit hoort echt ná de dienst te eindigen, anders is het een gewoon slot
    binnenDienst: avond.filter((x) => +x.vertrek <= +dagEind).length,
    melding: true,
  };
}

function vergelijk(wil, echt) {
  if (echt.teDuur || echt.teLaat || echt.binnenDienst) return false; // harde grenzen
  if (!wil.avondMag) return echt.avondAantal === 0; // lege dag of verre klant: nooit
  return true; // mag, maar hoeft niet (agenda kan het gewoon niet toelaten)
}

module.exports = {
  naam: 'avondrit na 15:00 (alleen dichtbij of onderweg naar huis)',
  scenarios: () => combinaties(dimensies),
  orakel,
  voerUit,
  vergelijk,
};
