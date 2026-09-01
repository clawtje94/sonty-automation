// Scenario-lab: POSTVAK-KAP (bevinding Bram jcgwwwgz 01-09: open opdrachten verdwenen door slice(-500)).
// Orakel: O1 open opdrachten (niet klaar/fout) blijven ALTIJD bewaard; O2 totaal bewaard <= max(500, open);
// O3 wat wegvalt komt in het archief (niets verdwijnt stil); O4 volgorde blijft behouden.
const { combinaties } = require('../matrix.js');
const { kapPostvak } = require('../../scripts/lib/brein.js');
const dims = [
  { naam: 'open', waarden: [{ label: '0', n: 0 }, { label: '10', n: 10 }, { label: '520', n: 520 }] },
  { naam: 'dicht', waarden: [{ label: '0', n: 0 }, { label: '490', n: 490 }, { label: '600', n: 600 }] },
];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  const openBewaard = s.open.n;
  const dichtBewaard = Math.min(s.dicht.n, Math.max(0, 500 - s.open.n));
  return { wil: 'ok', totaal: openBewaard + dichtBewaard, archief: s.dicht.n - dichtBewaard };
}
function voerUit(s) {
  const lijst = [];
  for (let i = 0; i < Math.max(s.open.n, s.dicht.n) * 2; i++) {
    if (lijst.filter((x) => x.status === 'nieuw').length < s.open.n) lijst.push({ id: 'o' + i, status: 'nieuw' });
    else if (lijst.filter((x) => x.status === 'klaar').length < s.dicht.n) lijst.push({ id: 'd' + i, status: 'klaar' });
  }
  const { bewaren, archief } = kapPostvak(lijst, 500);
  const alleOpenBewaard = bewaren.filter((x) => x.status === 'nieuw').length === s.open.n;
  const volgorde = bewaren.every((x, i) => i === 0 || lijst.indexOf(bewaren[i - 1]) < lijst.indexOf(x));
  return { totaal: alleOpenBewaard && volgorde ? bewaren.length : -1, archief: archief.length, melding: false };
}
function vergelijk(w, e) { return w.totaal === e.totaal && w.archief === e.archief; }
module.exports = { naam: 'postvak-kap (open opdrachten nooit wegkappen, rest naar archief)', scenarios, orakel, voerUit, vergelijk };
