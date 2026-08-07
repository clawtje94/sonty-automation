#!/usr/bin/env node
// SCENARIO-RUN (niets wordt verstuurd of gewijzigd): welke open dashboard-klanten
// passen bij elkaar op één dag, en wat levert dat op aan rijtijd?
// Daimy 07-08: "als mensen goed bij elkaar passen moet je die bij elkaar zetten
// en dan alleen die (dag)optie geven." Eerst meten, dan bouwen.
const planner = require('./cron-inmeten-planner.js');
const { reistijd } = require('./lib/reistijd');
const { bezetteBlokken } = require('./lib/slotzoeker');

const MAX_COMBI = 20; // zelfde grens als combiPas
const MEET_CODE = '2288';

async function main() {
  const dash = await (await fetch('https://sonty-website.vercel.app/api/inmeet-dashboard', {
    headers: { 'x-meet-code': MEET_CODE },
  })).json();
  const open = (dash.leads || []).filter((l) =>
    ['wachtend', 'aanbod-mogelijk'].includes(l.status));
  console.log(`Open klanten (nog geen aanbod verstuurd): ${open.length}`);
  if (open.length < 2) { console.log('Te weinig voor combi-analyse.'); return; }

  // Adressen: het dashboard geeft ze niet mee — lees ze uit de RP-cache van de
  // planner (state.inmeetLeads) via dezelfde lezing als de echte planner.
  const state = JSON.parse(require('fs').readFileSync(`${__dirname}/../data/inmeten-planner-state.json`, 'utf8'));
  const cache = state.inmeetLeads || [];
  const leden = [];
  for (const l of open) {
    const item = cache.find((i) => i.id === l.rpItemId);
    if (!item) { console.log(`(niet in cache: ${l.naam})`); continue; }
    try {
      const vol = await planner.leesLeadCompleet(item);
      leden.push({ ...l, adres: vol.volledigAdres || null, duurMin: l.duurMin || vol.duurMin });
    } catch (e) { console.log(`(lead onleesbaar: ${l.naam} — ${e.message.slice(0, 40)})`); }
  }
  const zonder = leden.filter((l) => !l.adres);
  if (zonder.length) console.log(`(zonder adres: ${zonder.map((l) => l.naam).join(', ')})`);
  const mee = leden.filter((l) => l.adres);

  // 1. paarsgewijze rijtijden
  const paren = [];
  for (let a = 0; a < mee.length; a++) {
    for (let b = a + 1; b < mee.length; b++) {
      try {
        const r = await reistijd(mee[a].adres, mee[b].adres, new Date());
        paren.push({ a, b, min: r.minuten });
      } catch { /* niet routeerbaar */ }
    }
  }

  // 2. clusteren (union-find, zelfde aanpak als combiPas)
  const groep = mee.map((_, i) => i);
  for (const p of paren) {
    if (p.min <= MAX_COMBI) {
      const doel = groep[p.a];
      for (let k = 0; k < groep.length; k++) if (groep[k] === groep[p.b]) groep[k] = doel;
    }
  }
  const groepen = {};
  groep.forEach((g, i) => { (groepen[g] = groepen[g] || []).push(i); });
  const clusters = Object.values(groepen).filter((g) => g.length >= 2);

  console.log(`\nClusters (onderling ≤ ${MAX_COMBI} min): ${clusters.length}`);
  const agenda = await planner.haalAgenda();
  await planner.laadVakanties();

  for (const c of clusters) {
    const namen = c.map((i) => `${mee[i].naam} (${mee[i].plaats || '?'}${mee[i].wachtDagen != null ? ', dag ' + mee[i].wachtDagen : ''})`);
    const onderling = paren.filter((p) => c.includes(p.a) && c.includes(p.b)).map((p) => p.min);
    console.log(`\nCLUSTER: ${namen.join(' + ')}`);
    console.log(`  onderlinge rijtijd: ${Math.min(...onderling)}-${Math.max(...onderling)} min`);
    const somDuur = c.reduce((n, i) => n + (mee[i].duurMin || 30), 0);
    const nodigMin = somDuur + (c.length - 1) * Math.max(...onderling) + 30; // ruime marge

    // 3. per inmeter: dagen met één aaneengesloten gat groot genoeg voor de hele groep
    // (werkdagenVoor houdt rooster én vakanties aan, net als de echte planner)
    for (const inm of ['Joey', 'Sjoerd']) {
      const kandidaten = [];
      for (const dag of planner.werkdagenVoor(inm, 25)) {
        const iso = dag.datum || dag;
        const werk = dag.van ? dag : planner.ROOSTER[inm].dagen[['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][new Date(iso).getDay()]];
        if (!werk) continue;
        const van = new Date(`${iso}T${werk.van}:00+02:00`);
        const tot = new Date(`${iso}T${werk.tot}:00+02:00`);
        const blokken = bezetteBlokken(
          (agenda[inm] || []).filter((x) => String(x.start).startsWith(iso))
            .map((x) => ({ start: new Date(x.start), eind: new Date(x.eind), adres: x.adres || '' })),
          van, tot,
        );
        // grootste vrije gat op deze dag
        let cursor = van, grootste = 0;
        for (const b of [...blokken, { start: tot, eind: tot }]) {
          grootste = Math.max(grootste, (b.start - cursor) / 60000);
          if (b.eind > cursor) cursor = b.eind;
        }
        if (grootste >= nodigMin) kandidaten.push(`${iso} (${Math.round(grootste)} min vrij)`);
        if (kandidaten.length >= 4) break;
      }
      console.log(`  ${inm}: nodig ~${Math.round(nodigMin)} min aaneengesloten → ${kandidaten.length ? kandidaten.join(', ') : 'geen dag gevonden binnen 5 weken'}`);
    }
  }
  console.log('\n(Scenario-run: alleen gemeten, niets verstuurd of gewijzigd.)');
}

main().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
