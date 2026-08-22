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
  const { zoekSlots, kiesWinkelOpties, venster } = require('./lib/slotzoeker.js');
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
  // SAMENLOOP-FIX (07-08, geval Manon/Franken/Marco): open aanbiedingen zijn bezet,
  // anders rekent deze route hetzelfde slot uit dat al bij een andere klant ligt.
  try { await planner.voegAanbiedingenToe(agenda); } catch { /* register onbereikbaar: kaart is indicatief */ }
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
  // Te weinig gaten binnen de normale horizon? Dan verder vooruit kijken, want de
  // winkel wil vijf keuzes zien en niet twee (Marco Klok 09-08: verre klant, 2 opties).
  if (kiesWinkelOpties(beste, 5).length < 5) {
    for (const naam of Object.keys(planner.ROOSTER)) {
      if (!planner.ROOSTER[naam].uuidPlanado) continue;
      const sl = await zoekSlots({
        agenda: agenda[naam] || [], adres: lead.volledigAdres, duurMin: duur,
        werkdagen: planner.werkdagenVoor(naam, 30),
        startAdres: planner.ROOSTER[naam]?.startAdres || undefined,
        eindAdres: planner.ROOSTER[naam]?.eindAdres || undefined,
      }).catch(() => []);
      beste.push(...sl.map((x) => ({ ...x, inmeter: naam })));
    }
    // dubbele slots (zelfde inmeter + tijd) uit de twee rondes ontdubbelen
    const gezienSlot = new Set();
    beste = beste.filter((x) => {
      const k = `${x.inmeter}|${+x.aankomst}`;
      if (gezienSlot.has(k)) return false;
      gezienSlot.add(k);
      return true;
    });
  }
  beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
  // Winkelklant staat aan de balie: geef een echte keuzelijst (5 opties met labels
  // vroegste / minste rijtijd) in plaats van het ene "beste" moment — Daimy 09-08.
  const aanbod = kiesWinkelOpties(beste, 5);
  if (!aanbod.length) return { afgewezen: true, uitkomst: 'geen enkel gat beschikbaar' };
  // kaart als los reken-resultaat naar het dashboard (eigen sleutel, kan niet
  // overschreven worden door de 30-min-ronde — race gezien 06-08)
  await api(DASH_API, { method: 'POST', body: JSON.stringify({ extraLead: {
    rpItemId: item.id, naam: lead.naam, plaats: lead.plaats, duurMin: duur, wachtDagen: 0,
    status: 'aanbod-mogelijk',
    producten: lead.producten.map((p) => `${p.aantal}x ${p.naam}`).join(', ').slice(0, 90),
    top: aanbod.map((x) => ({ inmeter: x.inmeter, datum: x.datum, venster: venster(x), aankomst: x.aankomst.toISOString(), vertrek: x.vertrek.toISOString(), extra: x.extraRijtijdMin, label: x.label || undefined })),
  } }) });
  return { afgewezen: false, uitkomst: `${aanbod.length} tijden berekend, staan in het dashboard` };
}

async function ronde() {
  const { mutaties } = await api(MUTATIE_API + '?status=open');
  if (!mutaties?.length) return false;
  for (const m of mutaties) {
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
      const definitief = /geen enkel gat|geen 3 tijden|moet.*tekenen|niet gevonden|lopend aanbod|template heeft er 3 nodig|NIET eerder dan|mens nodig|voorgestelde tijden zijn inmiddels bezet|heeft al een afspraak/i.test(e.message);
      if (definitief) {
        await api(MUTATIE_API, { method: 'PATCH', body: JSON.stringify({ id: m.id, status: 'afgewezen', uitkomst: e.message.slice(0, 200) }) }).catch(() => {});
        await planner.telegram(`ℹ️ Verzoek ${m.type} (${m.bron}) kan niet: ${e.message.slice(0, 140)}. Verzoek is gesloten; de kaart staat weer gewoon in het dashboard.`);
      } else {
        // STORINGS-MELDING MAX 1x PER UUR PER VERZOEK+FOUT (Daimy 22-08, Planado-
        // onderhoud 19-21 UTC: elke poll-cyclus een nieuw bericht = spam terwijl
        // dezelfde storing gewoon nog loopt). Daemon leeft lang, dus in-memory.
        // Daimy 22-08 (aanscherping): "stuur alleen even als die is opgelost, niet
        // elke keer als het niet werkt" — storing per verzoek max 1x per 12 uur
        // melden, en bij succes daarna een ✅ (zie onder bij de succes-afhandeling).
        globalThis.__storingGemeld = globalThis.__storingGemeld || new Map();
        const sleutel = `${m.id}:${e.message.slice(0, 60)}`;
        const eerder = globalThis.__storingGemeld.get(sleutel) || 0;
        if (Date.now() - eerder > 12 * 3600000) {
          globalThis.__storingGemeld.set(sleutel, Date.now());
          await planner.telegram(`⚠️ Verzoek ${m.type} (${m.bron}) mislukt: ${e.message.slice(0, 140)} — blijft open en wordt automatisch opnieuw geprobeerd; je hoort het als het gelukt is.`);
        }
      }
      console.log(new Date().toISOString(), m.type, 'FOUT:', e.message);
      continue;
    }
    await api(MUTATIE_API, {
      method: 'PATCH',
      body: JSON.stringify({ id: m.id, status: res.afgewezen ? 'afgewezen' : 'verwerkt', uitkomst: res.uitkomst }),
    });
    // Was hier eerder een storing over gemeld? Dan nu het beloofde ✅ (Daimy 22-08).
    if (globalThis.__storingGemeld) {
      const hadStoring = [...globalThis.__storingGemeld.keys()].some((k) => k.startsWith(m.id + ':'));
      if (hadStoring) {
        for (const k of [...globalThis.__storingGemeld.keys()]) if (k.startsWith(m.id + ':')) globalThis.__storingGemeld.delete(k);
        await planner.telegram(`✅ Verzoek ${m.type}${m.naam ? ` (${m.naam})` : ''} dat eerder faalde is alsnog gelukt: ${String(res.uitkomst || 'verwerkt').slice(0, 120)}`);
      }
    }
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
  return true; // er was werk: blijf even snel pollen
}

// ADAPTIEF POLLEN (08-08, na de Upstash-limietstoring): elke 10 seconden pollen kost
// ~260.000 database-verzoeken per maand terwijl er meestal niets te doen is. Nu:
// 10 seconden zolang er werk is of net was (de winkel staat aan de balie te wachten),
// daarna rustig terugzakken naar 60 seconden. Dat scheelt een factor 6 in rust
// zonder dat een klik ooit traag voelt.
const SNEL_MS = 10000;
const RUSTIG_MS = 60000;
const SNEL_VENSTER_MS = 5 * 60000; // zo lang na het laatste werk blijven we snel pollen

(async () => {
  console.log(`inmeet-verzoek-daemon gestart (poll ${SNEL_MS / 1000}s bij werk, ${RUSTIG_MS / 1000}s in rust)`);
  let laatsteWerk = Date.now(); // eerste minuten na een herstart altijd snel
  while (true) {
    try {
      const gedaan = await ronde();
      if (gedaan) laatsteWerk = Date.now();
    } catch (e) { console.log(new Date().toISOString(), 'ronde-fout:', e.message); }
    const snel = Date.now() - laatsteWerk < SNEL_VENSTER_MS;
    await wacht(snel ? SNEL_MS : RUSTIG_MS);
  }
})();
