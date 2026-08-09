#!/usr/bin/env node
// Reply-monitor voor keuzelink-berichten (Daimy 06-08). Twee taken:
// 1. KEUZE UITLEZEN op WhatsApp (Daimy: "lees jij gewoon op WhatsApp de keuze uit en
//    voer je die door en stuur je een bevestiging?"): antwoordt de klant "1", "2" of
//    "3" (of een dag die precies bij één optie past) op een OPEN aanbod, dan wordt de
//    keuze vastgelegd (zelfde route als de keuzepagina), boekt de verwerker alles
//    door, en krijgt de klant direct een WhatsApp-bevestiging in het gesprek.
// 2. Al het andere gaat letterlijk naar Daimy op Telegram — geen AI-gok, dedup per
//    bericht. Mail houdt gewoon de keuzelink.
const fs = require('fs');
const path = require('path');

const STATE_PLANNER = path.join(__dirname, '..', 'data', 'inmeten-planner-state.json');
const GEMELD = path.join(__dirname, '..', 'data', 'aanbod-replies-gemeld.json');
const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const TH = { Authorization: 'Bearer ' + TT, Accept: 'application/json' };
const { PLANNING_TG_TOKEN: TG_TOKEN, PLANNING_TG_CHAT } = require('./lib/telegram-planning.js');
const MEET_CODE = process.env.MEETBON_CODE || '2288';

async function telegram(tekst) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: PLANNING_TG_CHAT, text: tekst.slice(0, 3900) }),
  }).catch(() => {});
}

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const DAGK = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

/** Welke optie kiest dit bericht? 1/2/3, "optie 2", of een dagnaam die precies één slot matcht. */
function leesKeuze(tekst, slots) {
  const t = String(tekst || '').toLowerCase().trim();
  // 1-moment-aanbod: knop "Dat past" (of een bevestiging) = akkoord op slot 0.
  // "Ander moment"/"past niet" is GEEN keuze: conservatief → Telegram-melding.
  if (slots.length === 1) {
    // TWIJFEL over de AFSPRAAK wint altijd (mens kijkt mee). Bewust specifiek:
    // een los "maar" in een bijzin over iets anders (Marjolein 07-08: "Dat is
    // prima! Ik zou de offerte nog krijgen maar heb deze niet gehad") is géén
    // twijfel over de tijd.
    const twijfel = /ander(e)? (moment|tijd|dag|datum)|past (mij |ons )?niet|kan (dan |echt )?niet|lukt (dan |echt )?niet|liever|helaas|verzetten|verplaatsen|annuleer/i;
    if (twijfel.test(t)) return null;
    // kale bevestiging (knop of kort berichtje)
    if (/^(dat past|past\b.{0,10}|prima|is goed|akkoord|top|ja|jazeker|oke|oké|ok|👍)[!. ]*$/.test(t)
      && !/niet|geen|ander/.test(t)) return 0;
    // ACCEPTATIE MET EXTRA TEKST (audit 07-08, geval Marjolein: keuze bleef liggen
    // en niemand boekte): een zin die met een duidelijke bevestiging begint telt,
    // ook als er daarna nog een vraag of groet volgt. De twijfel-check hierboven
    // heeft dan al gedraaid.
    const eersteZinnen = t.split(/[.!?\n]/).slice(0, 2).map((z) => z.trim());
    if (eersteZinnen.some((z) => /^(hi+|hoi|hey|hallo|goedemorgen|goedemiddag|goedenavond)?[,! ]*(dat (is|past)|past (goed|prima)|prima|is goed|helemaal goed|akkoord|top|ja( hoor| graag| leuk)?|jazeker|oke|oké|ok|perfect|super)\b/.test(z))) return 0;
    if (/^(?:optie\s*)?1[.!)]?$/.test(t)) return 0;
    return null;
  }
  const num = t.match(/^(?:optie\s*)?([123])\b[.!)]?$/) || t.match(/\boptie\s*([123])\b/);
  if (num) return Number(num[1]) - 1;
  // dagnaam ("dinsdag" / "di") die precies bij één van de aangeboden slots past
  const perDag = slots.map((sl, i) => ({ i, dag: new Date(sl.aankomst).getDay() }));
  for (let d = 0; d < 7; d++) {
    if (!new RegExp(`\\b(${DAGEN[d]}|${DAGK[d]})\\b`).test(t)) continue;
    const passend = perDag.filter((x) => x.dag === d);
    if (passend.length === 1) return passend[0].i;
  }
  return null;
}

function bevestigingsTekst(slot) {
  const d = new Date(slot.aankomst);
  const dag = d.toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
  const van = d.toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const tot = new Date(+d + 30 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  // Naam alleen noemen als hij er echt is: op 06-08 stond er "onze inmeter undefined"
  // in een klantbericht omdat de publieke API de naam stripte.
  const wie = slot.inmeter ? `onze inmeter ${slot.inmeter}` : 'onze inmeter';
  return `Top! Genoteerd: ${dag} tussen ${van} en ${tot} komt ${wie} bij je langs. Komt er toch iets tussen? Stuur dan even een berichtje. Groetjes, Nanny van Sonty`;
}

async function stuurWaBevestiging(ticketId, naam, slot) {
  // Met retry en zonder stil falen: op 06-08 verdween Carlo's bevestiging in een
  // Trengo-429 en zei de ✅-melding tóch "bevestiging is al gestuurd".
  const tekst = bevestigingsTekst(slot);
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages`, {
        method: 'POST', headers: { ...TH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: tekst, type: 'OUTBOUND' }),
      });
      if (r.ok) return true;
      if (r.status === 429) { await new Promise((x) => setTimeout(x, 20000 + i * 15000)); continue; }
      await telegram(`⚠️ Bevestiging aan ${naam} kon niet verstuurd worden (Trengo ${r.status}, ticket ${ticketId}) — even handmatig bevestigen: ${tekst}`);
      return false;
    } catch { await new Promise((x) => setTimeout(x, 15000)); }
  }
  await telegram(`⚠️ Bevestiging aan ${naam} bleef op rate-limits stuklopen (ticket ${ticketId}) — even handmatig bevestigen: ${tekst}`);
  return false;
}

async function ticketBerichten(ticketId) {
  // 429's niet stil laten wegvallen (miste Eric's antwoord op 06-08): even wachten
  // en opnieuw; blijft het mislukken dan zichtbaar loggen.
  for (let poging = 0; poging < 3; poging++) {
    const r = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages?per_page=15`, { headers: TH });
    if (r.status === 429) { await new Promise((x) => setTimeout(x, 15000)); continue; }
    if (!r.ok) { console.log(`ticket ${ticketId}: HTTP ${r.status}`); return []; }
    return ((await r.json())?.data || []);
  }
  console.log(`ticket ${ticketId}: blijft 429 — volgende ronde opnieuw`);
  return [];
}

async function zoekWaTicketOpNummer(telefoon) {
  const kaal = String(telefoon || '').replace(/\D/g, '').slice(-9);
  if (kaal.length !== 9) return null;
  const r = await fetch(`https://app.trengo.com/api/v2/tickets?term=${kaal}`, { headers: TH });
  if (!r.ok) return null;
  const hit = ((await r.json())?.data || []).find((t) => t.channel?.type === 'WA_BUSINESS');
  return hit?.id || null;
}

async function main() {
  const state = (() => { try { return JSON.parse(fs.readFileSync(STATE_PLANNER, 'utf8')); } catch { return {}; } })();
  const gemeld = (() => { try { return JSON.parse(fs.readFileSync(GEMELD, 'utf8')); } catch { return {}; } })();
  const tickets = state.aanbodTickets || {};
  const tokensBijStart = new Set(Object.keys(tickets));
  const tokens = Object.keys(tickets);
  if (!tokens.length) { console.log('geen verstuurde aanbiedingen om te volgen'); return; }

  // aanbod-status erbij (open/gekozen/verwerkt/verlopen) voor context in de melding
  const statusPer = {};
  // Eén verzoek voor alle LOPENDE aanbiedingen (open + gekozen). Hiervoor werden vier
  // aparte lijsten opgehaald, elk met de volledige historie erachter — dat was een van
  // de grootverbruikers achter de Upstash-limietstoring van 08-08. Een token dat hier
  // niet in staat is klaar (verwerkt/verlopen) en hoeft niet gevolgd te worden.
  try {
    const r = await fetch('https://sonty-website.vercel.app/api/inmeet-aanbod?actief=1', { headers: { 'x-meet-code': MEET_CODE } });
    for (const a of (await r.json())?.aanbiedingen || []) statusPer[a.token] = a.status;
  } catch { /* status is context, geen blokkade */ }

  let meldingen = 0;
  for (const token of tokens) {
    const info = tickets[token];
    // ouder dan 14 dagen: niet meer volgen (en opruimen)
    if (Date.now() - Date.parse(info.verstuurdOp) > 14 * 86400000) { delete tickets[token]; continue; }
    const teVolgen = new Set([info.waTicket, info.mailTicket].filter(Boolean));
    if (info.telefoon) {
      const extra = await zoekWaTicketOpNummer(info.telefoon).catch(() => null);
      if (extra) teVolgen.add(extra);
    }
    for (const ticketId of teVolgen) {
      const rows = await ticketBerichten(ticketId);
      for (const m of rows) {
        const inbound = String(m.type || '').toUpperCase() === 'INBOUND' || m.direction === 'incoming';
        if (!inbound) continue;
        const wanneer = Date.parse(String(m.created_at || '').replace(' ', 'T'));
        if (!(wanneer > Date.parse(info.verstuurdOp))) continue;
        const sleutel = ticketId + ':' + m.id;
        const alGemeld = !!gemeld[sleutel];
        // Een keuze-poging mag NOOIT eenmalig zijn (incident Rene 07-08: de eerste
        // poging faalde op een netwerkfout en de dedup blokkeerde elke herkansing —
        // klant zei "Is goed" en er gebeurde niets). Zolang het aanbod open staat
        // proberen we een herkenbare keuze elke run opnieuw; alleen de
        // Telegram-MELDING blijft eenmalig.
        if (alGemeld && statusPer[token] !== 'open') continue;
        if (!alGemeld) { gemeld[sleutel] = new Date().toISOString(); meldingen++; }
        const tekst = String(m.body_plain || m.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);

        // WhatsApp-keuze automatisch doorvoeren (alleen op een nog OPEN aanbod)
        if (statusPer[token] === 'open') {
          try {
            const rA = await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${token}`, { headers: { 'x-meet-code': MEET_CODE } });
            const aanbod = rA.ok ? await rA.json() : null;
            const keuze = aanbod ? leesKeuze(tekst, aanbod.slots || []) : null;
            if (keuze !== null && aanbod.slots?.[keuze]) {
              const rK = await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${token}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
                body: JSON.stringify({ status: 'gekozen', gekozenIndex: keuze }),
              });
              if (rK.ok) {
                // GEEN bevestiging hier — die stuurt de verwerker pas NA een
                // geslaagde boeking (Daimy 08-08: "pas een bericht als het echt
                // ingeboekt is"; Hendrik-Jan kreeg 07-08 een bevestiging terwijl
                // de boeking daarna afketste). Verwerker direct wakker maken zodat
                // de klant binnen een minuut zijn bevestiging krijgt.
                try { require('child_process').execFile('launchctl', ['kickstart', 'gui/501/nl.sonty.inmeet-verwerker']); } catch { /* volgende 5-min-run pakt hem */ }
                await telegram(`✅ ${info.naam} koos via WhatsApp optie ${keuze + 1} ("${tekst.slice(0, 40)}") — wordt nu geboekt; de klant krijgt de bevestiging zodra de boeking helemaal rond is.`);
                statusPer[token] = 'gekozen';
                continue;
              }
            }
          } catch { /* uitlezen mislukt: dan gewoon rapporteren */ }
        }
        if (!alGemeld) await telegram(`💬 REACTIE op keuzelink van ${info.naam} (aanbod: ${statusPer[token] || 'onbekend'}, ticket ${ticketId}):\n\n"${tekst || '(leeg/bijlage)'}"`);
      }
    }
  }
  // opgeschoonde tokens + dedup bewaren
  const vers = (() => { try { return JSON.parse(fs.readFileSync(STATE_PLANNER, 'utf8')); } catch { return {}; } })();
  // ALLEEN de eigen opruiming (>14 dagen) toepassen — nooit de hele lijst
  // terugschrijven. Op 06-08 wiste de oude write-back concurrent gezette velden
  // (waTicket/email door planner of handmatig herstel) met een verouderde kopie.
  vers.aanbodTickets = vers.aanbodTickets || {};
  for (const tok of tokensBijStart) {
    if (!(tok in tickets)) delete vers.aanbodTickets[tok];
  }
  fs.writeFileSync(STATE_PLANNER, JSON.stringify(vers, null, 2));
  for (const [k, v] of Object.entries(gemeld)) if (Date.now() - Date.parse(v) > 30 * 86400000) delete gemeld[k];
  fs.writeFileSync(GEMELD, JSON.stringify(gemeld, null, 1));
  console.log(`${tokens.length} aanbod(en) gevolgd, ${meldingen} nieuwe reactie(s) gemeld`);
}

module.exports = { bevestigingsTekst, leesKeuze };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
