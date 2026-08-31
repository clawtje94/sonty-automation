#!/usr/bin/env node
// AI-Klantenservice daemon — SCHADUWMODUS
// Pollt Trengo op nieuwe inkomende berichten (WA + Aanvragen/Klantenservice e-mail),
// laat de agent een concept-antwoord maken en plaatst dat als INTERNE NOTITIE bij het ticket.
// De klant ziet niets. Escalaties gaan óók naar Telegram.
//
// Draaien: node scripts/ai-ks/daemon.js            (één poll-ronde; zet in cron elke 5 min)
//          node scripts/ai-ks/daemon.js --ticket 963416960   (één specifiek ticket, voor test)
const fs = require('fs');
const { teamTags, OVERDRACHT_HERKENNING } = require(`./team-tags.js`);
const { terugkomMoment, bruikbareVoornaam } = require('./terugkom-moment.js');
const path = require('path');
const CFG = require('./config.js');
const { beantwoord } = require('./agent.js');

// Versturen gebeurt bij voorkeur vanuit het eigen Sonny-account (opdracht Daimy 2026-07-16:
// "vanuit Sonny antwoorden, niet meer vanuit mij"). Bestaat het Sonny-token nog niet, dan
// valt de daemon terug op het gedeelde token (Daimy Boot).
const SONNY_TOKEN_FILE = path.join(__dirname, '.trengo-sonny-token.txt');
let TT;
try { TT = fs.readFileSync(SONNY_TOKEN_FILE, 'utf8').trim(); console.log('Trengo: verstuurt als SONNY-account'); }
catch { TT = fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim(); }
const TH = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };

// LEZEN MOET NET ZO HARD DOORZETTEN ALS SCHRIJVEN (Daimy 16-08, geval Leo Prins).
// tPost had al een 429-retry, tGet niet: die gaf bij élke fout null terug. Eén rate limit
// van Trengo maakte het ticket dus onzichtbaar, waarna de offerte-levering concludeerde
// "geen leverpad" en de klant zijn link nooit kreeg (ticket 974394420 had gewoon het
// mailkanaal Aanvragen). 429 en 5xx zijn tijdelijk, dus opnieuw proberen; 401/404 niet.
async function tGet(ep) {
  for (let poging = 1; poging <= 3; poging++) {
    const res = await fetch('https://app.trengo.com/api/v2' + ep, { headers: TH });
    if (res.ok) return res.json();
    if (res.status === 429) { try { require('../lib/trengo-fetch.js').tel429('sunny-lezen'); } catch { /* teller is extra */ } }
    if (res.status !== 429 && res.status < 500) return null;
    if (poging < 3) {
      console.log(`  Trengo GET ${res.status} op ${ep}, nieuwe poging over ${poging * 20}s...`);
      await new Promise(r => setTimeout(r, poging * 20000));
    }
  }
  return null;
}
// De messages-endpoint van Trengo pagineert met 20 per pagina en geeft de nieuwste eerst.
// Zonder paginering zag de bot bij een lang gesprek dus maar 20 berichten, terwijl hij er 25
// wil gebruiken. Bij Sofyan (ticket 963170423, 38 berichten) viel daardoor de helft weg,
// inclusief zijn oorspronkelijke akkoord. Twee pagina's is genoeg voor de 25 die we snijden.
// (Daimy 2026-07-26)
async function haalBerichten(ticketId, paginas = 2) {
  const data = [];
  for (let p = 1; p <= paginas; p++) {
    const res = await tGet(`/tickets/${ticketId}/messages?page=${p}`);
    if (!res) break;
    data.push(...(res.data || []));
    if (!res.links?.next) break;
  }
  return { data };
}

async function tPost(ep, body) {
  // Trengo geeft af en toe 429 "Too Many Attempts" — zonder retry ging het antwoord dan
  // verloren (Pieter 20:15, Vruchi 19:20 op 16 juli). 429 = niets verzonden, dus veilig
  // om opnieuw te proberen: 3 pogingen met 20s/40s wachttijd.
  let laatste = { ok: false, status: 429, body: 'Too Many Attempts (na 3 pogingen)' };
  for (let poging = 1; poging <= 3; poging++) {
    const res = await fetch('https://app.trengo.com/api/v2' + ep, { method: 'POST', headers: TH, body: JSON.stringify(body) });
    laatste = { ok: res.ok, status: res.status, body: await res.text().catch(() => '') };
    if (res.status === 429) { try { require('../lib/trengo-fetch.js').tel429('sunny-sturen'); } catch { /* teller is extra */ } }
    if (res.status !== 429) return laatste;
    if (poging < 3) {
      console.log(`  Trengo 429, nieuwe poging over ${poging * 20}s...`);
      await new Promise(r => setTimeout(r, poging * 20000));
    }
  }
  return laatste;
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(CFG.POLL_STATE_FILE, 'utf8')); } catch { return { verwerkt: {} }; }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(CFG.POLL_STATE_FILE), { recursive: true });
  // Merge met disk: meerdere processen delen dit bestand (watcher, --ticket, batch).
  // Domweg overschrijven wiste elkaars markeringen → dubbel afscheid bij Nout (16 juli).
  try {
    const disk = JSON.parse(fs.readFileSync(CFG.POLL_STATE_FILE, 'utf8')).verwerkt || {};
    s.verwerkt = { ...disk, ...s.verwerkt };
  } catch {}
  fs.writeFileSync(CFG.POLL_STATE_FILE, JSON.stringify(s));
}
function log(entry) {
  fs.mkdirSync(path.dirname(CFG.LOG_FILE), { recursive: true });
  fs.appendFileSync(CFG.LOG_FILE, JSON.stringify({ tijd: new Date().toISOString(), ...entry }) + '\n');
}
async function telegram(text) {
  await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

const clean = b => (b || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function normPhone(p) {
  let d = (p || '').replace(/\D/g, '');
  if (d.startsWith('0031')) d = '31' + d.slice(4);
  if (d.startsWith('06') && d.length === 10) d = '31' + d.slice(1);
  if (d.startsWith('6') && d.length === 9) d = '31' + d;
  return d;
}

// Mag dit ticket een ÉCHT antwoord krijgen? Alleen als het contact-nummer exact op de
// whitelist staat. Dubbel gecheckt: hier én vlak voor verzending.
function isLiveTestContact(t) {
  const p = normPhone(t.contact?.phone);
  return !!p && CFG.TEST_LIVE_PHONES.includes(p);
}

async function sendLiveReply(t, tekst) {
  tekst = veiligeKlantTekst(tekst);
  // Verdedigingslaag 2: nooit versturen als het nummer niet op de whitelist staat.
  if (!isLiveTestContact(t)) throw new Error('sendLiveReply geblokkeerd: contact staat niet op de live-test whitelist');
  if (!tekst || !tekst.trim()) throw new Error('sendLiveReply geblokkeerd: leeg antwoord');
  return tPost(`/tickets/${t.id}/messages`, { message: tekst, type: 'OUTBOUND' });
}

function isWaTicket(t) {
  return t.channel?.id === CFG.WA_CHANNEL_ID || t.channel?.type === 'WA_BUSINESS';
}

// Interne notitie plaatsen. LET OP: POST /tickets/{id}/notes bestaat niet (405) en het
// messages-endpoint wil het veld "message" (niet "body") — ontdekt 16 juli: alle eerdere
// AI-notities faalden stil. Dit is de enige werkende vorm.
async function plaatsNotitie(ticketId, tekst) {
  return tPost(`/tickets/${ticketId}/messages`, { internal_note: true, message: tekst });
}

// Trengo-labels die de bot automatisch zet zodat het team in één oogopslag ziet wat de bedoeling
// is (Daimy 17 juli). IDs uit /labels. AI_BOT = bot handelt het af; MENS_NODIG = overdracht, een
// mens moet iets doen; de stap-labels markeren wat er concreet is gebeurd.
const LABEL = { AI_BOT: 1821763, MENS_NODIG: 1821764, OPMETING: 1815410, OFFERTE_VERSTUURD: 1815411, SHOWROOM: 1816444 };
async function zetLabel(ticketId, labelId) {
  // Zelfde 429-geduld als tPost. Zonder retry viel het Mens nodig-label stilletjes weg
  // tijdens een rate-limit-storm (Liz van Driel 10-08: notitie geplaatst, label en
  // team-toewijzing mislukt, dus niemand zag de overdracht).
  try {
    for (let poging = 1; poging <= 3; poging++) {
      const res = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/labels`, { method: 'POST', headers: TH, body: JSON.stringify({ label_id: labelId }) });
      if (res.status !== 429) return res.ok;
      if (poging < 3) await new Promise(r => setTimeout(r, poging * 20000));
    }
    return false;
  } catch { return false; }
}
async function haalLabelWeg(ticketId, labelId) {
  try { await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/labels/${labelId}`, { method: 'DELETE', headers: TH }); } catch {}
}

// Een geplaatst bericht/notitie verwijderen. Werkende route (getest 17 juli):
// DELETE /tickets/{id}/messages/{msgId}. Gebruikt om een achterhaalde escalatie-comment
// (met collega-tags) weg te halen zodra de AI de klant tóch zelf heeft geholpen.
async function verwijderNotitie(ticketId, messageId) {
  try {
    const res = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages/${messageId}`, { method: 'DELETE', headers: TH });
    return res.ok;
  } catch { return false; }
}

// Mention-tag voor een Trengo-gebruiker: "@{voornaam}{user_id}" (zo werkte @daimy736327).
// Naam wordt éénmalig via de API opgehaald en gecachet; fallback = Daimy.
const userTagCache = { 736327: '@daimy736327', 745487: '@jorren745487', 748440: '@tanya748440', 745486: '@joey745486', 736329: '@nanny736329', 745488: '@jaimy745488', 745489: '@sjoerd745489', 747786: '@daimy736327' /* bot tagt nooit zichzelf */ };
async function tagVoor(userId) {
  if (!userId) return '@daimy736327';
  if (userTagCache[userId]) return userTagCache[userId];
  try {
    const u = await tGet(`/users/${userId}`);
    const naam = (u?.data?.first_name || u?.first_name || '').toLowerCase().replace(/[^a-z]/g, '');
    userTagCache[userId] = naam ? `@${naam}${userId}` : '@daimy736327';
  } catch { userTagCache[userId] = '@daimy736327'; }
  return userTagCache[userId];
}

function isRelevantTicket(t) {
  if (isWaTicket(t)) return true;
  return CFG.EMAIL_CHANNEL_NAMES.includes(t.channel?.title);
}

// ---- SONNY: buiten openingstijden live voor ALLE WhatsApp-klanten (config.SONNY) ----
function loadSonnyState() {
  try { return JSON.parse(fs.readFileSync(CFG.SONNY.STATE_FILE, 'utf8')); } catch { return { introTickets: {}, dagTeller: {}, lastRapport: null }; }
}
function saveSonnyState(s) {
  fs.mkdirSync(path.dirname(CFG.SONNY.STATE_FILE), { recursive: true });
  fs.writeFileSync(CFG.SONNY.STATE_FILE, JSON.stringify(s));
}
function sonnyActiefNu() {
  return CFG.SONNY.enabled && CFG.isBuitenOpeningstijden();
}
// ---- ACTIEVE GESPREKKEN: echte klanttickets die de AI beheert (opdracht Daimy 2026-07-16:
// open tickets afhandelen en daarna alleen déze gesprekken blijven beantwoorden, als Jaimy,
// zonder Sonny-intro). Nieuwe tickets blijven voor het team tot Sonny's avonddienst aan staat.
const ACTIEF_FILE = path.join(path.dirname(CFG.POLL_STATE_FILE), 'actieve-tickets.json');
function loadActief() { try { return JSON.parse(fs.readFileSync(ACTIEF_FILE, 'utf8')); } catch { return {}; } }
function isActiefTicket(t) { return !!loadActief()[t.id]; }
async function sendActiefReply(t, tekst) {
  tekst = veiligeKlantTekst(tekst);
  if (buitenVerzendvenster(t)) throw new Error(`sendActiefReply geblokkeerd: buiten verzendvenster ${CFG.BOT_UREN.start}-${CFG.BOT_UREN.eind} (nu ${CFG.amsterdamNu().hhmm})`);
  if (!isActiefTicket(t)) throw new Error('sendActiefReply geblokkeerd: ticket staat niet in actieve-tickets.json');
  if (!isWaTicket(t)) throw new Error('sendActiefReply geblokkeerd: geen WhatsApp-ticket');
  if (!tekst || !tekst.trim()) throw new Error('sendActiefReply geblokkeerd: leeg antwoord');
  return tPost(`/tickets/${t.id}/messages`, { message: tekst, type: 'OUTBOUND' });
}

// NACHTMODUS (Daimy 2026-07-16 avond): tot het tijdstip in .nieuwe-tickets-tot mag de AI
// ook NIEUWE WhatsApp-tickets helpen (zelfde regels: Jaimy, geen intro). Elk opgepakt
// ticket wordt actief geregistreerd zodat vervolgvragen ook ná het venster beantwoord worden.
function nieuweTicketsToegestaan() {
  // Vast dagritme (Daimy 2026-07-17): elke dag 08:00-21:00 pakt de bot nieuwe gesprekken op.
  if (CFG.binnenBotUren()) return true;
  // Daarnaast nog een handmatig verlengingsvenster mogelijk (.nieuwe-tickets-tot) voor uitzonderingen.
  try {
    const tot = fs.readFileSync(path.join(__dirname, '.nieuwe-tickets-tot'), 'utf8').trim();
    return new Date() < new Date(tot);
  } catch { return false; }
}

// Credits op terwijl een klant op antwoord wacht = klantenservice staat stil → luid alarm.
// Dedupe 1x/uur via hetzelfde state-bestand als de 2-uurlijkse watchdog (check-anthropic-credits.js).
const CREDITS_STATE = path.join(path.dirname(CFG.SONNY.STATE_FILE), 'credits-state.json');
async function alertCreditsOp() {
  let s;
  try { s = JSON.parse(fs.readFileSync(CREDITS_STATE, 'utf8')); } catch { s = { status: 'ok', laatsteAlert: 0 }; }
  if (Date.now() - (s.laatsteAlert || 0) < 3600000) return;
  await telegram('🚨🚨 ANTHROPIC CREDITS OP, er wacht NU een klant op antwoord en de AI-klantenservice staat stil!\n\nBijladen: console.anthropic.com/settings/billing → Buy credits.');
  fs.writeFileSync(CREDITS_STATE, JSON.stringify({ status: 'op', laatsteAlert: Date.now() }));
}

// @sonny-notities in een gesprek zijn óók leerpunten voor de kennisbank (werkwijze Daimy
// 2026-07-16: "ik ga in de gesprekken @sonny zetten met op- en aanmerkingen die in de
// kennisbank verwerkt moeten worden"). Elke nieuwe @sonny-notitie gaat naar leerpunten.md
// (per direct in de prompt) + bevestiging op Telegram. Dedupe via notitie-leerpunten.json.
const NOTITIE_STATE = path.join(path.dirname(CFG.LOG_FILE), 'notitie-leerpunten.json');
// Verwerkt @sonny-notities. Drie soorten: STOP (gesprek uit AI-beheer), OPDRACHT ("vraag/zeg/
// stuur ... " → de bot moet NU iets doen in dit gesprek; wordt als lijst teruggegeven zodat
// verwerkTicket hem uitvoert) en LEERPUNT (al het andere → vaste kennis).
async function verwerkSonnyNotities(t, teamNotities) {
  const instructies = [];
  // Eigen notities van de bot (auteur 747786) en ✅-terugkoppelingen NOOIT opnieuw verwerken —
  // dat gaf 16 juli ~23:58 een zelf-loop (bot verwerkte zijn eigen ✅ als nieuwe opdracht).
  // Commando = een notitie die "@sonny" bevat (MET of ZONDER het user-id, want de Trengo
  // mention-picker voegt "@sonny747786" toe — dat is juist de correcte manier van taggen; het
  // eerdere (?!\d)-filter negeerde daardoor Daimy's echte notities, ticket 966969445 17 juli).
  // Anti-loop komt van: ✅ uitsluiten + de teamNotities-filter die alle eigen bot-notities
  // (Uitgevoerde acties / ✅ Verwerkt / AI-KS / schaduwmodus) er al uit haalt.
  const sonnyNotes = teamNotities.filter(n => /@s[ou]nny/i.test(n.tekst) && !n.tekst.includes('✅'));
  if (!sonnyNotes.length) return instructies;
  let st;
  try { st = JSON.parse(fs.readFileSync(NOTITIE_STATE, 'utf8')); } catch { st = {}; }
  let nieuw = false;
  for (const n of sonnyNotes) {
    const key = `${t.id}:${n.tijd}`;
    if (st[key]) continue;
    const punt = n.tekst.replace(/@s[ou]nny(747786)?[,:]?\s*/i, '').trim();
    const wie = t.contact?.full_name || t.contact?.phone || t.id;
    // STOPCOMMANDO: "@sonny stop" / "niet verder (gaan) met dit gesprek" / "neem over" →
    // gesprek uit de actieve lijst halen; de AI antwoordt daar dan niet meer. Geen leerpunt.
    // Let op: géén los "stop" matchen — "stopcontact"/"stop contact" in een gewone notitie
    // is geen stopcommando (ging 16 juli mis bij Hany's kabel-notitie).
    if (/\b(niet verder|stop met dit gesprek|stop ermee|stoppen met dit gesprek|neem (het |dit )?over|pauzeer|laat dit gesprek)\b/i.test(punt)) {
      const actief = loadActief();
      if (actief[t.id]) {
        delete actief[t.id];
        fs.writeFileSync(ACTIEF_FILE, JSON.stringify(actief, null, 1));
      }
      // Telegram-melding alleen bij Daimy's eigen stopcommando (Daimy 20 juli: collega-gebruik
      // hoeft niet op Telegram zolang het goed werkt). De ✅-notitie op het ticket komt er altijd.
      if (Number(n.userId) === 736327) await telegram(`🛑 Gesprek ${wie} (ticket ${t.id}) is op jouw @sonny-notitie UIT het AI-beheer gehaald. De bot antwoordt daar niet meer; het team neemt het over.`);
      // Altijd als opmerking terug reageren en de tagger terugtaggen (werkwijze Daimy)
      await plaatsNotitie(t.id, `${await tagVoor(n.userId)} ✅ Verwerkt: dit gesprek is uit AI-beheer gehaald. De bot antwoordt hier niet meer, het team neemt het over.`);
      st[key] = new Date().toISOString();
      nieuw = true;
      continue;
    }
    // FEEDBACK/OPDRACHT (al het andere): de bot beoordeelt ZELF of het lopende gesprek ook nog
    // een bericht aan de klant vraagt en voert opdrachten uit (werkwijze Daimy 2026-07-16).
    // VASTE KENNIS wordt het alleen als de notitie van DAIMY komt (Daimy 20 juli: "collega's
    // gaan ook @sonny gebruiken — wel uitvoeren wat ze vragen, maar niet standaard in de
    // kennis zetten"). Een collega-notitie is dus een eenmalige opdracht voor dít gesprek.
    if (punt) {
      if (Number(n.userId) === 736327) {
        fs.appendFileSync(path.join(path.dirname(CFG.LOG_FILE), 'leerpunten.md'),
          `- (${new Date().toISOString().slice(0, 10)}) [team-notitie bij gesprek ${wie}] ${punt}\n`);
        await telegram(`🎓 @sonny-notitie verwerkt als leerpunt (gesprek ${wie}):\n"${punt.substring(0, 300)}"\n\nDe bot beoordeelt nu zelf of dit gesprek ook nog een bericht nodig heeft.`);
      }
      instructies.push({ key, punt, userId: n.userId }); // caller: beoordeling + ✅-notitie
    }
    st[key] = new Date().toISOString();
    nieuw = true;
  }
  if (nieuw) fs.writeFileSync(NOTITIE_STATE, JSON.stringify(st, null, 1));
  return instructies;
}

// Markeer een notitie als verwerkt (na succesvolle uitvoering van een opdracht)
function markeerNotitie(key) {
  let st;
  try { st = JSON.parse(fs.readFileSync(NOTITIE_STATE, 'utf8')); } catch { st = {}; }
  st[key] = new Date().toISOString();
  fs.writeFileSync(NOTITIE_STATE, JSON.stringify(st, null, 1));
}

// Haalt meta-redenering en interne kopjes uit een klantbericht zodat er NOOIT iets naar de klant
// gaat dat niet voor de klant bedoeld is (Déborah 17 juli). Verwijdert een "Bericht aan (de) klant:"-
// kop (houdt alleen wat erna komt) en leidende "— ik ..."/"- ik ..."-redeneerregels.
function schoonKlantTekst(tekst) {
  let s = String(tekst || '');
  const kop = s.match(/(?:^|\n)\s*Bericht(?:\s+aan\s+(?:de\s+)?klant)?\s*:\s*\n?([\s\S]*)$/i);
  if (kop) s = kop[1];
  // leidende meta-regels (bot vertelt wat hij gaat doen) weghalen
  s = s.replace(/^(?:\s*[—–-]\s*(?:ik|eerst|dan|hier)\b[^\n]*\n+)+/i, '');
  return s.trim();
}

// MARKDOWN ERUIT (Daimy 2026-07-26). WhatsApp kent geen **vet** en geen ## koppen, dus die
// tekens komen letterlijk bij de klant aan. Bij Dorianna (ticket 968488354, offerte €5.342)
// stond er "**2. Type geleider.**" in het bericht. WhatsApp gebruikt *enkele* sterretjes voor
// vet, dus **tekst** wordt *tekst*; koppen en kale sterretjes gaan er helemaal uit.
function stripMarkdown(s) {
  return String(s || '')
    .replace(/\*\*\*(.+?)\*\*\*/gs, '*$1*')   // ***vet cursief*** → *vet*
    .replace(/\*\*(.+?)\*\*/gs, '*$1*')       // **vet** → *vet* (WhatsApp-vet)
    .replace(/^#{1,6}\s+/gm, '')              // ## kop → kop
    .replace(/^\s*\*\*\s*$/gm, '')            // losse sterretjes op een eigen regel
    .replace(/__(.+?)__/gs, '$1');            // __onderstreept__ bestaat niet in WhatsApp
}

// Laatste verdedigingslinie: elke uitgaande klanttekst gaat hier eerst doorheen.
function veiligeKlantTekst(tekst) {
  const s = schoonKlantTekst(tekst);
  return stripMarkdown(s);
}

// HARDE VERZENDPOORT (Daimy 2026-07-26: "altijd binnen de aangegeven tijden"). Laatste
// verdedigingslaag vóór élk klantbericht: buiten de bot-uren gaat er niets naar een klant.
// De marge van 15 min is er alleen zodat een agent-run die net vóór 21:00 begon zijn antwoord
// nog kwijt kan; iets wat daarna nog wil versturen (zoals het 00:22-bericht op ticket 968921413)
// wordt hier geweigerd. Testnummers van het team mogen altijd door.
const VENSTER_MARGE_MIN = 15;
function buitenVerzendvenster(t) {
  if (isLiveTestContact(t)) return false;
  if (CFG.binnenBotUren()) return false;
  const { hhmm } = CFG.amsterdamNu();
  const [eu, em] = CFG.BOT_UREN.eind.split(':').map(Number);
  const [nu_u, nu_m] = hhmm.split(':').map(Number);
  const minutenNa = (nu_u * 60 + nu_m) - (eu * 60 + em);
  return !(minutenNa >= 0 && minutenNa <= VENSTER_MARGE_MIN);
}

async function sendSonnyReply(t, tekst) {
  tekst = veiligeKlantTekst(tekst);
  if (buitenVerzendvenster(t)) throw new Error(`sendSonnyReply geblokkeerd: buiten verzendvenster ${CFG.BOT_UREN.start}-${CFG.BOT_UREN.eind} (nu ${CFG.amsterdamNu().hhmm})`);
  // Eigen verdedigingslagen (los van de whitelist): alleen WhatsApp, alleen als Sonny
  // aan staat én het buiten openingstijden is, nooit leeg.
  if (!sonnyActiefNu()) throw new Error('sendSonnyReply geblokkeerd: Sonny niet actief (binnen openingstijden of .sonny-enabled ontbreekt)');
  if (!isWaTicket(t)) throw new Error('sendSonnyReply geblokkeerd: geen WhatsApp-ticket');
  if (!tekst || !tekst.trim()) throw new Error('sendSonnyReply geblokkeerd: leeg antwoord');
  return tPost(`/tickets/${t.id}/messages`, { message: tekst, type: 'OUTBOUND' });
}

// Een ticket dat aan een MENS is toegewezen is van hem/haar — de bot blijft er volledig af
// (harde regel Daimy: alleen onbehandelde/niet-toegewezen tickets). 747786 = het Sonny/AI-account
// zelf; die toewijzing telt niet als "een mens heeft het overgenomen".
function aanMensToegewezen(t) {
  const u = t.user_id ?? t.assignee?.id ?? null;
  return !!u && Number(u) !== 747786;
}

// Woorden waaruit een puur bedankje kan bestaan. Op module-niveau omdat twee plekken hem
// nodig hebben: de gewone antwoordlus en de service-heropening. Stond die alleen in de
// antwoordlus, dan zette een simpel 'Dank je wel!' een afgerond gesprek alsnog terug in Mens
// nodig (Daimy 2026-08-04, Irene +31625002169).
const BEVESTIG_WOORDEN_GEDEELD = new Set(['top','ok','oke','oké','dank','dankje','dankjewel','dankuwel','danku','bedankt','thanks','thx','ga','ik','doen','het','is','goed','prima','super','perfect','helemaal','fijn','duidelijk','je','u','voor','alvast','mooi','gelukt','jullie','jij','ja','yes','klopt','begrepen','snap','wel','nogmaals','hartelijk','erg','heel','zo','dat','fijne','dag','avond','weekend','ook','hoor','en','nog','maar','even','tot','ziens','groetjes','groet','mvg','oke','okay','akkoord','helder','joe','yes','jup','jep','top','fantastisch','geweldig','netjes','keurig']);

/** Is dit bericht niets meer dan een bedankje of bevestiging? Dan hoeft er geen mens naar. */
function isPuurBedankje(tekst) {
  const zonder = String(tekst || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ').trim();
  if (!zonder) return true;                 // alleen een emoji
  if (zonder.length > 60) return false;
  if (/\?/.test(zonder)) return false;       // een vraag is nooit een bedankje
  const woorden = zonder.toLowerCase().replace(/[!.,;:'"()-]/g, ' ').split(/\s+/).filter(Boolean);
  return woorden.length > 0 && woorden.every((w) => BEVESTIG_WOORDEN_GEDEELD.has(w));
}

// Heeft dit telefoonnummer of e-mailadres een lopend inmeet-aanbod? Dan is de
// planner de enige stem richting de klant (Irene-incident 06-08). Venster: 48 uur
// na versturen — aanbiedingen zelf verlopen na max 24 uur, dus dit dekt de hele
// actieve periode plus een dag buffer. Match op laatste 9 cijfers én op e-mail,
// zodat ook mail-tickets (zonder telefoonnummer) beschermd zijn.
/** Welke rol heeft Sunny bij dit gesprek als er een inmeet-aanbod loopt of net liep?
 *  @returns {Promise<{blijfWeg:boolean, reden?:string, context:string}>} */
async function planningRolVoor(t, rows) {
  // Annulering loopt al via de keten (reply-route zette de mutatie, 28-08): Sunny blijft eraf,
  // anders krijgt de klant de waarom-vraag bovenop de annuleringsbevestiging.
  try {
    const cA = require('../lib/gesprek-claims.js').claimVan(t.id);
    if (cA && cA.door === 'annulering-loopt' && Date.now() - Date.parse(cA.op) < 2 * 3600000) return { blijfWeg: true, reden: 'annulering-loopt', context: '' };
    // winkel plant zelf (Daimy 29-08): kantoor/winkel heeft dit gesprek; Sunny doet niets aan de planning
    if (cA && cA.door === 'winkel' && Date.now() - Date.parse(cA.op) < 24 * 3600000) return { blijfWeg: true, reden: 'winkel-plant-zelf', context: '' };
  } catch { /* geen claims-administratie */ }
  const fs2 = require('fs');
  const st = JSON.parse(fs2.readFileSync('/Users/clawdboot/sonty/data/inmeten-planner-state.json', 'utf8'));
  const tel9 = String(t.contact?.phone || '').replace(/\D/g, '').slice(-9);
  const mail = String(t.contact?.email || '').trim().toLowerCase();
  const recent = Object.entries(st.aanbodTickets || {})
    .filter(([, a]) => {
      const aTel = String(a.telefoon || '').replace(/\D/g, '').slice(-9);
      const aMail = String(a.email || '').trim().toLowerCase();
      return ((tel9.length === 9 && aTel === tel9) || (!!mail && !!aMail && aMail === mail))
        && Date.now() - Date.parse(a.verstuurdOp) < 14 * 86400000;
    })
    .sort((x, y) => String(y[1].verstuurdOp).localeCompare(String(x[1].verstuurdOp)));
  if (!recent.length) return { blijfWeg: false, context: '' };
  const [token, info] = recent[0];
  let aanbod = null;
  try {
    const r = await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod/${token}`, { headers: { 'x-meet-code': process.env.MEETBON_CODE || '2288' } });
    aanbod = r.ok ? await r.json() : null;
  } catch { /* context zonder details */ }
  const slots = aanbod?.slots || [];
  // laatste reeks klantberichten (zonder tussenliggend antwoord van ons) = de boodschap
  const reeks = [];
  for (let i = rows.length - 1; i >= 0 && rows[i].van === 'klant'; i--) reeks.unshift(rows[i].tekst);
  const tekst = reeks.join('\n').trim();
  const lopend = lopendInmeetAanbod(t.contact?.phone, t.contact?.email);
  // Fase 3 (Daimy 26-08): met de aan-knop .inmeet-plannen-live neemt Sunny het
  // planningsoverleg over — hij zoekt zelf echte tijden en boekt. Zonder de knop
  // geldt het oude gedrag (planner regelt alles, Sunny blijft weg).
  // Pad hardcoded (geen __dirname): het scenario-lab knipt deze functie los uit het
  // bestand; INMEET_PLANNEN_LIVE=0/1 dwingt de stand af voor tests.
  const plannenAan = process.env.INMEET_PLANNEN_LIVE
    ? process.env.INMEET_PLANNEN_LIVE === '1'
    : fs2.existsSync('/Users/clawdboot/sonty/scripts/ai-ks/.inmeet-plannen-live');
  let blijfWeg = false, reden = '', alleenDeel = '', sunnyPlant = null;
  if (lopend && tekst) {
    const { leesKeuze } = require('../cron-aanbod-replies.js');
    // Sunny noemde ZELF tijden in dit gesprek (28-08, Daimy's test): dan is een kale keuze
    // een keuze uit Sunny's tijden, niet uit het oude planner-aanbod — Sunny handelt af.
    let eigenTijden = false;
    try { eigenTijden = require('../lib/gesprek-claims.js').sunnyNoemdeTijden(t.id); } catch { /* geen claims */ }
    // Sunny's eigen voorstel (bron 'sunny', 29-08 Mickey-les): een keuze/akkoord op dát voorstel handelt Sunny
    // zelf af (verifiëren met inmeet_tijden, boeken met inmeet_boeken) — de reply-route en Sunny lazen elkaars
    // "ik laat het aan de ander" en de klant kreeg 2 uur niets. Alleen bij een Nanny/planner-voorstel blijft
    // de klassieke keuze-route eigenaar.
    const eigenVoorstel = plannenAan && info.bron === 'sunny';
    if (!eigenTijden && !eigenVoorstel && leesKeuze(tekst, slots.length ? slots : [{ aankomst: info.verstuurdOp }]) !== null) { blijfWeg = true; reden = 'keuze'; }
    else {
      const { leesReactie } = require('../lib/planning-antwoord.js');
      const d = await leesReactie(tekst, slots);
      // Heeft Sunny dit gesprek al geclaimd (hij stelde net zelf tijden voor)? Dan is
      // het VERVOLG ook van hem — inclusief het akkoord ("oke doe maar dinsdag").
      // GAT GEDICHT 26-08 (Daimy's eigen test): Sunny stelde tijden voor, klant koos,
      // en Sunny gaf het stokje terug aan de klassieke route — die Sunny's tijden
      // helemaal niet kent. Klant kreeg 8+ minuten niets.
      let sunnyClaim = false;
      try { sunnyClaim = require('../lib/gesprek-claims.js').geclaimd(t.id, 45) || eigenTijden || eigenVoorstel; } catch { /* geen claim */ }
      // Sunny's EIGEN voorstel (bron 'sunny', Daimy 28-08): het vervolg is altijd van hem, ook na 45 min.
      if (info.bron === 'sunny') sunnyClaim = true;
      if (plannenAan && (['ander-moment', 'annuleren'].includes(d.intent) || (sunnyClaim && ['akkoord', 'ander-moment', 'vraag', 'annuleren'].includes(d.intent)))) {
        // Sunny neemt (of houdt) dit gesprek: ticket claimen zodat de planner-routes
        // (aanbod-replies, laatste-woord-check) er vanaf blijven — nooit twee botten.
        try { require('../lib/gesprek-claims.js').claim(t.id, 'sunny'); } catch { /* claim is vangnet */ }
        reden = 'sunny-plant';
        sunnyPlant = d;
        sunnyPlant.vervolgOpEigenVoorstel = sunnyClaim && d.intent !== 'ander-moment';
        alleenDeel = d.overigeVraag || '';
      } else if (['akkoord', 'ander-moment', 'annuleren'].includes(d.intent) && !d.overigeVraag) { blijfWeg = true; reden = d.intent; }
      else if (['akkoord', 'ander-moment', 'annuleren'].includes(d.intent)) {
        // Marius 19-08: "kan het op dinsdag?" + "op=op wil ik voorkomen" — de planner
        // regelt de dinsdag, maar niemand ging in op de voorraad-zorg. Sunny beantwoordt
        // dan ALLEEN het deel buiten de planning.
        reden = d.intent + '+vraag';
        alleenDeel = d.overigeVraag;
      } else reden = d.intent;
    }
  }
  // NA BOEKING (fase 3, 26-08 — het lab-onderdeel testrit-keten ving dit): een klant
  // die zijn GEBOEKTE afspraak wil annuleren handelde niemand af — de planner is na
  // de boeking klaar en Sunny kreeg geen annuleer-instructie. Daimy's regel: altijd
  // eerst vragen waarom en een ander moment proberen; wil hij echt annuleren, dan
  // gaat de afspraak overal weg. Dus: geboekte klant + annuleren → Sunny.
  if (plannenAan && !blijfWeg && !sunnyPlant && tekst) {
    try {
      const bo2 = JSON.parse(fs2.readFileSync('/Users/clawdboot/sonty/data/inmeet-boekingen.json', 'utf8'));
      const geboektNu = Object.values(bo2).some((b) => b.status === 'geboekt' && tel9.length === 9 && String(b.telefoon || '').replace(/\D/g, '').slice(-9) === tel9);
      if (geboektNu) {
        const { leesReactie } = require('../lib/planning-antwoord.js');
        const d3 = await leesReactie(tekst, []);
        if (d3.intent === 'annuleren') {
          try { require('../lib/gesprek-claims.js').claim(t.id, 'sunny'); } catch { /* vangnet */ }
          reden = 'sunny-plant';
          sunnyPlant = d3;
          alleenDeel = d3.overigeVraag || '';
        }
      }
    } catch { /* administratie onleesbaar: bestaande route */ }
  }
  const fmt = (sl) => new Date(sl.aankomst).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) + (sl.inmeter ? ` (inmeter ${sl.inmeter})` : '');
  const status = aanbod?.status || 'onbekend';
  let geboekt = null;
  try {
    const bo = JSON.parse(fs2.readFileSync('/Users/clawdboot/sonty/data/inmeet-boekingen.json', 'utf8'));
    geboekt = Object.values(bo).find((b) => b.status === 'geboekt' && String(b.telefoon || '').replace(/\D/g, '').slice(-9) === tel9 && tel9.length === 9) || null;
  } catch { /* geen administratie */ }
  const context = [
    'PLANNING-CONTEXT (intern, niet letterlijk citeren):',
    geboekt
      ? `- De inmeetafspraak van deze klant is GEBOEKT: ${geboekt.slot?.aankomst ? fmt({ aankomst: geboekt.slot.aankomst, inmeter: geboekt.slot.inmeter || geboekt.inmeter }) : (geboekt.datum || 'datum onbekend')}. Thuisblijf-venster: een uur vóór tot anderhalf uur ná de genoemde tijd; verschuift het door de route, dan laten we het weten.`
      : `- ${info.bron === 'sunny' ? 'JIJ (Sunny) hebt deze klant zelf een inmeetmoment voorgesteld' : 'Onze planning (Nanny) heeft deze klant een inmeetmoment voorgesteld'}: ${slots.length ? slots.map(fmt).join(' of ') : 'tijd onbekend'} (status aanbod: ${status}${aanbod?.verlooptOp ? ', vast tot ' + new Date(aanbod.verlooptOp).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }) : ''}).`,
    '- Dit is het EERSTE beschikbare moment; eerder kan op dit moment NIET (het is drukker dan we willen door vakanties en de bouwvak; de inmeters werken maandag t/m donderdag 09:00-15:00; Engelstalige klanten meet alleen Sjoerd). Zeg dat eerlijk, beloof geen eerdere datum.',
    sunnyPlant && sunnyPlant.intent === 'annuleren'
      ? `- DE KLANT WIL ZIJN INMEETAFSPRAAK ANNULEREN en JIJ handelt dit volledig af (${sunnyPlant.samenvatting || 'zie zijn bericht'}). Vaste werkwijze (Daimy 28-08: "annuleringen volledig zelf uitvoeren"): zegt hij duidelijk dat hij wil annuleren, roep dan DIRECT inmeet_annuleren aan met zijn letterlijke zin als citaat (reden = wat hij zei; noemde hij niets, dan 'geen reden gegeven' — NIET eerst om een reden vragen). Zeg kort en vriendelijk dat je de afspraak annuleert, dat hij de bevestiging vanzelf krijgt, en dat hij later altijd een nieuw moment kan aanvragen. Twijfel of hij wil annuleren of alleen verzetten? Dan één korte vraag. Dit is een lopend gesprek: begin niet met "Hoi naam".`
      : sunnyPlant
      ? `- ${sunnyPlant.vervolgOpEigenVoorstel ? 'DE KLANT REAGEERT OP DE TIJDEN DIE JIJ EERDER IN DIT GESPREK NOEMDE' : 'DE KLANT WIL EEN ANDER MOMENT'} en JIJ handelt dit volledig af (${sunnyPlant.samenvatting || 'zie zijn bericht'}). ${sunnyPlant.vervolgOpEigenVoorstel ? 'Kiest hij (ook impliciet, zoals "doe maar dinsdag") één van joúw eerder genoemde tijden, roep dan eerst inmeet_tijden aan om die tijd te verifiëren en boek hem DIRECT met inmeet_boeken. Twijfel je welke hij bedoelt, vraag het kort na.' : `Roep inmeet_tijden aan met zijn voorkeur${sunnyPlant.vanaf ? ` (vanaf: ${sunnyPlant.vanaf})` : ''}${(sunnyPlant.dagen || []).length ? ` (dagen: ${sunnyPlant.dagen.join(',')})` : ''}${sunnyPlant.dagdeel ? ` (dagdeel: ${sunnyPlant.dagdeel})` : ''}, stel 2-3 opties voor in gewone taal, en boek met inmeet_boeken zodra de klant expliciet één moment kiest.`} Het oude voorstel wordt automatisch ingetrokken zodra je boekt; verwijs er niet meer naar. BELANGRIJK voor de toon: dit is een lopend gesprek, dus begin NIET met "Hoi ${String(t.contact?.name || '').split(' ')[0] || 'naam'}" — val gewoon met de deur in huis ("Geen probleem, ik heb even gekeken: ..." / "Helemaal goed, ik zet hem vast ...").`
      : '- Jij boekt, verzet of belooft ZELF GEEN inmeetmoment. Wil de klant het voorgestelde moment vastzetten, dan kan hij simpelweg "dat past" (EN: "that works") antwoorden; wil hij een andere dag, dan noemt hij die dag en zoekt de planning opnieuw. Zeg dat zo.',
    '- Beantwoord zijn inhoudelijke vraag volledig (levertijd 8-10 weken na definitieve offerte + aanbetaling, proces, product, waarom niet eerder). Vraagt hij expliciet om een mens: beantwoord éérst zelf wat je kunt, zeg dat een collega is ingelicht, en escaleer daarnaast — nooit alleen "een collega komt erop terug".',
    alleenDeel ? `- LET OP: de klant koos/vroeg ook iets over de TIJD; dat handelt de planning zelf af (die stuurt een nieuw voorstel of bevestigt). Ga daar niet op in en herhaal geen tijden. Beantwoord ALLEEN dit deel: "${alleenDeel}". Weet je het antwoord niet zeker (bv. of een voorraadproduct gereserveerd kan worden): zeg dat eerlijk, escaleer, en beloof geen uitkomst.` : '',
  ].filter(Boolean).join('\n');
  return { blijfWeg, reden, context };
}

function lopendInmeetAanbod(phone, email) {
  try {
    const st = JSON.parse(require('fs').readFileSync('/Users/clawdboot/sonty/data/inmeten-planner-state.json', 'utf8'));
    const tel9 = String(phone || '').replace(/\D/g, '').slice(-9);
    const mail = String(email || '').trim().toLowerCase();
    // Alleen blokkeren zolang de KEUZE nog loopt (Jan van Wageningen 15-08: hij was al
    // geboekt en vroeg naar Velux-rolluiken, maar Sunny bleef geblokkeerd — de klant
    // kreeg twee keer dezelfde lege "ik zoek het uit" van de planner-monitor terwijl
    // de klantenservice-bot het antwoord gewoon weet). Is de klant geboekt, dan is de
    // planner klaar en neemt Sunny het gesprek weer over.
    let geboekt = new Set();
    try {
      const bo = JSON.parse(require('fs').readFileSync('/Users/clawdboot/sonty/data/inmeet-boekingen.json', 'utf8'));
      geboekt = new Set(Object.values(bo).filter((b) => b.status === 'geboekt').map((b) => String(b.telefoon || '').replace(/\D/g, '').slice(-9)));
    } catch { /* geen administratie */ }
    return Object.values(st.aanbodTickets || {}).some((a) => {
      if (Date.now() - Date.parse(a.verstuurdOp) >= 48 * 3600000) return false;
      const aTel = String(a.telefoon || '').replace(/\D/g, '').slice(-9);
      const aMail = String(a.email || '').trim().toLowerCase();
      const match = (tel9.length === 9 && aTel === tel9) || (!!mail && !!aMail && aMail === mail);
      if (!match) return false;
      if (aTel && geboekt.has(aTel)) return false; // geboekt = planner klaar, Sunny mag weer
      return true;
    });
  } catch { return false; /* state onleesbaar: normale flow */ }
}

async function verwerkTicket(t, state) {
  // VERSE TEAM-OPDRACHT OVERRULET DE BLOKKADES (Daimy 2026-07-27, na drie keer terugkomen op
  // hetzelfde). Er zitten meerdere terechte redenen in deze functie om van een gesprek af te
  // blijven: het ligt bij een collega, een collega stuurde het laatste bericht, het ligt in de
  // Mens nodig-map, of het is eerder geëscaleerd. Maar zet iemand van het team er expliciet
  // "@sunny antwoord" bij, dan is dat juist een opdracht om het WEL te doen, en hoort geen van
  // die redenen dat tegen te houden.
  // Concreet geval: ticket 966697967 (Rob). Het laatste echte uitgaande bericht kwam uit Daimy's
  // account, waardoor de bot er permanent vanaf bleef, ook nadat Daimy zelf om een antwoord vroeg.
  t._verseOpdracht = false;
  try {
    // 28-08 (Trengo-429-storm, Daimy's test lag 12 min): berichten alleen ophalen als het
    // ticket sinds de vorige ronde veranderd is. Stand = updated_at|messages_count; zelfde
    // stand binnen 20 min = niets nieuws → overslaan. Na 20 min altijd opnieuw kijken, zodat
    // tijdgebonden beslissingen (verzendvenster, verlopen claims) nooit blijven hangen.
    const stand = t.updated_at ? `${t.updated_at}|${t.messages_count ?? ''}` : null;
    state.ticketStand = state.ticketStand || {};
    const vorigeStand = stand ? state.ticketStand[t.id] : null;
    if (vorigeStand && vorigeStand.stand === stand && Date.now() - Date.parse(vorigeStand.op) < 8 * 60000 && !t._msgs) return;
    if (stand) state.ticketStand[t.id] = { stand, op: new Date().toISOString() };
    if (Object.keys(state.ticketStand).length > 2000) {
      for (const [id, v] of Object.entries(state.ticketStand)) if (Date.now() - Date.parse(v.op) > 86400000) delete state.ticketStand[id];
    }
    const vm = t._msgs || await haalBerichten(t.id);
    t._msgs = vm;
    const intern = (vm?.data || []).filter((m) => m.internal_note || m.type === 'NOTE');
    const opdrachten = intern.filter((m) => /@s[ou]nny(?!\d)/i.test(String(m.body || m.message || '')) && !String(m.body || m.message || '').includes('✅'));
    if (opdrachten.length) {
      const laatsteOpdracht = opdrachten.map((m) => String(m.created_at)).sort().pop();
      const laatsteVink = intern.filter((m) => String(m.body || m.message || '').includes('✅')).map((m) => String(m.created_at)).sort().pop();
      t._verseOpdracht = !laatsteVink || laatsteOpdracht > laatsteVink;
      if (t._verseOpdracht) console.log(`  [${t.id}] verse team-opdracht (@sonny) → blokkades worden overgeslagen`);
    }
  } catch { /* lukt het niet, dan gelden de normale blokkades gewoon */ }

  if (aanMensToegewezen(t) && !t._verseOpdracht) {
    // Toegewezen aan een collega → nooit ANTWOORDEN, maar @sonny-notities WEL verwerken
    // (Daimy 23-07: dagstand-feedback op een aan hem toegewezen ticket werd gemist).
    try {
      const msgsMens = t._msgs || await haalBerichten(t.id);
      const notitiesMens = (msgsMens?.data || []).map(m => ({
        van: m.type === 'INBOUND' ? 'klant' : 'sonty',
        tekst: clean(m.body || m.message), tijd: m.created_at,
        intern: !!m.internal_note || m.type === 'NOTE', userId: m.user_id || null,
      })).filter(m => m.tekst && m.intern && !/AI-KS|SONNY \(AI|schaduwmodus|live verstuurd|✅ Verwerkt|Uitgevoerde acties door de AI/i.test(m.tekst)).slice(-5);
      // VERSE team-opdracht (bv. "@sunny stuur een follow-up")? Dan het ticket in AI-beheer
      // nemen en DOORVALLEN naar de normale flow zodat de opdracht ECHT wordt uitgevoerd
      // (Daimy 23-07: "tickets die ik stuur met geen-follow-up: die follow-up mag je sturen").
      const alleIntern = (msgsMens?.data || []).filter(m => m.internal_note || m.type === 'NOTE');
      const laatsteOpdracht = alleIntern.filter(m => /@s[ou]nny(?!\d)/i.test(String(m.body || m.message || '')) && !String(m.body || m.message || '').includes('✅')).map(m => String(m.created_at)).sort().pop();
      const laatsteVink = alleIntern.filter(m => String(m.body || m.message || '').includes('✅')).map(m => String(m.created_at)).sort().pop();
      if (laatsteOpdracht && (!laatsteVink || laatsteOpdracht > laatsteVink)) {
        const a = loadActief();
        if (!a[t.id]) { a[t.id] = { sinds: new Date().toISOString(), klant: t.contact?.full_name || t.contact?.phone || null, bron: 'team-notitie op collega-ticket' }; fs.writeFileSync(ACTIEF_FILE, JSON.stringify(a, null, 1)); }
        console.log(`  [${t.id}] verse team-opdracht op collega-ticket → in AI-beheer, opdracht wordt uitgevoerd`);
      } else {
        if (notitiesMens.some(m => /@s[ou]nny(?!\d)/i.test(m.tekst))) await verwerkSonnyNotities(t, notitiesMens);
        return;
      }
    } catch (e) { console.error(`  [${t.id}] notitie-op-mensticket FOUT: ${e.message}`); return; }
  }
  const msgs = t._msgs || await haalBerichten(t.id);
  // VACATURE-appjes (Daimy 22-07): sollicitanten via de wervingsmail (voorgevuld bericht
  // "interesse in de vacature" / "Ik kom via:") NOOIT door de bot beantwoorden —
  // direct aan Daimy (736327) toewijzen en verder met rust laten.
  if ((msgs?.data || []).some(m => m.type === 'INBOUND' && /interesse in de vacature|ik kom via:/i.test(String(m.body || m.message || '')))) {
    try { await tPost(`/tickets/${t.id}/assign`, { type: 'user', user_id: 736327 }); console.log(`  [${t.id}] vacature-appje → toegewezen aan Daimy`); } catch (e) { console.error(`  [${t.id}] vacature-toewijzing FOUT: ${e.message}`); }
    return;
  }
  // MENS-GESPREK (Daimy 23-07, "als Nanny iemand een WhatsApp stuurt"): heeft een COLLEGA
  // (niet het Sonny-account) het laatste uitgaande bericht gestuurd, dan is het gesprek van
  // die collega — toewijzen aan hen, uit AI-beheer, en de bot blijft er definitief vanaf.
  {
    const echteBerichten = (msgs?.data || []).filter(m => !(m.internal_note || m.type === 'NOTE'));
    const laatsteUit = echteBerichten.filter(m => m.type === 'OUTBOUND')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    const laatsteBericht = [...echteBerichten].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    // Sloot een mens het ticket (= klaar) en begint de klant DAARNA opnieuw (laatste bericht is van
    // de klant)? Dan pakt de BOT het vervolg gewoon op, i.p.v. het terug te geven aan die collega
    // (Daimy 3-08, casus Rox +31633352837: "Jorren had het gesloten dus hij is er klaar mee").
    // closed_by blijft staan, dus we eisen óók dat de klant als laatste iets stuurde — anders is de
    // collega gewoon nog bezig en blijft het gesprek van hem.
    // closed_by zit NIET in de ticketlijst van Trengo (alleen in de detail-call),
    // closed_at wél. Daardoor was deze check altijd false en ging elk klantbericht
    // na een afgerond gesprek tóch terug naar Mens nodig (Daimy 09-08: "Sunny wijst
    // nog steeds toe aan Jorren"). Beide velden accepteren.
    const klantWachtNaSluiting = !!(t.closed_by || t.closed_at) && laatsteBericht && laatsteBericht.type === 'INBOUND';
    if (klantWachtNaSluiting) {
      try { await tPost(`/tickets/${t.id}/assign`, { type: 'user', user_id: 747786 }); await haalLabelWeg(t.id, LABEL.MENS_NODIG); }
      catch (e) { console.error(`  [${t.id}] heropend-na-sluiting oppakken FOUT: ${e.message}`); }
      const actiefLijst = loadActief();
      if (!actiefLijst[t.id]) { actiefLijst[t.id] = { sinds: new Date().toISOString(), bron: 'heropend na sluiting door collega' }; fs.writeFileSync(ACTIEF_FILE, JSON.stringify(actiefLijst, null, 1)); }
      console.log(`  [${t.id}] collega had gesloten, klant reageert opnieuw → bot pakt het vervolg op`);
      // niet returnen: de normale flow hieronder beantwoordt de klant
    } else if (laatsteUit && laatsteUit.user_id && Number(laatsteUit.user_id) !== 747786 && !t._verseOpdracht) {
      // Daimy zelf nooit automatisch toewijzen (Daimy 23-07) — bot blijft er wel vanaf
      // MENS-NODIG WINT (Daimy 20-08: hij zette een ticket van Nanny naar Mens nodig
      // en de bot wees hem terug aan Nanny toe — die is nota bene met vakantie).
      // Ligt het ticket in het Mens nodig-team, dan is dat een bewuste keuze van een
      // mens: NOOIT terug-toewijzen aan wie toevallig het laatste antwoord stuurde.
      if (Number(t.team_id) === 431872) return;
      if (t.status !== 'CLOSED' && Number(laatsteUit.user_id) !== 736327 && Number(t.user_id) !== Number(laatsteUit.user_id)) {
        try { await tPost(`/tickets/${t.id}/assign`, { type: 'user', user_id: laatsteUit.user_id }); console.log(`  [${t.id}] laatste bericht van collega (user ${laatsteUit.user_id}) → aan hen toegewezen, bot eraf`); } catch (e) { console.error(`  [${t.id}] collega-toewijzing FOUT: ${e.message}`); }
      }
      const actiefLijst = loadActief();
      if (actiefLijst[t.id]) { delete actiefLijst[t.id]; fs.writeFileSync(ACTIEF_FILE, JSON.stringify(actiefLijst, null, 1)); }
      return;
    }
  }
  // SERVICE-HEROPENING (Daimy 22-07, "anders gaan gesprekken verloren", casus Nele 966428536):
  // is dit gesprek ooit door de bot overgedragen (escalatie-notitie) en stuurt de klant DAARNA
  // opnieuw een bericht, dan hoort het DIRECT weer bij team Mens nodig — de bot praat niet mee.
  {
    const ruweBerichten = msgs?.data || [];
    // TAAL VASTLEGGEN (Ganesh 15-08: mailde dagenlang in het Engels met Sunny, maar de
    // Engels-vlag werd alleen door de reply-monitor gezet — de planner wist van niks en
    // boekte Joey, tegen de regel "Engelstalig = altijd Sjoerd" in). Elke Engelse
    // klantzin die hier voorbij komt zet de vlag, vóór er ooit een aanbod uitgaat.
    try {
      const { lijktEngels, zetEngels, isEngels } = require('../lib/taal-voorkeur.js');
      const laatsteInboundTekst = ruweBerichten.filter((m) => m.type === 'INBOUND')
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map((m) => String(m.body || m.message || '').replace(/<[^>]+>/g, ' ')).pop() || '';
      if (t.contact?.phone && laatsteInboundTekst && lijktEngels(laatsteInboundTekst) && !isEngels(t.contact.phone)) {
        zetEngels(t.contact.phone, 'ai-ks ticket ' + t.id);
        console.log(`  taal: ${t.contact.full_name || t.contact.phone} gemarkeerd als Engelstalig`);
      }
    } catch {}
    const overdrachten = ruweBerichten.filter(m => (m.internal_note || m.type === 'NOTE') && m.user_id === 747786 &&
      (OVERDRACHT_HERKENNING.test(String(m.body || m.message || '')) || /De AI kan dit niet zelf afhandelen en draagt het over/i.test(String(m.body || m.message || ''))));
    if (isWaTicket(t) && overdrachten.length && !t._verseOpdracht) {
      const laatsteKlant = ruweBerichten.filter(m => m.type === 'INBOUND').map(m => String(m.created_at)).sort().pop() || '';
      const laatsteOverdracht = overdrachten.map(m => String(m.created_at)).sort().pop() || '';
      // Gesloten door een mens = die was klaar (Daimy 3-08, casus Manon +31622368116). Begint de
      // klant daarna opnieuw, dan pakt de BOT het gewoon op en antwoordt — NIET automatisch terug
      // naar Mens nodig puur omdat het daar eerder lag. Wie verder wil helpen sluit niet, maar wijst
      // zichzelf toe (dan blijft user_id gezet en blijft de bot eraf).
      // Zie hierboven: closed_at is het veld dat de lijst-API wél teruggeeft.
      // Alleen als de klant ná het sluiten schreef; anders is een oud gesloten-moment
      // genoeg om elk gesprek als "nieuwe vraag" te zien.
      const werdGesloten = !!(t.closed_by || t.closed_at)
        && (!t.closed_at || laatsteKlant > String(t.closed_at));
      if (werdGesloten && laatsteKlant > laatsteOverdracht) {
        if (Number(t.team_id) === 431872) {
          try { await tPost(`/tickets/${t.id}/assign`, { type: 'user', user_id: 747786 }); await haalLabelWeg(t.id, LABEL.MENS_NODIG); }
          catch (e) { console.error(`  [${t.id}] heropend-oppakken FOUT: ${e.message}`); }
        }
        const actief = loadActief();
        if (!actief[t.id]) { actief[t.id] = { sinds: new Date().toISOString(), bron: 'heropend na sluiting' }; fs.writeFileSync(ACTIEF_FILE, JSON.stringify(actief, null, 1)); }
        console.log(`  [${t.id}] was gesloten en heropend → bot pakt het op i.p.v. terug naar Mens nodig`);
        // NIET returnen: de normale flow hieronder beantwoordt de klant.
      } else {
        // OVERDRACHT VERJAART (Daimy 29-08, zijn eigen test "ik zit toch te twijfelen" na een annulering): een
        // overdracht is geen eeuwige blokkade. Heeft GEEN mens (ander user-id dan de bot) sinds de overdracht in
        // het gesprek geschreven en schrijft de klant ≥90 min na de overdracht opnieuw, dan pakt de bot het gewoon
        // weer op (met de volledige context) in plaats van "terug naar Mens nodig" + stilte. Wil een collega het
        // zelf doen, dan wijst die zichzelf toe (dan blijft de bot eraf, zie aanMensToegewezen).
        // Maatstaf: het laatste KLANTbericht staat ≥90 min onbeantwoord (geen mens, geen inhoudelijk bot-
        // antwoord erna — een vangnet-berichtje telt niet), ongeacht of de overdracht-notitie ervoor of erna kwam.
        const VANGNET_RE2 = /nog niets van ons hoorde|haven't heard from us yet|collega pakt het nu persoonlijk op|colleague is picking it up|ik geef (je annulering|het) direct door aan/i;
        const naKlant = ruweBerichten.filter((m) => String(m.type || '').toUpperCase() === 'OUTBOUND' && String(m.created_at) > laatsteKlant);
        const mensNaKlant = naKlant.some((m) => Number(m.user_id) && Number(m.user_id) !== 747786);
        const botAntwoordNaKlant = naKlant.some((m) => (!Number(m.user_id) || Number(m.user_id) === 747786) && !VANGNET_RE2.test(String(m.message || m.body || m.body_plain || '')));
        const klantOud = laatsteKlant && (Date.now() - Date.parse(String(laatsteKlant).replace(' ', 'T')) > 90 * 60000);
        if (laatsteKlant && !mensNaKlant && !botAntwoordNaKlant && klantOud && !t.user_id) {
          if (Number(t.team_id) === 431872) {
            try { await tPost(`/tickets/${t.id}/assign`, { type: 'user', user_id: 747786 }); await haalLabelWeg(t.id, LABEL.MENS_NODIG); }
            catch (e) { console.error(`  [${t.id}] overdracht-verjaring oppakken FOUT: ${e.message}`); }
          }
          const actief = loadActief();
          if (!actief[t.id]) { actief[t.id] = { sinds: new Date().toISOString(), bron: 'overdracht verjaard (geen mens reageerde)' }; fs.writeFileSync(ACTIEF_FILE, JSON.stringify(actief, null, 1)); }
          console.log(`  [${t.id}] klantbericht staat ${Math.round((Date.now() - Date.parse(String(laatsteKlant).replace(' ', 'T'))) / 60000)} min onbeantwoord na overdracht (geen mens reageerde) → bot pakt het weer op`);
          // NIET returnen: de normale flow hieronder beantwoordt de klant.
        } else {
        if (Number(t.team_id) === 431872 && !t._verseOpdracht) return; // ligt al in de Mens nodig-map, team ziet het
        // EEN BEDANKJE IS GEEN HEROPENING (Daimy 2026-08-04, Irene +31625002169).
        // Zij bedankte na een keurig afgerond gesprek met "Dank je wel!", en dat zette het ticket
        // terug in Mens nodig met een tag naar twee collegas. Dat vervuilt de Mens-nodig-lijst met
        // gesprekken waar niets meer te doen is. Een puur bedankje laat het gesprek dus met rust.
        const laatsteInbound = ruweBerichten.filter((m) => m.type === 'INBOUND')
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).pop();
        if (laatsteKlant > laatsteOverdracht && isPuurBedankje(laatsteInbound?.message || laatsteInbound?.body_plain)) {
          console.log(`  [${t.id}] klant stuurde alleen een bedankje na de overdracht, niet terug naar Mens nodig`);
          return;
        }
        if (laatsteKlant > laatsteOverdracht) {
          console.log(`  [${t.id}] klant reageerde opnieuw op overgedragen (service)gesprek → terug naar Mens nodig`);
          try {
            await plaatsNotitie(t.id, `${teamTags()}\n\nKlant reageerde opnieuw op dit eerder overgedragen gesprek, direct terug in Mens nodig gezet, de bot blijft eraf.`);
            await zetLabel(t.id, LABEL.MENS_NODIG);
            await tPost(`/tickets/${t.id}/assign`, { type: 'team', team_id: 431872 });
          } catch (e) { console.error(`  [${t.id}] service-heropening FOUT: ${e.message}`); }
          const actief = loadActief();
          if (actief[t.id]) { delete actief[t.id]; fs.writeFileSync(ACTIEF_FILE, JSON.stringify(actief, null, 1)); }
          return;
        }
        }
      }
    }
  }
  const alleRijen = (msgs?.data || []).map(m => ({
    van: m.type === 'INBOUND' ? 'klant' : 'sonty',
    tekst: clean(m.body || m.message),
    tijd: m.created_at,
    intern: !!m.internal_note || m.type === 'NOTE',
    userId: m.user_id || null,
  })).filter(m => m.tekst)
    .sort((a, b) => String(a.tijd).localeCompare(String(b.tijd))); // Trengo geeft nieuwste-eerst; wij willen oud → nieuw
  const rows = alleRijen.filter(m => !m.intern);
  // Interne notities van het TEAM = sturing voor de AI (bv. "@sonny wij boren dan een gat...",
  // vraag Daimy 2026-07-16). Eigen AI-notities eruit filteren (anders praat hij tegen zichzelf).
  const teamNotities = alleRijen.filter(m => m.intern && !/AI-KS|SONNY \(AI|schaduwmodus|live verstuurd|✅ Verwerkt|Uitgevoerde acties door de AI/i.test(m.tekst)).slice(-5);
  // @sonny-notities altijd verwerken (leerpunt/stop/opdracht), óók als er niets te
  // beantwoorden valt (Daimy plaatst ze vaak nadat het gesprek al beantwoord is).
  let teamInstructies = [];
  try { teamInstructies = await verwerkSonnyNotities(t, teamNotities); } catch (e) { console.error('  notitie-leerpunt FOUT:', e.message); }

  // FEEDBACK-beoordeling: de bot schat zelf in of de team-feedback óók een bericht aan de
  // klant in dít gesprek vraagt (verduidelijking/aanvulling). Zo niet, dan alleen kennis.
  if (teamInstructies.length && isWaTicket(t) && (isActiefTicket(t) || isLiveTestContact(t))) {
    const feedback = teamInstructies.map(i => i.punt).join('\n');
    console.log(`Ticket ${t.id}: team-feedback beoordelen: ${feedback.slice(0, 80)}...`);
    const res = await beantwoord({
      kanaal: 'WA',
      klant: { naam: t.contact?.full_name || null, email: t.contact?.email || null, phone: t.contact?.phone || null },
      berichten: rows.slice(-25),
      liveTest: true,
      sonny: false,
      teamNotities,
      teamInstructie: feedback,
      ticketId: t.id,
    });
    // Output-protocol: [klanttekst] / GEEN_BERICHT, afgesloten met "NOTITIE: <antwoord team>".
    // Acties (offerte aanpassen etc.) zijn door de agent al ECHT uitgevoerd via zijn tools.
    const ruw = res.antwoord || '';
    const notitieMatch = ruw.match(/NOTITIE:\s*([\s\S]+)$/i);
    const teamAntwoord = notitieMatch ? notitieMatch[1].trim() : '';
    let klantTekst = ruw.replace(/NOTITIE:\s*[\s\S]+$/i, '').replace(/GEEN_BERICHT/g, '').trim();
    // VANGNET (Déborah 17 juli: bot stuurde zijn eigen redenering + de kop "Bericht aan klant:"
    // letterlijk naar de klant). Als de bot zo'n kop gebruikt, houd ALLEEN wat erna komt; strip
    // ook een leidende meta-/redeneerregel (begint met — of - en gaat over wat de bot gaat doen).
    klantTekst = schoonKlantTekst(klantTekst);
    let verstuurd = false;
    // Ook via het @sonny-feedbackpad mag er GEEN klantbericht bovenop een lopend
    // inmeet-aanbod (dit pad zat vóór de aanbod-guard en omzeilde hem, audit 06-08).
    if (klantTekst && lopendInmeetAanbod(t.contact?.phone, t.contact?.email)) {
      console.log(`  ticket ${t.id}: klantbericht uit feedback ONDERDRUKT (lopend inmeet-aanbod)`);
      klantTekst = '';
    }
    if (klantTekst) {
      const sendRes = isLiveTestContact(t) ? await sendLiveReply(t, klantTekst) : await sendActiefReply(t, klantTekst);
      verstuurd = sendRes.ok;
      console.log(`  → FEEDBACK-vervolgbericht naar ${t.contact?.phone}: ${sendRes.ok ? 'OK' : 'FOUT ' + sendRes.status}`);
      // 24-UURSVENSTER DICHT (422): vrij bericht mag niet meer — stuur dan de goedgekeurde
      // follow-up-template (236108: "je hebt nog niet gereageerd op de prijsindicatie...").
      // Eén keer per ticket (marker in state via notitie), daarna klaar.
      if (!sendRes.ok && sendRes.status === 422 && t.contact?.phone) {
        const voornaam = (t.contact?.full_name || '').split(' ')[0] || 'daar';
        const tw = await fetch('https://app.trengo.com/api/v2/wa_sessions', {
          method: 'POST', headers: { 'Authorization': 'Bearer ' + TT, 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient_phone_number: t.contact.phone, hsm_id: 236108, channel_id: 1359857,
            params: [{ type: 'body', key: '{{1}}', value: voornaam }] }) });
        console.log(`  → 24u dicht: follow-up-TEMPLATE naar ${t.contact.phone}: ${tw.ok ? 'OK' : 'FOUT ' + tw.status}`);
        // Template via wa_sessions maakt een NIEUW ticket (Daimy 23-07: gesprek raakt kwijt);
        // daarom het nieuwe ticket direct mergen in het originele zodat alles in 1 gesprek blijft.
        if (tw.ok) {
          try {
            const twJson = await tw.json();
            const nieuwTicket = twJson?.message?.ticket_id;
            if (nieuwTicket && Number(nieuwTicket) !== Number(t.id)) {
              const mr = await fetch(`https://app.trengo.com/api/v2/tickets/${t.id}/merge`, {
                method: 'POST', headers: { 'Authorization': 'Bearer ' + TT, 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_ticket_id: nieuwTicket }) });
              console.log(`  → template-ticket ${nieuwTicket} samengevoegd met ${t.id}: ${mr.ok ? 'OK' : 'FOUT ' + mr.status}`);
              if (!mr.ok) await telegram(`⚠️ Follow-up-template bij ticket ${t.id} kwam in los ticket ${nieuwTicket} en samenvoegen lukte niet (${mr.status}). Even handmatig checken.`);
            }
          } catch (e) { console.log('  merge na template mislukt:', e.message); }
        }
        verstuurd = tw.ok;
        if (tw.ok) await plaatsNotitie(t.id, `✅ 24-uursvenster was dicht, daarom de goedgekeurde follow-up-template verstuurd (in dit ticket samengevoegd, geen los gesprek). Zodra de klant reageert is het venster weer open en kan het gesprek verder.`);
        else await telegram(`⚠️ Follow-up bij ticket ${t.id} kon niet: 24u-venster dicht EN template faalde (${tw.status}).`);
      } else if (!sendRes.ok) {
        await telegram(`⚠️ Vervolgbericht na feedback bij ticket ${t.id} kon niet verstuurd worden: ${sendRes.status}`);
      }
    }
    const mutaties = res.acties.filter(a => a.type !== 'escalatie');
    const actieTekst = mutaties.length ? '\nUitgevoerd: ' + mutaties.map(a => a.samenvatting || a.type).join('; ') : '';
    for (const i of teamInstructies) {
      await plaatsNotitie(t.id, `${await tagVoor(i.userId)} ✅ ${teamAntwoord || 'Verwerkt als vaste kennis.'}${actieTekst}${verstuurd ? '\n(De klant heeft hierover een kort bericht gekregen.)' : ''}`);
    }
    log({ ticket: t.id, kanaal: 'WA', klant: { phone: t.contact?.phone }, teamOpdracht: feedback.slice(0, 300), antwoord: verstuurd ? klantTekst : '(geen klantbericht)', teamAntwoord: teamAntwoord.slice(0, 200), acties: res.acties, toolCalls: res.toolCalls, usage: res.usage, actief: true });
    return; // notitie afgehandeld; normale flow volgt bij het volgende klantbericht
  }

  if (!rows.length) return;

  // VANGNET-BERICHTEN TELLEN NIET ALS ANTWOORD (Daimy 29-08, zijn test "ik zit toch te twijfelen"): het
  // stilte-vangnet ("Sorry dat je nog niets van ons hoorde, een collega pakt het op") is een uitgaand
  // bot-bericht en maakte het laatste bericht "van ons", waardoor Sunny de klant daarna NOOIT meer
  // beantwoordde. Trailing vangnet-berichten overslaan: het laatste ECHTE bericht telt.
  const VANGNET_RE = /nog niets van ons hoorde|haven't heard from us yet|collega pakt het nu persoonlijk op|colleague is picking it up|ik geef (je annulering|het) direct door aan/i;
  let li = rows.length - 1;
  while (li >= 0 && rows[li].van !== 'klant' && VANGNET_RE.test(String(rows[li].tekst || ''))) li--;
  const laatste = rows[Math.max(0, li)];
  if (!laatste || laatste.van !== 'klant') return; // alleen reageren als het laatste echte bericht van de klant is

  // LOPEND INMEET-AANBOD? DAN IS DE PLANNER DE ENIGE RESPONDER — voor ÁLLES op dit
  // nummer, niet alleen keuze-berichten. Op 06-08 vroeg Irene "over welke dag gaat
  // het?" en antwoordde de AI "de planning belt binnen 5 werkdagen" bovenop het
  // keuze-aanbod met 3 tijden: twee tegenstrijdige verhalen bij één klant, Daimy
  // moest er zelf tussen springen. Elke reactie wordt al door de aanbod-monitor
  // (elke 3 min) naar Daimy gerapporteerd en keuzes voert die zelf door.
  // BIJGESTELD (Daimy 21-08, Fatih): de planner/monitor blijven eigenaar van KEUZES
  // ("dat past", "ander moment", "dinsdag kan ook", annuleren) — daar blijft Sunny af.
  // Maar een VRAAG tijdens een lopend aanbod ("kan het sneller? hoe lang is de levertijd?",
  // "mag ik een mens?") beantwoordt Sunny gewoon, met de planning-context erbij. De monitor
  // stuurde daar "ik zoek het uit" op en daarna kwam er niets meer: twee dagen stilte.
  let planningContext = '';
  try {
    const rol = await planningRolVoor(t, rows);
    planningContext = rol.context || '';
    if (rol.blijfWeg) {
      console.log(`  ticket ${t.id}: lopend inmeet-aanbod en klant reageert op het voorstel (${rol.reden}) — planner/monitor handelen af, AI blijft eraf`);
      return;
    }
    if (rol.context) console.log(`  ticket ${t.id}: lopend/recent inmeet-aanbod, klant stelt een vraag — Sunny antwoordt mét planning-context`);
  } catch (e) {
    // Twijfel = oude gedrag (planner is de enige stem) zolang het aanbod loopt.
    if (lopendInmeetAanbod(t.contact?.phone, t.contact?.email)) {
      console.log(`  ticket ${t.id}: lopend inmeet-aanbod, duiding mislukt (${String(e.message).slice(0, 60)}) — AI blijft eraf`);
      return;
    }
  }

  // EEN VERSE @sonny-OPDRACHT MOET OOK EEN ANTWOORD OPLEVEREN (Daimy 2026-07-27).
  // De sleutel hing alleen aan het laatste KLANTbericht. Was dat al beantwoord, dan stopte hij
  // hier, ook als het team daarna "@sunny antwoord" in het ticket zette. De notitie werd wel
  // als leerpunt gelezen (hierboven), maar er ging nooit een bericht naar de klant. Daimy:
  // "ik vind het echt heel irritant dat @sunny niet opgepakt wordt". Voorbeeld: ticket 966697967,
  // waar om 10:53 "@sunny antwoord" kwam en er twee uur niets gebeurde.
  // Door de tijd van de nieuwste onafgevinkte @sonny-notitie in de sleutel te zetten wordt het
  // een nieuwe sleutel, en pakt hij het gesprek opnieuw op.
  const verseOpdracht = (teamNotities || [])
    .filter((n) => /@s[ou]nny(?!\d)/i.test(String(n.tekst || '')) && !String(n.tekst || '').includes('✅'))
    .map((n) => String(n.tijd))
    .sort()
    .pop();
  const sleutel = verseOpdracht ? `${t.id}:${laatste.tijd}:opdracht${verseOpdracht}` : `${t.id}:${laatste.tijd}`;
  const staleClaim = (m) => m && m.claim && Date.now() - new Date(m.tijd).getTime() > 10 * 60000;
  if (state.verwerkt[sleutel] && !staleClaim(state.verwerkt[sleutel])) return; // al behandeld (verlopen claim mag opnieuw)

  // PURE BEVESTIGING NA AFRONDING (Hany 17 juli: "Ga ik doen 👍" / "👍🤝" liet de bot escaleren
  // en een verwarrende "schaduwmodus"-notitie plaatsen). Op een duimpje/kort bedankje reageer je
  // niet — geen agent-run, geen antwoord, geen escalatie, geen notitie. Alleen als het écht een
  // afsluitend bevestigingsberichtje is (emoji-only of kort "top/bedankt/ga ik doen"), nooit bij
  // een vraag (?) of een langer bericht.
  const zonderEmoji = laatste.tekst.replace(/[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]/gu, '').trim();
  const BEVESTIG_WOORDEN = BEVESTIG_WOORDEN_GEDEELD;
  // Bevestiging = geen vraag (?) én na verwijderen van emoji bestaat de tekst alleen uit
  // bevestigingswoorden (of is leeg = alleen emoji). Zo blijven echte vragen/verzoeken altijd
  // een antwoord krijgen, maar een "Top! Bedankt, ga ik doen 👍" niet.
  const woorden = zonderEmoji.toLowerCase().replace(/[!.,;:👍🤝🙏😊🎉'"()-]/g, ' ').split(/\s+/).filter(Boolean);
  // MAAR NIET ALS WIJ NET IETS VROEGEN (Daimy 2026-07-27, ticket 968750981). Vraagt de bot
  // "Zal ik alvast een prijsindicatie klaarzetten?" en antwoordt de klant "Prima", dan is dat
  // geen afsluitend bedankje maar gewoon JA. Die klant kreeg 2,5 uur niets omdat "prima" in de
  // bevestigingslijst staat. Gemeten over alle lokale WhatsApp-gesprekken: 9 keer zei een klant
  // kort ja op een concrete vraag en gebeurde er niets, tegen 142 keer een echt afscheid waar
  // zwijgen juist goed is. Daarom alleen zwijgen als ons laatste bericht GEEN vraag was.
  const onsLaatste = [...rows].reverse().find(r => r.van === 'sonty');
  // HEEL ons bericht bekijken, niet de laatste 200 tekens (Els, ticket 970642693, 1 aug):
  // de bot vroeg "zelf ondertekenen of zal ik hem in orde maken?" en zette daar procesuitleg
  // achter. De vraag viel buiten die 200 tekens, dus gold dit als "wij vroegen niets".
  const wijVroegenIets = /\?/.test(String(onsLaatste?.tekst || ''));
  // ALLE onbeantwoorde klantberichten meewegen, niet alleen het laatste. Els stuurde vier
  // inhoudelijke berichten ("zet het sws maar in gang") en sloot af met een ✅; op dat vinkje
  // zweeg de bot, waardoor haar akkoord nooit is verwerkt.
  const onsIdx = rows.map((r, i) => (r.van === 'sonty' ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  const naOns = rows.slice(onsIdx + 1).filter((r) => r.van !== 'sonty');
  const isEnkelBevestiging = (tekst) => {
    const ze = String(tekst || '').replace(/[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]/gu, '').trim();
    const w = ze.toLowerCase().replace(/[!.,;:👍🤝🙏😊🎉'"()-]/g, ' ').split(/\s+/).filter(Boolean);
    return !/\?/.test(tekst) && ze.length <= 45 && (w.length === 0 || w.every((x) => BEVESTIG_WOORDEN.has(x)));
  };
  const isBevestiging = !wijVroegenIets && !/\?/.test(laatste.tekst) && zonderEmoji.length <= 45 &&
    (woorden.length === 0 || woorden.every(w => BEVESTIG_WOORDEN.has(w))) &&
    (naOns.length <= 1 || naOns.every((r) => isEnkelBevestiging(r.tekst)));
  if (isBevestiging) {
    state.verwerkt[sleutel] = { tijd: new Date().toISOString(), bevestiging: true };
    console.log(`  ticket ${t.id}: pure bevestiging ("${laatste.tekst.slice(0, 20)}"), niet op reageren`);
    // AFSLUITEND DUIMPJE = GESPREK KLAAR → TICKET DICHT (Daimy 2026-08-30, +31642426847).
    // Dit pad stopte hier, vóór de sluit-logica verderop; de klant zei "👍" op ons laatste
    // bericht en het ticket bleef 13 dagen open bij Sunny. Zelfde poort als daar: alleen
    // WhatsApp in een live-modus, nooit met een lopende escalatie, en nooit als er een
    // service-melding of belofte in zit (mag-sluiten.js). Bot-tickets alleen: ons laatste
    // bericht moet van Sunny zijn, een collega die zelf appt sluit zijn eigen gesprek.
    try {
      const onsLaatsteRij = [...rows].reverse().find((r) => r.van === 'sonty');
      const liveModus = isWaTicket(t) && (sonnyActiefNu() || isActiefTicket(t) || isLiveTestContact(t));
      const vanSunny = onsLaatsteRij && Number(onsLaatsteRij.userId) === 747786;
      const lopendeEscalatie = (msgs?.data || []).some((m) => {
        const tk = m.body || m.message || '';
        return (m.internal_note || m.type === 'NOTE') && m.user_id === 747786 &&
          (OVERDRACHT_HERKENNING.test(tk) || /De AI kan dit niet zelf afhandelen en draagt het over/i.test(tk));
      });
      if (liveModus && vanSunny && !lopendeEscalatie) {
        const { magSluiten } = require('./mag-sluiten.js');
        const poort = magSluiten({
          klantTekst: rows.filter((r) => r.van !== 'sonty').map((r) => r.tekst).join(' '),
          antwoord: onsLaatsteRij.tekst, acties: [],
        });
        if (poort.mag) {
          const dicht = await tPost(`/tickets/${t.id}/close`, {});
          console.log(`  ${dicht.ok ? '✓ afsluitende bevestiging → ticket gesloten' : '⚠️ ticket sluiten mislukte: ' + dicht.status}`);
          log({ ticket: t.id, kanaal: 'WA', klant: t.contact?.phone || null, bevestigingGesloten: dicht.ok, laatsteKlantBericht: laatste.tekst });
        } else {
          console.log(`  ticket ${t.id} NIET gesloten na bevestiging (${poort.soort}: ${poort.reden})`);
        }
      }
    } catch (e) { console.error(`  [${t.id}] sluiten na bevestiging FOUT: ${e.message}`); }
    return;
  }

  // FEEDBACK-KANAAL (Daimy 2026-07-16): "feedback: ..." in het WhatsApp-gesprek = leerpunt,
  // opslaan in data/ai-ks/leerpunten.md (gaat per direct mee in de systemprompt) en kort
  // bevestigen. ALLEEN de nummers van Daimy en Joey (CFG.FEEDBACK_PHONES) — Jarne en
  // klanten mogen de bot niet herprogrammeren.
  const feedbackMatch = laatste.tekst.match(/^\s*feedback\s*[:\-]\s*([\s\S]+)/i);
  if (feedbackMatch && CFG.FEEDBACK_PHONES.includes(normPhone(t.contact?.phone))) {
    const punt = feedbackMatch[1].trim();
    fs.appendFileSync(path.join(path.dirname(CFG.LOG_FILE), 'leerpunten.md'), `- (${new Date().toISOString().slice(0, 10)}) ${punt}\n`);
    log({ ticket: t.id, feedback: punt, klant: t.contact?.full_name || t.contact?.phone });
    try { await sendLiveReply(t, 'Feedback opgeslagen en direct actief. Vanaf mijn volgende antwoord doe ik het zo.'); } catch {}
    await telegram(`🎓 WhatsApp-feedback van ${t.contact?.full_name || t.contact?.phone} opgeslagen als leerpunt:\n"${punt.substring(0, 400)}"\n\n(Staat in data/ai-ks/leerpunten.md en zit per direct in de prompt.)`);
    state.verwerkt[sleutel] = { tijd: new Date().toISOString(), feedback: true };
    return;
  }

  // Menselijke reactietijd (Daimy 17 juli: "de bot reageert binnen een minuut, dat is niet
  // menselijk — alleen op Daimy en Joey direct, de rest 3-5 min aanhouden"). Daimy + Joey
  // (FEEDBACK_PHONES) krijgen direct antwoord om te kunnen doortrainen; iedere andere klant
  // wacht 3-5 min. De wachttijd is stabiel per bericht (hash van ticket+tijd) zodat elke
  // poll-ronde dezelfde drempel gebruikt en het bundelen van snel-na-elkaar-berichten blijft werken.
  const directAntwoord = CFG.FEEDBACK_PHONES.includes(normPhone(t.contact?.phone));
  const leeftijdSec = (Date.now() - new Date(String(laatste.tijd).replace(' ', 'T'))) / 1000;
  if (!directAntwoord && isFinite(leeftijdSec)) {
    let h = 0; for (const c of sleutel) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const wachtSec = 180 + (h % 121); // 180-300s (3-5 min), vast per bericht
    if (leeftijdSec < wachtSec) return; // volgende poll-ronde
  }

  // VERZENDVENSTER (Daimy 2026-07-26): een klant krijgt NOOIT een bericht buiten de bot-uren
  // (08:00-21:00 Amsterdam). Aanleiding: ticket 968921413 (+31617722967) kreeg om 00:22 's nachts
  // antwoord omdat de actief-gesprek-tak het venster helemaal oversloeg. Buiten het venster doen
  // we niets: geen agent-run (scheelt ook credits), geen claim — het bericht blijft onbehandeld
  // en wordt de eerste poll-ronde ná 08:00 gewoon opgepakt. Testnummers van het team
  // (TEST_LIVE_PHONES/FEEDBACK_PHONES) blijven altijd doorgaan zodat Daimy kan blijven testen.
  if (isWaTicket(t) && !isLiveTestContact(t) && !CFG.binnenBotUren()) {
    if (isActiefTicket(t) || sonnyActiefNu()) {
      console.log(`  ticket ${t.id}: buiten verzendvenster (${CFG.BOT_UREN.start}-${CFG.BOT_UREN.eind}), wacht tot ${CFG.BOT_UREN.start}`);
      return;
    }
  }

  // CLAIM het bericht vóór de trage agent-run (30-90s): een tweede proces dat hetzelfde
  // bericht ziet slaat het dan over. Dit voorkwam-niet-gehad dubbel antwoorden (Nout, 16 juli).
  {
    const disk = loadState();
    const d = disk.verwerkt[sleutel];
    if (d && !staleClaim(d)) { state.verwerkt[sleutel] = d; return; }
  }
  state.verwerkt[sleutel] = { tijd: new Date().toISOString(), claim: true };
  saveState(state);

  // SONNY-persona en -intro ALLEEN wanneer de avonddienst expliciet aan staat
  // (.sonny-enabled + buiten openingstijden). Whitelist-nummers krijgen sinds het
  // werkmodus-besluit (Daimy 16 juli avond: "geen vermelding van Sonny") gewoon Jaimy —
  // de eerdere altijd-Sonny-op-whitelist testinstelling gaf Joey per ongeluk de intro.
  const sonnyMode = isWaTicket(t) && sonnyActiefNu();
  // Nachtmodus: nieuw WA-ticket direct als actief registreren (mag versturen + blijft beheerd)
  if (!sonnyMode && isWaTicket(t) && !isActiefTicket(t) && !isLiveTestContact(t) && nieuweTicketsToegestaan()) {
    const a = loadActief();
    a[t.id] = { sinds: new Date().toISOString(), klant: t.contact?.full_name || t.contact?.phone || null, bron: 'nachtmodus' };
    fs.writeFileSync(ACTIEF_FILE, JSON.stringify(a, null, 1));
    console.log(`  nieuw ticket ${t.id} geregistreerd als actief (nachtmodus)`);
  }
  // ACTIEF: door de AI beheerd klantgesprek → live antwoorden als Jaimy, zonder intro.
  const actiefTicket = !sonnyMode && isWaTicket(t) && isActiefTicket(t);
  const sonnyState = sonnyMode ? loadSonnyState() : null;
  const sonnyIntroNodig = sonnyMode && !sonnyState.introTickets[t.id];
  if (sonnyMode && sonnyIntroNodig && !isLiveTestContact(t)) {
    // Dagcap alleen voor NIEUWE gesprekken (lopende gesprekken maken we altijd af)
    const dag = CFG.amsterdamNu().datum;
    if ((sonnyState.dagTeller[dag] || 0) >= CFG.SONNY.MAX_GESPREKKEN_PER_DAG) {
      log({ ticket: t.id, sonny: true, overgeslagen: 'dagcap bereikt', klant: t.contact?.full_name || t.contact?.phone });
      state.verwerkt[sleutel] = { tijd: new Date().toISOString(), sonnyCap: true }; // team pakt het 's ochtends op
      return;
    }
  }

  const gesprek = {
    kanaal: t.channel?.type === 'WA_BUSINESS' ? 'WA' : 'EMAIL',
    klant: { naam: t.contact?.full_name || null, email: t.contact?.email || null, phone: t.contact?.phone || null },
    berichten: rows.slice(-25),
    liveTest: isLiveTestContact(t) || sonnyMode || actiefTicket, // actie-tools mogen echt uitvoeren
    sonny: sonnyMode,
    sonnyIntroNodig,
    teamNotities,
    ticketId: t.id,
    planningContext,
  };

  console.log(`Ticket ${t.id} (${gesprek.kanaal}, ${gesprek.klant.naam || 'onbekend'}): agent draait...`);
  const res = await beantwoord(gesprek);

  // Interne notitie samenstellen. In live-modus zijn de acties ÉCHT uitgevoerd — de oude
  // formulering "zou uitvoeren" (schaduwmodus) verwarde het team (vraag Daimy 16 juli).
  const actiesEcht = sonnyMode || actiefTicket || isLiveTestContact(t);
  const acties = res.acties.length
    ? `\n\n${actiesEcht ? 'Uitgevoerde acties:' : 'Acties die de AI zou uitvoeren (schaduwmodus, NIET uitgevoerd):'}\n` + res.acties.map(a => '- ' + JSON.stringify(a)).join('\n')
    : '';

  const liveTest = isLiveTestContact(t);
  // ESCALATIE NOOIT ZONDER KLANTBERICHT (Daimy 29-08: "waarom wordt dit niet gewoon zelf opgepakt"): kiest
  // het model voor escaleren_naar_mens zonder eigen antwoord, dan krijgt de klant tóch een warm bericht
  // (regel: perfect helpen of warm doorverwijzen — stilte is nooit een optie) mét een open vraag, zodat
  // Sunny het gesprek gewoon verder kan voeren als de klant reageert.
  if ((!res.antwoord || !String(res.antwoord).trim()) && Array.isArray(res.acties) && res.acties.some((a) => a.type === 'escalatie')) {
    let en = false; try { en = require('../lib/taal-voorkeur.js').isEngels(t.contact?.phone, t.contact?.email); } catch { /* nl */ }
    // voornaam alleen als er echt een voor- én achternaam staat (WhatsApp-profielnaam "Boot" → geen "Dank je, Boot!")
    const delen = String(t.contact?.full_name || '').trim().split(/\s+/).filter(Boolean);
    const vn = delen.length >= 2 && /^[A-Za-zÀ-ÿ'-]{2,}$/.test(delen[0]) ? delen[0] : '';
    res.antwoord = en
      ? `Thanks for your message${vn ? ', ' + vn : ''}! I've passed it on to my colleague, who will get back to you personally. If you tell me what you're still unsure about, I can probably already help you right now.`
      : `Dank je voor je bericht${vn ? ', ' + vn : ''}! Ik heb het doorgezet naar mijn collega, die neemt persoonlijk contact met je op. Vertel je me alvast waar je nog over twijfelt? Dan kan ik je waarschijnlijk nu al verder helpen.`;
    console.log(`  [${t.id}] escalatie zonder antwoord → standaard warm bericht toegevoegd`);
  }
  if (sonnyMode && res.antwoord) {
    const antwoordTekst = (sonnyIntroNodig ? CFG.SONNY.INTRO + '\n\n' : '') + res.antwoord;
    // Rustig, menselijk tempo (±1-3 min)
    const d = Math.min(CFG.SONNY.DELAY.maxSec, Math.max(CFG.SONNY.DELAY.minSec, CFG.SONNY.DELAY.baseSec + res.antwoord.length * CFG.SONNY.DELAY.perCharSec));
    console.log(`  Sonny typ-vertraging ${Math.round(d)}s...`);
    await new Promise(r => setTimeout(r, d * 1000));
    const sendRes = liveTest ? await sendLiveReply(t, antwoordTekst) : await sendSonnyReply(t, antwoordTekst);
    console.log(`  → SONNY antwoord verstuurd naar ${t.contact?.phone}: ${sendRes.ok ? 'OK' : 'FOUT ' + sendRes.status + ' ' + sendRes.body.substring(0, 200)}`);
    if (!sendRes.ok) {
      await telegram(`⚠️ Sonny verzenden MISLUKT op ticket ${t.id}: ${sendRes.status} ${sendRes.body.substring(0, 200)}`);
    } else {
      if (sonnyIntroNodig) {
        sonnyState.introTickets[t.id] = new Date().toISOString();
        if (!liveTest) {
          const dag = CFG.amsterdamNu().datum;
          sonnyState.dagTeller[dag] = (sonnyState.dagTeller[dag] || 0) + 1;
        }
      }
      saveSonnyState(sonnyState);
    }
  } else if (actiefTicket && res.antwoord) {
    // Actief klantgesprek: direct antwoorden als Jaimy (geen kunstmatige vertraging; de
    // klant wacht vaak al uren). Escalaties gaan zoals altijd stil naar Telegram.
    const sendRes = await sendActiefReply(t, res.antwoord);
    console.log(`  → ACTIEF antwoord verstuurd naar ${t.contact?.phone}: ${sendRes.ok ? 'OK' : 'FOUT ' + sendRes.status + ' ' + sendRes.body.substring(0, 200)}`);
    if (!sendRes.ok) await telegram(`⚠️ AI-KS actief-gesprek verzenden MISLUKT op ticket ${t.id}: ${sendRes.status} ${sendRes.body.substring(0, 200)}`);
    if (sendRes.ok) { try { require('../lib/brein.js').gebeurtenis('Sunny', `antwoord gestuurd aan ${(t.contact && t.contact.name) || 'klant'} (ticket ${t.id})`); } catch { /* brein is best effort */ } }
    if (sendRes.ok) { try { require('../lib/sunny-start.js').noteerSunnyVerstuurd(t.id); } catch { /* best effort */ } }
  } else if (liveTest && res.antwoord) {
    // Menselijke typ-vertraging (config REPLY_DELAY; uit tijdens test, aan bij livegang)
    if (CFG.REPLY_DELAY?.enabled) {
      const d = Math.min(CFG.REPLY_DELAY.maxSec, Math.max(CFG.REPLY_DELAY.minSec, CFG.REPLY_DELAY.baseSec + res.antwoord.length * CFG.REPLY_DELAY.perCharSec));
      console.log(`  typ-vertraging ${Math.round(d)}s...`);
      await new Promise(r => setTimeout(r, d * 1000));
    }
    // LIVE-TEST: alleen voor whitelist-nummers (Daimy's testnummer) — écht versturen
    const sendRes = await sendLiveReply(t, res.antwoord);
    console.log(`  → LIVE-TEST antwoord verstuurd naar ${t.contact?.phone}: ${sendRes.ok ? 'OK' : 'FOUT ' + sendRes.status + ' ' + sendRes.body.substring(0, 200)}`);
    if (!sendRes.ok) await telegram(`⚠️ AI-KS live-test verzenden MISLUKT op ticket ${t.id}: ${sendRes.status} ${sendRes.body.substring(0, 200)}`);
  } else if (CFG.MODE === 'shadow' && res.antwoord && !res.acties.some(a => a.type === 'escalatie')) {
    // Schaduwmodus-conceptnotitie ALLEEN als er echt een concept-antwoord te tonen is én er
    // geen escalatie is. Bij een escalatie kreeg het ticket anders TWEE notities: deze
    // technische dump én de nette overdracht-notitie (Daimy 17 juli: "weer dubbele notities,
    // voor onze mensen niet duidelijk"). De overdracht-notitie hieronder is dan genoeg.
    await plaatsNotitie(t.id, `🤖 AI-KLANTENSERVICE (schaduwmodus, NIET verstuurd)\n\nConcept-antwoord:\n${res.antwoord}${acties}`);
  } else if (CFG.MODE === 'live') {
    // LIVE verzenden — pas actief als Daimy .live-enabled aanmaakt. Nog bewust niet geïmplementeerd.
    console.log('LIVE-modus nog niet vrijgegeven; er is niets verstuurd.');
  }

  // Notitie-beleid (Daimy 16 juli): alleen een opmerking bij (1) uitgevoerde acties in
  // Reuzenpanda (offerte aangepast, inmeten doorgezet, offerte aangemaakt), (2) overdracht
  // aan het team met tag, (3) antwoorden op @sonny-notities (elders). Geen ruis per antwoord.
  const echtVerstuurd = (sonnyMode || actiefTicket || liveTest) && res.antwoord;
  const mutaties = res.acties.filter(a => a.type !== 'escalatie');
  if (echtVerstuurd && mutaties.length) {
    // Leesbaar voor het team, geen JSON-dump (Daimy 17 juli: "voor onze mensen niet duidelijk").
    const leesbaar = (a) => {
      if (a.type === 'offerte_aanpassen') return `Offerte aangepast: ${a.samenvatting || 'zie Reuzenpanda'}`;
      if (a.type === 'inmeet_afspraak') return `Inmeten doorgezet naar de planning voor ${a.klantNaam || 'de klant'} (${a.product || 'product onbekend'})${a.notitie ? `, notitie voor de planner: ${a.notitie}` : ''}`;
      if (a.type === 'offerte_aanmaken') return `Nieuwe offerte aangemaakt voor ${a.klant || 'de klant'}`;
      return a.samenvatting || a.type;
    };
    await plaatsNotitie(t.id, '🤖 Door de AI gedaan:\n' + mutaties.map(a => '• ' + leesbaar(a)).join('\n'));
  }

  // LABELS zetten zodat het team ziet wat de bedoeling is (Daimy 17 juli). Bot beantwoordde =
  // "🤖 AI Bot"; concrete acties krijgen hun stap-label; escalatie (hieronder) zet "👤 Mens nodig".
  if (isWaTicket(t) && echtVerstuurd) {
    await zetLabel(t.id, LABEL.AI_BOT);
    if (mutaties.some(a => a.type === 'inmeet_afspraak')) await zetLabel(t.id, LABEL.OPMETING);
    if (mutaties.some(a => a.type === 'offerte_aanpassen' || a.type === 'offerte_aanmaken')) await zetLabel(t.id, LABEL.OFFERTE_VERSTUURD);
    if (/bookings\.cloud\.microsoft/.test(res.antwoord || '')) await zetLabel(t.id, LABEL.SHOWROOM);
  }

  // Eerdere overdracht-notities van de bot in dít gesprek (tagsignatuur, nieuw + oud format).
  // Nodig voor de opruimlogica hieronder én om een gesprek met een nog lopende escalatie
  // nooit automatisch te sluiten (Rom-bug 20 juli).
  const eerdereEscalaties = (msgs?.data || []).filter(m => {
    const tk = m.body || m.message || '';
    return (m.internal_note || m.type === 'NOTE') && m.user_id === 747786 &&
      (OVERDRACHT_HERKENNING.test(tk) || /De AI kan dit niet zelf afhandelen en draagt het over/i.test(tk));
  });

  const escalatie = res.acties.find(a => a.type === 'escalatie');
  if (escalatie) {
    const wie = gesprek.klant.naam || gesprek.klant.phone || gesprek.klant.email;
    if (escalatie.leervraag) {
      // Leervraag (instructie Daimy): vraag naar Telegram zodat het antwoord aangeleerd kan worden
      fs.appendFileSync(path.join(path.dirname(CFG.LOG_FILE), 'leervragen.jsonl'), JSON.stringify({ tijd: new Date().toISOString(), ticket: t.id, klant: wie, vraag: laatste.tekst.substring(0, 500), toelichtingAI: escalatie.reden, status: 'open' }) + '\n');
      await telegram(`🎓 LEERVRAAG van klant ${wie} (ticket ${t.id}):\n\n"${laatste.tekst.substring(0, 400)}"\n\nAI: ${escalatie.reden.substring(0, 400)}\n\nAntwoord hier op Telegram, dan leer ik het de AI aan en ${escalatie.stil ? 'beantwoorden we de klant (gesprek staat nog open)' : 'weet hij het voortaan zelf'}.`);
    } else if (/hoog/i.test(escalatie.urgentie || '')) {
      // Alleen nog een Telegram-alarm bij HOGE urgentie (veiligheid). Gewone overdrachten niet
      // meer melden — het team ziet ze gewoon in de map Mens nodig (Daimy 20 juli).
      await telegram(`🚨 URGENTE escalatie, ticket ${t.id} (${wie}):\n${escalatie.reden}\n\nLaatste klantbericht: ${laatste.tekst.substring(0, 300)}`);
    }
    // Overdracht: ÉÉN duidelijk bericht met tag naar het team (beleid Daimy 16+17 juli:
    // "tag de juiste mensen en maak het in 1x duidelijk, niet alles op elkaar geramd").
    if (isWaTicket(t)) {
      // ÉÉN tagregel + de reden zelf, verder NIETS (Daimy 17 juli). De reden die de AI schrijft is
      // al compleet (wie, adres, telefoon, wat er mis is, welke actie nodig, context) — een wrapper
      // met kopjes en een extra "laatste bericht"-blok maakt er juist weer meerdere dingen op elkaar van.
      await plaatsNotitie(t.id, `${teamTags()}\n\n${String(escalatie.reden || '').trim()}`);
      // Label: een mens moet iets doen. "AI Bot" eraf, want de bot handelt dit niet af.
      await zetLabel(t.id, LABEL.MENS_NODIG);
      await haalLabelWeg(t.id, LABEL.AI_BOT);
      // Ook echt naar team "Mens nodig" toewijzen (Daimy 20 juli: escalaties horen in de
      // Mens nodig-map, net als bij e-mail — het label alleen zet hem daar niet in).
      const toegewezen = await tPost(`/tickets/${t.id}/assign`, { type: 'team', team_id: 431872 });
      // OVERDRACHT REGISTREREN VOOR ZELFHERSTEL (Liz van Driel 10-08). Mislukt de
      // toewijzing hier (zelfs na de retries), dan stond het ticket nergens: notitie wel,
      // map niet, en de belofte "een collega komt erop terug" hing in het luchtledige.
      // Daarom houden we elke overdracht 48 uur vast en controleert elke cyclus of hij
      // ook ECHT in de Mens nodig-map staat.
      state.overdrachten = state.overdrachten || {};
      state.overdrachten[t.id] = { op: new Date().toISOString(), gelukt: !!toegewezen.ok };
      if (!toegewezen.ok) console.log(`  ⚠️ [${t.id}] team-toewijzing Mens nodig MISLUKT (${toegewezen.status}) — zelfherstel pakt hem volgende cyclus`);
    }
  } else if (echtVerstuurd && isWaTicket(t) && eerdereEscalaties.length && res.opgelost) {
    // TÓCH ZELF GEHOLPEN na een eerdere overdracht (Daimy 2026-07-17: "als je toch iemand kan
    // helpen maar je hebt al collega's getagd in een comment, verwijder die comment dan ook").
    // ALLEEN op expliciete [OPGELOST]-claim van de agent (Rom-bug 20 juli: de bot antwoordde
    // op een bedankje en de opruiming gooide de nog LOPENDE escalatie-notitie weg — "antwoord
    // zonder escalatie" is geen bewijs dat het geëscaleerde probleem is opgelost).
    for (const m of eerdereEscalaties) {
      const weg = await verwijderNotitie(t.id, m.id);
      console.log(`  ${weg ? '✓ achterhaalde escalatie-notitie ' + m.id + ' verwijderd (probleem alsnog zelf opgelost)' : '⚠️ kon escalatie-notitie ' + m.id + ' niet verwijderen'}`);
    }
    // Labels omzetten: de bot doet het nu zelf → "Mens nodig" eraf, "AI Bot" erop,
    // en uit de Mens nodig-map: terug naar het Sonny-account (Daimy 20 juli).
    await haalLabelWeg(t.id, LABEL.MENS_NODIG); await zetLabel(t.id, LABEL.AI_BOT);
    await tPost(`/tickets/${t.id}/assign`, { type: 'user', user_id: 747786 });
  }

  // GESPREK KLAAR → TICKET SLUITEN (Daimy 20 juli, voorbeeld +31653832879): vindt de bot het
  // gesprek volledig afgerond ([KLAAR]-marker in het antwoord, of [STIL] op een afsluitend
  // bedankje), dan sluiten we het WhatsApp-ticket in Trengo. Nooit bij een escalatie in deze
  // beurt, en ook nooit zolang er een eerdere escalatie loopt die niet is opgelost; stuurt
  // de klant later toch weer iets, dan opent Trengo het ticket vanzelf weer.
  if (res.klaar && !escalatie && !(eerdereEscalaties.length && !res.opgelost) && isWaTicket(t) && (sonnyMode || actiefTicket || liveTest)) {
    // Zelfde poort als de e-mailkant: een service-/reparatiemelding of een belofte dat iemand
    // contact opneemt gaat nooit dicht, maar naar Mens nodig (Daimy 2026-08-02).
    const { magSluiten } = require('./mag-sluiten.js');
    const poort = magSluiten({
      klantTekst: rows.filter(r => r.van !== 'sonty').map(r => r.tekst).join(' '),
      antwoord: res.antwoord, acties: res.acties,
    });
    if (!poort.mag) {
      // Servicemelding: alleen open laten (Daimy 2026-08-06). Mens nodig blijft voor beloftes
      // en echte escalaties.
      if (poort.soort !== 'service') {
        await tPost(`/tickets/${t.id}/assign`, { type: 'team', team_id: 431872 });
        await zetLabel(t.id, LABEL.MENS_NODIG);
        await tPost(`/tickets/${t.id}/messages`, { internal_note: true, message: `👤 Ticket blijft OPEN bij Mens nodig: ${poort.reden}.` });
      }
      console.log(`  ticket ${t.id} NIET gesloten (${poort.soort}: ${poort.reden})`);
    } else {
      const dicht = await tPost(`/tickets/${t.id}/close`, {});
      console.log(`  ${dicht.ok ? '✓ gesprek klaar → ticket gesloten' : '⚠️ ticket sluiten mislukte: ' + dicht.status}`);
    }
  }

  // Terugkom-belofte in het zojuist beantwoorde klantbericht? Registreren voor de reminder.
  if ((sonnyMode || actiefTicket || liveTest) && res.antwoord && TERUGKOM_PATROON.test(laatste.tekst)) {
    const tk = loadTerugkomers();
    // ONTHOUD WANNEER DE KLANT ZEI TERUG TE KOMEN (Daimy 2026-08-04, Ebru +31616463983).
    // Zij schreef twee keer "ik laat het weten voor donderdag 6 augustus" en kreeg dinsdagochtend
    // al een reminder, want die ging altijd na 22 uur. Noemt iemand zelf een moment, dan houden
    // we ons daaraan; zegt hij niets concreets, dan blijft het 22 uur.
    const moment = terugkomMoment(laatste.tekst, new Date(String(laatste.tijd).replace(' ', 'T')).getTime());
    tk[t.id] = {
      klantTijd: laatste.tijd,
      phone: t.contact?.phone || null,
      naam: t.contact?.full_name || null,
      geregistreerd: new Date().toISOString(),
      opvolgenVanaf: new Date(moment.tijd).toISOString(),
      reden: moment.reden,
    };
    fs.writeFileSync(TERUGKOMERS_FILE, JSON.stringify(tk, null, 1));
    console.log(`  terugkomer geregistreerd → opvolgen vanaf ${new Date(moment.tijd).toLocaleString('nl-NL')} (${moment.reden})`);
  }

  state.verwerkt[sleutel] = { tijd: new Date().toISOString(), acties: res.acties.length };
  log({ ticket: t.id, kanaal: gesprek.kanaal, klant: gesprek.klant, laatsteKlantBericht: laatste.tekst.substring(0, 500), antwoord: res.antwoord, acties: res.acties, toolCalls: res.toolCalls, usage: res.usage, mode: CFG.MODE, sonny: sonnyMode, actief: actiefTicket });
  console.log(`  → notitie geplaatst (${res.acties.length} acties, ${res.toolCalls.length} tool-calls)`);
}

// Pending offerte-creaties afronden: RP heeft ±5-7 min nodig om lead+offerte aan te maken;
// daarna vullen we de offerte met de echte producten, zetten de status en appen de link.
async function verwerkPendingOffertes() {
  const { loadPending, savePending } = require('./rp-offerte-create.js');
  const { pasOfferteAan, zetStatus } = require('./rp-offerte-edit.js');
  const pending = loadPending();
  const open = pending.filter(p => p.status === 'wachten');
  if (!open.length) return;

  const board = await (async () => {
    try {
      const res = await fetch(`https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/boards/${CFG.RP_BOARD}/items`, { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } });
      return res.ok ? (await res.json()).items || [] : null;
    } catch { return null; }
  })();
  if (!board) return;

  for (const p of open) {
    if (Date.now() - p.aangemaakt > 25 * 60000) {
      p.status = 'timeout';
      await telegram(`⚠️ AI-KS: nieuwe offerte voor ${p.klantNaam} is na 25 min nog niet verschenen in RP (lcId ${p.lcId}). Handmatig checken.`);
      continue;
    }
    const item = board.find(i => i.item_subject?.id === p.lcId);
    if (!item) continue; // RP nog bezig
    let docs;
    try {
      docs = await (await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${p.lcId}`, { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } })).json();
    } catch { continue; }
    const doc = (docs?.quotationDatas || [])[0];
    if (!doc) continue; // offerte nog niet gegenereerd

    // Placeholder eruit, echte producten erin (incl. v4-verrijking + 7 dagen geldigheid)
    const res = await pasOfferteAan({ documentId: doc.documentId, verwijderen: ['offerte op maat', 'shutter', 'winkel offerte'], toevoegen: p.producten });
    if (res.error) {
      p.status = 'fout';
      await telegram(`⚠️ AI-KS: offerte vullen mislukt voor ${p.klantNaam}: ${res.error}`);
      continue;
    }
    await zetStatus(item.id, CFG.RP_STATUS_AI_OFFERTE_VERSTUURD).catch(() => {});

    // Link appen op het oorspronkelijke ticket (met whitelist-check)
    const tRes = await tGet(`/tickets/${p.ticketId}`);
    const ticket = tRes?.data || tRes;
    // TICKET ONBEKEND IS NIET HETZELFDE ALS GEEN LEVERPAD (Daimy 16-08, Leo Prins).
    // Lukt het ophalen niet, dan weten we niks over het kanaal en mogen we het geval niet
    // op 'onbezorgd' zetten — dat is eindstation en de klant blijft dan wachten. Op
    // 'wachten' laten staan betekent: volgende ronde opnieuw proberen.
    if (!ticket) {
      console.log(`  ! ticket ${p.ticketId} niet op te halen bij Trengo — volgende ronde opnieuw`);
      await telegram(`⚠️ AI-KS: ticket ${p.ticketId} (${p.klantNaam}) is even niet op te halen bij Trengo, dus ik weet het kanaal niet. De offerte staat klaar; ik probeer het de volgende ronde opnieuw. Link:\n${res.link}`);
      continue;
    }
    // Link mag naar de klant bij: whitelist-test, of een Sonny-gesprek (buiten openingstijden
    // aangemaakt; de nalevering zelf mag ook net ná opening nog, klant verwacht hem).
    const magSonnyLeveren = p.sonny && CFG.SONNY.enabled && ticket && isWaTicket(ticket);
    const voornaam = (p.klantNaam || '').split(' ')[0];
    // E-mail-ticket: de offerte-link per mail in hetzelfde ticket nasturen (het e-mailkanaal is
    // volledig live). Zonder deze tak zou een via e-mail aangemaakte offerte de klant nooit bereiken.
    const isEmailLevering = ticket && !isWaTicket(ticket) && (p.kanaal === 'EMAIL' || CFG.EMAIL_CHANNEL_NAMES.includes(ticket.channel?.title));
    if (isEmailLevering) {
      // Nette mailopbouw incl. afsluiting (Daimy 20 juli: "zo'n mail moet wel goed opgesteld, met vriendelijke groet etc.")
      const html = `<p>Hi ${voornaam},</p><p>Goed nieuws: je offerte staat klaar. Je bekijkt hem hier: <a href="${res.link}">${res.link}</a></p><p>Offertenummer: ${doc.quotationNumber || ''}<br>De offerte is 7 dagen geldig. Neem hem rustig door en laat het gerust weten als je nog vragen hebt of iets aangepast wilt hebben.</p><p>Met vriendelijke groet,<br>Sunny | Sonty</p>`;
      const sendRes = await tPost(`/tickets/${ticket.id}/messages`, { message: html });
      console.log(`  → pending offerte per mail geleverd aan ${p.klantNaam}: ${sendRes.ok ? 'OK' : 'FOUT ' + sendRes.status}`);
    } else if (ticket && (isLiveTestContact(ticket) || magSonnyLeveren || isActiefTicket(ticket))) {
      // ACTIEF-GESPREK-TAK (Daimy 2026-07-26). Deze ontbrak, waardoor de bot bij een
      // WhatsApp-klant in een actief gesprek de offerte wél aanmaakte en vulde, "je ontvangt de
      // link over een paar minuten" beloofde, en de link daarna weggooide. Geraakt: Yorenzo
      // Vermeulen (ticket 967801351) en Rogier Feis (967185427).
      const bericht = `Hi ${voornaam}, je offerte staat klaar. Je bekijkt hem hier: ${res.link}\n\nOffertenummer: ${doc.quotationNumber || ''}\nDe offerte is 7 dagen geldig. Neem hem rustig door en laat maar weten als je vragen hebt!`;
      const sendRes = isLiveTestContact(ticket)
        ? await sendLiveReply(ticket, bericht)
        : isActiefTicket(ticket) ? await sendActiefReply(ticket, bericht)
        : await tPost(`/tickets/${ticket.id}/messages`, { message: bericht, type: 'OUTBOUND' });
      console.log(`  → pending offerte geleverd aan ${p.klantNaam}: ${sendRes.ok ? 'OK' : 'FOUT ' + sendRes.status}`);
      if (!sendRes.ok) {
        // WhatsApp laat een gewoon bericht alleen toe binnen 24 uur na het laatste
        // klantbericht. Daarbuiten is het kanaal dicht en helpt opnieuw proberen niets meer:
        // dan moet het via de template of de telefoon (Yorenzo, 26 juli: HTTP 422 "valt buiten
        // het 24-uurs venster"). Eindeloos herhalen zou alleen de log volspammen.
        const venster = /24-uurs|24 uur|outside.*window/i.test(String(sendRes.body || ''));
        p.status = venster ? 'onbezorgd-venster' : 'wachten';
        await telegram(venster
          ? `🚫 AI-KS: offerte-link voor ${p.klantNaam} kan NIET meer via WhatsApp (ticket ${p.ticketId}) — het 24-uurs venster is verlopen. Bellen of de template gebruiken. Link:\n${res.link}`
          : `⚠️ AI-KS: offerte-link versturen MISLUKT bij ${p.klantNaam} (ticket ${p.ticketId}): ${sendRes.status}. Link: ${res.link}`);
        continue;
      }
    } else {
      // GEEN LEVERPAD (Daimy 2026-07-26): liever luidruchtig falen dan een klant die wacht op
      // een offerte die klaar ligt. Eerder verdween zo'n geval stil op 'klaar'. Geraakt:
      // Koos Schuurman (967634212) en Belinda Wildenberg (966171659).
      p.status = 'onbezorgd';
      await telegram(`⚠️ AI-KS: offerte voor ${p.klantNaam} is KLAAR maar er is geen leverpad (ticket ${p.ticketId}, kanaal ${ticket?.channel?.type || '?'}/${ticket?.channel?.title || '?'}). De klant heeft de link NIET. Handmatig sturen:\n${res.link}\nOffertenummer: ${doc.quotationNumber || ''}`);
      log({ pendingOfferte: p.lcId, klant: p.klantNaam, onbezorgd: true, link: res.link, ticket: p.ticketId });
      continue;
    }
    p.status = 'klaar';
    log({ pendingOfferte: p.lcId, klant: p.klantNaam, documentId: doc.documentId, regels: res.regelsNa, totaal: res.totaalIndicatie });
  }
  savePending(pending);
}

// TERUGKOMERS: klant zegt "ik kom er morgen op terug" (of vergelijkbaar) en blijft stil →
// na ~22 uur, nog nét binnen het 24-uurs WhatsApp-venster, één vriendelijke reminder
// (tekst van Daimy, 2026-07-16). Komt de klant zelf eerder terug, dan vervalt hij. Is het
// venster toch verlopen, dan een Telegram-melding dat bellen de enige route is.
const TERUGKOMERS_FILE = path.join(path.dirname(CFG.POLL_STATE_FILE), 'terugkomers.json');
// Korte remindertemplate voor als het 24-uursvenster dicht is (Daimy 2026-08-04, door hem zelf
// in Meta aangemaakt als "Reminder whatsapp sunny").
// Tekst: "Hoi {{1}}, even een kort berichtje over ons gesprek. Laat maar weten als ik nog ergens
// mee kan helpen!"
const REMINDER_TEMPLATE_ID = Number(process.env.REMINDER_TEMPLATE_ID || 0) || 243872;

/**
 * Is de template op dít moment goedgekeurd door Meta?
 *
 * Bewust elke keer live opvragen in plaats van een vlag in de code. Bij AB1 (242731) stond de
 * template in Trengo op ACCEPTED terwijl Meta hem alsnog weigerde, en toen kwamen 16 van de 18
 * berichten niet aan en bleven er lege tickets achter. Een status die je niet controleert is een
 * aanname, en die kost hier klantcontact.
 */
async function templateBruikbaar(id) {
  if (!id) return false;
  try {
    const r = await tGet(`/wa_templates/${id}`);
    const d = r?.data || r;
    return String(d?.status || d?.state || '').toUpperCase() === 'ACCEPTED';
  } catch { return false; }
}
function loadTerugkomers() { try { return JSON.parse(fs.readFileSync(TERUGKOMERS_FILE, 'utf8')); } catch { return {}; } }
const TERUGKOM_PATROON = /(kom\w*[^.!?]{0,30}op terug|laat\w* (het|je)[^.!?]{0,20}weten|even overleggen|overlegg?\w* met|er[^.!?]{0,20}voor zitten|denk\w* er[^.!?]{0,15}over na|morgen[^.!?]{0,25}(terug|weten|verder|bevestig)|(vanavond|morgen|dit weekend|volgende week)[^.!?]{0,15}op terug)/i;

async function verwerkTerugkomers() {
  const tk = loadTerugkomers();
  const ids = Object.keys(tk);
  if (!ids.length) return;
  for (const tid of ids) {
    const info = tk[tid];
    const uur = (Date.now() - new Date(String(info.klantTijd).replace(' ', 'T')).getTime()) / 3600000;
    if (!isFinite(uur)) continue;
    // Wachten tot het moment dat de klant zelf noemde. Oude regels zonder dat veld vallen terug
    // op de 22 uur van voorheen.
    const vanaf = info.opvolgenVanaf ? new Date(info.opvolgenVanaf).getTime() : null;
    if (vanaf ? Date.now() < vanaf : uur < 22) continue;
    const res = await tGet(`/tickets/${tid}`);
    const t = res?.data || res;
    if (!t || t.status !== 'OPEN') { delete tk[tid]; continue; }
    const msgs = await haalBerichten(tid);
    const inbound = (msgs?.data || []).filter(m => m.type === 'INBOUND').map(m => String(m.created_at)).sort();
    if (inbound.length && inbound[inbound.length - 1] > String(info.klantTijd)) { delete tk[tid]; continue; } // klant kwam zelf al terug
    // VENSTER DICHT: dan mag een vrij bericht niet meer, maar een goedgekeurde template wel
    // (Daimy 2026-08-04: "maak 1 template aan die je kan sturen, kort en simpel kan altijd").
    // Dit gebeurt vaak, want wie zegt "ik laat het donderdag weten" is tegen die tijd allang
    // voorbij de 24 uur. Zonder deze route bleef er alleen een Telegram-melding over.
    if (uur >= 23.7) {
      delete tk[tid];
      const voornaamT = bruikbareVoornaam(info.naam);
      const tel = info.phone || null;
      let gelukt = false;
      if (tel && await templateBruikbaar(REMINDER_TEMPLATE_ID)) {
        const tw = await fetch('https://app.trengo.com/api/v2/wa_sessions', {
          method: 'POST', headers: { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient_phone_number: tel, hsm_id: REMINDER_TEMPLATE_ID, channel_id: 1359857,
            params: [{ type: 'body', key: '{{1}}', value: voornaamT || 'daar' }] }),
        });
        gelukt = tw.ok;
        if (!tw.ok) console.error(`  [${tid}] remindertemplate mislukt: ${tw.status} ${(await tw.text()).slice(0, 160)}`);
      }
      if (gelukt) {
        await plaatsNotitie(tid, `🤖 AI-KS: het 24-uursvenster was dicht, daarom de korte remindertemplate gestuurd (klant zei terug te komen: ${info.reden || 'geen moment genoemd'}).`);
        await telegram(`⏰ Remindertemplate gestuurd aan ${info.naam || tel} (venster was dicht, klant beloofde terug te komen).`);
      } else {
        await telegram(`⏰ Terugkomer gemist: ${info.naam || info.phone} beloofde terug te komen maar bleef stil en het WhatsApp-venster is nu dicht.${REMINDER_TEMPLATE_ID ? ' De remindertemplate is nog niet goedgekeurd of kon niet verstuurd worden.' : ''} Bellen is de enige route.`);
      }
      continue;
    }
    if (!(isActiefTicket(t) || isLiveTestContact(t))) { delete tk[tid]; continue; }
    // Geen emoji als aanhef: Ebru stond in Trengo als "🤷🏻‍♀️" en kreeg letterlijk "Hoi 🤷🏻‍♀️,".
    const voornaam = bruikbareVoornaam(info.naam);
    const tekst = `Hoi${voornaam ? ' ' + voornaam : ''}, kleine reminder vanaf mijn kant: als ik nog ergens bij kan helpen, laat het maar weten!`;
    const sendRes = isLiveTestContact(t) ? await sendLiveReply(t, tekst) : await sendActiefReply(t, tekst);
    delete tk[tid];
    if (sendRes.ok) {
      await plaatsNotitie(tid, `🤖 AI-KS: vriendelijke reminder gestuurd (klant beloofde terug te komen en bleef ~22 uur stil).`);
      await telegram(`⏰ Reminder gestuurd aan ${info.naam || info.phone} (beloofde terug te komen, bleef ~22 uur stil).`);
      log({ ticket: Number(tid), reminder: true, antwoord: tekst, actief: true });
    } else {
      await telegram(`⚠️ Reminder aan ${info.naam || info.phone} kon niet verstuurd worden: ${sendRes.status}`);
    }
    await new Promise(r => setTimeout(r, 400));
  }
  fs.writeFileSync(TERUGKOMERS_FILE, JSON.stringify(tk, null, 1));
}

let laatsteActiefSweep = 0;
let laatsteNotitieSweep = 0;
let laatsteTerugkomerCheck = 0;

let sweepOffset = 0;
async function pollRonde(state, { onlyTest, sonnyOnly }) {
  // hartslag: aanbod-replies laat Sunny's eigen voorstellen aan Sunny zolang hij aantoonbaar draait
  try { require('../lib/sunny-start.js').schrijfHeartbeat(); } catch { /* best effort */ }
  // --sonny-only (AI-dienst-cron): buiten openingstijden bedient Sonny alle WA-klanten
  // (mits .sonny-enabled). Binnen openingstijden — of zolang Sonny uit staat — alleen de
  // whitelist-testnummers live, zodat we overdag doortrainen zonder dat klanten iets
  // merken (opdracht Daimy 2026-07-16). Geen schaduwnotities in deze modus.
  const sonnyNu = sonnyActiefNu();
  const effOnlyTest = onlyTest || (sonnyOnly && !sonnyNu);
  try { await verwerkPendingOffertes(); } catch (e) { console.error('pending-offertes FOUT:', e.message); }
  // ZELFHERSTEL OVERDRACHTEN (Liz van Driel 10-08): een overdracht is pas een overdracht
  // als het ticket ook echt in de Mens nodig-map staat. Rate-limits lieten notitie en
  // toewijzing uit elkaar lopen; hier controleren we elke recente overdracht en zetten we
  // hem alsnog goed. Verdwenen of gesloten tickets vallen vanzelf van de lijst.
  try {
    state.overdrachten = state.overdrachten || {};
    for (const [tid, info] of Object.entries(state.overdrachten)) {
      if (Date.now() - Date.parse(info.op) > 48 * 3600000) { delete state.overdrachten[tid]; continue; }
      const r = await fetch(`https://app.trengo.com/api/v2/tickets/${tid}`, { headers: TH });
      if (r.status === 429) continue; // druk: volgende cyclus
      if (!r.ok) { delete state.overdrachten[tid]; continue; }
      const tk = (await r.json()).data || {};
      if (String(tk.status).toUpperCase() === 'CLOSED') { delete state.overdrachten[tid]; continue; }
      if (Number(tk.team_id) === 431872) { delete state.overdrachten[tid]; continue; } // staat goed
      const her = await tPost(`/tickets/${tid}/assign`, { type: 'team', team_id: 431872 });
      await zetLabel(tid, LABEL.MENS_NODIG);
      console.log(`  zelfherstel: overdracht ${tid} ${her.ok ? 'alsnog in de Mens nodig-map gezet' : 'NOG STEEDS niet toe te wijzen (' + her.status + ')'}`);
      if (her.ok) delete state.overdrachten[tid];
    }
  } catch (e) { console.error('zelfherstel-overdrachten FOUT:', e.message); }
  // Terugkomer-reminders: elke 15 min checken (venster 22u-23,7u na laatste klantbericht)
  if (Date.now() - laatsteTerugkomerCheck > 15 * 60000) {
    laatsteTerugkomerCheck = Date.now();
    try { await verwerkTerugkomers(); } catch (e) { console.error('terugkomers FOUT:', e.message); }
  }
  const specificTicket = process.argv.includes('--ticket') ? process.argv[process.argv.indexOf('--ticket') + 1] : null;

  let tickets = [];
  if (specificTicket) {
    const t = await tGet(`/tickets/${specificTicket}`);
    if (t) tickets = [t.data || t];
  } else {
    // Open tickets van de relevante kanalen (nieuwste eerst). Was 3 pagina's = 75 tickets,
    // terwijl er ~406 open staan: alles daaronder werd nooit gezien tenzij het in
    // actieve-tickets.json stond (Daimy 2026-07-26, aanleiding Herman van Kaam 965782453 en
    // Pim 964070481 die 2 dagen zonder antwoord bleven).
    for (let page = 1; page <= 12; page++) {
      const data = await tGet(`/tickets?page=${page}`);
      // OOK ASSIGNED (Daimy 2026-07-27: "ook al staat die ergens aan toegewezen moet je die
      // dingen wel oppakken"). De scan pakte alleen OPEN, waardoor een @sonny-notitie op een
      // ticket dat aan een collega is toegewezen structureel werd gemist. Op 27 juli stonden er
      // zo vijf opdrachten open, waarvan twee al dagen. Antwoorden naar de klant gebeurt hier
      // niet: verwerkTicket() ziet aan aanMensToegewezen() dat het ticket van een mens is en
      // verwerkt dan alleen de notitie, tenzij er een verse @sonny-opdracht ligt.
      const rows = (data?.data || []).filter(t => (t.status === 'OPEN' || t.status === 'ASSIGNED') && isRelevantTicket(t));
      tickets.push(...rows);
      if (!data?.links?.next) break;
    }
  }

  // whitelist-modus: alleen whitelist-tickets + actieve (AI-beheerde) gesprekken aanraken;
  // alle andere volledig negeren (ook geen notities)
  if (effOnlyTest) {
    const actief = loadActief();
    const nachtmodus = nieuweTicketsToegestaan();
    tickets = tickets.filter(tt => isLiveTestContact(tt) || !!actief[tt.id] || (nachtmodus && isWaTicket(tt)));
  }
  // --sonny-only: alleen WhatsApp (Sonny doet geen e-mail in de testfase)
  if (sonnyOnly) tickets = tickets.filter(isWaTicket);

  console.log(`[${new Date().toLocaleTimeString()}] AI-KS (${CFG.MODE.toUpperCase()}${effOnlyTest ? ', WHITELIST-ONLY' : ''}${sonnyNu ? ', SONNY ACTIEF' : ''}): ${tickets.length} kandidaat-tickets`);

  // ACTIEF-SWEEP (elke 5 min): actieve gesprekken direct op ID ophalen. De paginascan hierboven
  // mist tickets die dieper in de lijst staan (notities duwen een ticket niet omhoog), waardoor
  // @sonny-notities daar bleven liggen — ontdekt 16 juli.
  if (!specificTicket && Date.now() - laatsteActiefSweep > 2 * 60000) {
    laatsteActiefSweep = Date.now();
    // 28-08 (Daimy's test "ander moement" bleef liggen): (1) 609 actieve gesprekken één voor
    // één ophalen = Trengo-429-storm van minuten; nu per sweep de 30 nieuwste + een roterend
    // blok van 120, zodat verse gesprekken altijd binnen 2 min aan de beurt zijn. (2) Een
    // ticket dat via een WhatsApp-template is geopend staat ASSIGNED op het bot-account,
    // niet OPEN — dat telde niet mee. (3) Gesloten tickets gaan uit de actieve lijst.
    const actiefAlles = Object.entries(loadActief())
      .filter(([id]) => !tickets.some(t => String(t.id) === String(id)))
      .sort((a, b) => String(b[1]?.sinds || '').localeCompare(String(a[1]?.sinds || '')))
      .map(([id]) => id);
    const nieuwste = actiefAlles.slice(0, 30);
    const rest = actiefAlles.slice(30);
    // blok van 40: de 12-pagina-scan dekt de actieve OPEN/ASSIGNED-tickets al; de sweep is
    // alleen het vangnet voor diepere tickets — 40 per 2 min = alles binnen ~25 min gezien
    const blok = rest.length ? rest.slice(sweepOffset % rest.length).concat(rest.slice(0, sweepOffset % rest.length)).slice(0, 40) : [];
    sweepOffset += 40;
    const actiefIds = [...new Set([...nieuwste, ...blok])];
    if (actiefIds.length) console.log(`  actief-sweep: ${actiefIds.length} van ${actiefAlles.length} gesprekken direct checken`);
    let opgeruimd = 0;
    for (const tid of actiefIds) {
      try {
        const res = await tGet(`/tickets/${tid}`);
        const at = res?.data || res;
        const bijBot = Number(at?.assigned_user_id ?? at?.user_id) === 747786;
        if (at && (at.status === 'OPEN' || (at.status === 'ASSIGNED' && bijBot))) tickets.push(at);
        else if (at && at.status === 'CLOSED') {
          try { const a = loadActief(); if (a[tid]) { delete a[tid]; fs.writeFileSync(ACTIEF_FILE, JSON.stringify(a, null, 1)); opgeruimd++; } } catch { /* opruimen is extra */ }
        }
      } catch (e) { console.error('  actief-sweep FOUT', tid, e.message); }
      await new Promise(r => setTimeout(r, 300));
    }
    if (opgeruimd) console.log(`  actief-sweep: ${opgeruimd} gesloten gesprek(ken) uit de actieve lijst gehaald`);
  }
  // NOTITIE-SWEEP (Daimy 2026-07-27, derde poging op dit probleem). Een @sonny-notitie duwt een
  // ticket NIET omhoog in de ticketlijst: latest_message_at blijft op het laatste echte bericht
  // staan. Een oud gesprek met een verse opdracht zakt dus weg voorbij de pagina's die we scannen,
  // en de actief-sweep hierboven pakt alleen gesprekken uit actieve-tickets.json. Precies wat
  // gebeurde bij ticket 966697967: om 10:53 kwam er "@sunny antwoord" en de bot zag het nooit.
  //
  // Daarom hier één keer per 5 minuten álle open en toegewezen WhatsApp-tickets langslopen en per
  // ticket alleen pagina 1 van de berichten ophalen. Dat is genoeg: Trengo geeft nieuwste eerst,
  // dus een verse notitie staat er altijd op. Eén call per ticket, met throttle.
  if (!specificTicket && Date.now() - laatsteNotitieSweep > 5 * 60000) {
    laatsteNotitieSweep = Date.now();
    try {
      const kandidaten = [];
      for (const status of ['OPEN', 'ASSIGNED']) {
        for (let p = 1; p <= 40; p++) {
          const data = await tGet(`/tickets?status=${status}&page=${p}`);
          const rows = (data?.data || []).filter(isWaTicket);
          kandidaten.push(...rows);
          if (!data?.links?.next || (data?.data || []).length < 25) break;
        }
      }
      const alBekend = new Set(tickets.map((t) => String(t.id)));
      let erbij = 0;
      for (const kt of kandidaten) {
        if (alBekend.has(String(kt.id))) continue;
        const msgs = await tGet(`/tickets/${kt.id}/messages`);
        const intern = (msgs?.data || []).filter((m) => m.internal_note || m.type === 'NOTE');
        const opdrachten = intern.filter((m) => /@s[ou]nny(?!\d)/i.test(String(m.body || m.message || '')) && !String(m.body || m.message || '').includes('✅'));
        if (!opdrachten.length) continue;
        const laatsteOpdracht = opdrachten.map((m) => String(m.created_at)).sort().pop();
        const laatsteVink = intern.filter((m) => String(m.body || m.message || '').includes('✅')).map((m) => String(m.created_at)).sort().pop();
        if (laatsteVink && laatsteVink > laatsteOpdracht) continue; // al afgehandeld
        kt._msgs = msgs; // hergebruiken, scheelt een tweede call in verwerkTicket
        tickets.push(kt);
        erbij++;
        console.log(`  notitie-sweep: ticket ${kt.id} heeft een openstaande @sonny-opdracht van ${laatsteOpdracht}`);
        await new Promise((r) => setTimeout(r, 90));
      }
      if (erbij) console.log(`  notitie-sweep: ${erbij} gesprek(ken) met een openstaande opdracht toegevoegd`);
    } catch (e) { console.error('  notitie-sweep FOUT:', e.message); }
  }

  // Parallel met 3 werkers i.p.v. één voor één: een agent-run duurt 1-4 min, waardoor
  // @sonny-notities en klantberichten anders minutenlang in de rij stonden (klacht Daimy
  // 17 juli: "waarom duurt mijn reactie op de comments steeds zo lang?"). Claim-early +
  // merge-on-save in de state maken dit veilig; dedupe op id voorkomt dubbele runs.
  const rij = [...new Map(tickets.map(t => [String(t.id), t])).values()];
  // NOTITIE-VOORRANG (Daimy 17 juli: "notities moet je zien als nieuwe berichten, ik wil daar
  // gelijk een reactie op"). Berichten één keer per kandidaat ophalen (verwerkTicket hergebruikt
  // ze via t._msgs) en gesprekken met een verse @sonny-notitie vooraan in de rij zetten.
  let nStat = {};
  try { nStat = JSON.parse(fs.readFileSync(NOTITIE_STATE, 'utf8')); } catch {}
  const fetchRij = [...rij];
  await Promise.all(Array.from({ length: Math.min(5, fetchRij.length) }, async () => {
    let t;
    while ((t = fetchRij.shift())) {
      try { t._msgs = await haalBerichten(t.id); } catch {}
    }
  }));
  const verseNotitie = (t) => (t._msgs?.data || []).some(m => {
    const tekst = String(m.body || m.message || '');
    return (m.internal_note || m.type === 'NOTE') && /@s[ou]nny(?!\d)/i.test(tekst) &&
      !tekst.includes('✅') && !nStat[`${t.id}:${m.created_at}`];
  });
  // WHITELIST-VOORRANG (Daimy 21 juli: "op mij en Joey z'n nummer mag je direct antwoorden"):
  // testnummers altijd vooraan in de rij, daarna gesprekken met een verse @sonny-notitie.
  const prioriteit = (t) => (isLiveTestContact(t) ? 2 : 0) + (verseNotitie(t) ? 1 : 0);
  rij.sort((a, b) => prioriteit(b) - prioriteit(a));
  await Promise.all(Array.from({ length: Math.min(3, rij.length) }, async () => {
    let t;
    while ((t = rij.shift())) {
      try { await verwerkTicket(t, state); }
      catch (e) {
        console.error(`Ticket ${t.id} FOUT:`, e.message);
        log({ ticket: t.id, fout: String(e.message || e) });
        if (/credit balance/i.test(String(e.message || e))) await alertCreditsOp();
      }
      saveState(state);
    }
  }));
  // State beperken tot laatste 2000 entries
  const keys = Object.keys(state.verwerkt);
  if (keys.length > 2000) for (const k of keys.slice(0, keys.length - 2000)) delete state.verwerkt[k];
  saveState(state);
}

(async () => {
  const state = loadState();
  const onlyTest = process.argv.includes('--only-test');
  const sonnyOnly = process.argv.includes('--sonny-only');
  const watchIdx = process.argv.indexOf('--watch');
  const watchMin = watchIdx >= 0 ? parseInt(process.argv[watchIdx + 1] || '60', 10) : 0;

  if (watchIdx >= 0) {
    const oneindig = !watchMin; // --watch 0 = permanent (launchd KeepAlive herstart ons bij crash, "moet gewoon altijd aanstaan", Daimy 17 juli)
    console.log(`Watch-modus: elke 30s pollen, ${oneindig ? 'PERMANENT' : watchMin + ' minuten'}${onlyTest ? ' (alleen whitelist-nummers)' : ''}${sonnyOnly ? ' (alleen Sonny/WA)' : ''}.`);
    const tot = oneindig ? Infinity : Date.now() + watchMin * 60000;
    while (Date.now() < tot) {
      await pollRonde(state, { onlyTest, sonnyOnly });
      await new Promise(r => setTimeout(r, 30000));
    }
    console.log('Watch-venster afgelopen.');
  } else {
    await pollRonde(state, { onlyTest, sonnyOnly });
    console.log('Klaar.');
  }
})();
