// SUNNY PLANT ZELF (Daimy 28-08, /goal): "zodra iemand op Inmeten inplannen komt moet
// Sunny zelf op een menselijke manier de beste tijd aanbieden en inboeken, zoals nu met
// het inmeet-dashboard is gedaan. Er mogen geen dubbele mails en dubbele berichten komen."
//
// Dit bestand is de BESLISLAAG + de TEKST van Sunny's eerste voorstel. Het verzenden zelf
// blijft de bewezen route (cron-inmeten-planner maakEnVerstuurAanbod → lib/aanbod-versturen
// → lib/verzend-poort → aanbodTickets). Alles hier is puur (geen netwerk), zodat het
// scenario-lab er honderden gevallen doorheen kan jagen.
//
// Orakel (docs/sunny-inmeet-plannen-ontwerp.md):
//   O1  één voorstel per klant per dag, tenzij de klant zelf om een ander moment vroeg
//   O2  één open voorstel per klant over alle routes
//   O5  WA-gesprek < 24u → vrij Sunny-bericht; WA > 24u → template; geen WA → mail
//   O6  mens-actief / stil-lijst / weeklimiet: niets sturen, reden zichtbaar
//   O7  verzendvenster 08:30–20:00 NL-tijd, ma–za; daarbuiten wachten, niet vergeten
//   O8  Engels-vlag → alles Engels
//   O9  geen telefoon én geen e-mail → mens nodig, zichtbaar
//   O10 al geboekt → geen voorstel
//   O14 lopend keuzelink-aanbod → Sunny doet niets tot dat is afgehandeld
//   O16 alles wat NIET verstuurd wordt is zichtbaar (reden op de kaart)
const fs = require('fs');
const path = require('path');

const VLAG = path.join(__dirname, '..', 'ai-ks', '.sunny-start-live');
const HEARTBEAT = path.join(__dirname, '..', '..', 'data', 'sunny-heartbeat.txt');
const VENSTER = { startMin: 8 * 60 + 30, eindMin: 20 * 60 }; // 08:30–20:00 NL-tijd
const DAG_MS = 24 * 3600000;

/** Aan-knop: env SUNNY_START=0/1 (tests) wint van het vlagbestand scripts/ai-ks/.sunny-start-live. */
function aan() {
  if (process.env.SUNNY_START === '1') return true;
  if (process.env.SUNNY_START === '0') return false;
  try { return fs.existsSync(VLAG); } catch { return false; }
}

/** Weekdag (0=zo) en minuten-sinds-middernacht in Europe/Amsterdam. */
function nlDelen(nu = Date.now()) {
  const d = new Date(nu);
  const delen = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const get = (t) => (delen.find((p) => p.type === t) || {}).value;
  const dagen = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const uur = Number(get('hour')) % 24;
  return { dag: dagen[get('weekday')] ?? 0, minuten: uur * 60 + Number(get('minute')) };
}

/** O7: alleen ma–za 08:30–20:00 NL-tijd. */
function binnenVenster(nu = Date.now()) {
  const { dag, minuten } = nlDelen(nu);
  return dag >= 1 && dag <= 6 && minuten >= VENSTER.startMin && minuten < VENSTER.eindMin;
}

/** Wanneer gaat het venster weer open (voor de reden op de kaart)? */
function volgendeVensterTekst(nu = Date.now()) {
  const { dag, minuten } = nlDelen(nu);
  if (dag >= 1 && dag <= 6 && minuten < VENSTER.startMin) return 'vandaag 08:30';
  if (dag === 6 || dag === 0) return 'maandag 08:30';
  return 'morgen 08:30';
}

const tel9 = (t) => String(t || '').replace(/\D/g, '').slice(-9);
const mailNorm = (m) => String(m || '').trim().toLowerCase();

/** Laatste voorstel (verstuurdOp) aan deze klant uit de aanbodTickets-administratie,
 *  op rpItemId (nieuwe entries) óf telefoon/e-mail (oude entries). Herhalingen tellen
 *  ook: een herinnering is geen nieuw voorstel, maar wél een bericht — O1 gaat over
 *  berichten die de klant als "nog een voorstel" ervaart. */
function aantalEerdereVoorstellen(state, lead) {
  let n = 0;
  for (const a of Object.values(state?.aanbodTickets || {})) {
    const zelfde = (lead?.rpItemId && a.rpItemId && String(a.rpItemId) === String(lead.rpItemId))
      || (tel9(lead?.telefoon).length === 9 && tel9(a.telefoon) === tel9(lead?.telefoon))
      || (!!mailNorm(lead?.email) && mailNorm(a.email) === mailNorm(lead?.email));
    if (zelfde && a.verstuurdOp && !a.herhaling) n++;
  }
  return n;
}

function laatsteVoorstelOp(state, lead) {
  let laatste = 0;
  for (const a of Object.values(state?.aanbodTickets || {})) {
    const zelfde = (lead?.rpItemId && a.rpItemId && String(a.rpItemId) === String(lead.rpItemId))
      || (tel9(lead?.telefoon).length === 9 && tel9(a.telefoon) === tel9(lead?.telefoon))
      || (!!mailNorm(lead?.email) && mailNorm(a.email) === mailNorm(lead?.email));
    if (!zelfde) continue;
    const t = Date.parse(a.verstuurdOp || '');
    if (t > laatste) laatste = t;
  }
  return laatste || null;
}

/**
 * Mag Sunny NU een eerste voorstel sturen aan deze lead? Puur, geen netwerk.
 * Stil-lijst, mens-actief en de weeklimiet zitten in de verzendpoort (lib/verzend-poort.js)
 * en worden dáár getoetst; hier alleen wat de planner zelf al weet.
 * @returns {{ok:boolean, reden:string, mensNodig?:boolean, wachtTot?:string}}
 */
function magStarten({ nu = Date.now(), lead = {}, slots = [], lopend = false, geboekt = false, state = {}, vlagAan = aan(), opVerzoek = false, maxEerder = 2 } = {}) {
  if (!vlagAan) return { ok: false, reden: 'sunny-start staat uit' };
  if (geboekt) return { ok: false, reden: 'al geboekt' };
  if (lopend) return { ok: false, reden: 'lopend aanbod (keuzelink of eerder voorstel) — wachten tot dat is afgehandeld' };
  if (!lead.telefoon && !lead.email) return { ok: false, reden: 'geen telefoon en geen e-mail — mens nodig', mensNodig: true };
  if (!Array.isArray(slots) || !slots.length) return { ok: false, reden: 'geen tijd binnen de horizon — planner meldt dit apart' };
  // O1-bis (Scholten-les 28-08: 3 voorstellen, 7 dagen stil): wie al maxEerder automatische
  // voorstellen kreeg en nog steeds niet geboekt is, krijgt geen vierde bot-bericht maar een
  // mens. Weeklimieten resetten; dit niet — tenzij de klant zélf om een nieuw moment vraagt.
  const eerder = aantalEerdereVoorstellen(state, lead);
  if (!opVerzoek && eerder >= maxEerder) return { ok: false, reden: `al ${eerder} voorstellen gestuurd zonder boeking — mens nodig (bellen)`, mensNodig: true };
  const vorige = laatsteVoorstelOp(state, lead);
  if (!opVerzoek && vorige && nu - vorige < DAG_MS) {
    const uren = Math.max(1, Math.round((DAG_MS - (nu - vorige)) / 3600000));
    return { ok: false, reden: `al een voorstel gestuurd <24u geleden — volgende op zijn vroegst over ${uren} u` };
  }
  if (!binnenVenster(nu)) return { ok: false, reden: `buiten verzendvenster (ma–za 08:30–20:00) — gaat ${volgendeVensterTekst(nu)}`, wachtTot: volgendeVensterTekst(nu) };
  return { ok: true, reden: 'ok' };
}

// ── Sunny's tekst ─────────────────────────────────────────────────────────────
const DAG_NL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const DAG_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MND_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const MND_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function slotZin(slot, taal = 'nl') {
  const d = new Date(slot.aankomst);
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[g('weekday')] || 0;
  const dag = Number(g('day')); const mnd = Number(g('month')) - 1;
  const tijd = `${String(Number(g('hour')) % 24).padStart(2, '0')}:${g('minute')}`;
  return taal === 'en'
    ? `${DAG_EN[wd]} ${dag} ${MND_EN[mnd]} around ${tijd}`
    : `${DAG_NL[wd]} ${dag} ${MND_NL[mnd]} rond ${tijd}`;
}

function wekenWeg(slots, nu = Date.now()) {
  const eerste = slots?.[0]?.aankomst ? Date.parse(slots[0].aankomst) : 0;
  return eerste ? (eerste - nu) / (7 * DAG_MS) : 0;
}

/**
 * Sunny's eerste voorstel: één beste tijd, menselijk, met de aankomstmarge (harde regel
 * Daimy 11-08) en de wens-vraag (V8, 23-08) in hetzelfde bericht. Bij ≥3 weken geen
 * "goed nieuws" maar eerlijk over de drukte (Rita-les 09-08). Ondertekend als Sunny
 * (BOT_PATRONEN in verzend-poort kent deze handtekening, anders telt hij als mens-actief).
 */
function voorstelTekst({ voornaam = 'daar', slots = [], duurMin = 30, ver = false, taal = 'nl', nu = Date.now() } = {}) {
  const lijst = (slots || []).filter((s) => s && s.aankomst).slice(0, 3);
  const inmeter = lijst[0]?.inmeter || (taal === 'en' ? 'our surveyor' : 'onze inmeter');
  const druk = wekenWeg(lijst, nu) >= 3;
  if (taal === 'en') {
    const when = lijst.map((s) => slotZin(s, 'en')).join(' or ');
    const open = druk
      ? `Hi ${voornaam}, I'd love to get the measuring scheduled for you. It's extra busy at the moment (summer holidays and the construction break), so this is the first moment I can offer`
      : `Hi ${voornaam}, good news: I can schedule the measuring for you`;
    const ver_ = ver ? ' We plan our measuring routes as efficiently as possible and combine jobs in your area: that saves unnecessary kilometres, emissions and fuel, but it can mean it takes a little longer before we get to you.' : '';
    const marge = ' As we drive a route that day it can be up to an hour earlier or later; we\'ll let you know if so.';
    const vraag = lijst.length === 1
      ? ' Does that work for you? Just reply "yes" and I\'ll lock it in. If not, let me know from when it suits you (or which days/parts of the day), and I\'ll have another look.'
      : ' Which one suits you best? Just reply with the day and I\'ll lock it in. None of them work? Let me know from when it suits you and I\'ll have another look.';
    return `${open}: ${inmeter} can come by ${when} to measure, which takes about ${duurMin} minutes.${ver_}${marge}${vraag}\n\nKind regards, Sunny from Sonty`;
  }
  const wanneer = lijst.map((s) => slotZin(s, 'nl')).join(' of ');
  const open = druk
    ? `Hoi ${voornaam}, ik plan het inmeten graag voor je in. Het is op dit moment extra druk (bouwvak en vakanties), dus dit is het eerste moment dat ik je kan aanbieden`
    : `Hoi ${voornaam}, goed nieuws: ik kan het inmeten voor je inplannen`;
  const ver_ = ver ? ' We plannen onze inmeetroutes zo efficiënt mogelijk en combineren klussen bij jou in de buurt: dat scheelt onnodige kilometers, uitstoot en brandstof, maar daardoor kan het soms iets langer duren voor we bij je zijn.' : '';
  const marge = ' Omdat we die dag een route rijden kan het een uurtje eerder of later worden, dat laten we je dan even weten.';
  const vraag = lijst.length === 1
    ? ' Past dat? Antwoord dan gewoon "ja", dan zet ik hem voor je vast. Komt het niet uit, laat dan even weten vanaf wanneer het jou wél uitkomt (of welke dagen/dagdelen), dan kijk ik verder.'
    : ' Welke past jou het beste? Antwoord gewoon met de dag, dan zet ik hem voor je vast. Past geen van beide, laat dan even weten vanaf wanneer het jou wél uitkomt, dan kijk ik verder.';
  return `${open}: ${inmeter} kan ${wanneer} bij je langskomen om in te meten, dat duurt ongeveer ${duurMin} minuten.${ver_}${marge}${vraag}\n\nGroetjes, Sunny van Sonty`;
}

/** Mailversie (HTML) van hetzelfde voorstel; de knop is een gemak, "ja" terugmailen werkt ook. */
function voorstelMailHtml({ voornaam = 'daar', slots = [], duurMin = 30, ver = false, taal = 'nl', url = '', geldigUren = 24, nu = Date.now() } = {}) {
  const plat = voorstelTekst({ voornaam, slots, duurMin, ver, taal, nu })
    .replace(/\n\n(Groetjes, Sunny van Sonty|Kind regards, Sunny from Sonty)$/, '');
  const alinea = plat.split(/(?<=[.!?])\s+(?=[A-Z"])/).map((z) => `<p>${z}</p>`).join('\n');
  const knop = url
    ? `<p><a href="${url}" style="display:inline-block;background:#F97316;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">${taal === 'en' ? 'Yes, that works' : 'Ja, dit past'}</a></p>`
    : '';
  const vast = taal === 'en'
    ? `<p>The time is held for you for ${geldigUren} hours.</p>`
    : `<p>De tijd staat ${geldigUren} uur voor je vast.</p>`;
  const groet = taal === 'en' ? '<p>Kind regards,<br>Sunny from Sonty</p>' : '<p>Groetjes,<br>Sunny van Sonty</p>';
  return `${alinea}\n${knop}\n${vast}\n${groet}`;
}

// ── Sunny leeft? (aanbod-replies laat Sunny's eigen voorstellen aan Sunny zolang hij draait)
function schrijfHeartbeat() {
  try { fs.mkdirSync(path.dirname(HEARTBEAT), { recursive: true }); fs.writeFileSync(HEARTBEAT, new Date().toISOString()); } catch { /* best effort */ }
}
function sunnyLeeft(maxMin = 10, nu = Date.now()) {
  try { return nu - fs.statSync(HEARTBEAT).mtimeMs < maxMin * 60000; } catch { return false; }
}

/**
 * Wie handelt een klantreactie op een voorstel af? Puur, voor lab én productie.
 * Regel (O2): precies één eigenaar. Sunny is eigenaar van zijn eigen voorstellen zolang
 * hij leeft; is hij weg (heartbeat ouder dan maxMin) dan neemt de klassieke reply-route
 * het over — stilte is erger dan een minder persoonlijk antwoord.
 * @returns {'sunny'|'reply-route'}
 */
function eigenaarVanReactie({ bron, geclaimd = false, leeft = sunnyLeeft(), plannenAan = true, ouderdomMin = 0, maxWachtMin = 20, kaleKeuze = false } = {}) {
  if (geclaimd) return 'sunny';
  // een kale keuze ("ja", "dat past") op een open voorstel zet de bewezen boekroute vast —
  // direct, zonder op Sunny te wachten (Sunny blijft daar zelf ook van af: blijfWeg 'keuze')
  if (kaleKeuze) return 'reply-route';
  // Sunny's eigen voorstel: alles wat geen kale keuze is, is van Sunny — maar hooguit
  // maxWachtMin lang; reageert hij niet (buiten zijn venster, storing), dan neemt de
  // reply-route het over. Stilte is erger dan een minder persoonlijk antwoord.
  if (plannenAan && bron === 'sunny' && leeft && ouderdomMin < maxWachtMin) return 'sunny';
  return 'reply-route';
}

/** Proefstand: vlagbestand met inhoud "alleen:<naam>" beperkt Sunny tot één klant (eerst 1, dan de rest). */
function alleenNaam() {
  try {
    const m = fs.readFileSync(VLAG, 'utf8').match(/alleen:\s*(.+)/i);
    return m ? m[1].trim().toLowerCase() : null;
  } catch { return null; }
}

/** Ticket als actief Sunny-gesprek registreren (data/ai-ks/actieve-tickets.json), zodat de
 *  actief-sweep het antwoord van de klant ook buiten de kandidaat-lijst ziet. */
function registreerActiefTicket(ticketId, klant) {
  const bestand = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'actieve-tickets.json');
  let lijst = {};
  try { lijst = JSON.parse(fs.readFileSync(bestand, 'utf8')); } catch { lijst = {}; }
  if (!lijst[ticketId]) {
    lijst[ticketId] = { sinds: new Date().toISOString(), klant: klant || null, bron: 'sunny-voorstel inmeten' };
    fs.mkdirSync(path.dirname(bestand), { recursive: true });
    fs.writeFileSync(bestand, JSON.stringify(lijst, null, 1));
  }
}

module.exports = { aan, alleenNaam, registreerActiefTicket, binnenVenster, volgendeVensterTekst, magStarten, laatsteVoorstelOp, aantalEerdereVoorstellen, voorstelTekst, voorstelMailHtml, slotZin, schrijfHeartbeat, sunnyLeeft, eigenaarVanReactie, VLAG, HEARTBEAT, VENSTER };
