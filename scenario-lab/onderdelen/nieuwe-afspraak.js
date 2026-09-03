// Onderdeel: NIEUWE AFSPRAAK BESTAANDE KLANT (Daimy 03-09, Markus Naumer: gemiste afspraak van
// vandaag, klant wil een nieuwe). Pure keuzes uit scripts/lib/nieuwe-afspraak.js.
//
// Orakel (hard):
//  - Kaart kiezen: telefoon is de sleutel. Op één nummer meerdere kaarten (Naumer: "Naumer -" op
//    Afgerond én "Markus Naumer" op Ai offerte verstuurd) → de kaart die niet Afgerond/te-ver is en
//    het best bij de naam past. Gearchiveerde kaarten nooit. Zonder telefoon: naam, maar 2+ kaarten
//    op naam = afwijzen met reden (nooit stil de eerste). Niets gevonden = reden.
//  - Oude afspraak: geweest (ook vandaag) → laten staan. Toekomst → bot-boeking verzetten,
//    kantoor-afspraak annuleren (Outlook + Planado). Al geannuleerd/verzet/verwijderd → laten.
const { combinaties } = require('../matrix.js');
const { kiesRpKaart, bepaalPlan } = require('../../scripts/lib/nieuwe-afspraak.js');

const INPLANNEN = '2e9819bd-26f0-4082-8f18-32bb48f87f54';
const AFGEROND = '2082ad8a-517c-4e24-8c0f-a5be69b1588a';
const AI_VERSTUURD = 'dc0efe4f-2cd6-45d8-aeff-7f1c817a0fb2';
const TE_VER = '20815fa5-94ce-40a3-8e1f-d36093de006f';
const k = (id, summary, status_id, phone, extra = {}) => ({ id, summary, status_id, fields: { phone }, technical_labels: [], ...extra });
const KAARTEN = [
  k('naumer-oud', 'Naumer -', AFGEROND, '0622223964'),
  k('naumer-nieuw', 'Markus Naumer', AI_VERSTUURD, '+31622223964'),
  k('vries-1', 'Jan de Vries', INPLANNEN, '0611111111'),
  k('vries-2', 'Jan de Vries', AI_VERSTUURD, '0622222222'),
  k('archief', 'Piet Archief', INPLANNEN, '0633333333', { technical_labels: [{ type: 'ITEM_ARCHIVED' }] }),
  k('tever', 'Kees te Ver', TE_VER, '0644444444'),
  k('tever-2', 'Kees te Ver', INPLANNEN, '0644444444'),
  k('beschrijving', 'Anna Beschrijving', INPLANNEN, undefined, { description: 'Telefoonnummer: 06 55 55 55 55\nPlaats: Delft' }),
];

const NU = Date.parse('2026-09-03T13:00:00Z');
const d = (uren) => new Date(NU + uren * 3600e3).toISOString();

const dimensies = [
  {
    naam: 'klant',
    waarden: [
      { label: 'naumer-tel', telefoon: '+31 6 22223964', naam: 'Markus Naumer', verwacht: 'naumer-nieuw' },
      { label: 'naumer-tel-zonder-naam', telefoon: '0622223964', naam: '', verwacht: 'naumer-nieuw' },
      { label: 'naumer-naam-alleen', telefoon: '', naam: 'Markus Naumer', verwacht: 'naumer-nieuw' },
      { label: 'naumer-achternaam-alleen', telefoon: '', naam: 'Naumer', verwacht: null }, // 2 kaarten op naam, geen telefoon → afwijzen
      { label: 'vries-tel-1', telefoon: '0611111111', naam: 'Jan de Vries', verwacht: 'vries-1' },
      { label: 'vries-naam', telefoon: '', naam: 'Jan de Vries', verwacht: null },
      { label: 'archief', telefoon: '0633333333', naam: 'Piet Archief', verwacht: null },
      { label: 'tever-tel', telefoon: '0644444444', naam: 'Kees te Ver', verwacht: 'tever-2' },
      { label: 'tel-in-beschrijving', telefoon: '0655555555', naam: '', verwacht: 'beschrijving' },
      { label: 'onbekend-tel', telefoon: '0699999999', naam: 'Nieuwe Klant', verwacht: null },
      { label: 'leeg', telefoon: '', naam: '', verwacht: null },
      { label: 'korte-naam', telefoon: '', naam: 'Jan', verwacht: null },
    ],
  },
  {
    naam: 'oud',
    waarden: [
      { label: 'geen', afspraak: null, actie: 'laten' },
      { label: 'bot-vandaag-geweest', afspraak: { bron: 'bot', aankomst: d(-1), status: 'geweest' }, actie: 'laten' },
      { label: 'kantoor-vandaag-geweest', afspraak: { bron: 'kantoor', aankomst: d(-1), status: 'komend' }, actie: 'laten' }, // status uit oude lijst, klok beslist
      { label: 'bot-morgen', afspraak: { bron: 'bot', aankomst: d(20), status: 'komend' }, actie: 'verzet' },
      { label: 'kantoor-volgende-week', afspraak: { bron: 'kantoor', aankomst: d(24 * 7), status: 'komend' }, actie: 'kantoor-annuleer' },
      { label: 'bot-al-geannuleerd', afspraak: { bron: 'bot', aankomst: d(20), status: 'geannuleerd' }, actie: 'laten' },
      { label: 'kantoor-verwijderd', afspraak: { bron: 'kantoor', aankomst: d(20), status: 'verwijderd' }, actie: 'laten' },
      { label: 'over-1-minuut', afspraak: { bron: 'bot', aankomst: d(1 / 60), status: 'komend' }, actie: 'verzet' },
      { label: 'kapotte-tijd', afspraak: { bron: 'bot', aankomst: 'morgen', status: 'komend' }, actie: 'laten' },
      { label: 'onbekende-bron', afspraak: { bron: 'x', aankomst: d(20), status: 'komend' }, actie: 'laten' },
    ],
  },
];

function orakel(s) {
  return { wil: s.klant.verwacht ? 'door' : 'blokkeer', kaart: s.klant.verwacht, actie: s.oud.actie };
}

async function voerUit(s) {
  const { kaart, reden } = kiesRpKaart(KAARTEN, { telefoon: s.klant.telefoon, naam: s.klant.naam });
  const plan = bepaalPlan(s.oud.afspraak, NU);
  return { kaart: kaart ? kaart.id : null, reden: reden || null, actie: plan.actie, melding: !!reden };
}

function vergelijk(verwacht, echt) {
  if (echt.kaart !== verwacht.kaart) return false;   // verkeerde kaart = verkeerde klant ingepland
  if (!verwacht.kaart && !echt.reden) return false;  // afwijzen zonder reden
  return echt.actie === verwacht.actie;
}

module.exports = { naam: 'nieuwe-afspraak', scenarios: () => combinaties(dimensies), orakel, voerUit, vergelijk };
