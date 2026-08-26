// Onderdeel: TESTRIT-KETEN — Daimy's volledige testgesprek van 26-08 nagespeeld
// door de ECHTE keten, stap voor stap, met verstrijkende tijd.
//
// Daimy (26-08, terecht boos): "zou fijn zijn als je nou echt ff scenario's
// doorloopt, dit is fucking simpel en toch gebeurt het." De losse onderdelen waren
// groen, maar de KETEN faalde: twee routes lazen hetzelfde gesprek, de claim
// verliep halverwege, en "oke doe dan maar dinsdag" werd een donderdag-boeking.
// Dit onderdeel draait dus geen losse functies maar het hele gesprek:
//
//   stap 1  aanbod staat open (1 slot: DONDERDAG) — klant: "Ander moment"
//   stap 2  Sunny stelde tijden voor — klant: variant (dinsdag / donderdag / kaal ja)
//   stap 3  er is geboekt — klant: "oke super maar annuleer mijn afspraak maar"
//   stap 4  tweede boek-verzoek voor dezelfde klant
//
// Orakel (invariants, over de HELE rit):
//   - er wordt nooit een keuze geregistreerd op een bericht dat een ANDERE dag
//     noemt dan het aanbod-slot — ook niet als de Sunny-claim verlopen is
//   - zolang de claim actief is doet de reply-route helemaal NIETS met het gesprek
//   - een annulering gaat naar Sunny mét de waarom-en-ander-moment-instructie
//   - een tweede boek-verzoek kaatst af op "heeft al een afspraak"
const fs = require('fs');
const path = require('path');
const { combinaties } = require('../matrix.js');
const ROOT = path.join(__dirname, '..', '..');
const NU = Date.now();
const min = (m) => m * 60000;
const ts = (msAgo) => new Date(NU - msAgo).toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).replace('T', ' ').slice(0, 19);
const BOT = 747786;
const TOKEN = 'labtoken00000000000000000000000t2';
// het aanbod-slot is een DONDERDAG over 3 dagen — dinsdag noemen is dus een andere dag
const donderdag = (() => { const d = new Date(NU); while (d.getDay() !== 4) d.setDate(d.getDate() + 1); d.setHours(12, 15, 0, 0); return d; })();

const STAP2 = {
  'andere-dag': { tekst: 'oke doe dan maar dinsdag', duiding: { intent: 'akkoord', dagen: [2] }, keuzeMag: false },
  'zelfde-dag': { tekst: 'doe donderdag maar', duiding: { intent: 'akkoord', dagen: [4] }, keuzeMag: true },
  'kaal-akkoord': { tekst: 'oke prima', duiding: { intent: 'akkoord' }, keuzeMag: true },
};

const dimensies = [
  { naam: 'stap2', waarden: Object.keys(STAP2).map((k) => ({ label: k })) },
  { naam: 'claim', waarden: [{ label: 'actief', ouderdomMin: 5 }, { label: 'verlopen', ouderdomMin: 45 }] },
];

function scenarios() { return combinaties(dimensies); }

function orakel(s) {
  const v = STAP2[s.stap2.label];
  return {
    wil: 'keten-schoon',
    // een keuze op het oude aanbod mag alleen bij zelfde dag of kaal akkoord, en dan
    // alleen als Sunny het gesprek niet (meer) vasthoudt
    keuzeGeregistreerd: v.keuzeMag && s.claim.label === 'verlopen',
    replyStilBijClaim: true,       // claim actief → reply-route raakt niets aan
    annuleerNaarSunny: true,       // stap 3: Sunny krijgt de waarom-instructie
    dubbelGeweigerd: true,         // stap 4: tweede boeking kaatst af
  };
}

// ── nep-Haiku (duiding per stap instelbaar) ─────────────────────────────────
let duidingNu = null;
const PA = require.resolve('../../scripts/lib/planning-antwoord.js');
const origPA = require.cache[PA];
function stubPA() {
  require.cache[PA] = { id: PA, filename: PA, loaded: true, exports: {
    leesReactie: async () => ({ intent: 'vraag', dagen: [], nietDatums: [], dagdeel: null, vanaf: null, samenvatting: 'lab', antwoordVoorstel: '', overigeVraag: '', ...(duidingNu || {}) }),
    pasBijVoorkeur: (slots) => slots, DAGEN: {},
  } };
}

// planningRolVoor uit daemon.js knippen (zelfde methode als klantreactie.js)
let planningRolVoor = null;
function laadPlanningRol() {
  if (planningRolVoor) return planningRolVoor;
  const src = fs.readFileSync(path.join(ROOT, 'scripts/ai-ks/daemon.js'), 'utf8');
  const a = src.indexOf('async function planningRolVoor');
  const b = src.indexOf('\n}\n', src.indexOf('function lopendInmeetAanbod', a)) + 3;
  const mod = { exports: {} };
  new Function('require', 'module', 'process', src.slice(a, b) + '\nmodule.exports={planningRolVoor};')(
    (p) => require(p.startsWith('.') ? path.join(ROOT, 'scripts/ai-ks', p) : p), mod, process);
  planningRolVoor = mod.exports.planningRolVoor;
  return planningRolVoor;
}

async function voerUit(s) {
  const vang = { patch: [], wa: [], mutatie: [], telegram: [] };
  const wereld = {
    rows: [], // WhatsApp-verloop, groeit per stap
    claims: {}, // data/gesprek-claims.json
    boekingen: {}, // data/inmeet-boekingen.json
    aanbodStatus: 'open',
  };
  const lead = { naam: 'Daimy Testrit', telefoon: '+31600000009', email: 'testrit@lab.test' };
  const slots = [{ aankomst: donderdag.toISOString(), inmeter: 'Joey', datum: donderdag.toISOString().slice(0, 10) }];

  const ok = (obj, status = 200) => ({ ok: status < 300, status, json: async () => obj, text: async () => JSON.stringify(obj) });
  const origFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const u = String(url); const method = (opts.method || 'GET').toUpperCase();
    let body = {}; try { body = opts.body ? JSON.parse(opts.body) : {}; } catch { /* */ }
    if (u.includes('api.telegram.org')) { vang.telegram.push(body.text || ''); return ok({ ok: true }); }
    if (u.includes('/api/inmeet-aanbod?')) return ok({ aanbiedingen: wereld.aanbodStatus === 'open' ? [{ token: TOKEN, status: 'open', lead: { rpItemId: 'rp-testrit' } }] : [] });
    if (u.includes('/api/inmeet-aanbod/' + TOKEN)) {
      if (method === 'PATCH') { vang.patch.push(body); if (body.status) wereld.aanbodStatus = body.status; return ok({ ok: true }); }
      return ok({ token: TOKEN, status: wereld.aanbodStatus, verlooptOp: new Date(NU + min(300)).toISOString(), slots, lead: { rpItemId: 'rp-testrit', naam: lead.naam } });
    }
    if (u.includes('/api/inmeet-mutatie')) { vang.mutatie.push(body); return ok({ id: 'm-testrit' }); }
    if (u.includes('/api/v2/tickets?term=')) return ok({ data: [{ id: 556, status: 'OPEN', channel: { id: 1359857, type: 'WA_BUSINESS' } }] });
    if (/\/api\/v2\/tickets\/556\/messages/.test(u) && method === 'GET') return ok({ data: [...wereld.rows].reverse() });
    if (/\/api\/v2\/tickets\/556\/messages/.test(u) && method === 'POST') { vang.wa.push(body.message || ''); return ok({ id: 9 }); }
    return ok({});
  };

  const origRead = fs.readFileSync, origWrite = fs.writeFileSync;
  fs.readFileSync = function (p, ...rest) {
    const sp = String(p);
    if (sp.endsWith('gesprek-claims.json')) return JSON.stringify(wereld.claims);
    if (sp.endsWith('inmeet-boekingen.json')) return JSON.stringify(wereld.boekingen);
    if (sp.endsWith('inmeten-planner-state.json')) return JSON.stringify({ aanbodTickets: { [TOKEN]: { naam: lead.naam, telefoon: lead.telefoon, email: lead.email, waTicket: 556, verstuurdOp: new Date(NU - min(30)).toISOString() } } });
    if (sp.endsWith('aanbod-replies-gemeld.json') || sp.endsWith('monitor-stil.json') || sp.endsWith('telegram-alarm-dedup.json') || sp.endsWith('annuleringen-open.json') || sp.endsWith('taal-voorkeur.json')) return '{}';
    return origRead.call(fs, p, ...rest);
  };
  fs.writeFileSync = function (p, inhoud, ...rest) {
    const sp = String(p);
    if (sp.endsWith('gesprek-claims.json')) { try { wereld.claims = JSON.parse(inhoud); } catch { /* */ } return; }
    if (sp.includes(path.join(ROOT, 'data'))) return;
    return origWrite.call(fs, p, inhoud, ...rest);
  };

  const vorigeEnv = process.env.INMEET_PLANNEN_LIVE;
  process.env.INMEET_PLANNEN_LIVE = '1';
  stubPA();
  const uit = { keuzeGeregistreerd: false, replyStilBijClaim: true, annuleerNaarSunny: false, dubbelGeweigerd: false, melding: true };
  try {
    const monitor = require('../../scripts/cron-aanbod-replies.js');
    const rol = laadPlanningRol();
    const cp = require('child_process');
    const origExec = cp.execFile; cp.execFile = () => {};

    // ── STAP 1: aanbod open, klant zegt "Ander moment" ──────────────────────
    wereld.rows = [
      { id: 1, type: 'OUTBOUND', user_id: BOT, created_at: ts(min(30)), message: 'Hoi, goed nieuws: we kunnen bij je langskomen om in te meten. Ons voorstel: donderdag. Tik op een knop en we zetten hem vast. Groetjes, Nanny van Sonty' },
      { id: 2, type: 'INBOUND', user_id: null, created_at: ts(min(25)), message: 'Ander moment' },
    ];
    duidingNu = { intent: 'ander-moment' };
    const rol1 = await rol({ id: 556, contact: { phone: lead.telefoon, email: lead.email } },
      wereld.rows.map((m) => ({ van: m.type === 'INBOUND' ? 'klant' : 'sonty', tekst: m.message, tijd: m.created_at })));
    if (rol1.reden !== 'sunny-plant' || !wereld.claims['556']) throw new Error('stap 1: Sunny nam het gesprek niet over (reden ' + rol1.reden + ')');
    await monitor.main();
    if (vang.patch.length || vang.mutatie.length) uit.replyStilBijClaim = false; // claim vers → route moest stil zijn

    // ── STAP 2: Sunny stelde tijden voor; klant kiest (variant) ─────────────
    const v = STAP2[s.stap2.label];
    wereld.claims['556'] = { door: 'sunny', op: new Date(Date.now() - min(s.claim.ouderdomMin)).toISOString() };
    wereld.rows.push({ id: 3, type: 'OUTBOUND', user_id: BOT, created_at: ts(min(14)), message: 'Geen probleem, ik heb even gekeken: donderdag 15:10 of dinsdag 10:10 kan ook. Welke komt jou het beste uit? Groetjes, Nanny van Sonty' });
    wereld.rows.push({ id: 4, type: 'INBOUND', user_id: null, created_at: ts(min(13)), message: v.tekst });
    duidingNu = v.duiding;
    vang.patch = []; vang.mutatie = [];
    await monitor.main();
    uit.keuzeGeregistreerd = vang.patch.some((p) => p.status === 'gekozen');
    if (s.claim.label === 'actief' && (vang.patch.length || vang.mutatie.length)) uit.replyStilBijClaim = false;

    // ── STAP 3: er is geboekt; klant annuleert ──────────────────────────────
    wereld.boekingen['rp-testrit'] = { status: 'geboekt', naam: lead.naam, telefoon: lead.telefoon, aankomst: donderdag.toISOString(), inmeter: 'Joey', rpItemId: 'rp-testrit', geboektOp: new Date().toISOString() };
    wereld.claims['556'] = { door: 'sunny', op: new Date().toISOString() };
    wereld.rows.push({ id: 5, type: 'INBOUND', user_id: null, created_at: ts(min(2)), message: 'oke super maar annuleer mijn afspraak maar' });
    duidingNu = { intent: 'annuleren' };
    const rol3 = await rol({ id: 556, contact: { phone: lead.telefoon, email: lead.email } },
      wereld.rows.map((m) => ({ van: m.type === 'INBOUND' ? 'klant' : 'sonty', tekst: m.message, tijd: m.created_at })));
    uit.annuleerNaarSunny = rol3.reden === 'sunny-plant' && /waarom/i.test(rol3.context || '') && /ander(e)? (moment|tijd)|inmeet_tijden/i.test(rol3.context || '');

    // ── STAP 4: tweede boek-verzoek voor dezelfde klant ─────────────────────
    const { heeftGeboekteAfspraak } = require('../../scripts/lib/inmeet-mutatie.js');
    uit.dubbelGeweigerd = !!heeftGeboekteAfspraak('rp-testrit');

    cp.execFile = origExec;
    return uit;
  } finally {
    global.fetch = origFetch;
    fs.readFileSync = origRead;
    fs.writeFileSync = origWrite;
    if (origPA) require.cache[PA] = origPA; else delete require.cache[PA];
    process.env.INMEET_PLANNEN_LIVE = vorigeEnv ?? '0';
  }
}

function vergelijk(wil, echt) {
  return wil.keuzeGeregistreerd === echt.keuzeGeregistreerd
    && echt.replyStilBijClaim === wil.replyStilBijClaim
    && echt.annuleerNaarSunny === wil.annuleerNaarSunny
    && echt.dubbelGeweigerd === wil.dubbelGeweigerd;
}

module.exports = { naam: 'testrit-keten (volledig gesprek)', scenarios, orakel, voerUit, vergelijk };
