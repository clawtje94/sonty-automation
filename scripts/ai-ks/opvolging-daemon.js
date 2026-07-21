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
const TEAM_MENS_NODIG = 431872;

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

const apiKey = process.env.ANTHROPIC_API_KEY ||
  fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();
const client = new Anthropic({ apiKey });

function laadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }

// ── Kandidaten: laatste AI-beurt per ticket uit log.jsonl, binnen het stilte-venster ──
function kandidaten(dagen) {
  const perTicket = new Map();
  for (const line of fs.readFileSync(LOG, 'utf8').trim().split('\n')) {
    let d; try { d = JSON.parse(line); } catch { continue; }
    if (!d.ticket || !d.tijd) continue;
    perTicket.set(String(d.ticket), d); // laatste entry wint
  }
  const nu = Date.now();
  return [...perTicket.values()].filter(d => {
    const leeftijdD = (nu - Date.parse(d.tijd)) / 86400000;
    return leeftijdD >= MIN_STIL_DAGEN && leeftijdD <= Math.min(dagen, MAX_STIL_DAGEN);
  });
}

// ── Zekerheids-checks (fail-closed): reden teruggeven waarom het NIET mag, anders null ──
async function blokkade(k, state) {
  if (fs.existsSync(KILL)) return 'kill-switch actief';
  const st = state[String(k.ticket)];
  if (st && (Date.now() - Date.parse(st.laatst)) / 86400000 < RUST_DAGEN) return `al opgevolgd op ${st.laatst.slice(0, 10)}`;

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
  if (stilUren < MIN_STIL_DAGEN * 24) return 'nog geen ' + MIN_STIL_DAGEN + ' dagen stil';

  // 100%-check 2: niets opvolgen dat al getekend/akkoord is of op "geen herinnering" staat.
  let context = null;
  try { context = await buildKlantContext({ email: k.klant?.email, phone: k.klant?.phone, naam: k.klant?.naam }); }
  catch { return 'klantcontext niet op te halen (fail-closed)'; }
  const blob = JSON.stringify(context);
  if (/ACCEPTED|getekend|akkoord-naar-inmeten/i.test(blob)) return 'offerte al getekend/akkoord';
  if (/geen herinnering/i.test(blob)) return 'klant staat op geen-herinnering (opt-out)';

  return { ok: true, ticket, echte, context };
}

// ── Agent-oordeel: is opvolging hier gepast, en zo ja: welk bericht? ──
async function beoordeel(k, echte, context) {
  const nu = CFG.amsterdamNu();
  const historie = echte.slice(-20).map(m => {
    const van = (m.contact_id || m.direction === 'inbound' || m.type === 'INBOUND') ? 'KLANT' : 'SONTY';
    return `${van} (${String(m.created_at).slice(0, 16)}): ${String(m.body || m.message || '').replace(/<[^>]+>/g, ' ').slice(0, 400)}`;
  }).join('\n');
  const resp = await client.messages.create({
    model: CFG.MODEL, max_tokens: 600,
    messages: [{ role: 'user', content:
      `Je bent Jaimy van Sonty (zonwering, Rijswijk). Vandaag is ${nu.datum}. Hieronder een klantgesprek (${k.kanaal || 'WA'}) dat al minstens ${MIN_STIL_DAGEN} dagen stil ligt; de klant heeft NIET meer gereageerd op ons laatste bericht en heeft niets getekend.\n\n# Gesprek (oud → nieuw)\n${historie}\n\n# Klantcontext (systemen)\n${JSON.stringify(context).slice(0, 1500)}\n\nBeoordeel als verkoper: is een korte, vriendelijke opvolging hier GEPAST? Gepast is bv.: klant zei "ik kom er op terug" / "moet overleggen" / "ik ga meten", of er ligt een concrete offerte of vraag waar de klant op zou terugkomen. NIET gepast: gesprek was al netjes afgerond zonder open eind, klant toonde geen interesse, klacht/service-kwestie, of het voelt pusherig. Twijfel = niet doen.\nZo ja: schrijf het opvolgbericht zoals Jaimy appt/mailt — kort (max 3 zinnen), warm, geen druk, geen korting, geen emoji, sluit aan op wat de klant zei. VERBODEN: beweren dat er intern iets is besproken, uitgezocht of geregeld ("ik heb het met onze adviseur besproken") als dat niet letterlijk uit het gesprek blijkt — je volgt alleen op, je verzint geen nieuwe gebeurtenissen. Lag er nog een onbeantwoorde vraag van de klant die jij niet zeker kunt beantwoorden: dan is opvolgen NIET gepast (opvolgen=false, reden vermelden).\nAntwoord UITSLUITEND met JSON: {"opvolgen": true/false, "reden": "...", "bericht": "..." }` }],
  });
  const tekst = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try { return JSON.parse(tekst.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); }
  catch { return { opvolgen: false, reden: 'oordeel niet te parsen (fail-closed)' }; }
}

async function main() {
  const argDagen = Number((process.argv.find(a => a.startsWith('--dagen')) || '').split('=')[1] || process.argv[process.argv.indexOf('--dagen') + 1]) || 14;
  const max = Number(process.argv[process.argv.indexOf('--max') + 1]) || 15;
  const state = laadState();
  const ks = kandidaten(argDagen).slice(0, max);
  console.log(`[SCHADUW] ${ks.length} kandidaat-gesprekken (${MIN_STIL_DAGEN}-${Math.min(argDagen, MAX_STIL_DAGEN)} dagen stil, max ${max})`);
  let voorstellen = 0;
  const regels = [];
  for (const k of ks) {
    await new Promise(r => setTimeout(r, 3000)); // Trengo-limiet delen met de daemons
    const wie = k.klant?.naam || k.klant?.phone || k.klant?.email || '?';
    const check = await blokkade(k, state);
    if (check.ok !== true) { console.log(`  − ${wie} (ticket ${k.ticket}): ${check}`); regels.push(`− ${wie}: ${check}`); continue; }
    const oordeel = await beoordeel(k, check.echte, check.context);
    const rec = { tijd: new Date().toISOString(), ticket: k.ticket, kanaal: k.kanaal || 'WA', klant: wie, ...oordeel, schaduw: true };
    fs.appendFileSync(VOORSTELLEN, JSON.stringify(rec) + '\n');
    if (oordeel.opvolgen) {
      voorstellen++;
      console.log(`  ✓ ${wie}: ZOU STUREN → ${String(oordeel.bericht).slice(0, 120)}`);
      regels.push(`✓ ${wie} (${k.kanaal || 'WA'}): "${String(oordeel.bericht).slice(0, 220)}"`);
    } else {
      console.log(`  − ${wie}: niet gepast (${String(oordeel.reden).slice(0, 80)})`);
      regels.push(`− ${wie}: ${String(oordeel.reden).slice(0, 100)}`);
    }
  }
  console.log(`[SCHADUW] klaar: ${voorstellen} voorstel(len) gelogd in opvolging-voorstellen.jsonl — er is NIETS verstuurd.`);

  // Dagelijkse schaduwrapportage naar Daimy (schaduwweek 21-28 juli, evaluatie samen daarna).
  if (regels.length) {
    const kop = `SCHADUW-OPVOLGING vandaag (er is niets naar klanten gestuurd):\n${voorstellen} voorstel(len), ${regels.length - voorstellen} overgeslagen.\n\n`;
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: (kop + regels.join('\n')).slice(0, 3900) }),
    }).catch(() => {});
  }
}

main().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
