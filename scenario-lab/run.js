#!/usr/bin/env node
// Scenario-lab: draai alle onderdelen (of één met `node scenario-lab/run.js <naam>`).
// Exitcode 1 zodra er ook maar één FOUT-STIL of crash is — dan mag er NIET geleverd worden.
// In het lab is alle data nep en lokaal: rate-limit-pauzes (wacht/setTimeout in de
// echte code) draaien op nulsnelheid — maar alleen tijdens logica-onderdelen.
// UI-onderdelen (Playwright) hebben de echte klok nodig, anders start de browser niet.
const echteSetTimeout = global.setTimeout;
const snelleKlok = (fn, _ms, ...args) => echteSetTimeout(fn, 0, ...args);
snelleKlok.__promisify__ = echteSetTimeout.__promisify__;

// nep-reistijd MOET vóór de onderdelen geladen worden (slotzoeker bindt bij require)
require('./stub-reistijd.js');
// idem voor de offerte-cache: het lab schrijft in een eigen wegwerpbestand,
// nooit in data/rp-offerte-cache.json (inmeten-planner-lees bindt het pad bij require)
process.env.RP_OFFERTE_CACHE_PAD = require('path').join(require('os').tmpdir(), 'lab-rp-offerte-cache.json');
try { require('fs').rmSync(process.env.RP_OFFERTE_CACHE_PAD, { force: true }); } catch { /* schoon beginnen is best effort */ }
const { draai, printRapport } = require('./runner.js');

const ONDERDELEN = [
  require('./onderdelen/offerte-keuze.js'),
  require('./onderdelen/koppel-ladder.js'),
  require('./onderdelen/planner-aanbod.js'),
  require('./onderdelen/planner-drukte.js'),
  require('./onderdelen/combi-dag.js'),
  require('./onderdelen/avondrit.js'),
  require('./onderdelen/sheet-rij.js'),
  require('./onderdelen/mutatie-motor.js'),
  require('./onderdelen/telefoon-normalisatie.js'),
  require('./onderdelen/planner-berichten.js'),
  require('./onderdelen/klantreactie.js'),
  require('./onderdelen/herplan-na-keuze.js'),
  require('./onderdelen/testrit-keten.js'),
];
// UI-laag draait tegen de echte site in een echte browser: alleen met --ui (of een filter),
// anders wordt elke logica-run traag van het browsen.
const UI = require('./onderdelen/ui-klantpaginas.js');

(async () => {
  const filter = process.argv[2];
  let lijst = filter && filter !== '--ui' ? [...ONDERDELEN, UI].filter((o) => o.naam.includes(filter)) : [...ONDERDELEN];
  if (process.argv.includes('--ui')) lijst = filter && filter !== '--ui' ? lijst : [...lijst, UI];
  const runs = [];
  for (const o of lijst) {
    global.setTimeout = o.echteKlok ? echteSetTimeout : snelleKlok;
    try {
      runs.push(await draai(o));
    } finally {
      global.setTimeout = echteSetTimeout;
      if (o.sluit) await o.sluit();
    }
  }
  const veilig = printRapport(runs);
  process.exit(veilig ? 0 : 1);
})();
