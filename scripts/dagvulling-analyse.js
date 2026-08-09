#!/usr/bin/env node
// DAGVULLING (Daimy 09-08: "ik vind het extreem belangrijk dat we die dagen bij die
// gasten vol krijgen, maar dan wel 100% efficiënt, op de juiste route of in dezelfde
// plaats").
//
// De planner kijkt per KLANT naar de goedkoopste plek. Dit script draait die blik om:
// per DAG met ruimte zoekt het de wachtende klant die er het goedkoopst tussen past.
// Zo zie je in één overzicht welke dag half leeg staat en wie je erbij kunt zetten.
//
// Alleen lezen en rekenen — er wordt niets geboekt of verstuurd.
const planner = require('./cron-inmeten-planner.js');
const { zoekSlots, venster, MAX_EXTRA_RIJTIJD_MIN } = require('./lib/slotzoeker.js');
const { schatDuur } = require('./lib/inmeetduur.js');

const MEET_CODE = process.env.MEETBON_CODE || '2288';
const DASH = 'https://sonty-website.vercel.app/api/inmeet-dashboard';
const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';

const uur = (d) => new Date(d).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

(async () => {
  const dashData = await (await fetch(DASH, { headers: { 'x-meet-code': MEET_CODE } })).json();
  const dash = dashData.dashboard || dashData;
  const wachtend = (dash.leads || []).filter((l) => l.rpItemId && l.status !== 'geboekt' && l.plaats);
  console.log(`${wachtend.length} klant(en) zonder afspraak\n`);

  const agenda = await planner.haalAgenda();
  await planner.laadVakanties();

  // bezetting per dag per inmeter
  console.log('=== BEZETTING KOMENDE WEKEN (werkdagen met ruimte) ===');
  const dagen = {};
  for (const naam of Object.keys(planner.ROOSTER)) {
    if (!planner.ROOSTER[naam].uuidPlanado) continue;
    for (const d of planner.werkdagenVoor(naam, 20)) {
      const klussen = (agenda[naam] || []).filter((a) => String(a.start).slice(0, 10) === d.datum);
      const bezetMin = klussen.reduce((som, a) => som + (Date.parse(a.eind) - Date.parse(a.start)) / 60000, 0);
      const dagMin = (Date.parse(`${d.datum}T${d.tot}:00`) - Date.parse(`${d.datum}T${d.van}:00`)) / 60000;
      dagen[`${d.datum}|${naam}`] = { datum: d.datum, inmeter: naam, klussen, bezetMin, dagMin, vrijMin: dagMin - bezetMin };
    }
  }

  const halfleeg = Object.values(dagen).filter((x) => x.vrijMin >= 60).sort((a, b) => a.datum.localeCompare(b.datum));
  for (const d of halfleeg.slice(0, 14)) {
    const waar = d.klussen.map((k) => String(k.adres || '').split(',')[0].slice(0, 22)).join(' → ') || '(leeg)';
    console.log(`${d.datum} ${d.inmeter.padEnd(7)} ${Math.round(d.vrijMin)} min vrij van ${d.dagMin} | ${d.klussen.length} klus(sen): ${waar}`);
  }

  // per wachtende klant: waar past hij het goedkoopst?
  console.log('\n=== WIE PAST WAAR (goedkoopste plek per wachtende klant) ===');
  const voorstellen = [];
  for (const lead of wachtend) {
    const item = await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${BACKLOG}/items/${lead.rpItemId}`, {
      headers: { Authorization: 'Bearer ' + RP_API_KEY },
    })).json().then((d) => d.item || d).catch(() => null);
    if (!item?.id) continue;
    const volledig = await planner.leesLeadCompleet(item);
    if (!volledig.volledigAdres) continue;
    const duur = schatDuur(volledig.producten);
    let beste = [];
    for (const naam of Object.keys(planner.ROOSTER)) {
      if (!planner.ROOSTER[naam].uuidPlanado) continue;
      const sl = await zoekSlots({
        agenda: agenda[naam] || [], adres: volledig.volledigAdres, duurMin: duur,
        werkdagen: planner.werkdagenVoor(naam, 20),
        startAdres: planner.ROOSTER[naam]?.startAdres || undefined,
        eindAdres: planner.ROOSTER[naam]?.eindAdres || undefined,
      }).catch(() => []);
      beste.push(...sl.map((x) => ({ ...x, inmeter: naam })));
    }
    beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
    const top = beste[0];
    if (!top) { console.log(`${lead.naam.padEnd(22)} (${lead.plaats}): NERGENS plek in 20 roosterdagen`); continue; }
    const zuinig = top.extraRijtijdMin <= MAX_EXTRA_RIJTIJD_MIN;
    console.log(`${lead.naam.padEnd(22)} (${String(lead.plaats).slice(0, 14).padEnd(14)}) → ${top.datum} ${venster(top)} ${top.inmeter}  +${top.extraRijtijdMin} min ${zuinig ? '✓ efficiënt' : '(duur)'} | na: ${String(top.naVorige).split(',')[0].slice(0, 24)}`);
    voorstellen.push({ naam: lead.naam, plaats: lead.plaats, rpItemId: lead.rpItemId, top });
  }

  const efficient = voorstellen.filter((v) => v.top.extraRijtijdMin <= MAX_EXTRA_RIJTIJD_MIN);
  console.log(`\n${efficient.length} van de ${voorstellen.length} klanten past ergens efficiënt in (≤${MAX_EXTRA_RIJTIJD_MIN} min omrijden).`);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
