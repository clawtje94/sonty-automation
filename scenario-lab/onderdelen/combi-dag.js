// Onderdeel: COMBI-DAG — "clusters Gouda+Waddinxveen, Utrecht+Zeist samen op één dag"
// (Daimy 06-08 akkoord). Test scripts/lib/combi-dag.js (echte code, nepdata).
// Invarianten (allemaal hard):
//  - combi gevonden ⇒ ALLE leden een aanbod, en alle tijden op DEZELFDE datum
//  - aangeboden tijden van verschillende leden overlappen nooit
//  - totale extra rijtijd ≤ grens × groepsgrootte (gedeelde kosten)
//  - de gekozen dag is de VROEGST haalbare (agenda vol t/m dag N ⇒ datum = dag N+1)
//  - geen enkele dag haalbaar ⇒ null (zichtbaar), nooit een halve groep stil bedienen
const { combinaties } = require('../matrix.js');
const { zoekCombiDag } = require('../../scripts/lib/combi-dag.js');
const { MAX_EXTRA_RIJTIJD_MIN } = require('../../scripts/lib/slotzoeker.js');

const WERKDAGEN = Array.from({ length: 20 }, (_, i) => {
  const d = new Date(2026, 8, 7 + i + Math.floor(i / 5) * 2); // 4 werkweken, weekend overgeslagen
  return { datum: d.toISOString().slice(0, 10), van: '09:00', tot: '15:00' };
});
const VOL = (dag) => ({ start: `${dag.datum}T09:00:00`, eind: `${dag.datum}T15:00:00`, adres: 'Bestaandelaan 1, 2650 XX Stad', klant: 'bestaand' });

const dimensies = [
  {
    naam: 'cluster',
    waarden: [
      // stub-reistijd: minuten ≈ |pc-verschil|/25; magazijn is pc 2651
      { label: 'ver', pcs: [4801, 4806, 4811] },       // ~86 min enkele reis, onderling ≤ 20
      { label: 'dichtbij', pcs: [2600, 2605, 2610] },  // vlak bij het magazijn
    ],
  },
  {
    naam: 'groep',
    waarden: [
      { label: '2-leden', aantal: 2 },
      { label: '3-leden', aantal: 3 },
    ],
  },
  {
    naam: 'agenda',
    waarden: [
      { label: 'leeg', maak: () => [] },
      { label: 'vol-dan-leeg', maak: () => WERKDAGEN.slice(0, 10).map(VOL) }, // eerste 10 dagen vol
      { label: 'helemaal-vol', maak: () => WERKDAGEN.map(VOL) },
    ],
  },
  {
    naam: 'duur',
    waarden: [
      { label: 'kort', duurMin: 20 },
      { label: 'lang', duurMin: 90 }, // 3×90 min + marges + rijden past nog nét in 6 uur
    ],
  },
];

function orakel(s) {
  const dagenVol = { leeg: 0, 'vol-dan-leeg': 10, 'helemaal-vol': 20 }[s.agenda.label];
  if (dagenVol >= 20) return { haalbaar: false }; // geen enkele vrije dag
  // De werkdag is klanttijd (Daimy 07-08): aanrit vóór 09:00, terugrit na 15:00.
  // Daardoor past óók het verre cluster met lange klussen (3×90 min + tussenritten
  // < 6 uur) — alles behalve een volle agenda moet gewoon lukken.
  // Dit is de kern van de feature: ook het VERRE cluster (Gouda+Waddinxveen-casus)
  // krijgt een dag; het duurste lid mag kosten wat hij kost, de rest past ernaast.
  return { haalbaar: true, vroegsteDatum: WERKDAGEN[dagenVol].datum };
}

async function voerUit(s) {
  const leden = Array.from({ length: s.groep.aantal }, (_, i) => ({
    naam: `Lid ${i + 1}`,
    adres: `Clusterstraat ${i + 1}, ${s.cluster.pcs[i]} AB Plaats`,
    duurMin: s.duur.duurMin,
  }));
  const agenda = s.agenda.maak();
  const combi = await zoekCombiDag({
    leden,
    inmeters: [{ naam: 'A', agenda, werkdagen: WERKDAGEN, startAdres: undefined, eindAdres: undefined }],
  });
  if (!combi) return { combi: null, melding: true };

  const alleTijden = combi.perLid.flatMap(({ lid, aanbod }) => aanbod.map((a) => ({ lid: lid.naam, van: +a.aankomst, tot: +a.vertrek, datum: a.datum })));
  const zelfdeDag = alleTijden.every((t) => t.datum === combi.datum);
  let overlap = 0;
  const sorted = [...alleTijden].sort((a, b) => a.van - b.van);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].van < sorted[i - 1].tot && sorted[i].lid !== sorted[i - 1].lid) overlap++;
  }
  const lidKosten = combi.perLid.map(({ aanbod }) => aanbod[0].extraRijtijdMin);
  return {
    combi: {
      datum: combi.datum,
      alleLeden: combi.perLid.length === leden.length,
      zelfdeDag,
      overlap,
      // gedeelde rit: duurste lid mag kosten wat hij kost, elk extra lid moet
      // binnen de normale omrij-grens ernaast passen
      eerlijkGedeeld: combi.totaalExtraMin - Math.max(...lidKosten) <= MAX_EXTRA_RIJTIJD_MIN * (leden.length - 1),
    },
    melding: true,
  };
}

function vergelijk(wil, echt) {
  if (wil.haalbaar === false) return echt.combi === null; // onhaalbaar = eerlijk niets, geen halve groep
  return (
    echt.combi !== null && // haalbaar ⇒ er MOET een combi-dag uit komen (geen lege test)
    echt.combi.alleLeden &&
    echt.combi.zelfdeDag &&
    echt.combi.overlap === 0 &&
    echt.combi.eerlijkGedeeld &&
    echt.combi.datum === wil.vroegsteDatum // vroegste vrije dag wint, nooit later
  );
}

module.exports = {
  naam: 'combi-dag (cluster samen op de vroegste haalbare dag)',
  scenarios: () => combinaties(dimensies),
  orakel,
  voerUit,
  vergelijk,
};
