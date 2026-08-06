// Scenario-runner: draait de ECHTE code per scenario (read-only, met nepdata) en
// deelt elke uitkomst in vier bakken in. Doel is altijd: 0x FOUT-STIL.
//
//   OK                — uitkomst is wat het orakel wil
//   TERECHT-GEBLOKKEERD — code weigert/stopt, en het orakel wilde dat ook
//   FOUT-ZICHTBAAR    — verkeerde uitkomst, maar er is een melding/fout te zien
//   FOUT-STIL         — verkeerde uitkomst en niemand merkt het (het enige echte gevaar)
//
// Een onderdeel-adapter levert: { naam, scenarios(), orakel(s), voerUit(s) }.
//   orakel(s)  -> { wil: 'koppel'|'blokkeer'|..., ...verwachting }
//   voerUit(s) -> { uitkomst, melding: bool }   (melding = zou een mens dit zien?)
//   vergelijk(verwacht, echt) -> true/false     (per onderdeel, optioneel)

async function draai(onderdeel, opts = {}) {
  const scenarios = onderdeel.scenarios();
  const telling = { OK: 0, 'TERECHT-GEBLOKKEERD': 0, 'FOUT-ZICHTBAAR': 0, 'FOUT-STIL': 0, CRASH: 0 };
  const afwijkingen = [];

  for (const s of scenarios) {
    const verwacht = onderdeel.orakel(s);
    let echt;
    try {
      echt = await onderdeel.voerUit(s);
    } catch (e) {
      // een crash is zichtbaar (het proces valt om) maar nooit de bedoeling
      telling.CRASH++;
      afwijkingen.push({ nr: s._nr, label: s._label, verwacht, echt: 'CRASH: ' + e.message.slice(0, 80) });
      continue;
    }
    const klopt = onderdeel.vergelijk ? onderdeel.vergelijk(verwacht, echt, s) : JSON.stringify(verwacht) === JSON.stringify(echt);
    let bak;
    if (klopt) bak = verwacht.wil === 'blokkeer' ? 'TERECHT-GEBLOKKEERD' : 'OK';
    else bak = echt.melding ? 'FOUT-ZICHTBAAR' : 'FOUT-STIL';
    telling[bak]++;
    if (bak === 'FOUT-ZICHTBAAR' || bak === 'FOUT-STIL') {
      afwijkingen.push({ nr: s._nr, label: s._label, bak, verwacht, echt });
    }
  }
  return { naam: onderdeel.naam, totaal: scenarios.length, telling, afwijkingen };
}

function printRapport(runs, { maxAfwijkingen = 12 } = {}) {
  let stil = 0, totaal = 0;
  for (const r of runs) {
    totaal += r.totaal;
    stil += r.telling['FOUT-STIL'] + r.telling.CRASH;
    const t = r.telling;
    console.log(`\n── ${r.naam} — ${r.totaal} scenario's ──`);
    console.log(`   OK: ${t.OK} | terecht geblokkeerd: ${t['TERECHT-GEBLOKKEERD']} | fout-zichtbaar: ${t['FOUT-ZICHTBAAR']} | FOUT-STIL: ${t['FOUT-STIL']} | crash: ${t.CRASH}`);
    for (const a of r.afwijkingen.slice(0, maxAfwijkingen)) {
      console.log(`   ${a.bak || 'CRASH'} #${a.nr}: ${a.label}`);
      console.log(`      wil: ${JSON.stringify(a.verwacht).slice(0, 110)}`);
      console.log(`      is:  ${JSON.stringify(a.echt).slice(0, 110)}`);
    }
    if (r.afwijkingen.length > maxAfwijkingen) console.log(`   … nog ${r.afwijkingen.length - maxAfwijkingen} afwijkingen`);
  }
  console.log(`\n===== TOTAAL: ${totaal} scenario's, ${stil}x FOUT-STIL/crash ${stil === 0 ? '— veilig om te bouwen/los te laten' : '— NIET opleveren vóór dit 0 is'} =====`);
  return stil === 0;
}

module.exports = { draai, printRapport };
