// Onderdeel: INMEET-ZOEKLIJST (Daimy 03-09, Markus Naumer: "waarom kan ik hier niet een klant
// opzoeken … die is vandaag vergeten en wil een nieuwe afspraak").
// Twee pure stukken: de lijstbouwer op de Mac (scripts/lib/afspraken-zoeklijst.js) en het zoekvak
// op de site (sonty-website/lib/inmeet-zoek.js).
//
// Orakel (hard):
//  - Elke inmeetafspraak uit de bot-boekingen én uit de agenda-snapshot (kantoor, Outlook/Planado)
//    staat in de lijst; een afspraak die geweest is blijft 45 dagen vindbaar (uit het geheugen),
//    ook als de snapshot hem niet meer heeft. Daarbuiten niet. Nooit dubbel (bot wint van kantoor).
//  - Een OPTIE-blokje of montage-afspraak staat er nooit in.
//  - Status klopt met de klok: komend / geweest / geannuleerd / verzet; een toekomstige
//    kantoor-afspraak die uit een verse snapshot verdween = "verwijderd".
//  - Zoeken: naam (accent- en hoofdletterongevoelig, deel van de naam), telefoon (06/+31/0031
//    zelfde nummer, laatste cijfers) en Gripp-nummer. Een zoekterm levert nooit een andere klant.
//  - Annuleren kan alleen op een afspraak die nog komt; nieuwe afspraak altijd.
const path = require('path');
const { combinaties } = require('../matrix.js');
const { bouwLijst } = require('../../scripts/lib/afspraken-zoeklijst.js');
const { filterLijst, actiesVoor } = require(path.join(require('os').homedir(), 'sonty-website', 'lib', 'inmeet-zoek.js'));

const NU = Date.parse('2026-09-03T13:00:00Z');
const d = (uren) => new Date(NU + uren * 3600e3).toISOString();

const dimensies = [
  {
    naam: 'botBoeking', // { rpItemId: {...} }
    waarden: [
      { label: 'geen', boekingen: {} },
      { label: 'komend', boekingen: { 'rp-1': { naam: 'Ingrid Verhaar', telefoon: '+31612345678', aankomst: d(24 * 14), inmeter: 'Joey', status: 'geboekt', planadoJobUuid: 'u-bot-1', grippNr: '6598' } }, verwacht: { sleutel: 'bot:rp-1', status: 'komend' } },
      { label: 'geweest-gisteren', boekingen: { 'rp-2': { naam: 'Rowie Post', telefoon: '0613263460', aankomst: d(-20), inmeter: 'Sjoerd', status: 'geboekt', planadoJobUuid: 'u-bot-2' } }, verwacht: { sleutel: 'bot:rp-2', status: 'geweest' } },
      { label: 'geannuleerd', boekingen: { 'rp-3': { naam: 'Myongsuk Chi', telefoon: '+31715721795', aankomst: d(48), inmeter: 'Joey', status: 'geannuleerd' } }, verwacht: { sleutel: 'bot:rp-3', status: 'geannuleerd' } },
      { label: 'verzet', boekingen: { 'rp-4': { naam: 'René de Vos', telefoon: '0611111111', aankomst: d(72), inmeter: 'Joey', status: 'verzet' } }, verwacht: { sleutel: 'bot:rp-4', status: 'verzet' } },
      { label: 'te-oud', boekingen: { 'rp-5': { naam: 'Oude Klant', telefoon: '0622222222', aankomst: d(-24 * 50), inmeter: 'Joey', status: 'geboekt' } }, verwacht: null },
      { label: 'kapotte-tijd', boekingen: { 'rp-6': { naam: 'Kapot Record', telefoon: '0633333333', aankomst: 'gisteren', status: 'geboekt' } }, verwacht: null },
    ],
  },
  {
    naam: 'snapshot',
    waarden: [
      { label: 'leeg', items: [], ts: d(-0.5) },
      { label: 'naumer-vandaag-geweest', items: [{ uuid: 'u-k-1', externalId: 'ol-48cf', start: d(-1), eind: d(0), inmeter: 'Joey', klant: 'Inmeten Sonty - Markus Naumer' }], ts: d(-0.5), verwacht: { sleutel: 'kantoor:u-k-1', status: 'geweest', naam: 'Markus Naumer' } },
      { label: 'kantoor-komend', items: [{ uuid: 'u-k-2', externalId: 'ol-1', start: d(24 * 7), eind: d(24 * 7 + 1), inmeter: 'Sjoerd', klant: 'Inmeten — Tim Mesman' }], ts: d(-0.5), verwacht: { sleutel: 'kantoor:u-k-2', status: 'komend', naam: 'Tim Mesman' } },
      { label: 'zelfde-als-bot', items: [{ uuid: 'u-bot-1', externalId: 'rp-rp-1', start: d(24 * 14), eind: d(24 * 14 + 1), inmeter: 'Joey', klant: 'Inmeten Sonty - Ingrid Verhaar' }], ts: d(-0.5), verwacht: null }, // bot wint, niet dubbel
      { label: 'optie-en-montage', items: [{ uuid: 'u-o', start: d(30), eind: d(31), inmeter: 'Joey', klant: 'OPTIE bot - Piet' }, { uuid: 'u-m', start: d(30), eind: d(35), inmeter: 'Joey', klant: 'Montage - Klaas Jansen' }], ts: d(-0.5), verwacht: null },
    ],
  },
  {
    naam: 'geheugen', // eerder gepubliceerde regels
    waarden: [
      { label: 'leeg', eerder: [] },
      { label: 'kantoor-geweest-vorige-week', eerder: [{ sleutel: 'kantoor:u-oud', bron: 'kantoor', planadoJobUuid: 'u-oud', naam: 'Lotte Vos', telefoon: '0644444444', aankomst: d(-24 * 6), inmeter: 'Joey', status: 'komend' }], verwacht: { sleutel: 'kantoor:u-oud', status: 'geweest' } },
      { label: 'kantoor-toekomst-verdwenen', eerder: [{ sleutel: 'kantoor:u-weg', bron: 'kantoor', planadoJobUuid: 'u-weg', naam: 'Weg Geweest', telefoon: '0655555555', aankomst: d(24 * 3), inmeter: 'Joey', status: 'komend' }], verwacht: { sleutel: 'kantoor:u-weg', status: 'verwijderd' } },
      { label: 'bot-uit-geheugen-weg', eerder: [{ sleutel: 'bot:rp-x:2026', bron: 'bot', rpItemId: 'rp-x', naam: 'Bot Weg', telefoon: '0666666666', aankomst: d(24 * 3), inmeter: 'Joey', status: 'komend' }], verwacht: null },
      { label: 'te-oud', eerder: [{ sleutel: 'kantoor:u-oud2', bron: 'kantoor', planadoJobUuid: 'u-oud2', naam: 'Heel Oud', aankomst: d(-24 * 60), inmeter: 'Joey', status: 'komend' }], verwacht: null },
    ],
  },
  {
    naam: 'zoek',
    waarden: [
      { label: 'leeg', term: '', alles: true },
      { label: 'naumer', term: 'naumer', treft: (r) => /naumer/i.test(r.naam) },
      { label: 'markus-nau', term: 'Markus nau', treft: (r) => /markus naumer/i.test(r.naam) },
      { label: 'accent-rene', term: 'rene', treft: (r) => /ren[eé]/i.test(r.naam) },
      { label: 'tel-06', term: '0613263460', treft: (r) => String(r.telefoon || '').replace(/\D/g, '').endsWith('613263460') },
      { label: 'tel-plus31', term: '+31 6 13263460', treft: (r) => String(r.telefoon || '').replace(/\D/g, '').endsWith('613263460') },
      { label: 'tel-laatste4', term: '3460', treft: (r) => String(r.telefoon || '').replace(/\D/g, '').endsWith('3460') },
      { label: 'gripp', term: '6598', treft: (r) => r.grippNr === '6598' || String(r.telefoon || '').replace(/\D/g, '').endsWith('6598') },
      { label: 'onbekend', term: 'zzzz', treft: () => false },
    ],
  },
];

function orakel(s) {
  // "zelfde-als-bot": de kantoor-regel valt alleen weg als de bot-boeking met dezelfde Planado-id er is
  const snapVerwacht = s.snapshot.label === 'zelfde-als-bot' && s.botBoeking.label !== 'komend'
    ? { sleutel: 'kantoor:u-bot-1', status: 'komend', naam: 'Ingrid Verhaar' } : s.snapshot.verwacht;
  const verwacht = [s.botBoeking.verwacht, snapVerwacht, s.geheugen.verwacht].filter(Boolean);
  const sleutels = verwacht.map((v) => v.sleutel).sort();
  return { wil: 'lijst', sleutels, statussen: Object.fromEntries(verwacht.map((v) => [v.sleutel, v.status])), namen: Object.fromEntries(verwacht.filter((v) => v.naam).map((v) => [v.sleutel, v.naam])) };
}

async function voerUit(s) {
  const lijst = bouwLijst({ boekingen: s.botBoeking.boekingen, snapshot: { ts: s.snapshot.ts, items: s.snapshot.items }, koppelCache: { 'u-k-1': { tel: ['622223964'] } }, eerder: s.geheugen.eerder, nu: NU });
  const sleutels = lijst.map((r) => r.sleutel.replace(/^(bot:[^:]+):.*$/, '$1')).sort();
  const statussen = Object.fromEntries(lijst.map((r) => [r.sleutel.replace(/^(bot:[^:]+):.*$/, '$1'), r.status]));
  const namen = Object.fromEntries(lijst.map((r) => [r.sleutel.replace(/^(bot:[^:]+):.*$/, '$1'), r.naam]));
  // zoeken over dezelfde lijst
  const treffers = filterLijst(lijst, s.zoek.term);
  const zoekKlopt = s.zoek.alles ? treffers.length === lijst.length : (treffers.every((r) => s.zoek.treft(r)) && lijst.filter((r) => s.zoek.treft(r)).length === treffers.length);
  // acties: annuleren alleen op "komend"
  const actiesKloppen = lijst.every((r) => actiesVoor(r, NU).annuleer === (r.status === 'komend') && actiesVoor(r, NU).nieuw === true);
  const dubbel = new Set(lijst.map((r) => r.planadoJobUuid).filter(Boolean)).size !== lijst.filter((r) => r.planadoJobUuid).length;
  return { sleutels, statussen, namen, zoekKlopt, actiesKloppen, dubbel, melding: false };
}

function vergelijk(verwacht, echt) {
  if (JSON.stringify(echt.sleutels) !== JSON.stringify(verwacht.sleutels)) return false;
  for (const [k, v] of Object.entries(verwacht.statussen)) if (echt.statussen[k] !== v) return false;
  for (const [k, v] of Object.entries(verwacht.namen)) if (echt.namen[k] !== v) return false;
  return echt.zoekKlopt && echt.actiesKloppen && !echt.dubbel;
}

module.exports = { naam: 'inmeet-zoeklijst', scenarios: () => combinaties(dimensies), orakel, voerUit, vergelijk };
