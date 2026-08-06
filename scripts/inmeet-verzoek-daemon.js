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

const MEET_CODE = process.env.MEETBON_CODE || '2288';
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
  // API-zuinig zoeken: eerst 1 pagina + de bekende leads uit de planner-state;
  // alleen als de naam daar niet tussen zit een volledige scan (zeldzaam balie-geval).
  const n = String(m.naam || '').toLowerCase();
  let kandidaten = [];
  const eerste = await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${SALES}/items?limit=1000`, {
    headers: { Authorization: 'Bearer ' + RP_API_KEY },
  })).json();
  const past = (i) => i.status_id === INMETEN_INPLANNEN && String(i.summary || '').toLowerCase().includes(n)
    && !(i.technical_labels || []).some((l) => l?.type === 'ITEM_ARCHIVED');
  kandidaten = (eerste.items || []).filter(past);
  if (!kandidaten.length) {
    try {
      const st = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeten-planner-state.json'), 'utf8'));
      kandidaten = (st.inmeetLeads || []).filter((i) => String(i.summary || '').toLowerCase().includes(n));
    } catch { /* state optioneel */ }
  }
  if (!kandidaten.length) {
    let offset = 1000;
    while (true) {
      const data = await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${SALES}/items?limit=1000&offset=${offset}`, {
        headers: { Authorization: 'Bearer ' + RP_API_KEY },
      })).json();
      kandidaten.push(...(data.items || []).filter(past));
      if (!data.has_more || kandidaten.length) break;
      offset += 1000;
    }
  }
  if (!kandidaten.length) return { afgewezen: true, uitkomst: `geen lead "${m.naam}" op Inmeten inplannen — zet hem eerst op die status in RP` };
  if (kandidaten.length > 1) return { afgewezen: true, uitkomst: `meerdere leads passen op "${m.naam}" — maak de naam specifieker` };
  const item = kandidaten[0];
  const lead = await planner.leesLeadCompleet(item);
  if (lead.ambigu) return { afgewezen: true, uitkomst: 'meerdere offerteversies, geen getekend — klant moet eerst tekenen' };
  const { schatDuur } = require('./lib/inmeetduur.js');
  const duur = schatDuur(lead.producten);
  const agenda = await planner.haalAgenda();
  await planner.laadVakanties();
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
  // kaart als los reken-resultaat naar het dashboard (eigen sleutel, kan niet
  // overschreven worden door de 30-min-ronde — race gezien 06-08)
  await api(DASH_API, { method: 'POST', body: JSON.stringify({ extraLead: {
    rpItemId: item.id, naam: lead.naam, plaats: lead.plaats, duurMin: duur, wachtDagen: 0,
    status: 'aanbod-mogelijk',
    producten: lead.producten.map((p) => `${p.aantal}x ${p.naam}`).join(', ').slice(0, 90),
    top: aanbod.map((x) => ({ inmeter: x.inmeter, datum: x.datum, venster: venster(x), aankomst: x.aankomst.toISOString(), vertrek: x.vertrek.toISOString(), extra: x.extraRijtijdMin })),
  } }) });
  return { afgewezen: false, uitkomst: `${aanbod.length} tijden berekend, staan in het dashboard` };
}

async function ronde() {
  const { mutaties } = await api(MUTATIE_API + '?status=open');
  for (const m of mutaties || []) {
    let res;
    try {
      if (m.type === 'adres') {
        // adres uit de winkel terugschrijven naar RP (Kenny-geval: RP-kaart zonder
        // adres) en direct verse tijden rekenen
        const rA = await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${SALES}/items/${m.rpItemId}`, {
          method: 'PATCH', headers: { Authorization: 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: { fields: { address: m.adres } } }),
        });
        if (!rA.ok) throw new Error('RP-adres opslaan: HTTP ' + rA.status);
        res = await verwerkReken({ ...m, naam: m.naam || '' });
        res.uitkomst = 'adres in RP gezet; ' + (res.uitkomst || '');
      } else if (m.type === 'ververs') {
        // handmatige verversing vanaf het dashboard (Daimy 06-08: "ik weet niet
        // wanneer die dingen ophaalt") — draait een volledige schaduw-ronde
        await planner.verversRonde();
        res = { afgewezen: false, uitkomst: 'dashboard ververst' };
      } else {
        res = m.type === 'reken' ? await verwerkReken(m) : await planner.verwerkVerzoek(m);
      }
    } catch (e) {
      // DEFINITIEVE fouten (geen gaten, klant moet tekenen, lead onvindbaar) niet
      // eindeloos herhalen (Daimy 06-08: "ik krijg steeds dit bericht") — verzoek
      // afwijzen met de reden; alleen echte storingen blijven open voor een retry.
      const definitief = /geen enkel gat|geen 3 tijden|moet.*tekenen|niet gevonden|lopend aanbod|template heeft er 3 nodig/i.test(e.message);
      if (definitief) {
        await api(MUTATIE_API, { method: 'PATCH', body: JSON.stringify({ id: m.id, status: 'afgewezen', uitkomst: e.message.slice(0, 200) }) }).catch(() => {});
        await planner.telegram(`ℹ️ Verzoek ${m.type} (${m.bron}) kan niet: ${e.message.slice(0, 140)}. Verzoek is gesloten; de kaart staat weer gewoon in het dashboard.`);
      } else {
        await planner.telegram(`⚠️ Verzoek ${m.type} (${m.bron}) mislukt: ${e.message.slice(0, 140)} — blijft open voor een nieuwe poging.`);
      }
      console.log(new Date().toISOString(), m.type, 'FOUT:', e.message);
      continue;
    }
    await api(MUTATIE_API, {
      method: 'PATCH',
      body: JSON.stringify({ id: m.id, status: res.afgewezen ? 'afgewezen' : 'verwerkt', uitkomst: res.uitkomst }),
    });
    // kaart in het dashboard direct bijwerken (Daimy 06-08: "ik weet helemaal niet
    // wat er gebeurt") — niet wachten op de halfuur-ronde
    try {
      if (m.rpItemId && ((m.type === 'stuur-aanbod' && (!res.afgewezen || /al een lopend aanbod/.test(res.uitkomst || ''))) || (m.type === 'boek' && !res.afgewezen))) {
        // naam nooit kwijtraken: uit het verzoek, anders uit de bestaande kaart of de planner-state
        let naam = m.naam;
        if (!naam) {
          try {
            const dash = await api(DASH_API);
            naam = (dash.leads || []).find((l) => l.rpItemId === m.rpItemId)?.naam;
          } catch { /* naamloos is niet fataal */ }
        }
        if (!naam) {
          try {
            const st = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeten-planner-state.json'), 'utf8'));
            naam = (st.inmeetLeads || []).find((l) => l.id === m.rpItemId)?.summary;
          } catch { /* idem */ }
        }
        const status = m.type === 'boek' ? 'geboekt' : 'aanbod-verstuurd';
        await api(DASH_API, { method: 'POST', body: JSON.stringify({ extraLead: { rpItemId: m.rpItemId, naam: naam || 'klant', status, top: [] } }) });
      }
    } catch { /* kaart-update is cosmetisch */ }
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
