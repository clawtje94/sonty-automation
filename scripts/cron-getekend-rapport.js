#!/usr/bin/env node
// Dagelijks AI-resultatenrapport (vraag Daimy 2026-07-16): elke ochtend 08:35 op Telegram:
// 1) hoeveel mensen de afgelopen dag hun offerte hebben ondertekend (RP → ACCEPTED-diff);
// 2) wat de AI-klantenservice bereikte: twijfelaars overtuigd (en hoe: downgrade, alternatief,
//    uitleg), showroom-verwijzingen, dossiers doorgezet naar inmeten, aangeboden alternatieven.
//    Samengevat door Haiku (goedkoop) op basis van de echte gesprekslogs.
// Eerste run = nulmeting (bestaande ACCEPTED worden gemarkeerd, niet gemeld).
const fs = require('fs');
const path = require('path');

const KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BOARD = 'edb9b0b7-b70e-4064-95b5-ec0d03357c0a';
const B = 'https://backend.reuzenpanda.nl';
const H = { Authorization: 'Bearer ' + KEY };
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TG_CHAT = 1700128390;
const STATE_FILE = path.join(__dirname, '..', 'data', 'getekend-gemeld.json');
const MAX_LEEFTIJD_DAGEN = 45; // alleen recente leads scannen (90d = 5500+ leads = ~1 uur; 45d houdt de run behapbaar)

async function rpGet(ep) {
  const r = await fetch(B + ep, { headers: H });
  if (!r.ok) throw new Error('RP ' + r.status + ' op ' + ep);
  return r.json();
}
async function telegram(text) {
  await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

(async () => {
  console.log('[' + new Date().toISOString() + '] Getekend-rapport start');
  let state;
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { state = { gemeld: {}, nulmeting: false }; }
  const eersteRun = !state.nulmeting;

  const items = (await rpGet(`/contact-service/${PID}/boards/${BOARD}/items`)).items || [];
  const cutoff = Date.now() - MAX_LEEFTIJD_DAGEN * 86400000;
  const recent = items.filter(i => i.item_subject?.id && i.timestamp_created > cutoff);

  const nieuw = [];
  const cohortRows = []; // {klant, gemaakt, status, documentId} — voor de cohort-meting onderaan
  let gescand = 0;
  for (const item of recent) {
    let docs;
    try {
      docs = (await rpGet(`/document-service/v1/${PID}/quotations?lead_configuration_id=${item.item_subject.id}`)).quotationDatas || [];
    } catch { continue; }
    gescand++;
    for (const d of docs) cohortRows.push({ klant: item.summary, gemaakt: d.quotationCreationTimestamp, status: d.quotationStatus, documentId: d.documentId });
    for (const d of docs) {
      if (d.quotationStatus !== 'ACCEPTED') continue;
      if (state.gemeld[d.documentId]) continue;
      state.gemeld[d.documentId] = { nummer: d.quotationNumber, klant: item.summary, gemeld: new Date().toISOString() };
      if (!eersteRun) nieuw.push({ nummer: d.quotationNumber, klant: item.summary });
    }
    await new Promise(r => setTimeout(r, 150));
  }
  state.nulmeting = true;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
  console.log(`Gescand: ${gescand} leads | nieuw getekend: ${nieuw.length}${eersteRun ? ' (nulmeting)' : ''}`);

  // GEEN los tekenbericht meer (Daimy 10-08: "mondeling akkoord en doorgezet naar
  // inmeten, en online ondertekend en doorgezet, is 1 ding — beantwoord dit in 1
  // terminal"). Twee rapporten met elk een eigen akkoord-getal dwongen hem elke dag
  // tot vergelijken. De handtekeningen gaan hieronder in HET ENE dagrapport mee.
  if (eersteRun) {
    await telegram(`✍️ Tekenrapport is ingesteld. Nulmeting gedaan (${Object.keys(state.gemeld).length} eerder getekende offertes gemarkeerd); getekende offertes tellen vanaf morgen mee in het dagrapport.`);
  }

  // ---- Deel 2: wat bereikte de AI de afgelopen dag (twijfelaars, showroom, inmeten) ----
  try {
    const LOG = path.join(__dirname, '..', 'data', 'ai-ks', 'log.jsonl');
    const sinds = Date.now() - 24 * 3600000;
    const entries = fs.readFileSync(LOG, 'utf8').trim().split('\n')
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && e.antwoord && new Date(e.tijd).getTime() > sinds && (e.actief || e.sonny || e.email));
    if (!entries.length) {
      // Nul-melding uitgezet (Daimy 30 juli): alleen loggen.
      console.log('geen AI-gesprekken afgelopen dag — geen Telegram-bericht');
      return;
    }
    // Compacte digest per gesprek voor de samenvatter
    const perTicket = new Map();
    for (const e of entries) {
      const arr = perTicket.get(e.ticket) || [];
      arr.push(`KLANT: ${(e.laatsteKlantBericht || e.teamOpdracht || '').slice(0, 200)}\nAI: ${(e.antwoord || '').slice(0, 300)}\nACTIES: ${(e.acties || []).map(a => a.type).join(',') || '-'}`);
      perTicket.set(e.ticket, arr);
    }
    const digest = [...perTicket.entries()].map(([tid, arr], i) => `## Gesprek ${i + 1} (ticket ${tid})\n${arr.join('\n---\n')}`).join('\n\n').slice(0, 150000);
    const APIKEY = fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
    // Harde aantallen die Daimy dagelijks wil (17 juli): hoeveel geholpen, hoeveel wilden akkoord,
    // hoeveel overtuigd vanuit twijfel, hoeveel afspraken. Haiku classificeert per gesprek en geeft JSON.
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': APIKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content:
          `Hieronder staan ${perTicket.size} AI-klantenservicegesprekken van Sonty (zonwering) van de afgelopen dag. Beoordeel ALLEEN op basis van wat er echt staat (niets verzinnen) en geef UITSLUITEND geldige JSON terug in dit formaat:\n` +
          `{\n  "geholpen": <aantal gesprekken waarin de AI de klant echt inhoudelijk verder heeft geholpen>,\n  "showroom": <aantal klanten dat een SHOWROOMbezoek heeft afgesproken of daarnaar verwezen is. Dit staat LOS van akkoord: iemand komt naar de showroom om nog te beslissen>,\n  "overtuigd": <aantal twijfelaars dat de AI over de streep trok (subset van geholpen; alleen wie eerst duidelijk twijfelde op prijs/keuze)>,\n  "overtuigd_details": ["Klantnaam (ticket) — in 1 zin hoe (alternatief/downgrade/uitleg/korting)"],\n  "geholpen_tickets": [<ticketnummers van de gesprekken die je als geholpen telt>],\n  "showroom_tickets": [<ticketnummers met een showroomafspraak>],\n  "overtuigd_tickets": [<ticketnummers van de overtuigde twijfelaars>],\n  "veelvoorkomende_problemen": ["Kort thema waar klanten hulp bij nodig hadden of waar de AI het niet zelf kon oplossen (bv. 'foto-beoordeling', 'levertijd al lopende order', 'maatwerk buiten configurator', 'klacht montage'), met hoe vaak het voorkwam. Sorteer op meest voorkomend. Alleen echte terugkerende thema's, max 6."]\n}\n` +
          `Belangrijk tegen scheve data: de ..._tickets-lijsten moeten precies even lang zijn als het bijbehorende aantal; de ticketnummers staan in de kop van elk gesprek. Geef alleen de JSON, geen tekst eromheen.\n\n${digest}` }],
      }),
    });
    const j = await resp.json();
    let raw = j?.content?.[0]?.text || '';
    let stats = null;
    try { stats = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch {}

    // Cumulatief totaal bijhouden zodat Daimy ook "totaal tot nu toe" ziet
    // Cumulatief bijhouden PER TICKET, niet door dagcijfers op te tellen. 16% van de
    // gesprekken loopt over meerdere dagen (gemeten 10-08-2026: 168 van 1020), en die
    // werden elke dag opnieuw meegeteld. Daardoor stond het totaal op 137 akkoord
    // terwijl er in dezelfde periode 117 offertes zijn getekend — een AI-subtotaal kan
    // nooit hoger zijn dan het totaal. Met sets is de telling zelf-corrigerend.
    const STATS_FILE = path.join(__dirname, '..', 'data', 'ai-ks', 'conversie-stats.json');
    let cum = { geholpen: 0, akkoord_inmeten: 0, showroom: 0, overtuigd: 0, dagen: 0 };
    try { cum = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')); } catch {}

    if (stats) {
      const CATS = [['geholpen', 'geholpen_tickets'], ['showroom', 'showroom_tickets'], ['overtuigd', 'overtuigd_tickets']];
      // akkoord-cumulatief: elke run vers herbouwd uit de harde bronnen sinds 10-08 —
      // handtekeningen (getekend-gemeld) plus unieke inmeet-actie-tickets uit de log.
      try {
        const START = Date.parse('2026-08-10');
        const namenGetekend = Object.values(state.gemeld).filter((v) => Date.parse(v.gemeld) >= START).map((v) => v.klant);
        const actieSet = new Set();
        for (const l of fs.readFileSync(LOG, 'utf8').trim().split('\n')) {
          let e3; try { e3 = JSON.parse(l); } catch { continue; }
          if (!e3 || new Date(e3.tijd).getTime() < START) continue;
          if ((e3.acties || []).some((a) => a.type === 'inmeet_afspraak')) actieSet.add(e3.ticket);
        }
        cum.akkoord_inmeten = namenGetekend.length + [...actieSet].length;
        cum.akkoordBron = `${namenGetekend.length} getekend + ${actieSet.size} doorgezet`;
      } catch { /* teller blijft dan staan */ }
      cum.tickets = cum.tickets || {};
      let perTicketGelukt = true;
      for (const [veld, lijstveld] of CATS) {
        const ids = Array.isArray(stats[lijstveld]) ? stats[lijstveld].map(String) : null;
        // alleen vertrouwen als de lijst even lang is als het gemelde aantal
        if (!ids || ids.length !== (stats[veld] || 0)) { perTicketGelukt = false; continue; }
        cum.tickets[veld] = [...new Set([...(cum.tickets[veld] || []), ...ids])];
      }
      if (perTicketGelukt) {
        for (const [veld] of CATS) cum[veld] = (cum.tickets[veld] || []).length;
      } else {
        // terugval: oude manier, maar dan wel gemarkeerd zodat het cijfer navolgbaar blijft
        for (const [veld] of CATS) cum[veld] = (cum[veld] || 0) + (stats[veld] || 0);
        cum.onzuiver = (cum.onzuiver || 0) + 1;
      }
      cum.dagen = (cum.dagen || 0) + 1;
      fs.writeFileSync(STATS_FILE, JSON.stringify(cum, null, 1));

      // Totaal aantal gevoerde gesprekken (Daimy 3 aug): all-time uniek uit het logbestand,
      // zelfde filter als de dagtelling. Zelf-corrigerend, geen losse teller nodig.
      let totaalGesprekken = 0;
      try {
        const alleTickets = new Set();
        for (const l of fs.readFileSync(LOG, 'utf8').trim().split('\n')) {
          let e; try { e = JSON.parse(l); } catch { continue; }
          if (e && e.ticket && e.antwoord && (e.actief || e.sonny || e.email)) alleTickets.add(e.ticket);
        }
        totaalGesprekken = alleTickets.size;
      } catch {}

      // CONVERSIE-BLOK IN HETZELFDE BERICHT (Daimy 11-08: "zorg dat mijn conversie-
      // rapport elke avond en tekenrapport kloppen qua data"). Twee losse berichten met
      // elk een eigen definitie gaven "verschillende data". Nu: één avondbericht, en de
      // conversie komt uit DE bron die Daimy zelf als juist heeft aangewezen (03-08):
      // de sheet, akkoord = inkoopbedrag ingevuld, geteld per maandtab. De akkoorden
      // van vandaag (hierboven, met namen) stromen daar bij het inplannen vanzelf in —
      // dat verschil in moment is de enige reden dat de weekcijfers nog kunnen oplopen,
      // en dat staat er expliciet bij.
      let conversieBlok = '';
      try {
        const uit = require('child_process').execFileSync(process.execPath,
          [path.join(__dirname, 'conversie-week-sheet.js'), '--maanden', '2'],
          { timeout: 5 * 60000 }).toString();
        const regels = uit.trim().split('\n').filter((r) => /^\d{4}-W|^\s+⭐/.test(r));
        if (regels.length) conversieBlok = '\n\n📊 Conversie per week (sheet, methode Daimy):\n' + regels.slice(-8).join('\n');
      } catch (e) { conversieBlok = '\n\n📊 Conversieblok niet beschikbaar: ' + e.message.slice(0, 60); }

      // COHORT-METING (Daimy 13-08: "wat merk je aan de conversie na de prijsstijging,
      // en de gemiddelde akkoord-tijd, gemeten vanaf de bot"). Eerlijke maat: getekend
      // binnen 3 dagen na de offerte — gelijk voor elk cohort, ongeacht leeftijd.
      // Tekentijd komt uit het documentdetail (veld "timestamp" bij ACCEPTED).
      let cohortBlok = '';
      try {
        const perKlant = {};
        for (const r of cohortRows) { if (!perKlant[r.klant] || r.gemaakt > perKlant[r.klant].gemaakt) perKlant[r.klant] = r; }
        const uniek = Object.values(perKlant);
        for (const r of uniek.filter((x) => x.status === 'ACCEPTED')) {
          try {
            const det = await rpGet(`/document-service/v1/${PID}/quotations/${r.documentId}`);
            const m2 = JSON.stringify(det).match(/"timestamp":(\d{13})/);
            if (m2) r.getekend = +m2[1];
          } catch { /* detail niet op te halen: telt niet mee in tekentijd */ }
          await new Promise((rr) => setTimeout(rr, 150));
        }
        const COHORTEN = [
          ['vóór bot', (t) => t < Date.parse('2026-07-16')],
          ['bot live 16/7-2/8', (t) => t >= Date.parse('2026-07-16') && t < Date.parse('2026-08-03')],
          ['na prijsverhoging 3/8+', (t) => t >= Date.parse('2026-08-03')],
        ];
        const regels = [];
        for (const [naam2, f] of COHORTEN) {
          const co = uniek.filter((r) => f(r.gemaakt));
          const oud3 = co.filter((r) => Date.now() - r.gemaakt >= 3 * 86400000);
          const binnen3 = oud3.filter((r) => r.getekend && r.getekend - r.gemaakt <= 3 * 86400000);
          const uren = co.filter((r) => r.getekend).map((r) => (r.getekend - r.gemaakt) / 86400000).sort((a, b2) => a - b2);
          const med = uren.length ? uren[Math.floor(uren.length / 2)] : null;
          if (oud3.length >= 10) regels.push(`• ${naam2}: ${(100 * binnen3.length / oud3.length).toFixed(1)}% tekent binnen 3 dgn${med != null ? `, mediaan tekentijd ${med.toFixed(1)} dgn` : ''} (n=${oud3.length})`);
        }
        if (regels.length) cohortBlok = '\n\n⏱️ Cohort-meting (getekend binnen 3 dagen na offerte):\n' + regels.join('\n');
      } catch (e) { console.error('cohort-meting overgeslagen:', e.message.slice(0, 60)); }

      const details = (stats.overtuigd_details || []).length ? '\n\nOvertuigd:\n' + stats.overtuigd_details.map(d => '• ' + d).join('\n') : '';

      // EEN AKKOORD-GETAL (Daimy 10-08). Online tekenen en mondeling ja zeggen in de
      // chat zijn allebei "akkoord, door naar inmeten" en tellen als één ding, elke
      // klant maximaal één keer. Ontdubbeld op achternaam+voorletter; de bron staat
      // erbij zodat elk cijfer navolgbaar blijft.
      // AKKOORD KOMT NOOIT MEER UIT EEN TAALMODEL (Daimy 13-08: zes "akkoorden in het
      // gesprek" bleken VERZONNEN — de namen kwamen niet eens in de logs voor). De enige
      // toegestane bronnen zijn hard: (1) een handtekening in RP, (2) een inmeet_afspraak-
      // actie die de bot zelf heeft uitgevoerd (staat in log.jsonl, deterministisch).
      const actieAkkoorden = [];
      try {
        const sinds24 = Date.now() - 24 * 3600000;
        const gezien = new Set();
        for (const l of fs.readFileSync(LOG, 'utf8').trim().split('\n')) {
          let e2; try { e2 = JSON.parse(l); } catch { continue; }
          if (!e2 || new Date(e2.tijd).getTime() < sinds24) continue;
          if (!(e2.acties || []).some((a) => a.type === 'inmeet_afspraak')) continue;
          if (gezien.has(e2.ticket)) continue;
          gezien.add(e2.ticket);
          const kl = e2.klant || {};
          actieAkkoorden.push({ naam: (typeof kl === 'string' ? kl : kl.naam) || (typeof kl === 'object' ? kl.phone : '') || 'onbekend', ticket: e2.ticket });
        }
      } catch { /* log onleesbaar: dan alleen handtekeningen */ }

      // "Taico Aerts" en "Taico Aerts en Carolin Brandt" zijn dezelfde klant: namen
      // matchen als alle woorden van de korte naam in de lange voorkomen (voegwoorden
      // tellen niet mee).
      const woorden = (n) => String(n || '').toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter((w) => w && !['en', 'de', 'van', 'der', 'den', 'het'].includes(w));
      const zelfde = (a, b) => {
        const [kort, lang] = [woorden(a), woorden(b)].sort((x, y) => x.length - y.length);
        return kort.length > 0 && kort.every((w) => lang.includes(w));
      };
      const akkoordLijst = [];
      for (const n of nieuw) akkoordLijst.push({ naam: n.klant, via: `getekend, offerte ${n.nummer}` });
      for (const a2 of actieAkkoorden) {
        if (a2.naam && !akkoordLijst.some((x) => zelfde(x.naam, a2.naam))) akkoordLijst.push({ naam: a2.naam, via: `doorgezet naar inmeten (ticket ${a2.ticket})` });
      }
      await telegram(
        `🤖 AI-resultaten afgelopen dag (${perTicket.size} gesprekken gevoerd):\n\n` +
        `• Geholpen: ${stats.geholpen ?? '?'}\n` +
        // Namen erbij (Daimy 10-08: "1 rapport zegt 2, het andere 5 vandaag?"). Dit
        // cijfer is een gesprek-oordeel van het model; zonder namen is het niet te
        // controleren en lijkt het te botsen met het tekenrapport, dat handtekeningen
        // telt. Met namen zie je in een oogopslag wie er wel ja zei maar nog niet tekende.
        `• Akkoord (door naar inmeten): ${akkoordLijst.length}` +
        (akkoordLijst.length ? '\n' + akkoordLijst.map((a) => `   - ${a.naam} (${a.via})`).join('\n') : '') + '\n' +
        `• Showroomafspraken (los): ${stats.showroom ?? '?'}\n` +
        `• Waarvan overtuigd vanuit twijfel: ${stats.overtuigd ?? '?'}\n` +
        details + conversieBlok + cohortBlok +
        (stats.samenvatting ? `\n\n${stats.samenvatting}` : '') +
        // "3 dagen en 1111 gesprekken?" (Daimy 12-08): het gesprekstotaal loopt sinds
        // 16 juli, maar de uitkomsten-teller is op 10-08 opnieuw gestart (de oude telde
        // meerdaagse gesprekken dubbel). Twee verschillende klokken in een zin lezen
        // als onzin — daarom nu allebei expliciet benoemd.
        `\n\n📊 Totaal: ${totaalGesprekken} gesprekken gevoerd sinds de start (16 juli). Uitkomsten geteld sinds de herstart van de teller op 10 aug (${cum.dagen} dag${cum.dagen === 1 ? '' : 'en'}): ${cum.geholpen} geholpen, ${cum.akkoord_inmeten} akkoord, ${cum.showroom} showroom, ${cum.overtuigd} overtuigd.` +
''
      );
    } else {
      await telegram(`🤖 AI-resultaten: ${perTicket.size} gesprekken gevoerd (aantallen-classificatie mislukt: ${JSON.stringify(j).slice(0, 100)}).`);
    }
  } catch (e) {
    console.error('samenvatting FOUT:', e.message);
    await telegram('⚠️ AI-resultaten-samenvatting gecrasht: ' + e.message.slice(0, 150));
  }
})().catch(async (e) => {
  console.error('CRASH:', e.message);
  await telegram('⚠️ Getekend-rapport gecrasht: ' + e.message.slice(0, 200));
  process.exit(1);
});
