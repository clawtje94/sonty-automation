// Onderdeel: DRUKTE — "wat als er 20 man in inmeten inplannen staan?" (Daimy 06-08).
// Speelt de echte hoofdlus-mechaniek na: per lead zoekSlots over beide inmeters,
// kiesAanbod, en de aangeboden slots reserveren zodat de volgende lead ze niet krijgt.
// Invarianten (allemaal hard):
//  - geen enkel tijdstip wordt aan twee klanten aangeboden (per inmeter)
//  - aangeboden slots overlappen nooit met bezette blokken of eerdere aanbiedingen
//  - elke lead krijgt een aanbod OF een uitleg — nooit stilte
//  - dichtbije leads blijven nooit onbediend zolang er gaten zijn
const { combinaties } = require('../matrix.js');
const { zoekSlots, kiesAanbod, waaromGeenAanbod, MAX_EXTRA_RIJTIJD_MIN } = require('../../scripts/lib/slotzoeker.js');
const { reistijd } = require('../../scripts/lib/reistijd.js'); // = de lab-stub

const WERKDAGEN = Array.from({ length: 10 }, (_, i) => {
  const d = new Date(2026, 8, 7 + i + (i > 3 ? 2 : 0)); // 2 werkweken, weekend overgeslagen
  return { datum: d.toISOString().slice(0, 10), van: '09:00', tot: '15:00' };
});
const AFSPRAAK = (datum, vanUur, totUur, pc) => ({
  start: `${datum}T${String(vanUur).padStart(2, '0')}:00:00`,
  eind: `${datum}T${String(totUur).padStart(2, '0')}:00:00`,
  adres: `Bestaandelaan 1, ${pc} XX Stad`, klant: 'bestaand',
});

const dimensies = [
  {
    naam: 'drukte',
    waarden: [
      { label: '8-leads', aantal: 8 },
      { label: '20-leads', aantal: 20 },
      { label: '40-leads', aantal: 40 },
    ],
  },
  {
    naam: 'agenda',
    waarden: [
      { label: 'rustig', maak: () => ({ A: [AFSPRAAK(WERKDAGEN[0].datum, 10, 11, 2510)], B: [AFSPRAAK(WERKDAGEN[1].datum, 13, 14, 2530)] }) },
      { label: 'halfvol', maak: () => ({
        A: WERKDAGEN.slice(0, 5).map((d) => AFSPRAAK(d.datum, 9, 12, 2500 + 20)),
        B: WERKDAGEN.slice(0, 5).map((d) => AFSPRAAK(d.datum, 12, 15, 2600)),
      }) },
      { label: 'vrijwel-vol', maak: () => ({
        A: WERKDAGEN.map((d) => AFSPRAAK(d.datum, 9, 14, 2520)),
        B: WERKDAGEN.map((d) => AFSPRAAK(d.datum, 10, 15, 2580)),
      }) },
    ],
  },
  {
    naam: 'mix',
    waarden: [
      { label: 'alles-dichtbij', pc: (i) => 2500 + ((i * 37) % 150) },
      { label: 'met-verre-klanten', pc: (i) => (i % 5 === 3 ? 4800 + i : 2500 + ((i * 37) % 150)) },
    ],
  },
];

function orakel() {
  return { wil: 'invarianten' };
}

async function voerUit(s) {
  const agenda = s.agenda.maak();
  const aangeboden = []; // {inmeter, aankomst, vertrek, lead}
  let zonderUitleg = 0, dichtbijZonderAanbod = 0, metAanbod = 0;

  for (let i = 0; i < s.drukte.aantal; i++) {
    const pc = s.mix.pc(i);
    const adres = `Leadstraat ${i + 1}, ${pc} AB Plaats`;
    let slots = [];
    for (const naam of ['A', 'B']) {
      const gevonden = await zoekSlots({ agenda: agenda[naam], adres, duurMin: 25, werkdagen: WERKDAGEN });
      slots.push(...gevonden.map((x) => ({ ...x, inmeter: naam })));
    }
    slots.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
    const aanbod = kiesAanbod(slots, 3, { wachtDagen: 0 });
    if (!aanbod.length) {
      if (!waaromGeenAanbod(slots)) zonderUitleg++;
      if (pc < 2700 && s.agenda.label !== 'vrijwel-vol') dichtbijZonderAanbod++;
      continue;
    }
    metAanbod++;
    for (const sl of aanbod) {
      aangeboden.push({ inmeter: sl.inmeter, aankomst: +sl.aankomst, vertrek: +sl.vertrek, lead: i });
      agenda[sl.inmeter].push({ start: sl.aankomst.toISOString(), eind: sl.vertrek.toISOString(), adres, klant: `aanbod lead ${i}` });
    }
  }

  // COMBI-PAS (zelfde mechaniek als de planner): wachtende buren delen de omrij-kosten;
  // de oudste krijgt aanbod, zijn slots worden ankers voor de rest
  const wachtend = [];
  for (let i = 0; i < s.drukte.aantal; i++) {
    const pc = s.mix.pc(i);
    if (!aangeboden.some((a) => a.lead === i)) wachtend.push({ i, pc, adres: `Leadstraat ${i + 1}, ${pc} AB Plaats` });
  }
  let combiAanbod = 0, verreClusterLeden = 0, clustersHaalbaar = 0;
  if (wachtend.length >= 2) {
    // groepen op onderlinge rijtijd ≤ 20 min
    const groep = wachtend.map((_, k) => k);
    for (let a = 0; a < wachtend.length; a++) for (let b = a + 1; b < wachtend.length; b++) {
      if ((await reistijd(wachtend[a].adres, wachtend[b].adres)).minuten <= 20) {
        const doel = groep[a];
        for (let k = 0; k < groep.length; k++) if (groep[k] === groep[b]) groep[k] = doel;
      }
    }
    const groepen = {};
    groep.forEach((g, k) => { (groepen[g] = groepen[g] || []).push(wachtend[k]); });
    for (const leden of Object.values(groepen)) {
      if (leden.length < 2) continue;
      verreClusterLeden += leden.length;
      let clusterHaalbaar = false;
      for (const w of leden) {
        let slots = [];
        for (const naam of ['A', 'B']) {
          const gevonden = await zoekSlots({ agenda: agenda[naam], adres: w.adres, duurMin: 25, werkdagen: WERKDAGEN });
          slots.push(...gevonden.map((x) => ({ ...x, inmeter: naam })));
        }
        const haalbaar = slots.filter((x) => x.extraRijtijdMin <= MAX_EXTRA_RIJTIJD_MIN * leden.length);
        if (haalbaar.length) clusterHaalbaar = true;
        slots = haalbaar.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
        const aanbod = kiesAanbod(slots, 3, { wachtDagen: 999 });
        if (!aanbod.length) continue;
        combiAanbod++;
        for (const sl of aanbod) {
          aangeboden.push({ inmeter: sl.inmeter, aankomst: +sl.aankomst, vertrek: +sl.vertrek, lead: w.i });
          agenda[sl.inmeter].push({ start: sl.aankomst.toISOString(), eind: sl.vertrek.toISOString(), adres: w.adres, klant: `aanbod lead ${w.i}` });
        }
      }
      if (clusterHaalbaar) clustersHaalbaar++;
    }
  }

  // invariant 1+2: geen dubbel aangeboden tijd, geen overlap per inmeter
  let dubbel = 0;
  for (const naam of ['A', 'B']) {
    const van = aangeboden.filter((a) => a.inmeter === naam).sort((a, b) => a.aankomst - b.aankomst);
    for (let i = 1; i < van.length; i++) {
      if (van[i].aankomst < van[i - 1].vertrek && van[i].lead !== van[i - 1].lead) dubbel++;
    }
  }
  return { dubbel, zonderUitleg, dichtbijZonderAanbod, metAanbod, combiAanbod, verreClusterLeden, clustersHaalbaar, melding: true };
}

function vergelijk(_wil, echt, s) {
  if (echt.dubbel !== 0 || echt.zonderUitleg !== 0 || echt.dichtbijZonderAanbod !== 0) return false;
  // combi-invariant: als een combi HAALBAAR was (gedeelde kosten binnen de grens)
  // moet er ook echt een combi-aanbod uit komen; onhaalbaar cluster = dag-4-regel
  if (echt.clustersHaalbaar > 0 && echt.combiAanbod === 0) return false;
  return true;
}

module.exports = {
  naam: 'planner-drukte (20+ leads tegelijk, geen dubbel aanbod)',
  scenarios: () => combinaties(dimensies),
  orakel,
  voerUit,
  vergelijk,
};
