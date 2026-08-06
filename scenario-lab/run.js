#!/usr/bin/env node
// Scenario-lab: draai alle onderdelen (of één met `node scenario-lab/run.js <naam>`).
// Exitcode 1 zodra er ook maar één FOUT-STIL of crash is — dan mag er NIET geleverd worden.
// In het lab is alle data nep en lokaal: rate-limit-pauzes (wacht/setTimeout in de
// echte code) draaien hier op nulsnelheid, anders duren 500 scenario's uren.
const echteSetTimeout = global.setTimeout;
global.setTimeout = (fn, _ms, ...args) => echteSetTimeout(fn, 0, ...args);

const { draai, printRapport } = require('./runner.js');

const ONDERDELEN = [
  require('./onderdelen/offerte-keuze.js'),
  require('./onderdelen/koppel-ladder.js'),
  require('./onderdelen/planner-aanbod.js'),
];

(async () => {
  const filter = process.argv[2];
  const lijst = filter ? ONDERDELEN.filter((o) => o.naam.includes(filter)) : ONDERDELEN;
  const runs = [];
  for (const o of lijst) runs.push(await draai(o));
  const veilig = printRapport(runs);
  process.exit(veilig ? 0 : 1);
})();
