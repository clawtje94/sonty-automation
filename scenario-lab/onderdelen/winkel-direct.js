// Onderdeel: WINKEL-DIRECT (Daimy 29-08: winkelafspraak direct inplannen op offertenummer;
// nieuwe klanten in winkeluren automatisch binnen een minuut met tijden op het dashboard).
//
// Orakel (hard):
//  - Een zoekterm levert precies 1 kaart, of een afwijzing met reden. Nooit stil de eerste pakken
//    bij 2+ treffers, nooit een gearchiveerde/andere-status/testkaart.
//  - Offertenummer (20…) matcht alleen op de RP-offertenummers van de kaart; Gripp-nummer alleen
//    via de Gripp-klantnaam; naam alleen op de kaartnaam (deel van de naam mag).
//  - Automatisch rekenen alleen in winkeluren (ma–za 08:30–18:00) en alleen voor kaarten die de
//    daemon nog niet kent; testkaarten nooit.
const { combinaties } = require('../matrix.js');
const { zoekTerm, matchItems, isWinkeluur, nieuweItems } = require('../../scripts/lib/winkel-direct.js');

const STATUS = 'inmeten';
const item = (id, summary, extra = {}) => ({ id, summary, status_id: STATUS, technical_labels: [], ...extra });
const ITEMS = [
  item('a', 'Annemarie Westerneng'),
  item('b', 'Reinhard Scholten'),
  item('c', 'Jan de Vries'),
  item('d', 'Jan de Vries'), // dubbele naam
  item('e', 'Test klant reuzenpanda'), // testkaart
  item('f', 'Gearchiveerd Persoon', { technical_labels: [{ type: 'ITEM_ARCHIVED' }] }),
  item('g', 'Andere Status', { status_id: 'anders' }),
];
const NUMMERS = { a: ['20263228', '20263229'], b: ['20270001'], c: ['20280001'], d: ['20280002'], e: ['20299999'], f: ['20260000'], g: ['20250000'] };

const dimensies = [
  {
    naam: 'invoer',
    waarden: [
      { label: 'offerte-a', tekst: '20263228', verwacht: ['a'] },
      { label: 'offerte-met-spaties', tekst: ' 2026 3228 ', verwacht: ['a'] },
      { label: 'offerte-testkaart', tekst: '20299999', verwacht: [] },
      { label: 'offerte-gearchiveerd', tekst: '20260000', verwacht: [] },
      { label: 'offerte-andere-status', tekst: '20250000', verwacht: [] },
      { label: 'offerte-onbekend', tekst: '20211111', verwacht: [] },
      { label: 'gripp-bekend', tekst: '6577', gripp: 'Reinhard Scholten', verwacht: ['b'] },
      { label: 'gripp-onbekend', tekst: '6578', gripp: null, verwacht: [] },
      { label: 'gripp-dubbel', tekst: '6579', gripp: 'Jan de Vries', verwacht: [] },
      { label: 'naam-uniek', tekst: 'westerneng', verwacht: ['a'] },
      { label: 'naam-dubbel', tekst: 'jan de vries', verwacht: [] },
      { label: 'naam-test', tekst: 'test klant', verwacht: [] },
      { label: 'naam-gearchiveerd', tekst: 'gearchiveerd', verwacht: [] },
      { label: 'leeg', tekst: '', verwacht: [] },
      { label: 'een-letter', tekst: 'a', verwacht: [] },
      { label: 'rommel', tekst: '///', verwacht: [] },
    ],
  },
  {
    naam: 'klok',
    waarden: [
      { label: 'ma-10u', d: new Date('2026-08-31T08:00:00Z'), winkel: true },   // 10:00 NL
      { label: 'za-17u', d: new Date('2026-09-05T15:30:00Z'), winkel: true },   // 17:30 NL
      { label: 'za-18u', d: new Date('2026-09-05T16:00:00Z'), winkel: false },  // 18:00 NL
      { label: 'zo', d: new Date('2026-09-06T10:00:00Z'), winkel: false },
      { label: 'ma-0815', d: new Date('2026-08-31T06:15:00Z'), winkel: false }, // 08:15 NL
      { label: 'ma-0830', d: new Date('2026-08-31T06:30:00Z'), winkel: true },
    ],
  },
  {
    naam: 'gezien',
    waarden: [
      { label: 'niets', ids: [], nieuw: ['a', 'b', 'c', 'd'] },
      { label: 'a-b', ids: ['a', 'b'], nieuw: ['c', 'd'] },
      { label: 'alles', ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], nieuw: [] },
    ],
  },
];

function orakel(s) {
  return { wil: s.invoer.verwacht.length ? 'reken' : 'blokkeer', kaarten: s.invoer.verwacht, winkel: s.klok.winkel, nieuw: s.gezien.nieuw };
}

async function voerUit(s) {
  const term = zoekTerm(s.invoer.tekst);
  const m = matchItems(ITEMS, term, STATUS, NUMMERS, s.invoer.gripp === undefined ? null : s.invoer.gripp);
  const gekozen = m.kandidaten.length === 1 && !m.reden ? [m.kandidaten[0].id] : [];
  // melding = de winkel ziet een reden op het scherm; een stille verkeerde kaart ziet niemand
  return { kaarten: gekozen, reden: m.reden || null, melding: !!m.reden, winkel: isWinkeluur(s.klok.d), nieuw: nieuweItems(ITEMS, s.gezien.ids, STATUS).map((i) => i.id) };
}

function vergelijk(verwacht, echt) {
  const zelfde = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  if (!zelfde(echt.kaarten, verwacht.kaarten)) return false;      // andere kaart = verkeerde klant ingepland
  if (!verwacht.kaarten.length && !echt.reden) return false;       // afwijzen zonder reden
  if (echt.winkel !== verwacht.winkel) return false;
  if (!zelfde(echt.nieuw, verwacht.nieuw)) return false;
  return true;
}

module.exports = { naam: 'winkel-direct', scenarios: () => combinaties(dimensies), orakel, voerUit, vergelijk };
