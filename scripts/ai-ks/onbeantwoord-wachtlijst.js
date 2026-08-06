#!/usr/bin/env node
/**
 * ONBEANTWOORDE-KLANT-WACHTLIJST (Daimy 2026-07-26)
 *
 * Aanleiding: Herman van Kaam (ticket 965782453) en Pim (964070481) appten op 24 juli een
 * concrete vraag en kregen 2 dagen lang van niemand antwoord. Niet door een storing, maar door
 * een gat in het ontwerp: de bot blijft met opzet van tickets af die aan een mens zijn
 * toegewezen (status ASSIGNED). Doet die mens niets, dan valt het gesprek stil en ziet niemand
 * het. Precies die gevallen vangt dit script op.
 *
 * Werkwijze: Trengo geeft per ticket latest_message_at én latest_received_message_at. Zijn die
 * gelijk, dan is het laatste bericht in het gesprek van de KLANT en wacht die dus op antwoord.
 * Dat scheelt een messages-call per ticket (bij 400+ tickets het verschil tussen seconden en
 * minuten).
 *
 * Gebruik:
 *   node scripts/ai-ks/onbeantwoord-wachtlijst.js            → rapport op Telegram + stdout
 *   node scripts/ai-ks/onbeantwoord-wachtlijst.js --dry       → alleen stdout, geen Telegram
 *   node scripts/ai-ks/onbeantwoord-wachtlijst.js --uren 8    → andere drempel (standaard 4)
 */

const fs = require('fs');
const path = require('path');
const { getToken } = require('../trengo-api.js');
const CFG = require('./config.js');

const DRY = process.argv.includes('--dry');
const DREMPEL_UREN = process.argv.includes('--uren')
  ? Number(process.argv[process.argv.indexOf('--uren') + 1])
  : 4;

// Trengo-gebruikers, zodat het rapport zegt wie het laat liggen in plaats van een user_id.
const USERS = {
  736327: 'Daimy', 736329: 'Nanny', 745486: 'Joey', 745487: 'Jorren',
  745488: 'Jaimy', 745489: 'Sjoerd', 747786: 'AI (Sunny)', 748440: 'Tanya',
};

async function telegram(tekst) {
  if (DRY) return;
  await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: tekst }),
  }).catch((e) => console.error('telegram FOUT', e.message));
}

async function haalAlle(jwt, status) {
  const H = { Authorization: 'Bearer ' + jwt };
  const uit = [];
  for (let p = 1; p <= 400; p++) {
    const r = await fetch(`https://app.trengo.com/api/v2/tickets?status=${status}&page=${p}`, { headers: H });
    if (!r.ok) { console.error(`${status} pagina ${p}: HTTP ${r.status}`); break; }
    const j = await r.json();
    const d = j.data || [];
    uit.push(...d);
    if (d.length < 25) break;
  }
  return uit;
}

// ── RUIS ERUIT ──
// Zonder filters komen er 429 van de 438 tickets op de lijst en kijkt niemand er meer naar.
// Wat eraf moet, en waarom:
//  - eigen scan-/systeemmail (Scan | Sonty Montage, no-reply): geen klant die wacht
//  - pure bevestigingen ("Top dankuwel", "🙏🏻👌🏻"): daar hoort geen antwoord op, zelfde
//    regel als de bot zelf gebruikt
//  - automatische antwoorden (out-of-office): de klant wacht juist niet

// ALLEEN KLANTENSERVICE-KANALEN (Daimy 2026-07-26: "die 169, zo veel zie ik er niet").
// Terecht: van de 435 open/toegewezen tickets zitten er 248 in Scans, 101 in Orders en 39 in
// Werkbon. Dat zijn geen klantgesprekken maar interne stromen, en niemand bekijkt die als
// klantenservice. Meegerekend gaf dat 169 "wachtende klanten"; alleen op de echte kanalen zijn
// het 40. Filteren op kanaal, niet alleen op afzender.
const KS_KANALEN = ['Aanvragen', 'Klantenservice', 'info@ mailbox'];
function isKlantenserviceKanaal(t) {
  return t.channel?.type === 'WA_BUSINESS' || KS_KANALEN.includes(t.channel?.title);
}

const EIGEN_MAIL = /(^|@)(scan|noreply|no-reply|postmaster|mailer-daemon)|@(sonty\.nl|sontymontage\.nl)$/i;

const BEVESTIG_WOORDEN = new Set(['top', 'ok', 'oke', 'oké', 'dank', 'dankje', 'dankjewel', 'dankuwel', 'danku',
  'bedankt', 'thanks', 'thx', 'ga', 'ik', 'doen', 'het', 'is', 'goed', 'prima', 'super', 'perfect', 'helemaal',
  'fijn', 'duidelijk', 'je', 'u', 'voor', 'alvast', 'mooi', 'gelukt', 'jullie', 'jij', 'ja', 'yes', 'klopt',
  'begrepen', 'snap', 'weekend', 'dag', 'avond', 'groet', 'groeten', 'gr']);

function isBevestiging(tekst) {
  const zonderEmoji = String(tekst).replace(/[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]/gu, '').trim();
  if (/\?/.test(tekst) || zonderEmoji.length > 45) return false;
  const woorden = zonderEmoji.toLowerCase().replace(/[!.,;:*'"()-]/g, ' ').split(/\s+/).filter(Boolean);
  return woorden.length === 0 || woorden.every((w) => BEVESTIG_WOORDEN.has(w));
}

const AUTO_ANTWOORD = /(niet aanwezig|afwezig|out of office|automatisch antwoord|automatic reply|mail wordt niet (gelezen|gecontroleerd)|ben ik weer terug|ben er weer|vakantie tot)/i;

function isRuis(w) {
  const adres = String(w.naam || '');
  if (EIGEN_MAIL.test(adres) || EIGEN_MAIL.test(String(w.email || ''))) return 'eigen/systeemmail';
  if (/webflow/i.test(String(w.email || '')) || /webflow/i.test(adres)) return 'webflow-lead (apart afgehandeld)';
  if (/^scan\b|sonty montage/i.test(adres)) return 'eigen scanmail';
  if (!w.tekst) return 'leeg bericht';
  if (isBevestiging(w.tekst) && !w.meerOnbeantwoord) return 'pure bevestiging';
  if (AUTO_ANTWOORD.test(w.tekst)) return 'automatisch antwoord';
  return null;
}

// "3 dagen", "5 uur" — leesbaarder dan 76.4 uur.
function duur(uren) {
  if (uren < 24) return `${Math.round(uren)} uur`;
  const d = Math.floor(uren / 24);
  return `${d} ${d === 1 ? 'dag' : 'dagen'}`;
}

(async () => {
  const jwt = await getToken();
  const tickets = [...await haalAlle(jwt, 'OPEN'), ...await haalAlle(jwt, 'ASSIGNED')];

  const nu = Date.now();
  const wachtend = [];
  let buitenKS = 0;
  for (const t of tickets) {
    // Scans/Orders/Werkbon zijn interne stromen, geen klantenservice — die horen hier niet in.
    if (!isKlantenserviceKanaal(t)) { buitenKS++; continue; }
    // Laatste bericht is van de klant → niemand heeft nog geantwoord.
    if (!t.latest_received_message_at || t.latest_message_at !== t.latest_received_message_at) continue;
    const sinds = new Date(String(t.latest_received_message_at).replace(' ', 'T') + 'Z').getTime();
    if (!isFinite(sinds)) continue;
    const uren = (nu - sinds) / 3600000;
    if (uren < DREMPEL_UREN) continue;
    wachtend.push({
      id: t.id,
      uren,
      teamId: t.team_id || null,
      wie: t.user_id ? (USERS[t.user_id] || `user ${t.user_id}`) : null,
      naam: t.contact?.full_name || t.contact?.phone || t.contact?.email || 'onbekend',
      email: t.contact?.email || '',
      sindsIso: String(t.latest_received_message_at),
      kanaal: t.channel?.type === 'WA_BUSINESS' ? 'WA' : 'mail',
      labels: (t.labels || []).map((l) => l.name),
      tekst: String(t.latest_received_message?.body_plain || t.latest_received_message?.message || '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
  }
  // BEVESTIGING MET INHOUD ERVOOR (Els, ticket 970642693, 1 aug): een klant die vijf berichten
  // stuurt en afsluit met een duimpje viel als "pure bevestiging" uit het rapport, terwijl haar
  // akkoord onbeantwoord bleef. Alleen voor die enkele tickets één extra call: staan er ná ons
  // laatste bericht meerdere klantberichten, dan is het géén afsluitend duimpje.
  for (const w of wachtend) {
    if (!isBevestiging(w.tekst)) continue;
    try {
      const m = await fetch(`https://app.trengo.com/api/v2/tickets/${w.id}/messages?per_page=10`, { headers: { Authorization: 'Bearer ' + jwt } });
      const rows = (await m.json())?.data || [];
      const onsIdx = rows.findIndex((x) => String(x.type).toUpperCase() === 'OUTBOUND'); // nieuwste eerst
      const naOns = (onsIdx === -1 ? rows : rows.slice(0, onsIdx)).filter((x) => String(x.type).toUpperCase() === 'INBOUND');
      if (naOns.length > 1) w.meerOnbeantwoord = true;
    } catch { /* lookup mag het rapport nooit breken */ }
  }

  // Ruis eruit, en tellen wát eruit ging — zodat het rapport nooit stil dingen weglaat.
  const ruisRedenen = {};
  const echt = wachtend.filter((w) => {
    const r = isRuis(w);
    if (r) { ruisRedenen[r] = (ruisRedenen[r] || 0) + 1; return false; }
    return true;
  });
  wachtend.length = 0;
  wachtend.push(...echt);
  wachtend.sort((a, b) => b.uren - a.uren);

  // OPGEPAKT BUITEN TRENGO OM (Jorren 06-08: "wordt vermeld bij iets dat allang is
  // opgepakt"): een interne notitie NA het laatste klantbericht = iemand is ermee
  // bezig (gebeld, afgehandeld). Die hoort niet meer in het rapport.
  for (let i = wachtend.length - 1; i >= 0; i--) {
    const w = wachtend[i];
    try {
      const m = await fetch(`https://app.trengo.com/api/v2/tickets/${w.id}/messages?per_page=10`, { headers: { Authorization: 'Bearer ' + jwt } });
      const rows = (await m.json())?.data || [];
      const klantTijd = new Date(w.sindsIso.replace(' ', 'T') + 'Z').getTime();
      const notitieNa = rows.some((x) => (x.internal_note || String(x.type).toUpperCase() === 'NOTE')
        && new Date(String(x.created_at).replace(' ', 'T')).getTime() > klantTijd);
      if (notitieNa) { wachtend.splice(i, 1); ruisRedenen['al opgepakt (notitie na klantbericht)'] = (ruisRedenen['al opgepakt (notitie na klantbericht)'] || 0) + 1; }
    } catch { /* lookup mag het rapport nooit breken */ }
  }

  // EENMAAL MELDEN PER KLANTBERICHT (zelfde klacht): hetzelfde wachtende bericht komt
  // niet elke run opnieuw in het Telegram-rapport.
  const GEMELD_PAD = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'wachtlijst-gemeld.json');
  let gemeld = {};
  try { gemeld = JSON.parse(fs.readFileSync(GEMELD_PAD, 'utf8')); } catch {}
  const versGemeld = [];
  for (let i = wachtend.length - 1; i >= 0; i--) {
    const w = wachtend[i];
    const sleutel = w.id + ':' + w.sindsIso;
    if (gemeld[sleutel]) { wachtend.splice(i, 1); ruisRedenen['al eerder gemeld'] = (ruisRedenen['al eerder gemeld'] || 0) + 1; }
    else versGemeld.push(sleutel);
  }
  if (!DRY) {
    for (const sl of versGemeld) gemeld[sl] = new Date().toISOString();
    // oude sleutels (>30 dagen) opruimen zodat het bestand niet eindeloos groeit
    for (const [k, v] of Object.entries(gemeld)) if (Date.now() - Date.parse(v) > 30 * 86400000) delete gemeld[k];
    fs.writeFileSync(GEMELD_PAD, JSON.stringify(gemeld, null, 1));
  }

  const ruisTotaal = Object.values(ruisRedenen).reduce((a, b) => a + b, 0);
  console.log(`${tickets.length} tickets bekeken, ${wachtend.length} klanten wachten écht langer dan ${DREMPEL_UREN} uur op antwoord`);
  console.log(`(${buitenKS} buiten de klantenservice-kanalen gelaten: Scans/Orders/Werkbon e.d.)`);
  console.log(`(${ruisTotaal} eruit gefilterd: ${Object.entries(ruisRedenen).map(([k, v]) => `${v} ${k}`).join(', ') || 'niets'})`);

  if (!wachtend.length) {
    // Nul-melding uitgezet (Daimy 30 juli, meldingen-opschoning): alleen loggen.
    console.log(`geen klant wacht langer dan ${DREMPEL_UREN} uur — geen Telegram-bericht`);
    return;
  }

  // ── NAAR MENS NODIG-TEAM (Daimy 31-07, casus Katie 962345594: "geen spoed-alarmen,
  // heel mijn Telegram is een zooi — tickets moeten gewoon naar het Mens nodig-team").
  // Elke wachtende klant zonder toegewezen agent die nog niet in team Mens nodig (431872)
  // ligt, wordt hier automatisch aan dat team toegewezen + gelabeld. Stil, geen Telegram.
  const MENS_TEAM = 431872, LABEL_MENS = 1821764;
  const H2 = { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' };
  let doorgezet = 0;
  for (const w of wachtend) {
    if (w.wie) continue;                       // al bij een mens, die is verantwoordelijk
    if (Number(w.teamId) === MENS_TEAM) continue; // ligt al in de Mens nodig-map
    if (DRY) { console.log(`  [dry] zou #${w.id} (${w.naam}) naar Mens nodig-team zetten`); doorgezet++; continue; }
    try {
      await fetch(`https://app.trengo.com/api/v2/tickets/${w.id}/assign`, { method: 'POST', headers: H2, body: JSON.stringify({ type: 'team', team_id: MENS_TEAM }) });
      await fetch(`https://app.trengo.com/api/v2/tickets/${w.id}/labels`, { method: 'POST', headers: H2, body: JSON.stringify({ label_id: LABEL_MENS }) }).catch(() => {});
      doorgezet++;
      console.log(`  → #${w.id} (${w.naam}, wacht ${duur(w.uren)}) naar Mens nodig-team gezet`);
    } catch (e) { console.error(`  toewijzen #${w.id} mislukt:`, e.message); }
  }
  if (doorgezet) console.log(`${doorgezet} wachtende klant(en) ${DRY ? 'zouden' : ''} naar het Mens nodig-team ${DRY ? 'gaan' : 'gezet'}`);

  // Toegewezen gevallen eerst: daar is iemand verantwoordelijk en gebeurt er tóch niets.
  const toegewezen = wachtend.filter((w) => w.wie);
  const vrij = wachtend.filter((w) => !w.wie);
  const urgent = wachtend.filter((w) => w.labels.some((l) => /urgent|mens nodig/i.test(l)));

  // WhatsApp laat een gewoon bericht alléén toe binnen 24 uur na het laatste klantbericht.
  // Daarna is het kanaal dicht: je kunt de klant niet meer normaal antwoorden, alleen nog
  // bellen of een template sturen. Te laat reageren kost dus permanent het kanaal (ontdekt
  // 26 juli bij Yorenzo, ticket 967801351: HTTP 422 op een link die 4 dagen te laat was).
  // Daarom apart markeren: DICHT als het al voorbij is, KRAP in de laatste 4 uur.
  const vensterVlag = (w) => {
    if (w.kanaal !== 'WA') return '';
    if (w.uren >= 24) return ' ⛔WA-VENSTER DICHT (alleen bellen/template)';
    if (w.uren >= 20) return ' ⏰WA-venster verloopt binnen ' + Math.max(1, Math.round(24 - w.uren)) + ' uur';
    return '';
  };
  const regel = (w) => `• ${w.naam} (${w.kanaal}, #${w.id}) wacht ${duur(w.uren)}${w.wie ? ` — bij ${w.wie}` : ''}${w.labels.length ? ` [${w.labels.join(', ')}]` : ''}${vensterVlag(w)}\n  "${w.tekst.substring(0, 120)}"`;

  // Klanten waar het WhatsApp-venster NU aan het verlopen is, gaan bovenaan: daar is de
  // tijdsdruk echt, want na 24 uur kun je ze niet meer normaal terugappen.
  const krap = wachtend.filter((w) => w.kanaal === 'WA' && w.uren >= 20 && w.uren < 24);
  const dicht = wachtend.filter((w) => w.kanaal === 'WA' && w.uren >= 24);

  let bericht = `⏳ WACHTLIJST: ${wachtend.length} klanten wachten langer dan ${DREMPEL_UREN} uur op antwoord.\n`;
  if (krap.length) bericht += `\n⏰ NU HANDELEN, WhatsApp-venster verloopt vandaag (${krap.length}):\n${krap.map(regel).join('\n')}\n`;
  if (dicht.length) bericht += `\n⛔ ${dicht.length} WhatsApp-klanten zijn al buiten het 24-uurs venster: die kun je niet meer terugappen, alleen bellen.\n`;
  if (urgent.length) bericht += `\nMet Urgent/Mens-nodig-label (${urgent.length}):\n${urgent.slice(0, 10).map(regel).join('\n')}\n`;
  if (toegewezen.length) {
    const perPersoon = {};
    for (const w of toegewezen) perPersoon[w.wie] = (perPersoon[w.wie] || 0) + 1;
    bericht += `\nToegewezen aan een mens (${toegewezen.length}): ${Object.entries(perPersoon).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}\n`;
    bericht += toegewezen.slice(0, 10).map(regel).join('\n') + '\n';
  }
  if (vrij.length) bericht += `\nNiet toegewezen (${vrij.length}), langst wachtend:\n${vrij.slice(0, 8).map(regel).join('\n')}\n`;

  console.log('\n' + bericht);
  // Rapport-Telegram alleen in de ochtend- en middagrun (Daimy wil minder Telegram-ruis);
  // de team-toewijzing hierboven draait wel elke run.
  const uurNu = Number(new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  if (uurNu !== 8 && uurNu !== 16) { console.log('(geen rapport-Telegram op dit uur, alleen team-toewijzing)'); return; }
  // Telegram kapt af op 4096 tekens; ruim eronder blijven en dat eerlijk melden.
  await telegram(bericht.length > 3800 ? bericht.substring(0, 3800) + '\n\n(afgekapt, zie volledige lijst met: node scripts/ai-ks/onbeantwoord-wachtlijst.js --dry)' : bericht);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
