#!/usr/bin/env node
// AI-Klantenservice daemon — SCHADUWMODUS
// Pollt Trengo op nieuwe inkomende berichten (WA + Aanvragen/Klantenservice e-mail),
// laat de agent een concept-antwoord maken en plaatst dat als INTERNE NOTITIE bij het ticket.
// De klant ziet niets. Escalaties gaan óók naar Telegram.
//
// Draaien: node scripts/ai-ks/daemon.js            (één poll-ronde; zet in cron elke 5 min)
//          node scripts/ai-ks/daemon.js --ticket 963416960   (één specifiek ticket, voor test)
const fs = require('fs');
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

async function tGet(ep) {
  const res = await fetch('https://app.trengo.com/api/v2' + ep, { headers: TH });
  if (!res.ok) return null;
  return res.json();
}
async function tPost(ep, body) {
  // Trengo geeft af en toe 429 "Too Many Attempts" — zonder retry ging het antwoord dan
  // verloren (Pieter 20:15, Vruchi 19:20 op 16 juli). 429 = niets verzonden, dus veilig
  // om opnieuw te proberen: 3 pogingen met 20s/40s wachttijd.
  let laatste = { ok: false, status: 429, body: 'Too Many Attempts (na 3 pogingen)' };
  for (let poging = 1; poging <= 3; poging++) {
    const res = await fetch('https://app.trengo.com/api/v2' + ep, { method: 'POST', headers: TH, body: JSON.stringify(body) });
    laatste = { ok: res.ok, status: res.status, body: await res.text().catch(() => '') };
    if (res.status !== 429) return laatste;
    if (poging < 3) {
      console.log(`  Trengo 429 — nieuwe poging over ${poging * 20}s...`);
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
  try {
    const res = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/labels`, { method: 'POST', headers: TH, body: JSON.stringify({ label_id: labelId }) });
    return res.ok;
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
  await telegram('🚨🚨 ANTHROPIC CREDITS OP — er wacht NU een klant op antwoord en de AI-klantenservice staat stil!\n\nBijladen: console.anthropic.com/settings/billing → Buy credits.');
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

// Laatste verdedigingslinie: elke uitgaande klanttekst gaat hier eerst doorheen.
function veiligeKlantTekst(tekst) {
  const s = schoonKlantTekst(tekst);
  return s;
}

async function sendSonnyReply(t, tekst) {
  tekst = veiligeKlantTekst(tekst);
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

async function verwerkTicket(t, state) {
  if (aanMensToegewezen(t)) {
    // Toegewezen aan een collega → nooit ANTWOORDEN, maar @sonny-notities WEL verwerken
    // (Daimy 23-07: dagstand-feedback op een aan hem toegewezen ticket werd gemist).
    try {
      const msgsMens = t._msgs || await tGet(`/tickets/${t.id}/messages`);
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
  const msgs = t._msgs || await tGet(`/tickets/${t.id}/messages`);
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
    const laatsteUit = (msgs?.data || []).filter(m => m.type === 'OUTBOUND' && !m.internal_note)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    if (laatsteUit && laatsteUit.user_id && Number(laatsteUit.user_id) !== 747786) {
      // Daimy zelf nooit automatisch toewijzen (Daimy 23-07) — bot blijft er wel vanaf
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
    const overdrachten = ruweBerichten.filter(m => (m.internal_note || m.type === 'NOTE') && m.user_id === 747786 &&
      (/@jorren745487[\s\S]*@tanya748440/.test(String(m.body || m.message || '')) || /De AI kan dit niet zelf afhandelen en draagt het over/i.test(String(m.body || m.message || ''))));
    if (isWaTicket(t) && overdrachten.length) {
      if (Number(t.team_id) === 431872) return; // ligt al in de Mens nodig-map — team ziet het
      const laatsteKlant = ruweBerichten.filter(m => m.type === 'INBOUND').map(m => String(m.created_at)).sort().pop() || '';
      const laatsteOverdracht = overdrachten.map(m => String(m.created_at)).sort().pop() || '';
      if (laatsteKlant > laatsteOverdracht) {
        console.log(`  [${t.id}] klant reageerde opnieuw op overgedragen (service)gesprek → terug naar Mens nodig`);
        try {
          await plaatsNotitie(t.id, `@jorren745487 @tanya748440\n\nKlant reageerde opnieuw op dit eerder overgedragen gesprek — direct terug in Mens nodig gezet, de bot blijft eraf.`);
          await zetLabel(t.id, LABEL.MENS_NODIG);
          await tPost(`/tickets/${t.id}/assign`, { type: 'team', team_id: 431872 });
        } catch (e) { console.error(`  [${t.id}] service-heropening FOUT: ${e.message}`); }
        const actief = loadActief();
        if (actief[t.id]) { delete actief[t.id]; fs.writeFileSync(ACTIEF_FILE, JSON.stringify(actief, null, 1)); }
        return;
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
        verstuurd = tw.ok;
        if (tw.ok) await plaatsNotitie(t.id, `✅ 24-uursvenster was dicht — goedgekeurde follow-up-template verstuurd i.p.v. vrij bericht. Zodra de klant reageert is het venster weer open en kan het gesprek verder.`);
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

  const laatste = rows[rows.length - 1];
  if (laatste.van !== 'klant') return; // alleen reageren als het laatste bericht van de klant is

  const sleutel = `${t.id}:${laatste.tijd}`;
  const staleClaim = (m) => m && m.claim && Date.now() - new Date(m.tijd).getTime() > 10 * 60000;
  if (state.verwerkt[sleutel] && !staleClaim(state.verwerkt[sleutel])) return; // al behandeld (verlopen claim mag opnieuw)

  // PURE BEVESTIGING NA AFRONDING (Hany 17 juli: "Ga ik doen 👍" / "👍🤝" liet de bot escaleren
  // en een verwarrende "schaduwmodus"-notitie plaatsen). Op een duimpje/kort bedankje reageer je
  // niet — geen agent-run, geen antwoord, geen escalatie, geen notitie. Alleen als het écht een
  // afsluitend bevestigingsberichtje is (emoji-only of kort "top/bedankt/ga ik doen"), nooit bij
  // een vraag (?) of een langer bericht.
  const zonderEmoji = laatste.tekst.replace(/[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]/gu, '').trim();
  const BEVESTIG_WOORDEN = new Set(['top','ok','oke','oké','oké','dank','dankje','dankjewel','dankuwel','danku','bedankt','thanks','thx','ga','ik','doen','het','is','goed','prima','super','perfect','helemaal','fijn','duidelijk','je','u','voor','alvast','mooi','gelukt','jullie','jij','ja','yes','klopt','oké','oke','begrepen','snap']);
  // Bevestiging = geen vraag (?) én na verwijderen van emoji bestaat de tekst alleen uit
  // bevestigingswoorden (of is leeg = alleen emoji). Zo blijven echte vragen/verzoeken altijd
  // een antwoord krijgen, maar een "Top! Bedankt, ga ik doen 👍" niet.
  const woorden = zonderEmoji.toLowerCase().replace(/[!.,;:👍🤝🙏😊🎉'"()-]/g, ' ').split(/\s+/).filter(Boolean);
  const isBevestiging = !/\?/.test(laatste.tekst) && zonderEmoji.length <= 45 &&
    (woorden.length === 0 || woorden.every(w => BEVESTIG_WOORDEN.has(w)));
  if (isBevestiging) {
    state.verwerkt[sleutel] = { tijd: new Date().toISOString(), bevestiging: true };
    console.log(`  ticket ${t.id}: pure bevestiging ("${laatste.tekst.slice(0, 20)}") — niet op reageren`);
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
    await plaatsNotitie(t.id, `🤖 AI-KLANTENSERVICE (schaduwmodus — NIET verstuurd)\n\nConcept-antwoord:\n${res.antwoord}${acties}`);
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
      if (a.type === 'inmeet_afspraak') return `Inmeten doorgezet naar de planning voor ${a.klantNaam || 'de klant'} (${a.product || 'product onbekend'})${a.notitie ? ` — notitie voor de planner: ${a.notitie}` : ''}`;
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
      (/@jorren745487[\s\S]*@tanya748440/.test(tk) || /De AI kan dit niet zelf afhandelen en draagt het over/i.test(tk));
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
      await telegram(`🚨 URGENTE escalatie — ticket ${t.id} (${wie}):\n${escalatie.reden}\n\nLaatste klantbericht: ${laatste.tekst.substring(0, 300)}`);
    }
    // Overdracht: ÉÉN duidelijk bericht met tag naar het team (beleid Daimy 16+17 juli:
    // "tag de juiste mensen en maak het in 1x duidelijk, niet alles op elkaar geramd").
    if (isWaTicket(t)) {
      // ÉÉN tagregel + de reden zelf, verder NIETS (Daimy 17 juli). De reden die de AI schrijft is
      // al compleet (wie, adres, telefoon, wat er mis is, welke actie nodig, context) — een wrapper
      // met kopjes en een extra "laatste bericht"-blok maakt er juist weer meerdere dingen op elkaar van.
      await plaatsNotitie(t.id, `@jorren745487 @tanya748440\n\n${String(escalatie.reden || '').trim()}`);
      // Label: een mens moet iets doen. "AI Bot" eraf, want de bot handelt dit niet af.
      await zetLabel(t.id, LABEL.MENS_NODIG);
      await haalLabelWeg(t.id, LABEL.AI_BOT);
      // Ook echt naar team "Mens nodig" toewijzen (Daimy 20 juli: escalaties horen in de
      // Mens nodig-map, net als bij e-mail — het label alleen zet hem daar niet in).
      await tPost(`/tickets/${t.id}/assign`, { type: 'team', team_id: 431872 });
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
    const dicht = await tPost(`/tickets/${t.id}/close`, {});
    console.log(`  ${dicht.ok ? '✓ gesprek klaar → ticket gesloten' : '⚠️ ticket sluiten mislukte: ' + dicht.status}`);
  }

  // Terugkom-belofte in het zojuist beantwoorde klantbericht? Registreren voor de reminder.
  if ((sonnyMode || actiefTicket || liveTest) && res.antwoord && TERUGKOM_PATROON.test(laatste.tekst)) {
    const tk = loadTerugkomers();
    tk[t.id] = { klantTijd: laatste.tijd, phone: t.contact?.phone || null, naam: t.contact?.full_name || null, geregistreerd: new Date().toISOString() };
    fs.writeFileSync(TERUGKOMERS_FILE, JSON.stringify(tk, null, 1));
    console.log('  terugkomer geregistreerd → reminder na ~22u stilte');
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
    } else if (ticket && (isLiveTestContact(ticket) || magSonnyLeveren)) {
      const bericht = `Hi ${voornaam}, je offerte staat klaar. Je bekijkt hem hier: ${res.link}\n\nOffertenummer: ${doc.quotationNumber || ''}\nDe offerte is 7 dagen geldig. Neem hem rustig door en laat maar weten als je vragen hebt!`;
      const sendRes = isLiveTestContact(ticket)
        ? await sendLiveReply(ticket, bericht)
        : await tPost(`/tickets/${ticket.id}/messages`, { message: bericht, type: 'OUTBOUND' });
      console.log(`  → pending offerte geleverd aan ${p.klantNaam}: ${sendRes.ok ? 'OK' : 'FOUT ' + sendRes.status}`);
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
function loadTerugkomers() { try { return JSON.parse(fs.readFileSync(TERUGKOMERS_FILE, 'utf8')); } catch { return {}; } }
const TERUGKOM_PATROON = /(kom\w*[^.!?]{0,30}op terug|laat\w* (het|je)[^.!?]{0,20}weten|even overleggen|overlegg?\w* met|er[^.!?]{0,20}voor zitten|denk\w* er[^.!?]{0,15}over na|morgen[^.!?]{0,25}(terug|weten|verder|bevestig)|(vanavond|morgen|dit weekend|volgende week)[^.!?]{0,15}op terug)/i;

async function verwerkTerugkomers() {
  const tk = loadTerugkomers();
  const ids = Object.keys(tk);
  if (!ids.length) return;
  for (const tid of ids) {
    const info = tk[tid];
    const uur = (Date.now() - new Date(String(info.klantTijd).replace(' ', 'T')).getTime()) / 3600000;
    if (!isFinite(uur) || uur < 22) continue;
    const res = await tGet(`/tickets/${tid}`);
    const t = res?.data || res;
    if (!t || t.status !== 'OPEN') { delete tk[tid]; continue; }
    const msgs = await tGet(`/tickets/${tid}/messages`);
    const inbound = (msgs?.data || []).filter(m => m.type === 'INBOUND').map(m => String(m.created_at)).sort();
    if (inbound.length && inbound[inbound.length - 1] > String(info.klantTijd)) { delete tk[tid]; continue; } // klant kwam zelf al terug
    if (uur >= 23.7) {
      delete tk[tid];
      await telegram(`⏰ Terugkomer gemist: ${info.naam || info.phone} beloofde terug te komen maar bleef stil en het WhatsApp-venster is nu dicht. Bellen is de enige route.`);
      continue;
    }
    if (!(isActiefTicket(t) || isLiveTestContact(t))) { delete tk[tid]; continue; }
    const voornaam = (info.naam || '').split(' ')[0];
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
let laatsteTerugkomerCheck = 0;

async function pollRonde(state, { onlyTest, sonnyOnly }) {
  // --sonny-only (AI-dienst-cron): buiten openingstijden bedient Sonny alle WA-klanten
  // (mits .sonny-enabled). Binnen openingstijden — of zolang Sonny uit staat — alleen de
  // whitelist-testnummers live, zodat we overdag doortrainen zonder dat klanten iets
  // merken (opdracht Daimy 2026-07-16). Geen schaduwnotities in deze modus.
  const sonnyNu = sonnyActiefNu();
  const effOnlyTest = onlyTest || (sonnyOnly && !sonnyNu);
  try { await verwerkPendingOffertes(); } catch (e) { console.error('pending-offertes FOUT:', e.message); }
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
    // Open tickets van de relevante kanalen, eerste 3 pagina's (nieuwste eerst)
    for (let page = 1; page <= 3; page++) {
      const data = await tGet(`/tickets?page=${page}`);
      const rows = (data?.data || []).filter(t => t.status === 'OPEN' && isRelevantTicket(t));
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
    const actiefIds = Object.keys(loadActief()).filter(id => !tickets.some(t => String(t.id) === String(id)));
    if (actiefIds.length) console.log(`  actief-sweep: ${actiefIds.length} gesprekken direct checken`);
    for (const tid of actiefIds) {
      try {
        const res = await tGet(`/tickets/${tid}`);
        const at = res?.data || res;
        if (at && at.status === 'OPEN') tickets.push(at);
      } catch (e) { console.error('  actief-sweep FOUT', tid, e.message); }
      await new Promise(r => setTimeout(r, 300));
    }
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
      try { t._msgs = await tGet(`/tickets/${t.id}/messages`); } catch {}
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
    const oneindig = !watchMin; // --watch 0 = permanent (launchd KeepAlive herstart ons bij crash — "moet gewoon altijd aanstaan", Daimy 17 juli)
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
