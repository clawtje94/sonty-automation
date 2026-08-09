#!/usr/bin/env node
// DOORLOPENDE e-mailverwerking voor aanvragen@ en info@ (net als de WhatsApp-daemon, maar voor e-mail).
// Pakt elke ronde de open tickets van de KANALEN op die aan Sunny toegewezen of niet-toegewezen zijn
// en waar de klant het laatste bericht stuurde, en verwerkt ze met dezelfde agent-logica:
// beantwoorden + aan Sunny toewijzen + sluiten, of naar team Mens nodig. Human-toegewezen
// tickets blijft hij af. State per ticket+laatste-berichttijd voorkomt dubbel verwerken.
// Gebruik: node email-daemon.js --watch 0   (permanent; launchd KeepAlive herstart bij crash)
const fs = require('fs');
const path = require('path');
const { verwerk, tGet, tPost, verwerkNotities } = require('./email-live.js');
const CFG = require('./config.js');

// Kanalen die de daemon beheert (Daimy 22 juli: info@ met dezelfde regels als aanvragen@).
const KANALEN = ['Aanvragen', 'info@ mailbox'];
const SONNY_USER = 747786;
const STATE_FILE = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'email-verwerkt.json');
// Per ticket de laatst geziene updated_at, zodat we berichten alleen ophalen als er iets
// veranderd is (429-vriendelijk) — nodig omdat we voor @sonny-notities ALLE Aanvragen-tickets
// volgen, ook gesloten en aan het team toegewezen.
const SCAN_FILE = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'email-notitie-scan.json');
// Tickets die Daimy met "@sonny stop/neem over" uit AI-beheer haalde (gevuld door email-live).
const STOP_FILE = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'email-stop.json');
const INTERVAL_MS = 90 * 1000;

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function saveState(s) { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); }

// Leeftijd van een Trengo-timestamp in minuten. Trengo geeft Amsterdamse wandkloktijd
// ("2026-07-20 09:07:04"); vergelijk met "nu" in dezelfde tijdzone-notatie zodat het ook
// klopt als de Mac zelf in een andere tijdzone staat.
function leeftijdMin(createdAt) {
  const nu = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  return (Date.parse(nu.replace(' ', 'T')) - Date.parse(String(createdAt).replace(' ', 'T'))) / 60000;
}

// Wachttijd per ticket: vast punt in het 1,5-2u-venster, deterministisch op ticket-id
// (verspringt dus niet per ronde). Zie CFG.EMAIL_REPLY_DELAY.
function wachttijdMin(ticketId) {
  const { minMin, maxMin } = CFG.EMAIL_REPLY_DELAY;
  return minMin + (Number(ticketId) % (maxMin - minMin + 1));
}

function loadJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } }

async function ronde() {
  const state = loadState();
  const scan = loadJson(SCAN_FILE);
  const stop = loadJson(STOP_FILE);
  // Zelfde bedrijfsuren als de WhatsApp-bot (Daimy 20 juli): buiten 08:00-21:00 geen klantmails
  // beantwoorden — wat 's nachts binnenkomt, wacht tot de ochtend. @sonny-notities van het team
  // verwerken we WEL de klok rond (net als de WA-daemon): dat is interne sturing, geen klantmail.
  const binnenUren = CFG.binnenBotUren();
  // ALLE Aanvragen-tickets ophalen — doorpaginaren tot leeg (cap 25 pagina's). Eerder werden
  // maar 4 pagina's gescand, waardoor OUDERE aan-Sunny/niemand-toegewezen tickets nooit werden
  // opgepakt en open bleven staan (Daimy 19 juli). Óók gesloten en aan team/mens toegewezen
  // tickets komen mee: daar tagt Daimy juist vaak @sonny op (beantwoorden doen we er niet).
  let tickets = [];
  for (let p = 1; p <= 25; p++) {
    const d = await tGet(`/tickets?page=${p}`);
    const data = d?.data || [];
    tickets.push(...data.filter(t => KANALEN.includes(t.channel?.title)));
    if (!data.length) break;
  }
  const teDoen = [];
  for (const t of tickets) {
    // Beantwoord-kandidaat = open én aan Sunny toegewezen, OF echt aan niemand (geen user én
    // geen team). Aan een TEAM toegewezen (bv. "Mens nodig") = human-wachtrij, daar blijft de
    // daemon qua beantwoorden vanaf (notities scannen mag wel).
    // VACATURE-tickets (Daimy 22-07): NOOIT door de bot beantwoorden. Toewijzen aan Daimy
    // ALLEEN bij een écht menselijk antwoord — open tickets zonder antwoord (mislukte sluiting
    // na verzending) of met alleen een afwezigheidsbericht/bounce gewoon als Sunny sluiten,
    // anders krijgt Daimy een toegewezen-mail per verzonden vacaturemail (bug 22-07 ~19:45).
    if (/nieuwe collega|interesse in de vacature/i.test(t.subject || '')) {
      if (t.status !== 'CLOSED') {
        try {
          const vm = await tGet(`/tickets/${t.id}/messages`);
          const inbound = (vm?.data || []).filter((m) => m.type === 'INBOUND');
          const echt = inbound.some((m) => !/automatisch antwoord|auto.?reply|out of office|afwezig|vakantie|undeliver|mail delivery|delivery status|postmaster|mailer-daemon/i.test(String(m.body || m.message || '').slice(0, 400)));
          if (echt && Number(t.user_id) !== 736327) {
            // vacature-antwoorden WEL aan Daimy (Daimy 23-07: "vacature reactie moet gewoon zo blijven")
            await tPost(`/tickets/${t.id}/assign`, { type: 'user', user_id: 736327 });
            console.log(`  [${t.id}] echt vacature-antwoord → toegewezen aan Daimy`);
          } else if (!echt) {
            await tPost(`/tickets/${t.id}/close`, {});
            console.log(`  [${t.id}] vacature-ticket zonder echt antwoord → gesloten (Sunny)`);
          }
        } catch (e) { console.error(`  [${t.id}] vacature-afhandeling FOUT: ${e.message}`); }
      }
      scan[t.id] = String(t.updated_at);
      continue;
    }
    const kandidaat = t.status !== 'CLOSED' && (Number(t.user_id) === SONNY_USER || (!t.user_id && !t.team_id));
    const gewijzigd = scan[t.id] !== String(t.updated_at);
    // Berichten alleen ophalen als er iets kan spelen: het ticket is gewijzigd (mogelijk een
    // nieuwe @sonny-notitie of klantmail), of het is een kandidaat die op zijn reactietijd wacht.
    if (!gewijzigd && !(kandidaat && binnenUren)) continue;
    const md = await tGet(`/tickets/${t.id}/messages`);
    const rowsAll = md?.data || [];
    scan[t.id] = String(t.updated_at);
    // 1) @SONNY-NOTITIES (Daimy 20 juli): altijd en direct verwerken — geen wachttijd, geen
    //    bot-uren-check. Leerpunt + ✅-terugkoppeling + eventuele actie/mail via email-live.
    try { await verwerkNotities(t, rowsAll); } catch (e) { console.error(`  [${t.id}] notitie FOUT: ${e.message}`); }
    // MENS-GESPREK (Daimy 23-07): stuurde een COLLEGA (niet Sunny) de laatste uitgaande mail,
    // dan is het gesprek van die collega — toewijzen en de bot blijft eraf.
    const laatsteUitgaand = rowsAll.filter((m) => m.type === 'OUTBOUND' && !m.internal_note)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    // AFGEROND GESPREK, NIEUWE VRAAG (Daimy 09-08): heeft de collega geantwoord én het
    // ticket gesloten, en begint de klant dáárna opnieuw, dan is dat een nieuwe vraag.
    // Die beantwoordt Sunny gewoon zelf; hem opnieuw aan Jorren hangen levert alleen
    // een wachtende klant op. (closed_at blijft na heropenen staan, dus we eisen dat
    // het klantbericht ná het sluiten kwam.)
    const laatsteEchtBericht = rowsAll.filter((m) => !(m.internal_note || m.type === 'NOTE'))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    const nieuweVraagNaSluiting = !!t.closed_at
      && laatsteEchtBericht?.type === 'INBOUND'
      && String(laatsteEchtBericht.created_at) > String(t.closed_at);
    if (nieuweVraagNaSluiting) console.log(`  [${t.id}] gesprek was afgerond en gesloten; klant stelt een nieuwe vraag → Sunny handelt zelf af`);

    if (!nieuweVraagNaSluiting && laatsteUitgaand && laatsteUitgaand.user_id && Number(laatsteUitgaand.user_id) !== SONNY_USER) {
      // Daimy zelf nooit automatisch toewijzen (Daimy 23-07) — bot blijft er wel vanaf
      if (t.status !== 'CLOSED' && Number(laatsteUitgaand.user_id) !== 736327 && Number(t.user_id) !== Number(laatsteUitgaand.user_id)) {
        try { await tPost(`/tickets/${t.id}/assign`, { type: 'user', user_id: laatsteUitgaand.user_id }); console.log(`  [${t.id}] laatste mail van collega (user ${laatsteUitgaand.user_id}) → aan hen toegewezen`); } catch (e) { console.error(`  [${t.id}] collega-toewijzing FOUT: ${e.message}`); }
      }
      // VANGNET (Daimy 30-07, casus Niels Pompe): een klantmail op een mens-gesprek die na
      // 4 uur nog onbeantwoord is, mag niet onzichtbaar blijven — Niels' "ik overweeg te
      // cancelen" van 23 juli bleef zo 5 dagen liggen tot hij echt annuleerde. De bot
      // antwoordt hier nooit; hij maakt het alleen ZICHTBAAR: team Mens nodig + notitie,
      // en bij annuleer-signalen direct een Telegram-alarm naar Daimy.
      try {
        const laatsteEcht = rowsAll.filter((m) => !(m.internal_note || m.type === 'NOTE')).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        const isInb = laatsteEcht && (laatsteEcht.contact_id || laatsteEcht.direction === 'inbound' || laatsteEcht.type === 'INBOUND');
        const stilUur = laatsteEcht ? (Date.now() - Date.parse(laatsteEcht.created_at)) / 3600000 : 0;
        const alGemeld = String(state[`vangnet:${t.id}`] || '') === String(laatsteEcht?.created_at || '');
        if (isInb && stilUur >= 4 && !alGemeld) {
          const tekst = String(laatsteEcht.body || laatsteEcht.message || '');
          const dreig = /annuleer|cancel|opzeg|terugbetal|geld terug|klacht|te lang|niet meer verder/i.test(tekst);
          if (Number(t.team_id) !== 431872) await tPost(`/tickets/${t.id}/assign`, { type: 'team', team_id: 431872 });
          await tPost(`/tickets/${t.id}/messages`, { internal_note: true, message: `⚠️ Vangnet: klantmail van ${String(laatsteEcht.created_at).slice(0, 16)} is na ${Math.round(stilUur)} uur nog onbeantwoord op dit mens-gesprek → naar Mens nodig gezet zodat hij zichtbaar is.` });
          if (dreig) await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: 1700128390, text: `🚨 Onbeantwoorde klantmail met annuleer/klacht-signaal (${Math.round(stilUur)}u stil) op ticket ${t.id} (${t.contact?.email || t.contact?.full_name || '?'}). Staat nu bij Mens nodig.` }) }).catch(() => {});
          state[`vangnet:${t.id}`] = String(laatsteEcht.created_at); saveState(state);
          console.log(`  [${t.id}] VANGNET: onbeantwoorde klantmail (${Math.round(stilUur)}u) → Mens nodig${dreig ? ' + alarm Daimy' : ''}`);
        }
      } catch (e) { console.error(`  [${t.id}] vangnet FOUT: ${e.message}`); }
      continue;
    }
    // 2) KLANTMAILS: alleen kandidaten, binnen bot-uren, en niet op stopgezette tickets.
    // Testadressen van Daimy/Joey (TEST_LIVE_EMAILS) krijgen DIRECT antwoord: geen bot-uren,
    // geen reactietijd (Daimy 20 juli) — het e-mail-equivalent van de WhatsApp-testnummers.
    const isTest = CFG.TEST_LIVE_EMAILS.includes((t.contact?.email || '').toLowerCase());
    if (!kandidaat || (!binnenUren && !isTest) || stop[t.id]) continue;
    const rows = rowsAll.filter(m => m.type === 'INBOUND' || m.type === 'OUTBOUND')
      .sort((a, b) => String(b.created_at).localeCompare(a.created_at));
    const laatste = rows[0];
    if (!laatste || laatste.type !== 'INBOUND') continue; // niks te beantwoorden
    // webflow-formulieren worden door verwerk() zelf afgehandeld (→ team Mens nodig met gegevens)
    const sleutel = `${t.id}:${laatste.created_at}`;
    if (state[sleutel]) continue;
    // ADS-RAPPORTMAILS (Daimy 31-07): geplande maandrapporten uit Google Ads / Meta
    // Ads Manager komen op aanvragen@ binnen. Nooit beantwoorden: veiligstellen in
    // data/ad-rapporten/ voor de spend-parser, ticket sluiten, klaar.
    const afz = String(t.contact?.email || '').toLowerCase();
    const isAdsRapport = /googleads-noreply@google\.com|@facebookmail\.com|adsmanager/.test(afz)
      || (/rapport|report/i.test(t.subject || '') && /google ads|meta|facebook/i.test(t.subject || ''));
    if (isAdsRapport) {
      try {
        const map = path.join(__dirname, '..', '..', 'data', 'ad-rapporten');
        fs.mkdirSync(map, { recursive: true });
        fs.writeFileSync(path.join(map, `${t.id}.json`), JSON.stringify({
          tijd: new Date().toISOString(), van: afz, onderwerp: t.subject,
          body: String(laatste.body || laatste.message || '').slice(0, 20000),
          attachments: (laatste.attachments || []).map(a => ({ naam: a.file_name || a.name, url: a.full_url || a.url })),
        }, null, 1));
        await tPost(`/tickets/${t.id}/close`, {});
        console.log(`  [${t.id}] ads-rapportmail veiliggesteld (${afz}) → data/ad-rapporten/, ticket gesloten`);
      } catch (e) { console.error(`  [${t.id}] ads-rapport FOUT: ${e.message}`); }
      state[sleutel] = 'ads-rapport ' + new Date().toISOString(); saveState(state);
      continue;
    }
    // ZAKELIJKE AANVRAGERS (Daimy 30-07, verduidelijkt): het gaat NIET om een particulier
    // die zegt "ik moet nog met mijn VvE overleggen" — die helpt de bot gewoon. Het gaat om
    // aanvragen NAMENS een organisatie: een VvE zelf, vastgoed-/gebouwbeheerder, bedrijf,
    // school of gemeente, of complexbreed (X woningen/appartementen). Die gaan naar Daimy.
    const vveTekst = `${t.subject || ''} ${String(laatste.body || laatste.message || '')}`;
    // Twee checks: (1) zakelijke termen, hoofdletterongevoelig; (2) "VvE <Eigennaam>"
    // (hoofdlettergevoelig, anders matcht ook "met mijn vve overleggen").
    const zakelijkTermen = /namens (de |onze |het )?(vve|vereniging|bestuur|beheer)|vereniging van eigenaren|vastgoedbeheer|gebouwbeheer|vve.?beheer|bewonerscommissie|\bgemeente\b|\bschool\b|kantoorpand|bedrijfspand|appartementencomplex|wooncomplex|\d+\s*(woningen|appartementen|units)\b|offerte voor (ons|onze) (pand|kantoor|complex|vereniging)/i;
    const vveMetNaam = /\b[Vv]\.?[Vv]\.?[Ee]\.?\s+(?:de\s|het\s)?[A-Z]/;
    if (zakelijkTermen.test(vveTekst) || vveMetNaam.test(vveTekst)) {
      try {
        if (Number(t.user_id) !== 736327) {
          await tPost(`/tickets/${t.id}/assign`, { type: 'user', user_id: 736327 });
          // AUDIT 07-08 (geval Deborah Loocks): de note zei "toegewezen" terwijl de
          // assignment stil was mislukt (user bleef null) — valse gerustheid. Eerst
          // verifiëren dat de toewijzing echt staat, dán pas de note.
          const check = await tGet(`/tickets/${t.id}`).catch(() => null);
          const echtToegewezen = Number(check?.user_id ?? check?.data?.user_id) === 736327;
          await tPost(`/tickets/${t.id}/messages`, {
            internal_note: true,
            message: echtToegewezen
              ? '🏢 VvE-aanvraag: automatisch aan Daimy toegewezen (regel Daimy 30-07). De bot beantwoordt dit niet.'
              : '🏢 VvE-aanvraag: toewijzen aan Daimy MISLUKT — dit ticket heeft nu NIEMAND. Handmatig oppakken.',
          });
          if (!echtToegewezen) console.error(`  [${t.id}] VvE-toewijzing NIET bevestigd — note waarschuwt nu i.p.v. gerust te stellen`);
        }
        console.log(`  [${t.id}] VvE-signaal → toegewezen aan Daimy, bot blijft eraf`);
      } catch (e) { console.error(`  [${t.id}] VvE-toewijzing FOUT: ${e.message}`); }
      state[sleutel] = 'vve->daimy ' + new Date().toISOString(); saveState(state);
      continue;
    }
    // REACTIETIJD (Daimy 20 juli): klantmails pas na 1,5-2 uur beantwoorden — direct antwoorden
    // voelt als een bot. Geldt sinds 20 juli ook voor webflow-leads: Sunny mailt die nu zelf
    // naar het klantadres, dus ook daar hoort het menselijke tempo bij.
    // Webflow-test van Daimy/Joey: het ticketcontact is no-reply@webflow, dus check ook of een
    // whitelist-adres ín het formulier staat — dan direct reageren (test).
    const isTestForm = CFG.TEST_LIVE_EMAILS.some(e => String(laatste.body || laatste.message || '').toLowerCase().includes(e));
    if (!isTest && !isTestForm) {
      const oud = leeftijdMin(laatste.created_at);
      const wacht = wachttijdMin(t.id);
      if (oud < wacht) { console.log(`  [${t.id}] wacht op reactietijd: ${Math.round(oud)}/${wacht} min`); continue; }
    }
    teDoen.push({ id: t.id, sleutel });
    await new Promise(r => setTimeout(r, 120));
  }
  fs.writeFileSync(SCAN_FILE, JSON.stringify(scan));
  if (!teDoen.length) { console.log(`[${new Date().toLocaleTimeString()}] geen nieuwe e-mail te verwerken${binnenUren ? '' : ' (buiten bot-uren; alleen notities gescand)'}`); return; }
  // Batch-limiet per ronde: nooit tientallen tegelijk afvuren (dat gaf 429-rate-limits en
  // onterecht overgeslagen tickets). Rustig 1 tegelijk, max 12 per ronde; de rest komt de
  // volgende ronde. Zo blijft de API-belasting en het uitgaande mailvolume beheersbaar.
  const batch = teDoen.slice(0, 12);
  console.log(`[${new Date().toLocaleTimeString()}] ${teDoen.length} te doen, nu ${batch.length} verwerken`);
  for (const job of batch) {
    try {
      const r = await verwerk(job.id);
      // ALLEEN als verwerkt markeren bij een écht afgehandeld resultaat. Bij "ticket niet
      // gevonden" (bv. transient/verwijderd) NIET markeren, zodat het niet stil verdwijnt.
      if (r && !/niet gevonden/i.test(r.resultaat || '')) { state[job.sleutel] = new Date().toISOString(); saveState(state); }
      console.log(`  [${job.id}] ${r.resultaat}, ${r.klant || ''}`);
    } catch (e) { console.error(`  [${job.id}] FOUT: ${e.message}`); }
    await new Promise(r => setTimeout(r, 800)); // adempauze tussen zware agent-runs
  }
  saveState(state);
}

(async () => {
  const watch = process.argv.includes('--watch');
  console.log('E-mail-daemon gestart' + (watch ? ' (permanent, elke 90s)' : ' (eenmalig)'));
  do {
    try { await ronde(); } catch (e) { console.error('ronde FOUT:', e.message); }
    if (watch) await new Promise(r => setTimeout(r, INTERVAL_MS));
  } while (watch);
})();
