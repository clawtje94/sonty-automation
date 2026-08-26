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
const { planningTelegram } = require('./lib/telegram-planning.js');
const MEET_CODE = process.env.MEETBON_CODE || '2288';

async function telegram(tekst) {
  await planningTelegram(tekst.slice(0, 3900));
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
    // ook Engels (Fatih 21-08: Engelstalige klanten antwoorden "that works"/"yes")
    const twijfel = /ander(e)? (moment|tijd|dag|datum)|past (mij |ons )?niet|kan (dan |echt )?niet|lukt (dan |echt )?niet|liever|helaas|verzetten|verplaatsen|annuleer|another (moment|time|day|date|slot)|different (day|time|date)|doesn'?t (work|suit)|does not (work|suit)|can'?t (make|do)|cannot (make|do)|rather|prefer|cancel|reschedule|not possible|unfortunately/i;
    if (twijfel.test(t)) return null;
    // "oke doe dan maar dinsdag" op een donderdag-aanbod is GEEN akkoord op donderdag
    // (Daimy's test 26-08: de verwerker boekte de verkeerde dag). Noemt het bericht
    // een weekdag die niet bij dit ene slot past, dan is dit geen keuze voor dit slot.
    const EN_DAGEN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const slotDag = new Date(slots[0].aankomst).getDay();
    for (let d2 = 0; d2 < 7; d2++) {
      if (d2 === slotDag) continue;
      if (new RegExp(`\\b(${DAGEN[d2]}|${DAGK[d2]}|${EN_DAGEN[d2]})\\b`, 'i').test(t)) return null;
    }
    // ONVREDE WINT ALTIJD (Daimy 09-08, geval Rita van Schagen). Zij schreef:
    // "Ja doe dat maar. Maar ik had het wel op prijs gesteld dat je dit eerlijk zou
    // zeggen. Sorry maar van 3 naar 6 weken vind ik wel veel." Dat werd als een
    // gewoon akkoord geboekt, inclusief opgewekte bevestiging — terwijl daar een
    // mens had moeten meelezen. Een klant die instemt én klaagt is GEEN kale keuze:
    // melden, niet automatisch afhandelen.
    const onvrede = /vind ik (wel |het )?(veel|lang|vervelend|jammer)|niet blij|teleurgesteld|balen|sorry maar|had ik (wel )?(anders|eerlijk)|op prijs gesteld|klopt niet|beloofd|toegezegd|(is|dat is)( wel| erg| best)? (lang|veel)|te lang|niet netjes|slecht|\bmaar dat is\b|\bmaar wel\b|too long|disappoint|not happy|unacceptable|promised|\bbut that'?s\b/i;
    if (onvrede.test(t)) return null;
    // kale bevestiging (knop of kort berichtje)
    if (/^(dat past|past\b.{0,10}|prima|is goed|akkoord|top|ja|jazeker|oke|oké|ok|👍|yes|yes please|yep|that works|works for me|that'?s fine|sounds good|sure|perfect|great|fine|okay|deal|confirmed?)[!. ]*$/.test(t)
      && !/niet|geen|ander|not\b|no\b|another/.test(t)) return 0;
    // ACCEPTATIE MET EXTRA TEKST (audit 07-08, geval Marjolein: keuze bleef liggen
    // en niemand boekte): een zin die met een duidelijke bevestiging begint telt,
    // ook als er daarna nog een vraag of groet volgt. De twijfel-check hierboven
    // heeft dan al gedraaid.
    const eersteZinnen = t.split(/[.!?\n]/).slice(0, 2).map((z) => z.trim());
    // "dat is" alléén met een positief vervolg (Charles 14-08: "Dat is zaak omdraaien.
    // Ik verwacht morgen antwoord" werd als akkoord gelezen en GEBOEKT terwijl hij
    // midden in een discussie met Daimy zat). "Dat is" op zichzelf zegt niets.
    if (eersteZinnen.some((z) => /^(hi+|hoi|hey|hallo|hello|goedemorgen|goedemiddag|goedenavond|good (morning|afternoon|evening))?[,! ]*(dat (is (goed|prima|top|akkoord|helemaal goed|ok[eé]?)|past)|past (goed|prima)|prima|is goed|helemaal goed|akkoord|top|ja( hoor| graag| leuk)?|jazeker|oke|oké|ok|perfect|super|yes( please)?|yep|that works|works for me|that'?s (fine|great|perfect|ok)|sounds good|sure|great|okay|confirmed?)\b/.test(z))) return 0;
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

// "Ik kom er vandaag nog op terug" om 21:33 's avonds is een belofte die je breekt
// (Debby 12-08). Buiten kantoortijd beloven we morgen.
function wanneerTerug() {
  const uur = Number(new Date().toLocaleString('nl-NL', { hour: 'numeric', hour12: false, timeZone: 'Europe/Amsterdam' }));
  return (uur >= 18 || uur < 8) ? 'morgenochtend' : 'vandaag nog';
}

function bevestigingsTekst(slot, taal = 'nl') {
  const d = new Date(slot.aankomst);
  if (taal === 'en') {
    // Engelstalige klant (Fatih 21-08 kreeg zijn boekingsbevestiging in het Nederlands)
    const dagEn = d.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
    const vanEn = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    const vVan = new Date(+d - 60 * 60000).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    const vTot = new Date(+d + 90 * 60000).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    const wieEn = slot.inmeter ? `our surveyor ${slot.inmeter}` : 'our surveyor';
    return `All set, it's booked! On ${dagEn} ${wieEn} will come by to measure. We expect to be with you around ${vanEn}. As we drive a route that day it can shift a little, so please be home between ${vVan} and ${vTot}. Something come up? Just send us a message. Kind regards, Nanny from Sonty`;
  }
  const dag = d.toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
  const van = d.toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const tot = new Date(+d + 30 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  // Naam alleen noemen als hij er echt is: op 06-08 stond er "onze inmeter undefined"
  // in een klantbericht omdat de publieke API de naam stripte.
  const wie = slot.inmeter ? `onze inmeter ${slot.inmeter}` : 'onze inmeter';
  // THUISBLIJF-VENSTER (Daimy 18-08: "het gaat er juist om dat mensen thuis zijn
  // als we komen" — geen belofte meer dat wij het laten weten; boeking 09:00-09:30
  // betekent gewoon thuis zijn van 08:00 tot 10:30, een uur voor tot een uur na).
  const vensterVan = new Date(+d - 60 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const vensterTot = new Date(+d + 90 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  return `Helemaal goed, hij staat! ${dag.charAt(0).toUpperCase() + dag.slice(1)} komt ${wie} bij je langs om in te meten. We verwachten rond ${van} bij je te zijn. Omdat we die dag een route rijden kan het iets schuiven, dus fijn als je tussen ${vensterVan} en ${vensterTot} thuis bent. Komt er iets tussen? Stuur gerust een berichtje. Groetjes, Nanny van Sonty`;
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

/** Klant meteen laten weten dat zijn bericht is aangekomen. Stilte na een reactie is
 *  het enige echt foute antwoord; dit koopt de tijd om het goed af te handelen. */
// MAX 1 ONTVANGSTBEVESTIGING PER GESPREK PER 2 UUR (Jan van Wageningen 15-08: drie
// berichten in 8 minuten = twee identieke "ik zoek het even uit"-teksten, over twee
// monitor-rondes heen). De cooldown leeft in de gedeelde gemeld-state.
function magBevestigen(gemeld, ticketId) {
  const k = 'bevestigd:' + ticketId;
  const laatst = Date.parse(gemeld[k] || 0);
  if (Date.now() - laatst < 2 * 3600000) return false;
  gemeld[k] = new Date().toISOString();
  return true;
}

/** Taal van de klant (Daimy 21-08, Fatih): Engelstalig = Engelse planningsteksten. */
function taalVoor(info) {
  try { return require('./lib/aanbod-versturen.js').taalVan({ telefoon: info?.telefoon, email: info?.email }); } catch { return 'nl'; }
}
const T = (taal, nl, en) => (taal === 'en' ? en : nl);
const GROET_NL = 'Groetjes, Nanny van Sonty';
const GROET_EN = 'Kind regards, Nanny from Sonty';

/** Afsluiter/bevestiging zonder vraag ("👍", "dank je", "top, tot dan") hoeft geen antwoord. */
function isAfsluiter(tekst) {
  const t = String(tekst || '');
  if (/\?/.test(t)) return false;
  const kaal = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F3FB}-\u{1F3FF}]/gu, ' ').toLowerCase().replace(/[^a-zà-ü]+/g, ' ').trim();
  if (!kaal) return true; // alleen emoji
  const W = new Set(['dank', 'dankje', 'dankjewel', 'danku', 'dankuwel', 'bedankt', 'thanks', 'thank', 'you', 'thnx', 'top', 'prima', 'oke', 'oké', 'ok', 'okay', 'is', 'goed', 'dat', 'past', 'helemaal', 'hoor', 'ja', 'graag', 'fijn', 'fijne', 'avond', 'dag', 'weekend', 'tot', 'dan', 'ziens', 'snel', 'ook', 'je', 'jij', 'u', 'jullie', 'wel', 'hetzelfde', 'insgelijks', 'gelijk', 'doei', 'doeg', 'groetjes', 'groeten', 'super', 'perfect', 'duidelijk', 'begrepen', 'komt', 'voor', 'elkaar', 'we', 'zien', 'het', 'de', 'een', 'zo', 'yes', 'yep', 'works', 'me', 'that', 'for', 'it', 'sounds', 'nakijken', 'reactie', 'bericht', 'info', 'informatie', 'moeite', 'uitleg', 'hulp', 'even', 'heel', 'erg', 'alvast', 'in', 'ieder', 'geval', 'great', 'perfect', 'fine', 'good', 'see', 'then', 'bye', 'cheers']);
  return kaal.split(/\s+/).every((w) => W.has(w));
}

const ACK_GESTUURD = new Set(); // tickets die deze procesrun een ontvangstbericht kregen
async function bevestigOntvangst(ticketId, naam, tekst, taal = 'nl') {
  const ok = await bevestigOntvangstRuw(ticketId, naam, tekst, taal);
  if (ok) ACK_GESTUURD.add(ticketId);
  return ok;
}
async function bevestigOntvangstRuw(ticketId, naam, tekst, taal = 'nl') {
  // Verzendpoort (18-08): geen automatische ontvangstbevestiging als een mens in
  // het gesprek zit of de klant op stil staat — precies het Hans-incident.
  try {
    const { magSturen } = require('./lib/verzend-poort.js');
    const poort = await magSturen({ telefoon: null, ticketId, soort: 'ontvangst' });
    if (!poort.ok) { console.log(`  verzendpoort: ontvangstbevestiging ${naam} NIET verstuurd (${poort.reden})`); return false; }
  } catch { /* poort-fout mag de bestaande flow niet breken */ }
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages`, {
      method: 'POST', headers: { ...TH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `${tekst}\n\n${taal === 'en' ? GROET_EN : GROET_NL}`, type: 'OUTBOUND' }),
    });
    if (r.ok) return true;
    if (r.status === 429) { await new Promise((x) => setTimeout(x, 15000)); continue; }
    break;
  }
  await telegram(`⚠️ Ontvangstbevestiging aan ${naam} kon niet verstuurd worden (ticket ${ticketId}) — even handmatig laten weten dat we ermee bezig zijn.`);
  return false;
}

/** Bij een samenvoeging verdwijnt het oude ticket-id (Trengo geeft dan 404) en volgde
 *  de monitor een dood spoor: Katuscha's "Dat past!!!!!" werd zo gemist omdat haar
 *  ticket net in het bestaande gesprek was gemerged (10-08). Opnieuw opzoeken op het
 *  telefoonnummer en de state bijwerken, dan loopt het gewoon door. */
async function vervangDoodTicket(token, info) {
  if (!info?.telefoon) return null;
  try {
    const { zoekWaTicketBreed } = require('./lib/aanbod-versturen.js');
    const nieuwId = await zoekWaTicketBreed(info.telefoon, { ookGesloten: true });
    if (!nieuwId) return null;
    const st = (() => { try { return JSON.parse(fs.readFileSync(STATE_PLANNER, 'utf8')); } catch { return {}; } })();
    if (st.aanbodTickets?.[token]) {
      st.aanbodTickets[token].waTicket = nieuwId;
      fs.writeFileSync(STATE_PLANNER, JSON.stringify(st, null, 2));
    }
    console.log(`  ticket van ${info.naam} was samengevoegd → nu ${nieuwId}`);
    return nieuwId;
  } catch { return null; }
}

async function ticketBerichten(ticketId) {
  // 429's niet stil laten wegvallen (miste Eric's antwoord op 06-08 en Hans' "ja"
  // op 17/18-08): oplopend wachten (15/30/60s) en tussen tickets sowieso even
  // ademen zodat we de limiet niet zelf blijven raken.
  await new Promise((x) => setTimeout(x, 1200));
  for (let poging = 0; poging < 4; poging++) {
    const r = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages?per_page=15`, { headers: TH });
    if (r.status === 429) { await new Promise((x) => setTimeout(x, 15000 * Math.pow(2, poging))); continue; }
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
  ACK_GESTUURD.clear(); // per run (cron start altijd vers; lab draait main() vaker)
  const state = (() => { try { return JSON.parse(fs.readFileSync(STATE_PLANNER, 'utf8')); } catch { return {}; } })();
  const gemeld = (() => { try { return JSON.parse(fs.readFileSync(GEMELD, 'utf8')); } catch { return {}; } })();
  const tickets = state.aanbodTickets || {};
  const tokensBijStart = new Set(Object.keys(tickets));
  // ALLEEN LOPENDE AANBIEDINGEN VOLGEN. De monitor liep over alle 38 bewaarde tokens
  // en haalde voor elk de berichten op — dat gaf structureel rate-limits bij Trengo,
  // waardoor verse antwoorden (Natalie's "Ja is goed") pas veel later werden gezien.
  // Verwerkte en verlopen aanbiedingen hoeven niet gevolgd te worden.
  let tokens = Object.keys(tickets);
  if (!tokens.length) { console.log('geen verstuurde aanbiedingen om te volgen'); return; }

  // aanbod-status erbij (open/gekozen/verwerkt/verlopen) voor context in de melding
  const statusPer = {};
  // Eén verzoek voor alle LOPENDE aanbiedingen (open + gekozen). Hiervoor werden vier
  // aparte lijsten opgehaald, elk met de volledige historie erachter — dat was een van
  // de grootverbruikers achter de Upstash-limietstoring van 08-08. Een token dat hier
  // niet in staat is klaar (verwerkt/verlopen) en hoeft niet gevolgd te worden.
  // rpItemId komt ALLEEN uit de lijst-route; de detail-route stript hem (publieke
  // pagina hoort geen RP-id te zien). Zonder dat id kon de reply-monitor geen nieuw
  // aanbod aanvragen — Rick kreeg wel "ik zoek een moment" en daarna niets.
  const rpItemPer = {};
  try {
    const r = await fetch('https://sonty-website.vercel.app/api/inmeet-aanbod?actief=1', { headers: { 'x-meet-code': MEET_CODE } });
    for (const a of (await r.json())?.aanbiedingen || []) {
      statusPer[a.token] = a.status;
      if (a.lead?.rpItemId) rpItemPer[a.token] = a.lead.rpItemId;
    }
  } catch { /* status is context, geen blokkade */ }
  // VANGNET (Fatih 21-08 10:13: zijn "Yes" kwam binnen terwijl de actief-lijst even niet
  // te lezen was → status "onbekend" → keuze niet doorgevoerd én als gemeld afgevinkt,
  // dus nooit meer geprobeerd). Lijst leeg terwijl we wél tokens volgen? Dan per token
  // de status ophalen; blijft ook dát onbekend, dan markeren we niets als afgehandeld.
  if (!Object.keys(statusPer).length && tokens.length) {
    for (const tok of tokens.slice(0, 40)) {
      try {
        const rT = await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${tok}`, { headers: { 'x-meet-code': MEET_CODE } });
        if (rT.ok) { const a = await rT.json(); statusPer[tok] = a.status; if (a.lead?.rpItemId) rpItemPer[tok] = a.lead.rpItemId; }
      } catch { /* volgende */ }
      await new Promise((x) => setTimeout(x, 300));
    }
  }
  const statusOnbekend = !Object.keys(statusPer).length;
  // Volgen: alles wat nog loopt, PLUS alles wat de afgelopen vier dagen is verstuurd —
  // ook als het al geboekt is. Connie Biermann schreef twee keer ná haar bevestiging dat
  // die dag niet kon (10-08) en kreeg niets terug, omdat een geboekt aanbod niet meer
  // gevolgd werd. Juist dán moet je luisteren: een afspraak die de klant intrekt is
  // erger dan een aanbod dat blijft liggen.
  const VERS_MS = 4 * 86400000;
  const teVolgen = tokens.filter((t) => statusPer[t] === 'open' || statusPer[t] === 'gekozen'
    || (Date.now() - Date.parse(tickets[t].verstuurdOp || 0) < VERS_MS));
  if (teVolgen.length) tokens = teVolgen;
  console.log(`${tokens.length} aanbod(en) om te volgen (van ${Object.keys(tickets).length} bewaarde)`);

  let meldingen = 0;
  // wat deze run al een bericht/actie kreeg (keuze doorgevoerd, ack gestuurd, nieuw
  // voorstel aangevraagd) hoeft de wachthond niet ook nog te "redden"
  const afgehandeldDezeRun = new Set();
  for (const token of tokens) {
    const info = tickets[token];
    // STIL-LIJST (Daimy 13-08, Charles Gevers): staat een nummer hierop, dan doet de
    // monitor NIETS meer in dat gesprek — geen keuzes doorvoeren, geen bevestigingen,
    // geen meldingen. Het gesprek is van een mens (Daimy praat er zelf), en de bot die
    // op een antwoord-aan-Daimy reageert maakt het alleen maar verwarrend.
    try {
      const stil = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'monitor-stil.json'), 'utf8'));
      const t9 = String(info.telefoon || '').replace(/\D/g, '').slice(-9);
      if (t9 && stil[t9]) continue;
    } catch { /* geen stil-lijst */ }
    // ouder dan 14 dagen: niet meer volgen (en opruimen)
    if (Date.now() - Date.parse(info.verstuurdOp) > 14 * 86400000) { delete tickets[token]; continue; }
    const teVolgen = new Set([info.waTicket, info.mailTicket].filter(Boolean));
    // De nummer-zoektocht was een Trengo-search PER KLANT PER RONDE en de grootste
    // 429-bron (1170x "blijft 429"; Debby's avond-ja lag daardoor 14 uur). Eén keer
    // zoeken en het resultaat in de state bewaren is genoeg: een samengevoegd ticket
    // verandert daarna niet meer.
    if (info.telefoon && info.extraTicket === undefined) {
      info.extraTicket = await zoekWaTicketOpNummer(info.telefoon).catch(() => null);
    }
    if (info.extraTicket) teVolgen.add(info.extraTicket);
    for (let ticketId of teVolgen) {
      let rows = await ticketBerichten(ticketId);
      if (!rows.length) {
        const vervanger = await vervangDoodTicket(token, info);
        if (vervanger && vervanger !== ticketId) { ticketId = vervanger; rows = await ticketBerichten(ticketId); }
      }
      // MENSEN SCHRIJVEN IN LOSSE STUKJES (Taico 10-08): eerst de knop "Ander moment",
      // drie minuten later de uitleg "wij kunnen pas vanaf 24 augustus". Wie elk bericht
      // los behandelt, handelt de knop af zonder de uitleg en stuurt twee antwoorden.
      // Daarom per bericht ook de rest van zijn reeks meegeven: alle klantberichten
      // zonder tussenliggend antwoord van ons vormen SAMEN de boodschap.
      const isIn = (x) => String(x.type || '').toUpperCase() === 'INBOUND' || x.direction === 'incoming';
      const reeksVan = (msg) => {
        const idx = rows.indexOf(msg);
        const reeks = [msg];
        for (let k = idx + 1; k < rows.length && isIn(rows[k]); k++) reeks.push(rows[k]);
        for (let k = idx - 1; k >= 0 && isIn(rows[k]); k--) reeks.unshift(rows[k]);
        return reeks;
      };
      for (const m of rows) {
        const inbound = isIn(m);
        if (!inbound) continue;
        const wanneer = Date.parse(String(m.created_at || '').replace(' ', 'T'));
        if (!(wanneer > Date.parse(info.verstuurdOp))) continue;
        // alleen het LAATSTE bericht van een reeks afhandelen; de eerdere stukjes gaan
        // als context mee. Zo gaat er per reeks precies één antwoord uit.
        const reeks = reeksVan(m);
        if (reeks[reeks.length - 1] !== m && isIn(reeks[reeks.length - 1])) {
          const laatsteT = Date.parse(String(reeks[reeks.length - 1].created_at || '').replace(' ', 'T'));
          if (laatsteT > Date.parse(info.verstuurdOp)) continue;
        }
        const sleutel = ticketId + ':' + m.id;
        const alGemeld = !!gemeld[sleutel];
        // Een keuze-poging mag NOOIT eenmalig zijn (incident Rene 07-08: de eerste
        // poging faalde op een netwerkfout en de dedup blokkeerde elke herkansing —
        // klant zei "Is goed" en er gebeurde niets). Zolang het aanbod open staat
        // proberen we een herkenbare keuze elke run opnieuw; alleen de
        // Telegram-MELDING blijft eenmalig.
        if (alGemeld && statusPer[token] !== 'open') continue;
        // status van het register onbekend (storing)? Dan NIET als gemeld afvinken: de
        // keuze moet de volgende ronde alsnog doorgevoerd kunnen worden.
        if (!alGemeld && !statusOnbekend) { gemeld[sleutel] = new Date().toISOString(); meldingen++; }
        else if (!alGemeld) {
          // REGISTER ONBEREIKBAAR terwijl er een verse reactie ligt (lab 21-08): niet stil
          // wachten — alarm (de filter ontdubbelt per 6 uur), zodat iemand het ziet als de
          // storing aanhoudt en "Dat past" van een klant blijft liggen.
          console.log(`  ${info.naam}: reactie gezien maar register onbekend — volgende ronde opnieuw`);
          const oudU = (Date.now() - wanneer) / 3600000;
          if (oudU >= 1) await telegram(`🚨 Aanbod-register onbereikbaar terwijl ${info.naam} al ${Math.floor(oudU)} uur geleden reageerde ("${String(m.body_plain || m.message || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 80)}") — keuze kan niet verwerkt worden; actie nodig als dit aanhoudt (ticket ${ticketId}).`);
          continue;
        }
        const tekst = String(m.body_plain || m.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
        // TAALREGEL (Daimy 13-08): schrijft de klant Engels, registreer dat — de planner
        // plant Engelstaligen dan automatisch bij Sjoerd (Joeys Engels is niet goed genoeg).
        try {
          const { lijktEngels, zetEngels, isEngels } = require('./lib/taal-voorkeur.js');
          if (lijktEngels(tekst) && !isEngels(info.telefoon)) {
            zetEngels(info.telefoon, 'reply-monitor ticket ' + ticketId);
            console.log(`  🇬🇧 ${info.naam} als Engelstalig geregistreerd (geen melding — Daimy 13-08)`);
          }
        } catch { /* taaldetectie is extra */ }
        const reeksTekst = reeks
          .map((x) => String(x.body_plain || x.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
          .filter(Boolean).join('\n').slice(0, 800);

        // Fase 3 (26-08): heeft Sunny dit gesprek geclaimd (hij overlegt zelf over
        // tijden en boekt), dan blijft deze route er HELEMAAL vanaf — ook van de
        // keuze-uitlezing. Daimy's test: zijn "oke doe dan maar dinsdag" (antwoord
        // op Sunny's tijden) werd hier als keuze op het oude aanbod gelezen en hij
        // werd op de verkeerde donderdag geboekt. Niet markeren: claim verlopen
        // zonder resultaat = volgende run pakt het gewoon op.
        if (require('./lib/gesprek-claims.js').geclaimd(ticketId, 30)) continue;
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
                afgehandeldDezeRun.add(ticketId);
                continue;
              }
            }
          } catch { /* uitlezen mislukt: dan gewoon rapporteren */ }
        }
        // GEEN KALE KEUZE? Dan alsnog echt afhandelen (Daimy 10-08: "ik blijf mensen
        // hebben die geen antwoord krijgen"). Tot nu toe bleef het bij een melding en
        // wachtte de klant tot iemand toevallig keek. Rick schreef "woensdag en
        // donderdag zijn wel opties" en hoorde niets meer.
        // Melden en AFHANDELEN zijn twee dingen. Een reactie die ooit gemeld is maar
        // nooit is afgehandeld, bleef anders voor eeuwig liggen (Rick van Nieuwkerk:
        // zijn bericht was gemeld, maar niemand deed er iets mee). Zolang het aanbod
        // openstaat pakken we hem alsnog op; de eigen vlag voorkomt dubbel werk.
        const afgehandeldSleutel = 'afgehandeld:' + sleutel;
        if (statusPer[token] === 'open' && !gemeld[afgehandeldSleutel] && tekst) {
          gemeld[afgehandeldSleutel] = new Date().toISOString();
          try {
            const { leesReactie } = require('./lib/planning-antwoord.js');
            const rA = await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${token}`, { headers: { 'x-meet-code': MEET_CODE } });
            const aanbod = rA.ok ? await rA.json() : null;
            const duiding = await leesReactie(reeksTekst || tekst, aanbod?.slots || []);
            console.log(`  ${info.naam}: intent ${duiding.intent}${duiding.dagen.length ? ' (dagen ' + duiding.dagen.join(',') + ')' : ''}`);

            // SUNNY PLANT (26-08): staat de planning-knop aan, dan voert Sunny het
            // gesprek over tijden. Deze route stuurt dan geen eigen bericht en geen
            // eigen nieuw voorstel, ook niet als de duiding hier 'ander-moment' zegt.
            // Anders hoort de klant twee botten door elkaar: Theo Hoffman antwoordde
            // 26-08 "Nee 1 okt is prima", Sunny boekte terecht, en deze route stuurde
            // in dezelfde minuut "ik kijk naar een ander moment voor je".
            const sunnyPlant = (() => {
              if (process.env.INMEET_PLANNEN_LIVE) return process.env.INMEET_PLANNEN_LIVE === '1';
              try { return fs.existsSync(path.join(__dirname, 'ai-ks', '.inmeet-plannen-live')); } catch { return false; }
            })();
            if (sunnyPlant && ['ander-moment', 'akkoord'].includes(duiding.intent)) {
              delete gemeld[afgehandeldSleutel];   // Sunny is aan zet; verloopt dat, dan pakt de volgende run het op
              console.log(`  ${info.naam}: ${duiding.intent} — Sunny doet de planning, deze route blijft eraf`);
              continue;
            }

            if (duiding.intent === 'ander-moment') {
              // PINGPONG-REM (Mandy 13-08: vier afwijzingen in 25 minuten, en het
              // systeem stuurde steeds een nieuw voorstel — zelfs 23 sep opnieuw nadat
              // ze die al had afgewezen, omdat nietDeze alleen het LAATSTE aanbod
              // uitsloot). Nu: alle ooit-afgewezen tijden stapelen per klant, en na
              // 2 automatische nieuwe voorstellen per dag stopt de machine en gaat
              // het naar een mens.
              const rpIdRem = rpItemPer[token] || aanbod?.lead?.rpItemId || info.telefoon;
              gemeld['afgewezen:' + rpIdRem] = [...new Set([...(gemeld['afgewezen:' + rpIdRem] || []), ...((aanbod?.slots || []).map((sl) => sl.aankomst))])];
              // Noemt de klant een hele dag waarop hij niet kan ("elke dag behalve 28 sept"),
              // dan sluiten we die dag helemaal uit. Anders boden we later diezelfde dag een
              // ander tijdstip aan, want de tijdstip-uitsluiting kende alleen het slot dat hij
              // net had afgewezen (het geval Theo Hoffman, 26-08).
              if ((duiding.nietDatums || []).length) {
                gemeld['nietdagen:' + rpIdRem] = [...new Set([...(gemeld['nietdagen:' + rpIdRem] || []), ...duiding.nietDatums])];
              }
              const rondeSleutel = 'replyrondes:' + rpIdRem + ':' + new Date().toISOString().slice(0, 10);
              gemeld[rondeSleutel] = (gemeld[rondeSleutel] || 0) + 1;
              if (gemeld[rondeSleutel] > 2) {
                await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${token}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
                  body: JSON.stringify({ status: 'verlopen', reden: 'klant wees meerdere voorstellen af, mens nodig' }),
                }).catch(() => {});
                { const taalS = taalVoor(info);
                if (magBevestigen(gemeld, ticketId)) await bevestigOntvangst(ticketId, info.naam, T(taalS, 'Dank je wel! Ik laat een collega even persoonlijk meekijken naar een moment dat echt goed past, je hoort snel van ons.', "Thank you! I'll have a colleague personally look for a moment that really suits you; you'll hear from us soon."), taalS); }
                await telegram(`📞 ${info.naam} heeft vandaag al ${gemeld[rondeSleutel] - 1}x een automatisch voorstel afgewezen (${duiding.samenvatting}) — ik stop met automatisch sturen, mens nodig / belscherm.`);
                continue;
              }
              // oude aanbod sluiten en meteen nieuwe tijden laten sturen, met zijn voorkeur
              await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${token}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
                body: JSON.stringify({ status: 'verlopen', reden: 'klant wilde een ander moment, nieuw voorstel gestuurd' }),
              }).catch(() => {});
              const rpId = rpItemPer[token] || aanbod?.lead?.rpItemId;
              if (!rpId) {
                await telegram(`⚠️ ${info.naam} wil een ander moment, maar ik kan zijn RP-lead niet vinden — nieuw aanbod handmatig sturen via het dashboard.`);
                continue;
              }
              afgehandeldDezeRun.add(ticketId);
              const r = await fetch('https://sonty-website.vercel.app/api/inmeet-mutatie', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
                body: JSON.stringify({
                  type: 'stuur-aanbod', rpItemId: rpItemPer[token] || aanbod?.lead?.rpItemId, naam: info.naam, bron: 'klant-reply',
                  voorkeurDagen: duiding.dagen, voorkeurDagdeel: duiding.dagdeel,
                  // wat de klant uitsloot en wat hij net afwees gaat mee: het nieuwe
                  // voorstel mag nooit hetzelfde zijn als wat hij afwees (Taico 10-08)
                  vanaf: duiding.vanaf || undefined,
                  nietDeze: gemeld['afgewezen:' + rpIdRem] || (aanbod?.slots || []).map((sl) => sl.aankomst),
                  nietDagen: gemeld['nietdagen:' + rpIdRem] || [],
                }),
              });
              { const taalA = taalVoor(info);
              if (magBevestigen(gemeld, ticketId)) await bevestigOntvangst(ticketId, info.naam, duiding.dagen.length
                ? T(taalA, 'Dank je wel! Ik zoek even een moment op de dagen die je noemt en stuur je zo een nieuw voorstel.', "Thank you! I'll look for a moment on the days you mention and send you a new proposal shortly.")
                : T(taalA, 'Dank je wel voor het laten weten! Ik zoek een ander moment voor je en stuur zo een nieuw voorstel.', "Thanks for letting me know! I'll look for another moment and send you a new proposal shortly."), taalA); }
              await telegram(`🔁 ${info.naam}: ${duiding.samenvatting}\nNieuw aanbod aangevraagd (${r.ok ? 'staat in de rij' : 'AANVRAAG MISLUKT — handmatig'}).`);
              statusPer[token] = 'verlopen';
              continue;
            }

            if (duiding.intent === 'klacht') {
              const taalK = taalVoor(info);
              if (magBevestigen(gemeld, ticketId)) await bevestigOntvangst(ticketId, info.naam, T(taalK,
                `Dank je voor je eerlijke bericht, dat snap ik goed. Ik leg het even voor aan een collega en je hoort ${wanneerTerug()} van ons.`,
                `Thank you for your honest message, I understand. I'm passing it on to a colleague and you'll hear from us ${wanneerTerug() === 'morgenochtend' ? 'tomorrow morning' : 'later today'}.`), taalK);
              await telegram(`🚨 KLACHT ${info.naam} (ticket ${ticketId}): ${duiding.samenvatting}\n\n"${tekst.slice(0, 200)}"\n\n`
                + (duiding.antwoordVoorstel ? `Concept-antwoord:\n${duiding.antwoordVoorstel}` : 'Geen concept-antwoord beschikbaar.')
                + '\n\nDe klant weet dat we ermee bezig zijn; het echte antwoord moet van een mens komen.');
              continue;
            }
            if (duiding.intent === 'annuleren') {
              // ANNULEREN OP EEN OPEN AANBOD viel tussen wal en schip (lab 21-08): alleen een
              // onderdrukte 💬-procesmelding. Nu: aanbod sluiten, klant bevestigen, alarm.
              await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${token}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
                body: JSON.stringify({ status: 'verlopen', reden: 'klant annuleert (reply-monitor)' }),
              }).catch(() => {});
              statusPer[token] = 'verlopen';
              const taalX = taalVoor(info);
              if (magBevestigen(gemeld, ticketId)) await bevestigOntvangst(ticketId, info.naam, T(taalX,
                'Dank je voor je bericht, wat jammer om te lezen! Ik geef het direct door aan een collega; die neemt het persoonlijk met je op.',
                "Thank you for your message, sorry to read that! I'm passing it straight on to a colleague, who will take it up with you personally."), taalX);
              await telegram(`🚨 ANNULERING/afzegging van ${info.naam} op een open inmeet-aanbod: ${duiding.samenvatting}\n\n"${tekst.slice(0, 200)}"\n\nAanbod is gesloten; mens nodig (ticket ${ticketId}).`);
              continue;
            }
            if (duiding.intent === 'akkoord') {
              // AKKOORD IN WOORDEN DIE DE REGEX NIET KENT ("Ja hoor, maandag is prima zo") op
              // een open aanbod met één tijd: gewoon doorvoeren — de klant zegt ja.
              if ((aanbod?.slots || []).length === 1) {
                const rK2 = await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${token}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
                  body: JSON.stringify({ status: 'gekozen', gekozenIndex: 0 }),
                }).catch(() => null);
                if (rK2?.ok) {
                  try { require('child_process').execFile('launchctl', ['kickstart', 'gui/501/nl.sonty.inmeet-verwerker']); } catch { /* volgende run */ }
                  await telegram(`✅ ${info.naam} ging akkoord (AI-duiding: "${tekst.slice(0, 40)}") — wordt nu geboekt; bevestiging volgt na de boeking.`);
                  statusPer[token] = 'gekozen';
                  afgehandeldDezeRun.add(ticketId);
                  continue;
                }
              }
              await telegram(`🚨 ${info.naam} lijkt akkoord te gaan ("${tekst.slice(0, 80)}") maar ik kon de keuze niet automatisch doorvoeren (meerdere tijden of register-fout) — actie nodig: handmatig boeken (ticket ${ticketId}).`);
              continue;
            }
            if (duiding.intent === 'vraag') {
              // VRAGEN ZIJN VAN SUNNY (Daimy 21-08, Fatih: "is it possible faster? how long
              // until delivery?" kreeg van de monitor "ik zoek het uit" en daarna niets,
              // want Sunny was geblokkeerd op het lopende aanbod). Nu: de klantenservice-bot
              // beantwoordt inhoudelijke vragen ook tijdens een aanbod (met de planning-
              // context erbij); de monitor zwijgt en zet alleen de stilte-wachthond: komt er
              // binnen 2 uur geen antwoord, dan alsnog een bericht + alarm (zie onder).
              console.log(`  ${info.naam}: vraag tijdens aanbod — Sunny antwoordt, wachthond aan`);
              gemeld['wachthond:' + ticketId + ':' + m.id] = new Date().toISOString();
              continue;
            }
          } catch (e) { console.log(`  reactie-afhandeling mislukt: ${e.message.slice(0, 80)}`); }
        }
        // BERICHT NA DE BOEKING. Het aanbod staat niet meer open, dus de afhandeling
        // hierboven slaat over — maar de klant mag nooit in stilte blijven staan. Zegt
        // hij iets anders dan "dank je", dan bevestigen we de ontvangst en gaat er een
        // duidelijke melding uit: hier staat een afspraak die misschien niet meer klopt.
        const naBoekingSleutel = 'naboeking:' + sleutel;
        if (statusPer[token] !== 'open' && !gemeld[naBoekingSleutel] && tekst) {
          gemeld[naBoekingSleutel] = new Date().toISOString();
          try {
            const { leesReactie } = require('./lib/planning-antwoord.js');
            const rB = await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${token}`, { headers: { 'x-meet-code': MEET_CODE } });
            const aanbodB = rB.ok ? await rB.json() : null;
            const duidingB = await leesReactie(reeksTekst || tekst, aanbodB?.slots || []);
            if (duidingB.intent === 'annuleren') {
              // ANNULERING NA BOEKING (Ana Franca 13-08: "ik zie af van de opdracht" kreeg
              // "ik zoek het even uit en kom er vandaag op terug" — en daarna gebeurde er
              // NIETS: de afspraak van 10 sep bleef gewoon in Planado en Outlook staan).
              // Dus: eerlijke reactie zonder loze belofte, alarm, en op de bewakingslijst
              // tot de afspraak aantoonbaar weg is (keten-zelfcontrole checkt Planado).
              { const taalAn = taalVoor(info);
              if (magBevestigen(gemeld, ticketId)) await bevestigOntvangst(ticketId, info.naam, T(taalAn,
                'Dank je voor je bericht, wat jammer om te lezen! Ik geef je annulering direct door aan onze planning. Zodra de afspraak is verwijderd krijg je daar nog een bevestiging van, dan hoef jij verder niets te doen.',
                "Thank you for your message, sorry to read that! I'm passing your cancellation straight on to our planning team. As soon as the appointment has been removed you'll receive a confirmation; you don't need to do anything else."), taalAn); }
              try {
                const AOPEN = '/Users/clawdboot/sonty/data/annuleringen-open.json';
                const ao = (() => { try { return JSON.parse(fs.readFileSync(AOPEN, 'utf8')); } catch { return {}; } })();
                ao[token] = { naam: info.naam, telefoon: info.telefoon || '', ticketId, gemeldOp: new Date().toISOString(), samenvatting: duidingB.samenvatting };
                fs.writeFileSync(AOPEN, JSON.stringify(ao, null, 1));
              } catch (e) { console.log(`  annulering-bewaking niet weggeschreven: ${e.message.slice(0, 80)}`); }
              // Naar Mens nodig: een annulering is altijd een mensen-moment (Daimy 15-08),
              // dus label + getagde notitie zodat het team het ziet, niet alleen Telegram.
              try {
                const { notitie } = require('./lib/trengo-notitie.js');
                await notitie(ticketId, `Klant annuleert na boeking: ${duidingB.samenvatting}. Afspraak moet uit Planado/Outlook (zelfcontrole bewaakt dit); klant krijgt daarna automatisch de bevestiging.`, { tag: true });
                await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/labels`, { method: 'POST', headers: { ...TH, 'Content-Type': 'application/json' }, body: JSON.stringify({ label_id: 1821764 }) });
              } catch (e) { console.log(`  mens-nodig-overdracht mislukt: ${e.message.slice(0, 80)}`); }
              await telegram(`🚨 ANNULERING van ${info.naam}: ${duidingB.samenvatting}\n\n"${tekst.slice(0, 200)}"\n\nDe geboekte afspraak staat NOG in Planado/Outlook — die moet eruit (en de klant krijgt daarna een bevestiging). De zelfcontrole blijft hierover piepen tot de afspraak weg is. Ticket ${ticketId}.`);
              meldingen++;
              continue;
            }
            if (duidingB.intent === 'ander-moment') {
              // Verzetten ná boeking blijft planner-terrein: bevestigen + alarm.
              { const taalV = taalVoor(info);
              if (magBevestigen(gemeld, ticketId)) await bevestigOntvangst(ticketId, info.naam, T(taalV,
                `Dank je wel voor het laten weten! Ik kijk meteen naar een ander moment voor je en kom er ${wanneerTerug()} op terug.`,
                `Thanks for letting me know! I'll look for another moment straight away and get back to you ${wanneerTerug() === 'morgenochtend' ? 'tomorrow morning' : 'later today'}.`), taalV); }
              await telegram(`🚨 ${info.naam} wil zijn GEBOEKTE afspraak verzetten (${duidingB.samenvatting}).\n\n"${tekst.slice(0, 200)}"\n\nDe afspraak staat nog vast — verzetten via dashboard of motor. Ticket ${ticketId}.`);
              meldingen++;
              continue;
            }
            if (duidingB.intent === 'akkoord' && statusPer[token] === 'verlopen' && (aanbodB?.slots || []).length === 1) {
              // JA NA HET VERLOPEN (Fatih 21-08: "Yes" 25 uur na het voorstel). De tijd is
              // misschien nog vrij: keuze alsnog doorzetten, de verwerker doet de
              // botsingscontrole en meldt het als het niet meer past.
              const rL = await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${token}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
                body: JSON.stringify({ status: 'gekozen', gekozenIndex: 0 }),
              }).catch(() => null);
              if (rL?.ok) {
                try { require('child_process').execFile('launchctl', ['kickstart', 'gui/501/nl.sonty.inmeet-verwerker']); } catch { /* volgende run */ }
                await telegram(`✅ ${info.naam} ging alsnog akkoord na het verlopen van het aanbod ("${tekst.slice(0, 40)}") — wordt nu geboekt als de tijd nog vrij is; anders volgt een melding.`);
                statusPer[token] = 'gekozen';
                afgehandeldDezeRun.add(ticketId);
                continue;
              }
              await telegram(`🚨 ${info.naam} zegt ja op een verlopen aanbod maar doorzetten lukte niet — actie nodig: handmatig boeken (ticket ${ticketId}).`);
              continue;
            }
            if (duidingB.intent !== 'akkoord') {
              // VRAGEN EN AL HET ANDERE NA BOEKING ZIJN VAN SUNNY (Daimy 18-08, Barbara
              // Galante: haar aanbetalingsvraag kreeg "ik zoek dit even goed uit" van de
              // monitor, waardoor Sunny — die het antwoord gewoon weet — nooit meer aan
              // de beurt kwam. De planner is na de boeking klaar; de monitor zwijgt hier
              // volledig zodat er nooit dubbele of lege berichten ontstaan).
              console.log(`  ${info.naam}: inhoudelijk bericht na boeking (${duidingB.intent}) — Sunny antwoordt, monitor zwijgt`);
              continue;
            }
          } catch (e) { console.log(`  na-boeking-check mislukt: ${e.message.slice(0, 80)}`); }
        }
        if (!alGemeld) await telegram(`💬 REACTIE op keuzelink van ${info.naam} (aanbod: ${statusPer[token] || 'onbekend'}, ticket ${ticketId}):\n\n"${tekst || '(leeg/bijlage)'}"`);
      }

      // STILTE-WACHTHOND (Daimy 21-08: "zorg dat dit nooit meer verkeerd kan gaan").
      // Ongeacht wie aan zet was (Sunny, monitor, planner, mens): staat het laatste
      // bericht van de klant al 2 uur onbeantwoord en is het geen afsluiter, dan krijgt
      // de klant alsnog een kort bericht (via de verzendpoort) en gaat er een alarm uit.
      // Eén keer per klantbericht. Alleen overdag (08-21), en niet ouder dan 3 dagen.
      try {
        // volgorde van de API niet vertrouwen: expliciet het NIEUWSTE klantbericht pakken
        const laatsteIn = rows.filter(isIn).sort((a, b) => Date.parse(String(b.created_at || '').replace(' ', 'T')) - Date.parse(String(a.created_at || '').replace(' ', 'T')))[0];
        const laatsteInT = laatsteIn ? Date.parse(String(laatsteIn.created_at || '').replace(' ', 'T')) : 0;
        const naLaatsteIn = rows.some((x) => !isIn(x) && String(x.type || '').toUpperCase() === 'OUTBOUND' && Date.parse(String(x.created_at || '').replace(' ', 'T')) > laatsteInT);
        const uurNu = Number(new Date().toLocaleString('nl-NL', { hour: 'numeric', hour12: false, timeZone: 'Europe/Amsterdam' }));
        const oudUur = (Date.now() - laatsteInT) / 3600000;
        const wSleutel = 'stil-gemeld:' + ticketId + ':' + (laatsteIn?.id || 0);
        const tekstIn = String(laatsteIn?.body_plain || laatsteIn?.message || '').replace(/<[^>]+>/g, ' ').trim();
        if (laatsteIn && laatsteInT > Date.parse(info.verstuurdOp) && !naLaatsteIn && oudUur >= 2 && oudUur < 72
            && uurNu >= 8 && uurNu < 21 && !gemeld[wSleutel] && !isAfsluiter(tekstIn)
            && !afgehandeldDezeRun.has(ticketId) && !ACK_GESTUURD.has(ticketId)) {
          gemeld[wSleutel] = new Date().toISOString();
          const taalW = taalVoor(info);
          const gestuurd = await bevestigOntvangst(ticketId, info.naam, T(taalW,
            'Sorry dat je nog niets van ons hoorde! Je bericht is binnen, een collega pakt het nu persoonlijk op en je hoort zo snel mogelijk van ons.',
            "Sorry you haven't heard from us yet! Your message has arrived, a colleague is picking it up personally now and you'll hear from us as soon as possible."), taalW);
          await telegram(`🚨 ${info.naam} wacht al ${Math.floor(oudUur)} uur op antwoord (ticket ${ticketId}): "${tekstIn.slice(0, 160)}" — actie nodig, mens moet dit beantwoorden.${gestuurd ? ' Klant heeft net een excuus/ontvangstbericht gekregen.' : ' (Geen automatisch bericht gestuurd: mens in gesprek of stil-lijst.)'}`);
          meldingen++;
        }
      } catch (e) { console.log(`  wachthond-fout ticket ${ticketId}: ${String(e.message).slice(0, 80)}`); }
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

module.exports = { bevestigingsTekst, leesKeuze, isAfsluiter, main };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
