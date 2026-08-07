// Onderdeel: de annuleer/verzet-motor (inmeet-mutatie.js) — alle systemen in één keer.
// Orakel (beleid Daimy 06-08):
//  - verzetten: Outlook weg VÓÓR Planado, job echt DELETE, sheet-cellen leeg, RP terug
//    naar "Inmeten inplannen" + verse 5-dagen-klok (nieuw aanbod volgt vanzelf)
//  - annuleren: zelfde opruiming, maar RP BLIJFT staan (kantoor beslist, V2) en het
//    1-tje in de sheet gaat weg (V3)
//  - geen actieve boeking (al gemuteerd, of onbekend) → weiger, nooit half werk
//  - een systeem faalt → de rest gaat door en de uitkomst is ZICHTBAAR deels-mislukt
const fs = require('fs');
const path = require('path');
const os = require('os');
const { combinaties } = require('../matrix.js');

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mutatie-lab-'));
process.env.INMEET_BOEKINGEN_PAD = path.join(SCRATCH, 'boekingen.json');
process.env.INMEET_PLANNER_STATE_PAD = path.join(SCRATCH, 'state.json');
process.env.EERDER_WILLEN_PAD = path.join(SCRATCH, 'eerder-willen.json'); // echte annuleringslijst nooit aanraken
const { registreerBoeking, muteerBoeking, vindBoeking } = require('../../scripts/lib/inmeet-mutatie.js');

const dimensies = [
  {
    naam: 'soort',
    waarden: [
      { label: 'verzet' },
      { label: 'annuleer' },
    ],
  },
  {
    naam: 'boeking',
    waarden: [
      { label: 'compleet', maak: () => ({ outlookEventId: 'ev-1', sheet: { tab: 'Aug 2026', rij: 40, kolomInkoop: 23 } }) },
      { label: 'zonder-outlook-id', maak: () => ({ outlookEventId: null, sheet: { tab: 'Aug 2026', rij: 40, kolomInkoop: 23 } }) },
      { label: 'zonder-sheet-locatie', maak: () => ({ outlookEventId: 'ev-1', sheet: null }) },
      { label: 'al-geannuleerd', maak: () => ({ outlookEventId: 'ev-1', sheet: null, status: 'geannuleerd' }) },
      { label: 'onbekende-klant', maak: () => null },
    ],
  },
  {
    naam: 'systemen',
    waarden: [
      { label: 'alles-werkt', faalt: null },
      { label: 'planado-faalt', faalt: 'planado' },
      { label: 'rp-faalt', faalt: 'rp' },
    ],
  },
];

function orakel(s) {
  if (s.boeking.label === 'al-geannuleerd' || s.boeking.label === 'onbekende-klant') return { wil: 'blokkeer' };
  // bij annuleren wordt RP bewust niet aangeraakt (V2), dus een RP-storing raakt niets
  const relevant = s.systemen.faalt && !(s.systemen.faalt === 'rp' && s.soort.label === 'annuleer');
  if (relevant) return { wil: 'deels', faalStap: s.systemen.faalt };
  return { wil: 'alles' };
}

async function voerUit(s) {
  // verse fixture per scenario
  fs.writeFileSync(process.env.INMEET_BOEKINGEN_PAD, '{}');
  fs.writeFileSync(process.env.INMEET_PLANNER_STATE_PAD, JSON.stringify({ gezien: { 'rp-1': '2026-08-01T00:00:00Z' }, aangeboden: { 'rp-1': {} } }));
  const basis = s.boeking.maak?.();
  if (basis) {
    registreerBoeking({
      rpItemId: 'rp-1', naam: 'Test Klant', telefoon: '+31612345678', email: 't@test.nl',
      planadoJobUuid: 'job-1', outlookEventId: basis.outlookEventId, grippNr: 6001,
      sheet: basis.sheet, slot: { aankomst: '2026-08-20T09:00:00Z', inmeter: 'Joey' }, duurMin: 25,
    });
    if (basis.status) {
      const b = JSON.parse(fs.readFileSync(process.env.INMEET_BOEKINGEN_PAD, 'utf8'));
      b['rp-1'].status = basis.status;
      fs.writeFileSync(process.env.INMEET_BOEKINGEN_PAD, JSON.stringify(b));
    }
  }

  const calls = [];
  const echteFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('telegram')) { calls.push('telegram'); return { ok: true, json: async () => ({}) }; }
    if (u.includes('outlook.office.com')) {
      calls.push('outlook-delete');
      return { ok: true, status: 204, json: async () => ({ value: [{ Id: 'cal', Name: 'Sonty Montage' }] }), text: async () => '' };
    }
    if (u.includes('planadoapp.com')) {
      calls.push('planado-delete');
      if (s.systemen.faalt === 'planado') return { ok: false, status: 500, text: async () => 'kapot' };
      return { ok: true, status: 200, text: async () => '' };
    }
    if (u.includes('reuzenpanda')) {
      calls.push('rp-status');
      if (s.systemen.faalt === 'rp') return { ok: false, status: 500 };
      return { ok: true, status: 200 };
    }
    if (u.includes('sheets.googleapis') || u.includes('googleapis.com')) { calls.push('sheet'); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => ({}) };
  };
  // sheets-client loopt via googleapis-lib, niet via fetch — stub op moduleniveau
  const sheetPad = require.resolve('../../scripts/lib/sheet-inplannen.js');
  const echteSheet = require.cache[sheetPad];
  require.cache[sheetPad] = { id: sheetPad, filename: sheetPad, loaded: true, exports: {
    maakCellenLeeg: async () => { calls.push('sheet-leeg'); },
  } };

  try {
    const doel = basis ? 'rp-1' : 'rp-onbekend';
    const res = await muteerBoeking(doel, s.soort.label === 'verzet' ? 'verzet' : 'annuleer', { bron: 'lab' });
    const naBestand = JSON.parse(fs.readFileSync(process.env.INMEET_BOEKINGEN_PAD, 'utf8'));
    const state = JSON.parse(fs.readFileSync(process.env.INMEET_PLANNER_STATE_PAD, 'utf8'));
    return {
      res, calls,
      status: naBestand['rp-1']?.status || null,
      outlookVoorPlanado: calls.indexOf('outlook-delete') === -1 || calls.indexOf('planado-delete') === -1 || calls.indexOf('outlook-delete') < calls.indexOf('planado-delete'),
      rpAangeraakt: calls.includes('rp-status'),
      sheetLeeg: calls.includes('sheet-leeg'),
      aangebodenWeg: !state.aangeboden?.['rp-1'],
      melding: true, // motor meldt altijd via Telegram
    };
  } finally {
    global.fetch = echteFetch;
    if (echteSheet) require.cache[sheetPad] = echteSheet;
  }
}

function vergelijk(wil, echt, s) {
  if (wil.wil === 'blokkeer') {
    return echt.res.gelukt === false && !echt.calls.includes('planado-delete');
  }
  if (!echt.outlookVoorPlanado) return false;
  if (s.soort.label === 'verzet' && s.systemen.faalt !== 'rp' && !echt.rpAangeraakt) return false;
  if (s.soort.label === 'annuleer' && echt.rpAangeraakt) return false; // V2: RP met rust laten
  if (s.boeking.label !== 'zonder-sheet-locatie' && !echt.sheetLeeg) return false; // V3
  if (s.soort.label === 'verzet' && s.systemen.faalt !== 'rp' && !echt.aangebodenWeg) return false;
  if (wil.wil === 'deels') return echt.res.gelukt === false && echt.res.stappen.some((x) => !x.ok);
  return echt.res.gelukt === true && ['verzet', 'geannuleerd'].includes(echt.status);
}

module.exports = {
  naam: 'mutatie-motor (annuleer/verzet over alle systemen)',
  scenarios: () => combinaties(dimensies),
  orakel,
  voerUit,
  vergelijk,
};
