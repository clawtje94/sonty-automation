#!/usr/bin/env node
// Snelle verzoek-daemon (Daimy 06-08: "als iemand in de winkel zit wil je zo snel
// mogelijk de inmeetafspraak inplannen zodra ze akkoord zijn"). Pollt de wachtrij
// elke 10 seconden en voert winkel-kliks (boeken, keuzelink, verzetten, annuleren,
// reken-verzoek voor een verse akkoord-klant) DIRECT uit — de klant staat aan de
// balie. Enige consument van de wachtrij (de 5-min-cron doet alleen de
// aanbod-levenscyclus), dus geen dubbele uitvoering.
const fs = require('fs');
const path = require('path');
const planner = require('./cron-inmeten-planner.js');

const MEET_CODE = process.env.BELSCHERM_CODE || 'sonty2288';
const MUTATIE_API = 'https://sonty-website.vercel.app/api/inmeet-mutatie';
const DASH_API = 'https://sonty-website.vercel.app/api/inmeet-dashboard';
const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const SALES = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const INMETEN_INPLANNEN = '2e9819bd-26f0-4082-8f18-32bb48f87f54';
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pad, opties = {}) {
  const r = await fetch(pad, {
    ...opties,
    headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE, ...(opties.headers || {}) },
  });
  if (!r.ok) throw new Error(`${pad}: HTTP ${r.status}`);
  return r.json();
}

/** 'reken': verse akkoord-klant (staat net op Inmeten inplannen) direct tijden geven
 * en als kaart in het dashboard zetten — zonder op de 30-min-ronde te wachten. */
async function verwerkReken(m) {
  const { zoekSlots, kiesAanbod, venster } = require('./lib/slotzoeker.js');
  const data = await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${SALES}/items?limit=200`, {
    headers: { Authorization: 'Bearer ' + RP_API_KEY },
  })).json();
  const n = String(m.naam || '').toLowerCase();
  const kandidaten = (data.items || []).filter((i) => i.status_id === INMETEN_INPLANNEN
    && String(i.summary || '').toLowerCase().includes(n));
  if (!kandidaten.length) return { afgewezen: true, uitkomst: `geen lead "${m.naam}" op Inmeten inplannen — zet hem eerst op die status in RP` };
  if (kandidaten.length > 1) return { afgewezen: true, uitkomst: `meerdere leads passen op "${m.naam}" — maak de naam specifieker` };
  const item = kandidaten[0];
  const lead = await planner.leesLeadCompleet(item);
  if (lead.ambigu) return { afgewezen: true, uitkomst: 'meerdere offerteversies, geen getekend — klant moet eerst tekenen' };
  const { schatDuur } = require('./lib/inmeetduur.js');
  const duur = schatDuur(lead.producten);
  const agenda = await planner.haalAgenda();
  let beste = [];
  for (const naam of Object.keys(planner.ROOSTER)) {
    if (!planner.ROOSTER[naam].uuidPlanado) continue;
    const sl = await zoekSlots({
      agenda: agenda[naam] || [], adres: lead.volledigAdres, duurMin: duur,
      werkdagen: planner.werkdagenVoor(naam),
      startAdres: planner.ROOSTER[naam]?.startAdres || undefined,
      eindAdres: planner.ROOSTER[naam]?.eindAdres || undefined,
    }).catch(() => []);
    beste.push(...sl.map((x) => ({ ...x, inmeter: naam })));
  }
  beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
  const aanbod = kiesAanbod(beste, 3, { wachtDagen: 999 });
  if (!aanbod.length) return { afgewezen: true, uitkomst: 'geen enkel gat beschikbaar' };
  // kaart direct in het dashboard zetten
  const dash = await api(DASH_API);
  dash.leads = (dash.leads || []).filter((l) => l.rpItemId !== item.id);
  dash.leads.unshift({
    rpItemId: item.id, naam: lead.naam, plaats: lead.plaats, duurMin: duur, wachtDagen: 0,
    status: 'aanbod-mogelijk',
    producten: lead.producten.map((p) => `${p.aantal}x ${p.naam}`).join(', ').slice(0, 90),
    top: aanbod.map((x) => ({ inmeter: x.inmeter, datum: x.datum, venster: venster(x), aankomst: x.aankomst.toISOString(), vertrek: x.vertrek.toISOString(), extra: x.extraRijtijdMin })),
  });
  dash.bijgewerkt = new Date().toISOString();
  await api(DASH_API, { method: 'POST', body: JSON.stringify(dash) });
  return { afgewezen: false, uitkomst: `${aanbod.length} tijden berekend, staan in het dashboard` };
}

async function ronde() {
  const { mutaties } = await api(MUTATIE_API + '?status=open');
  for (const m of mutaties || []) {
    let res;
    try {
      res = m.type === 'reken' ? await verwerkReken(m) : await planner.verwerkVerzoek(m);
    } catch (e) {
      await planner.telegram(`⚠️ Verzoek ${m.type} (${m.bron}) mislukt: ${e.message.slice(0, 140)} — blijft open voor een nieuwe poging.`);
      console.log(new Date().toISOString(), m.type, 'FOUT:', e.message);
      continue;
    }
    await api(MUTATIE_API, {
      method: 'PATCH',
      body: JSON.stringify({ id: m.id, status: res.afgewezen ? 'afgewezen' : 'verwerkt', uitkomst: res.uitkomst }),
    });
    console.log(new Date().toISOString(), m.type, '->', res.uitkomst);
  }
}

(async () => {
  console.log('inmeet-verzoek-daemon gestart (poll elke 10s)');
  while (true) {
    try { await ronde(); } catch (e) { console.log(new Date().toISOString(), 'ronde-fout:', e.message); }
    await wacht(10000);
  }
})();
