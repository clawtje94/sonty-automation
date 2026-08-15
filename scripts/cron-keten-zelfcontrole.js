#!/usr/bin/env node
// KETEN-ZELFCONTROLE (Daimy 10-08: "ik blijf dingen herhalen en corrigeren en kan er
// niet op vertrouwen dat dit autonoom werkt").
//
// Elke fout die Daimy vandaag zelf ontdekte, controleert dit script nu zelf — elk uur.
// Het lost niets op; het maakt onzichtbare fouten zichtbaar vóórdat een klant of Daimy
// ertegenaan loopt. Alleen melden als er echt iets mis is, anders zwijgen.
//
// Gecontroleerde invarianten (elk hoort bij een echt incident):
//  1. dubbele boeking      — twee klanten bij dezelfde inmeter op hetzelfde moment
//  2. botsend aanbod       — twee lopende voorstellen voor dezelfde plek (Rick/Katuscha)
//  3. aanbod ná boeking    — voorstel naar iemand die al een afspraak heeft (Eric)
//  4. stille klant         — klant reageerde op een voorstel, wij niet (Rick, Natalie)
//  5. dood ticket          — state verwijst naar een samengevoegd/verdwenen gesprek
//  6. vergeten lead        — staat >5 dagen op "Inmeten inplannen" zonder aanbod
//  7. verlopen zonder vervolg — aanbod verlopen, geen nieuw aanbod, geen boeking
const fs = require('fs');
const path = require('path');
const { planningTelegram } = require('./lib/telegram-planning.js');

const MEET_CODE = process.env.MEETBON_CODE || '2288';
const SITE = 'https://sonty-website.vercel.app';
const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const INMETEN_INPLANNEN = '2e9819bd-26f0-4082-8f18-32bb48f87f54';
const STATE_PAD = path.join(__dirname, '..', 'data', 'inmeten-planner-state.json');
const BOEKINGEN_PAD = path.join(__dirname, '..', 'data', 'inmeet-boekingen.json');
const GEMELD_PAD = path.join(__dirname, '..', 'data', 'zelfcontrole-gemeld.json');
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

const lees = (p, standaard) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return standaard; } };
const uur = (iso) => new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

async function api(pad) {
  const r = await fetch(SITE + pad, { headers: { 'x-meet-code': MEET_CODE } });
  if (!r.ok) throw new Error(`${pad}: HTTP ${r.status}`);
  return r.json();
}

/** @returns {{data?: any[]} | null | 'onbekend'} — 'onbekend' bij drukte (429) of een
 *  storing: dat is géén verdwenen gesprek. Zonder dit onderscheid meldde de controle
 *  Josua's gesprek als "dood" terwijl het gewoon bestond en Trengo even druk was —
 *  en een vals alarm ondermijnt het vertrouwen in deze controle. */
async function trengo(pad) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://app.trengo.com/api/v2' + pad, { headers: { Authorization: 'Bearer ' + TT } });
    if (r.status === 429) { await wacht(10000); continue; }
    if (r.status === 404) return null;        // echt weg
    if (!r.ok) return 'onbekend';             // storing: niet concluderen
    return r.json();
  }
  return 'onbekend';                          // bleef druk
}

(async () => {
  const problemen = [];
  const boekingen = lees(BOEKINGEN_PAD, {});
  const state = lees(STATE_PAD, {});
  const actief = Object.entries(boekingen).filter(([, b]) => b.status === 'geboekt' && Date.parse(b.aankomst) > Date.now());

  // 1. dubbele boeking
  for (let i = 0; i < actief.length; i++) {
    for (let j = i + 1; j < actief.length; j++) {
      const [, a] = actief[i]; const [, b] = actief[j];
      if (a.inmeter !== b.inmeter) continue;
      const aVan = Date.parse(a.aankomst); const aTot = aVan + (a.duurMin || 30) * 60000;
      const bVan = Date.parse(b.aankomst); const bTot = bVan + (b.duurMin || 30) * 60000;
      if (aVan < bTot && bVan < aTot) problemen.push(`DUBBELE BOEKING: ${a.naam} en ${b.naam} allebei bij ${a.inmeter} op ${uur(a.aankomst)}`);
    }
  }

  // 2 + 3. lopende aanbiedingen: botsingen en aanbod aan iemand die al geboekt staat
  const { aanbiedingen: lopend } = await api('/api/inmeet-aanbod?actief=1');
  const perSlot = {};
  for (const a of lopend) {
    if (a.lead?.rpItemId && boekingen[a.lead.rpItemId]?.status === 'geboekt'
        && Date.parse(boekingen[a.lead.rpItemId].aankomst) > Date.now()) {
      problemen.push(`AANBOD NAAST AFSPRAAK: ${a.lead.naam} heeft al ${uur(boekingen[a.lead.rpItemId].aankomst)} maar kreeg een nieuw voorstel`);
    }
    for (const s of a.slots || []) {
      const k = `${s.aankomst}|${s.inmeter}`;
      (perSlot[k] = perSlot[k] || []).push(a.lead?.naam || '?');
    }
  }
  for (const [k, namen] of Object.entries(perSlot)) {
    if (new Set(namen).size > 1) problemen.push(`BOTSEND AANBOD: ${namen.join(' + ')} kregen allebei ${uur(k.split('|')[0])} bij ${k.split('|')[1]}`);
  }

  // 4 + 5. klantreacties zonder antwoord, en dode ticket-ids
  const tickets = state.aanbodTickets || {};
  const verseTokens = Object.entries(tickets).filter(([, v]) => Date.now() - Date.parse(v.verstuurdOp) < 5 * 86400000);
  for (const [, info] of verseTokens) {
    if (!info.waTicket) continue;
    const msgs = await trengo(`/tickets/${info.waTicket}/messages?per_page=10`);
    await wacht(700);
    if (msgs === 'onbekend') continue; // Trengo was druk; volgende ronde opnieuw
    if (!msgs) { problemen.push(`DOOD GESPREK: ticket ${info.waTicket} van ${info.naam} bestaat niet meer (samengevoegd?) — reacties worden gemist`); continue; }
    const echt = (msgs.data || []).filter((m) => (m.message_type || m.type) !== 'NOTE')
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const laatste = echt[echt.length - 1];
    if (!laatste || (laatste.message_type || laatste.type) !== 'INBOUND') continue;
    const tekstLaatste = String(laatste.message || laatste.body || '').replace(/<[^>]+>/g, ' ').trim();
    // Een duimpje of "dat past" ná een geslaagde boeking hoeft geen antwoord — dat is
    // een afsluiter, geen open vraag. Wél melden als de klant iets vraagt of aankaart.
    // Een afsluiter kan uit meerdere korte zinnen bestaan ("Bedankt, ik heb de afspraak
    // geaccepteerd." / "Ja dat is goed. Fijne avond"). Alleen als ÉLKE zin een
    // bevestiging of bedankje is, hoeft er geen antwoord meer.
    const zinAfsluiter = /^(👍|👌|🙏|top|dank(je|u)?( wel)?|thanks|bedankt|prima|oke|oké|ok|dat (past|is goed|is prima)|is goed|ja( dat is goed| hoor| graag)?|fijne (avond|dag|weekend)|tot (dan|dinsdag|maandag)|ik heb de afspraak.{0,30}(geaccepteerd|bevestigd)|hoi|hallo|groet(en|jes)?|mvg|met vriendelijke groet)[\s!.,👍👌🙏🏻🏼🏽😊-]*$/i;
    const zinnen = tekstLaatste.split(/[.!?\n]+/).map((z) => z.trim()).filter(Boolean);
    const afsluiter = zinnen.length > 0 && zinnen.every((z) => zinAfsluiter.test(z));
    const tel9 = String(info.telefoon || '').replace(/\D/g, '').slice(-9);
    const boeking = Object.values(boekingen).find((b) => b.status === 'geboekt'
      && String(b.telefoon || '').replace(/\D/g, '').slice(-9) === tel9);
    const berichtOp = Date.parse(String(laatste.created_at).replace(' ', 'T'));
    // Is er ná dit bericht een afspraak vastgelegd, dan wás dit bericht de keuze en is
    // hij netjes afgehandeld (de klant kreeg zijn bevestiging). Zonder deze regel meldt
    // de controle elke geboekte klant die "dat past" schreef, en dan wordt hij ruis.
    if (boeking && Date.parse(boeking.geboektOp || 0) > berichtOp) continue;
    if (afsluiter && boeking) continue;
    // Vroeg de klant om eerder te mogen en staat hij inmiddels op de wachtlijst, dan is
    // dat afgehandeld — dan hoeft deze controle er niet elk uur over te blijven zeuren.
    try {
      const { laad } = require('./lib/eerder-willen.js');
      const opLijst = Object.values(laad()).some((k) => String(k.telefoon || '').replace(/\D/g, '').slice(-9) === tel9);
      if (opLijst && boeking && /eerder|vrijkom|vrij kom/i.test(tekstLaatste)) continue;
    } catch { /* lijst niet leesbaar: gewoon melden */ }
    // Het team beantwoordt lang niet alles in Trengo zelf: ze bellen of mailen en leggen
    // dat vast als interne notitie ("Gebeld en voicemail", "En mail gestuurd" — Marjolein
    // Nunnink, 10-08). Zonder deze stap bleef de controle om antwoord vragen dat allang
    // gegeven was, en dan wordt hij ruis en kijkt niemand er meer naar.
    //
    // Alleen ECHT contact telt. Een notitie die de vraag doorzet ("@jorren kijk jij hier
    // even naar") is géén antwoord aan de klant — precies het soort notitie waarachter
    // eerder vragen zijn blijven liggen.
    const CONTACT = /\b(gebeld|teruggebeld|voicemail|ingesproken|gemaild|mail (gestuurd|verstuurd)|gesproken|langsgeweest|opgelost|afgehandeld)\b/i;
    const contactNa = (msgs.data || []).some((m) => {
      if ((m.message_type || m.type) !== 'NOTE') return false;
      if (Date.parse(String(m.created_at).replace(' ', 'T')) <= berichtOp) return false;
      return CONTACT.test(String(m.message || m.body || '').replace(/<[^>]+>/g, ' '));
    });
    if (contactNa) continue;
    const stilUren = (Date.now() - berichtOp) / 3600000;
    if (stilUren >= 2) {
      problemen.push(`GEEN ANTWOORD: ${info.naam} reageerde ${Math.round(stilUren)} uur geleden op de planning en kreeg niets terug — "${String(laatste.message || laatste.body || '').replace(/<[^>]+>/g, ' ').slice(0, 70)}"`);
    }
  }

  // 6. leads die te lang wachten zonder aanbod
  try {
    const d = await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${BACKLOG}/items?limit=1000`, {
      headers: { Authorization: 'Bearer ' + RP_API_KEY },
    })).json();
    const wachtend = (d.items || []).filter((i) => i.status_id === INMETEN_INPLANNEN
      && !(i.technical_labels || []).some((l) => l?.type === 'ITEM_ARCHIVED'));
    const metAanbod = new Set(lopend.map((a) => a.lead?.rpItemId).filter(Boolean));
    for (const i of wachtend) {
      if (metAanbod.has(i.id) || boekingen[i.id]?.status === 'geboekt') continue;
      // WAT MEET JE EIGENLIJK (Daimy 10-08: "Th de Geest is vandaag pas akkoord gegaan,
      // waarom krijg ik daar een melding over?"). De klok moet lopen vanaf het moment dat
      // de lead bij ONS op de stapel kwam, niet vanaf zijn offerte-aanvraag. Th de Geest
      // vroeg op 1 augustus een offerte aan en ging vandaag akkoord; met de aanmaakdatum
      // als peildatum leek hij negen dagen te liggen terwijl hij er twee uur stond.
      // Volgorde: wanneer wij hem voor het eerst in deze status zagen, anders de laatste
      // wijziging aan de lead (de statusovergang zelf). De aanmaakdatum nooit.
      const sinds = state.gezien?.[i.id]
        ? Date.parse(state.gezien[i.id])
        : Number(i.timestamp_updated || i.timestamp_created);
      const dagen = (Date.now() - sinds) / 86400000;
      if (dagen > 5) problemen.push(`VERGETEN LEAD: ${i.summary} staat ${Math.round(dagen)} dagen op "Inmeten inplannen" zonder voorstel en zonder afspraak`);
    }
  } catch (e) { problemen.push(`CONTROLE MISLUKT: RP niet leesbaar (${e.message.slice(0, 50)})`); }

  // 7. verlopen aanbod zonder vervolg
  const { aanbiedingen: verlopen } = await api('/api/inmeet-aanbod?status=verlopen');
  for (const a of verlopen) {
    const rpId = a.lead?.rpItemId;
    if (!rpId) continue;
    if (boekingen[rpId]?.status === 'geboekt') continue;
    if (lopend.some((l) => l.lead?.rpItemId === rpId)) continue;
    const urenGeleden = (Date.now() - Date.parse(a.verlooptOp)) / 3600000;
    if (urenGeleden > 2 && urenGeleden < 72) {
      problemen.push(`VERLOPEN ZONDER VERVOLG: ${a.lead.naam} — voorstel verliep ${Math.round(urenGeleden)} uur geleden, geen nieuw voorstel en geen afspraak`);
    }
  }

  // 8. DRIE ADMINISTRATIES, ÉÉN WAARHEID (Daimy 10-08: "Connie staat als geboekt in het
  //    dashboard maar NIET in de Planado agenda"). Een afspraak leeft op drie plekken:
  //    ons boekingenbestand (waar het dashboard uit put), de opdracht in Planado, en de
  //    agenda in Outlook. Ze konden uit elkaar lopen zonder dat iemand het zag: bij
  //    Connie stond de opdracht in Planado geschrapt, de Outlook-afspraak nog wel, en
  //    het dashboard meldde vrolijk "geboekt" op een datum die de klant had afgezegd.
  //    Erger nog: de Outlook→Planado-sync maakte er een naamloze opdracht van terug, dus
  //    het opruimen draaide zichzelf terug.
  try {
    const { haalAgenda } = require('./cron-inmeten-planner.js');
    const agenda = await haalAgenda();
    const opdrachten = Object.values(agenda).flat();
    for (const [rpId, b] of Object.entries(boekingen)) {
      if (b.status !== 'geboekt' || !b.aankomst) continue;
      const van = Date.parse(b.aankomst);
      if (van < Date.now()) continue;
      const staatErIn = opdrachten.some((o) => Math.abs(Date.parse(o.start) - van) < 60000);
      if (!staatErIn) {
        problemen.push(`SCHIJN-BOEKING: ${b.naam} staat bij ons als geboekt op `
          + `${new Date(van).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}`
          + ` (${b.inmeter}), maar er is geen opdracht op dat tijdstip. Het dashboard toont dus een afspraak die niet bestaat.`);
      }
    }
    // Andersom vergelijken kan niet: de agenda bevat ook alle montages, en die horen
    // niet in onze inmeet-administratie. Daarop melden zou puur ruis zijn.
  } catch (e) {
    console.log('  agenda-vergelijking overgeslagen: ' + e.message.slice(0, 70));
  }

  // OPEN ANNULERINGEN (Ana Franca 13-08: zegde per mail af, kreeg "kom er vandaag op
  // terug" en daarna stilte — de afspraak van 10 sep bleef twee dagen in Planado en
  // Outlook staan). De reply-monitor zet een annulering op deze lijst; wij blijven
  // melden tot de afspraak aantoonbaar weg is, en sturen dan de beloofde bevestiging.
  try {
    const APAD = path.join(__dirname, '..', 'data', 'annuleringen-open.json');
    const openAnn = lees(APAD, {});
    let aangepast = false;
    for (const [tok, a] of Object.entries(openAnn)) {
      const b = Object.values(boekingen).find((x) => x.aanbodToken === tok);
      if (!b || !b.planadoJobUuid) {
        problemen.push(`ANNULERING OPEN: ${a.naam} zegde af (${a.samenvatting || 'zie ticket ' + a.ticketId}) maar er is geen boeking terug te vinden — handmatig checken`);
        continue;
      }
      const PK = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
      const r = await fetch(`https://api.planadoapp.com/api/v2/jobs/${b.planadoJobUuid}`, { headers: { Authorization: 'Bearer ' + PK } });
      const weg = r.status === 404 || (r.ok && ['canceled', 'cancelled'].includes(((await r.json()).job || {}).status));
      if (!weg) {
        problemen.push(`ANNULERING OPEN: ${a.naam} zegde ${Math.round((Date.now() - Date.parse(a.gemeldOp)) / 3600000)} uur geleden af, maar de afspraak van ${uur(b.aankomst)} (${b.inmeter}) staat NOG in Planado/Outlook`);
        continue;
      }
      // Afspraak is weg: belofte inlossen — klant krijgt de annuleringsbevestiging.
      const { klantStil } = require('./lib/klant-stil.js');
      if (!klantStil(a.telefoon)) {
        await fetch(`https://app.trengo.com/api/v2/tickets/${a.ticketId}/messages`, {
          method: 'POST', headers: { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Hoi ${String(a.naam || '').split(' ')[0]}, zoals beloofd nog even de bevestiging: je afspraak is geannuleerd en je hoeft verder niets te doen. Mocht je later toch nog eens iets willen, dan ben je natuurlijk altijd welkom!\n\nGroetjes, Nanny van Sonty`, type: 'OUTBOUND' }),
        });
      }
      delete openAnn[tok];
      aangepast = true;
      await planningTelegram(`✅ Annulering van ${a.naam} is rond: afspraak is uit de agenda en de klant heeft de bevestiging gekregen.`);
    }
    if (aangepast) fs.writeFileSync(APAD, JSON.stringify(openAnn, null, 1));
  } catch (e) { console.log('  annuleringen-bewaking overgeslagen: ' + e.message.slice(0, 70)); }

  console.log(`zelfcontrole: ${problemen.length} probleem(en)`);
  problemen.forEach((p) => console.log('  - ' + p));

  // Alleen melden wat NIEUW is, anders wordt dit zelf een meldingenregen.
  const gemeld = lees(GEMELD_PAD, {});
  const nieuw = problemen.filter((p) => !gemeld[p] || Date.now() - gemeld[p] > 12 * 3600000);
  if (nieuw.length) {
    nieuw.forEach((p) => { gemeld[p] = Date.now(); });
    for (const k of Object.keys(gemeld)) if (Date.now() - gemeld[k] > 7 * 86400000) delete gemeld[k];
    fs.writeFileSync(GEMELD_PAD, JSON.stringify(gemeld));
    await planningTelegram(`🔍 Zelfcontrole van de inmeet-keten vond ${nieuw.length} ding(en) die niet kloppen:\n\n` + nieuw.map((p) => '• ' + p).join('\n')
      + '\n\nDit is een automatische controle die elk uur draait; hij lost niets op, hij zorgt dat het niet onopgemerkt blijft.');
  } else if (!problemen.length) {
    console.log('keten is schoon');
  }
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
