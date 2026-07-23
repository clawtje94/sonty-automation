#!/usr/bin/env node
// OPVOLGING — SCHADUW-VERSIE (opdracht Daimy 21 juli: "eerst verzinnen en uitwerken, nog
// niet aanzetten"). Deze versie bevat BEWUST GEEN verzendcode: hij kan technisch niets naar
// klanten sturen. Hij loopt het lijstje na zoals een verkoper, en schrijft per kandidaat een
// VOORSTEL (opvolgen ja/nee + conceptbericht) naar data/ai-ks/opvolging-voorstellen.jsonl.
//
// Doelgroep (Daimy): mensen met wie wij al contact hebben via WhatsApp of mail — die zeiden
// "ik kom er op terug", of die gewoon een opvolger verdienen. GEEN bulk (de oude
// followup-scripts blijven uit), en 100% zeker dat de klant niet al gereageerd of getekend
// heeft. Alle checks zijn FAIL-CLOSED: bij twijfel of een mislukte check → géén opvolging.
//
// LIVE-MANDAAT (Daimy 23-07): twee subsets worden ECHT verstuurd:
//   1) WA-snelvenster: klant reageerde niet op ons laatste bericht, ticket niet toegewezen
//      en niet bij Mens nodig -> follow-up VOORDAT het 24u-venster sluit.
//   2) E-mail: zelfde condities, na 3 tot ~4,5 dagen stilte.
// Al het overige (oudere WA-gesprekken e.d.) blijft SCHADUW-voorstel.
// Gebruik: node scripts/ai-ks/opvolging-daemon.js [--dagen 14] [--max 15]
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const CFG = require('./config.js');
const { buildKlantContext } = require('./klant-context.js');

const DATA = path.join(__dirname, '..', '..', 'data', 'ai-ks');
const LOG = path.join(DATA, 'log.jsonl');
const STATE_FILE = path.join(DATA, 'opvolging-state.json');
const VOORSTELLEN = path.join(DATA, 'opvolging-voorstellen.jsonl');
const KILL = path.join(DATA, 'OPVOLGING_STOP');

const MIN_STIL_DAGEN = 3;   // pas opvolgen als de klant minstens zo lang stil is
const MAX_STIL_DAGEN = 14;  // ouder = laten rusten (geen mosterd na de maaltijd)
const RUST_DAGEN = 30;      // minimale tijd tussen twee opvolgingen bij dezelfde klant
// WA-snelvenster (Daimy 22 juli, n.a.v. Gino Kos): zelfde-dag opvolgen zolang het
// WhatsApp 24-uursvenster nog open is, dan hoeft er geen betaald template achteraan.
// Venster telt vanaf het laatste KLANTbericht; 20 uur = marge zodat we niet op de rand sturen.
const SNEL_MIN_STIL_UREN = 4;    // pas na zoveel uur stilte op ons laatste bericht
const SNEL_MAX_KLANT_UREN = 20;  // laatste klantbericht max zo oud, anders venster (bijna) dicht
const HERBEOORDEEL_UREN = 24;    // zelfde ticket niet vaker dan 1x per dag beoordelen
const TEAM_MENS_NODIG = 431872;
const LIVE_MAIL_MAX_DAGEN = 4.5; // mail-follow-up live rond dag 3-4 (Daimy 23-07)

let TT;
try { TT = fs.readFileSync(path.join(__dirname, '.trengo-sonny-token.txt'), 'utf8').trim(); }
catch { TT = fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim(); }
// Trengo deelt de rate-limit met de lopende daemons → 429 is normaal; 3 pogingen met backoff.
const tGet = async (ep) => {
  for (let poging = 1; poging <= 3; poging++) {
    const r = await fetch('https://app.trengo.com/api/v2' + ep, { headers: { Authorization: 'Bearer ' + TT } });
    if (r.ok) return r.json();
    if (r.status !== 429) return null;
    await new Promise(res => setTimeout(res, poging * 20000));
  }
  return null;
};

const tPost = async (ep, body) => {
  for (let poging = 1; poging <= 3; poging++) {
    const r = await fetch('https://app.trengo.com/api/v2' + ep, { method: 'POST', headers: { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return { ok: true };
    if (r.status !== 429) return { ok: false, status: r.status };
    await new Promise(res => setTimeout(res, poging * 20000));
  }
  return { ok: false, status: 429 };
};
const { formatteerEmail } = require('./email-live.js');
const naarMailHtml = (t) => '<p>' + formatteerEmail(t).split(/\n\n+/).map(p2 => p2.replace(/\n/g, '<br>')).join('</p><p>') + '</p>';

const apiKey = process.env.ANTHROPIC_API_KEY ||
  fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();
const client = new Anthropic({ apiKey });

function laadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function bewaarState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

// ── Kandidaten: laatste AI-beurt per ticket uit log.jsonl, binnen een van de twee vensters ──
// Regulier: 3-14 dagen stil. Snel (alleen WA): 4 uur tot 1 dag stil, zodat we binnen het
// 24-uursvenster blijven; de harde venster-check op het laatste klantbericht zit in blokkade().
function kandidaten(dagen) {
  const perTicket = new Map();
  for (const line of fs.readFileSync(LOG, 'utf8').trim().split('\n')) {
    let d; try { d = JSON.parse(line); } catch { continue; }
    if (!d.ticket || !d.tijd) continue;
    perTicket.set(String(d.ticket), d); // laatste entry wint
  }
  const nu = Date.now();
  return [...perTicket.values()].map(d => {
    const leeftijdD = (nu - Date.parse(d.tijd)) / 86400000;
    if ((d.kanaal || 'WA') === 'WA' && leeftijdD >= SNEL_MIN_STIL_UREN / 24 && leeftijdD < 1) return { ...d, snel: true };
    if (leeftijdD >= MIN_STIL_DAGEN && leeftijdD <= Math.min(dagen, MAX_STIL_DAGEN)) return d;
    return null;
  }).filter(Boolean);
}

// ── Zekerheids-checks (fail-closed): reden teruggeven waarom het NIET mag, anders null ──
async function blokkade(k, state) {
  if (fs.existsSync(KILL)) return 'kill-switch actief';
  const st = state[String(k.ticket)];
  if (st && st.laatst && (Date.now() - Date.parse(st.laatst)) / 86400000 < RUST_DAGEN) return `al opgevolgd op ${st.laatst.slice(0, 10)}`;
  if (st && st.beoordeeld && (Date.now() - Date.parse(st.beoordeeld)) / 3600000 < HERBEOORDEEL_UREN) return `vandaag al beoordeeld (${st.beoordeeld.slice(11, 16)})`;

  const t = await tGet(`/tickets/${k.ticket}`);
  const ticket = t?.data || t;
  if (!ticket) return 'ticket niet op te halen (fail-closed)';
  if (ticket.user && ticket.user.id !== 747786) return 'toegewezen aan een mens';
  if (ticket.team && ticket.team.id === TEAM_MENS_NODIG) return 'ligt bij team Mens nodig';

  const msgs = await tGet(`/tickets/${k.ticket}/messages`);
  if (!msgs?.data) return 'berichten niet op te halen (fail-closed)';
  const echte = msgs.data.filter(m => !(m.internal_note || m.type === 'NOTE'));
  const laatste = echte[echte.length - 1];
  if (!laatste) return 'geen berichten';
  // 100%-check 1: het laatste échte bericht moet van ONS zijn — anders heeft de klant
  // gereageerd en is dit gewoon een te beantwoorden gesprek, geen opvolging.
  const inbound = laatste.contact_id || laatste.direction === 'inbound' || laatste.type === 'INBOUND';
  if (inbound) return 'klant heeft als laatste iets gestuurd';
  const stilUren = (Date.now() - Date.parse(laatste.created_at)) / 3600000;
  if (k.snel) {
    if (stilUren < SNEL_MIN_STIL_UREN) return `nog geen ${SNEL_MIN_STIL_UREN} uur stil`;
    const laatsteKlant = [...echte].reverse().find(m => m.contact_id || m.direction === 'inbound' || m.type === 'INBOUND');
    if (!laatsteKlant) return 'geen klantbericht gevonden (fail-closed)';
    const klantUren = (Date.now() - Date.parse(laatsteKlant.created_at)) / 3600000;
    if (klantUren > SNEL_MAX_KLANT_UREN) return `WhatsApp 24u-venster (bijna) dicht (klant ${Math.round(klantUren)}u stil)`;
  } else if (stilUren < MIN_STIL_DAGEN * 24) return 'nog geen ' + MIN_STIL_DAGEN + ' dagen stil';

  // 100%-check 2: niets opvolgen dat al getekend/akkoord is of op "geen herinnering" staat.
  let context = null;
  try { context = await buildKlantContext({ email: k.klant?.email, phone: k.klant?.phone, naam: k.klant?.naam }); }
  catch { return 'klantcontext niet op te halen (fail-closed)'; }
  const blob = JSON.stringify(context);
  if (/ACCEPTED|getekend|akkoord-naar-inmeten/i.test(blob)) return 'offerte al getekend/akkoord';
  if (/geen herinnering/i.test(blob)) return 'klant staat op geen-herinnering (opt-out)';

  return { ok: true, ticket, echte, context, stilUren };
}

// ── Agent-oordeel: is opvolging hier gepast, en zo ja: welk bericht? ──
async function beoordeel(k, echte, context) {
  const nu = CFG.amsterdamNu();
  const historie = echte.slice(-20).map(m => {
    const van = (m.contact_id || m.direction === 'inbound' || m.type === 'INBOUND') ? 'KLANT' : 'SONTY';
    return `${van} (${String(m.created_at).slice(0, 16)}): ${String(m.body || m.message || '').replace(/<[^>]+>/g, ' ').slice(0, 400)}`;
  }).join('\n');
  const stilTekst = k.snel ? `een paar uur (zelfde-dag snelvenster)` : `minstens ${MIN_STIL_DAGEN} dagen`;
  const snelInstructie = k.snel ? `\nLET OP: dit is een ZELFDE-DAG opvolging binnen het WhatsApp 24-uursvenster. Alleen gepast als er echt iets kleins openstaat waar de klant op terug zou komen (bv. een maat, kleur of keuze doorgeven, of reactie op een net gestuurde prijs/offerte). Houd het extra kort en luchtig (max 2 zinnen), als een verkoper die dezelfde dag nog even vriendelijk aanhaakt. Bij een gesprek dat gewoon rustig loopt of net vanzelf afrondde: niet doen.\n` : '';
  const resp = await client.messages.create({
    model: CFG.MODEL, max_tokens: 600,
    messages: [{ role: 'user', content:
      `Je bent Jaimy van Sonty (zonwering, Rijswijk). Vandaag is ${nu.datum}. Hieronder een klantgesprek (${k.kanaal || 'WA'}) dat al ${stilTekst} stil ligt; de klant heeft NIET meer gereageerd op ons laatste bericht en heeft niets getekend.${snelInstructie}\n\n# Gesprek (oud → nieuw)\n${historie}\n\n# Klantcontext (systemen)\n${JSON.stringify(context).slice(0, 1500)}\n\nBeoordeel als verkoper: is een korte, vriendelijke opvolging hier GEPAST? Gepast is bv.: klant zei "ik kom er op terug" / "moet overleggen" / "ik ga meten", of er ligt een concrete offerte of vraag waar de klant op zou terugkomen. NIET gepast: gesprek was al netjes afgerond zonder open eind, klant toonde geen interesse, klacht/service-kwestie, of het voelt pusherig. Twijfel = niet doen.\nZo ja: schrijf het opvolgbericht zoals Jaimy appt/mailt — kort (max 3 zinnen), warm, geen druk, geen korting, geen emoji, sluit aan op wat de klant zei. VERBODEN: beweren dat er intern iets is besproken, uitgezocht of geregeld ("ik heb het met onze adviseur besproken") als dat niet letterlijk uit het gesprek blijkt — je volgt alleen op, je verzint geen nieuwe gebeurtenissen. Lag er nog een onbeantwoorde vraag van de klant die jij niet zeker kunt beantwoorden: dan is opvolgen NIET gepast (opvolgen=false, reden vermelden).\nAntwoord UITSLUITEND met JSON: {"opvolgen": true/false, "reden": "...", "bericht": "..." }` }],
  });
  const tekst = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try { return JSON.parse(tekst.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); }
  catch { return { opvolgen: false, reden: 'oordeel niet te parsen (fail-closed)' }; }
}

async function main() {
  const argDagen = Number((process.argv.find(a => a.startsWith('--dagen')) || '').split('=')[1] || process.argv[process.argv.indexOf('--dagen') + 1]) || 14;
  const max = Number(process.argv[process.argv.indexOf('--max') + 1]) || 15;
  const maxSnel = Number(process.argv[process.argv.indexOf('--max-snel') + 1]) || 10;
  const state = laadState();
  const alle = kandidaten(argDagen);
  // Snel apart cappen (nieuwste eerst: meeste venster over), anders drukken de vele
  // 24u-gesprekken de reguliere kandidaten uit de lijst — of andersom.
  const snel = alle.filter(k => k.snel).sort((a, b) => Date.parse(b.tijd) - Date.parse(a.tijd)).slice(0, maxSnel);
  const regulier = alle.filter(k => !k.snel).slice(0, max);
  const ks = [...snel, ...regulier];
  console.log(`[SCHADUW] ${ks.length} kandidaat-gesprekken (${snel.length} snel/24u-venster max ${maxSnel}, ${regulier.length} regulier ${MIN_STIL_DAGEN}-${Math.min(argDagen, MAX_STIL_DAGEN)} dagen stil max ${max})`);
  let voorstellen = 0;
  const regels = [];
  for (const k of ks) {
    await new Promise(r => setTimeout(r, 3000)); // Trengo-limiet delen met de daemons
    const wie = k.klant?.naam || k.klant?.phone || k.klant?.email || '?';
    const check = await blokkade(k, state);
    if (check.ok !== true) { console.log(`  − ${wie} (ticket ${k.ticket}): ${check}`); regels.push(`− ${wie}: ${check}`); continue; }
    const oordeel = await beoordeel(k, check.echte, check.context);
    const rec = { tijd: new Date().toISOString(), ticket: k.ticket, kanaal: k.kanaal || 'WA', klant: wie, snel: !!k.snel, ...oordeel, schaduw: true };
    fs.appendFileSync(VOORSTELLEN, JSON.stringify(rec) + '\n');
    state[String(k.ticket)] = { ...state[String(k.ticket)], beoordeeld: rec.tijd, ...(oordeel.opvolgen ? { laatst: rec.tijd, schaduw: true } : {}) };
    bewaarState(state);
    const tag = k.snel ? ' [SNEL/24u]' : '';
    if (oordeel.opvolgen) {
      voorstellen++;
      // LIVE-MANDAAT (Daimy 23-07): WA-snelvenster + mail dag 3-4,5 echt versturen (binnen bot-uren)
      const stilDagen = (check.stilUren || 0) / 24;
      const liveWa = k.snel && (k.kanaal || 'WA') === 'WA';
      const liveMail = (k.kanaal === 'EMAIL') && stilDagen <= LIVE_MAIL_MAX_DAGEN;
      const magLive = (liveWa || liveMail) && CFG.binnenBotUren();
      if (magLive && oordeel.bericht) {
        const payload = k.kanaal === 'EMAIL' ? { message: naarMailHtml(String(oordeel.bericht)), body_type: 'html' } : { message: String(oordeel.bericht) };
        const send = await tPost(`/tickets/${k.ticket}/messages`, payload);
        if (send.ok) {
          rec.schaduw = false; rec.verstuurd = true;
          fs.appendFileSync(VOORSTELLEN, JSON.stringify({ ...rec, correctie: 'live verstuurd' }) + '\n');
          await tPost(`/tickets/${k.ticket}/messages`, { internal_note: true, message: '✅ Opvolging automatisch verstuurd (AI, binnen mandaat: ' + (liveWa ? 'WA 24u-venster' : 'mail dag 3-4') + ').' }).catch?.(() => {});
          console.log(`  ✓ ${wie}${tag}: VERSTUURD → ${String(oordeel.bericht).slice(0, 120)}`);
          regels.push(`✓ VERSTUURD ${wie} (${k.kanaal || 'WA'}${tag}): "${String(oordeel.bericht).slice(0, 200)}"`);
        } else {
          console.log(`  ⚠️ ${wie}${tag}: versturen MISLUKT (${send.status}) — als voorstel gelogd`);
          regels.push(`⚠️ ${wie}: versturen mislukt (${send.status})`);
        }
      } else {
        console.log(`  ✓ ${wie}${tag}: ZOU STUREN${magLive ? '' : ' (schaduw/buiten mandaat)'} → ${String(oordeel.bericht).slice(0, 120)}`);
        regels.push(`✓ ${wie} (${k.kanaal || 'WA'}${tag}): "${String(oordeel.bericht).slice(0, 220)}"`);
      }
    } else {
      console.log(`  − ${wie}: niet gepast (${String(oordeel.reden).slice(0, 80)})`);
      regels.push(`− ${wie}: ${String(oordeel.reden).slice(0, 100)}`);
    }
  }
  console.log(`[SCHADUW] klaar: ${voorstellen} voorstel(len) gelogd in opvolging-voorstellen.jsonl — er is NIETS verstuurd.`);

  // Rapportage: daemon draait nu elk uur — het volledige overzicht alleen in de ochtendrun
  // (10:00-11:00); live-verzendingen worden altijd gemeld.
  const uurNu = Number(new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).slice(11, 13));
  const verstuurdRegels = regels.filter((r) => r.includes('VERSTUURD') || r.includes('mislukt'));
  if (verstuurdRegels.length && !(uurNu === 10)) {
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: ('Opvolging live verstuurd:\n' + verstuurdRegels.join('\n')).slice(0, 3900) }),
    }).catch(() => {});
  }
  if (regels.length && uurNu === 10) {
    const kop = `SCHADUW-OPVOLGING vandaag (er is niets naar klanten gestuurd):\n${voorstellen} voorstel(len), ${regels.length - voorstellen} overgeslagen.\n\n`;
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: (kop + regels.join('\n')).slice(0, 3900) }),
    }).catch(() => {});
  }
}

main().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
