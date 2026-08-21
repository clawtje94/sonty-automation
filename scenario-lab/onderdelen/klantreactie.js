// Onderdeel: KLANTREACTIE — wat doet de keten met wat een klant terugschrijft op een
// inmeetvoorstel? Draait de ÉCHTE reply-monitor (main) en Sunny's rolbepaling
// (planningRolVoor uit ai-ks/daemon.js) tegen nep-Trengo, nep-register en nep-Haiku.
//
// Aanleiding (Daimy 21-08): Fatih ("faster? delivery?", "real person?"), Marius
// ("dinsdag?" + op=op-zorg), Mirjam ("ander moment", "vrijdag?") kregen niets terug.
//
// Orakel (beleid): elke reactie leidt tot precies één van:
//  - boeken        akkoord (kaal of in woorden, NL/EN, ook ná verlopen) → keuze doorgezet
//  - nieuw-voorstel ander moment → ack in taal + nieuw aanbod met voorkeur
//  - sunny         vraag / verzoek om mens / klacht → klantenservice-bot antwoordt (monitor zwijgt);
//                  bij "ander moment + vraag" doet de planner de tijd en Sunny alleen het vraagdeel
//  - ack-alarm     annuleren, of ander moment/annuleren ná boeking → bevestiging + 🚨
//  - niets         afsluiter/duimpje, of al gekozen
//  - retry         register onbereikbaar → niets afvinken, volgende ronde opnieuw
//  En ALTIJD: staat een niet-afsluiter ≥2u onbeantwoord (overdag, <72u) zonder dat deze run
//  iets deed → wachthond: excuusbericht (via poort) + 🚨. Mens in gesprek → geen
//  automatische klantberichten, wel alarm/actie.
const { combinaties } = require('../matrix.js');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const NU = Date.now();
const uur = (h) => h * 3600000;
// Trengo geeft created_at als Amsterdamse lokale tijd zonder zone ('2026-08-21 10:12:44')
const ts = (msAgo) => new Date(NU - msAgo).toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).replace('T', ' ').slice(0, 19);
const BOT = 747786, MENS = 736327;
const TOKEN = 'labtoken0000000000000000000000001';

const REACTIE = {
  'akkoord-kaal': { nl: 'Dat past', en: 'Yes', duiding: { intent: 'akkoord' } },
  'akkoord-zin': { nl: 'Ja hoor, dat is prima zo. Tot dan!', en: 'Yes, that works for me, thank you!', duiding: { intent: 'akkoord' } },
  'ander-moment': { nl: 'Ander moment', en: 'Can we do another day?', duiding: { intent: 'ander-moment' } },
  'ander-moment-vraag': { nl: 'Kan het ook op een dinsdag? En blijft de actieprijs dan geldig?', en: 'Could we do a Tuesday instead? And does the discount still apply then?', duiding: { intent: 'ander-moment', dagen: [2], overigeVraag: 'blijft de actieprijs geldig' } },
  vraag: { nl: 'Hoe lang is de levertijd na het inmeten?', en: 'How long is the delivery time after measuring?', duiding: { intent: 'vraag', overigeVraag: 'levertijd' } },
  mens: { nl: 'Kan ik een echt persoon spreken?', en: 'Can I speak to a real person?', duiding: { intent: 'vraag', overigeVraag: 'wil een mens spreken' } },
  klacht: { nl: 'Dit duurt veel te lang, ik ben echt teleurgesteld.', en: 'This is taking far too long, I am really disappointed.', duiding: { intent: 'klacht' } },
  annuleren: { nl: 'Ik zie af van de opdracht.', en: 'I want to cancel the order.', duiding: { intent: 'annuleren' } },
  afsluiter: { nl: 'Top, dank je wel!', en: 'Great, thanks!', duiding: { intent: 'akkoord' } },
  emoji: { nl: '👍', en: '👍', duiding: { intent: 'akkoord' } },
};

const dimensies = [
  { naam: 'taal', waarden: [{ label: 'nl' }, { label: 'en' }] },
  { naam: 'reactie', waarden: Object.keys(REACTIE).map((k) => ({ label: k })) },
  { naam: 'register', waarden: [{ label: 'open' }, { label: 'verlopen' }, { label: 'gekozen' }, { label: 'onbekend' }] },
  { naam: 'leeftijd', waarden: [{ label: '10min', ms: 10 * 60000 }, { label: '3u', ms: uur(3) }, { label: '80u', ms: uur(80) }] },
  { naam: 'uur', waarden: [{ label: '03u', h: 3 }, { label: '14u', h: 14 }] },
  { naam: 'mens', waarden: [{ label: 'geen-mens' }, { label: 'mens-schreef-net' }] },
];

const lead = (taal) => (taal === 'en'
  ? { naam: 'Fatih Test', telefoon: '+31600000002', email: 'fatih@lab.test' }
  : { naam: 'Mirjam Test', telefoon: '+31600000001', email: 'mirjam@lab.test' });

function maakRows(s) {
  const l = lead(s.taal.label);
  const r = REACTIE[s.reactie.label];
  const verstuurdMs = s.leeftijd.ms + uur(1);
  const rows = [
    { id: 1, type: 'OUTBOUND', user_id: BOT, created_at: ts(verstuurdMs), message: 'Hoi, goed nieuws: we kunnen bij je langskomen om in te meten. Ons voorstel: ma 28 sep om 10:30. Groetjes, Nanny van Sonty' },
  ];
  if (s.mens.label === 'mens-schreef-net') rows.push({ id: 2, type: 'OUTBOUND', user_id: MENS, created_at: ts(s.leeftijd.ms + 30 * 60000), message: 'Hi, ik kijk er even naar. Daimy' });
  rows.push({ id: 3, type: 'INBOUND', user_id: null, created_at: ts(s.leeftijd.ms), message: r[s.taal.label] });
  return { rows, verstuurdOp: new Date(NU - verstuurdMs).toISOString(), lead: l };
}

function maakFetch(s, ctx, vang) {
  const ok = (obj, status = 200) => ({ ok: status < 300, status, json: async () => obj, text: async () => JSON.stringify(obj) });
  const reg = s.register.label;
  const detail = { token: TOKEN, status: reg, verlooptOp: new Date(NU + uur(5)).toISOString(), slots: [{ aankomst: new Date(NU + 30 * 86400000).toISOString(), inmeter: 'Sjoerd', datum: '2026-09-28' }], lead: { rpItemId: 'rp-lab', naam: ctx.lead.naam } };
  return async (url, opts = {}) => {
    const u = String(url); const method = (opts.method || 'GET').toUpperCase();
    let body = {}; try { body = opts.body ? JSON.parse(opts.body) : {}; } catch { /* */ }
    if (u.includes('api.telegram.org')) { vang.telegram.push(body.text || ''); return ok({ ok: true }); }
    if (u.includes('/api/inmeet-aanbod?')) {
      if (reg === 'onbekend') return ok({ error: 'storing' }, 500);
      return ok({ aanbiedingen: reg === 'verlopen' ? [] : [{ token: TOKEN, status: reg, lead: { rpItemId: 'rp-lab' } }] });
    }
    if (u.includes('/api/inmeet-aanbod/' + TOKEN)) {
      if (method === 'PATCH') { vang.patch.push(body); if (body.status === 'gekozen') vang.boeken = true; return ok({ ok: true }); }
      if (reg === 'onbekend') return ok({ error: 'storing' }, 500);
      return ok(detail);
    }
    if (u.includes('/api/inmeet-mutatie')) { vang.mutatie.push(body); return ok({ id: 'm1' }); }
    if (u.includes('/api/v2/tickets?term=')) return ok({ data: [{ id: 555, status: 'OPEN', channel: { id: 1359857, type: 'WA_BUSINESS' } }] });
    if (/\/api\/v2\/tickets\/555\/messages/.test(u) && method === 'GET') return ok({ data: [...ctx.rows].reverse() });
    if (/\/api\/v2\/tickets\/555\/messages/.test(u) && method === 'POST') { if (body.internal_note || body.type === 'NOTE') { vang.notitie.push(body.message); return ok({ id: 9 }); } vang.wa.push(body.message || ''); return ok({ id: 9 }); }
    if (/\/api\/v2\/tickets\/555\/labels/.test(u)) return ok({});
    return ok({});
  };
}

function metNepBestanden(s, ctx, fn) {
  const origRead = fs.readFileSync, origWrite = fs.writeFileSync;
  const state = { aanbodTickets: { [TOKEN]: { naam: ctx.lead.naam, telefoon: ctx.lead.telefoon, email: ctx.lead.email, waTicket: 555, mailTicket: null, extraTicket: null, verstuurdOp: ctx.verstuurdOp } } };
  fs.readFileSync = function (p, ...rest) {
    const sp = String(p);
    if (sp.endsWith('inmeten-planner-state.json')) return JSON.stringify(state);
    if (sp.endsWith('aanbod-replies-gemeld.json')) return '{}';
    if (sp.endsWith('taal-voorkeur.json')) return JSON.stringify({ '600000002': { taal: 'en' } });
    if (sp.endsWith('inmeet-boekingen.json') || sp.endsWith('monitor-stil.json') || sp.endsWith('telegram-alarm-dedup.json') || sp.endsWith('annuleringen-open.json')) return '{}';
    return origRead.call(fs, p, ...rest);
  };
  fs.writeFileSync = function (p, ...rest) { if (String(p).includes(path.join(ROOT, 'data'))) return; return origWrite.call(fs, p, ...rest); };
  return fn().finally(() => { fs.readFileSync = origRead; fs.writeFileSync = origWrite; });
}

// nep-Haiku: de duiding die het orakel bij deze reactie hoort
let huidigeDuiding = null;
const PA_PATH = require.resolve('../../scripts/lib/planning-antwoord.js');
require.cache[PA_PATH] = { id: PA_PATH, filename: PA_PATH, loaded: true, exports: {
  leesReactie: async () => ({ intent: 'vraag', dagen: [], dagdeel: null, vanaf: null, samenvatting: 'lab', antwoordVoorstel: '', overigeVraag: '', ...(huidigeDuiding || {}) }),
  pasBijVoorkeur: (slots) => slots, DAGEN: {},
} };
// launchctl nooit echt aanroepen vanuit het lab
const cp = require('child_process');
const origExec = cp.execFile;

// planningRolVoor uit daemon.js knippen (daemon.js start anders zijn poll-lus)
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
  const ctx = maakRows(s);
  const vang = { wa: [], telegram: [], patch: [], mutatie: [], notitie: [], boeken: false };
  huidigeDuiding = REACTIE[s.reactie.label].duiding;
  const origFetch = global.fetch; global.fetch = maakFetch(s, ctx, vang);
  cp.execFile = () => {};
  // klok: het uur bepaalt de wachthond (08-21) → Date.prototype.toLocaleString patchen voor 'hour'
  const origTLS = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function (loc, o) { if (o && o.hour === 'numeric' && !o.weekday && !o.day) return String(s.uur.h); return origTLS.call(this, loc, o); };
  try {
    return await metNepBestanden(s, ctx, async () => {
      const monitor = require('../../scripts/cron-aanbod-replies.js');
      await monitor.main();
      const rol = await laadPlanningRol()({ id: 555, contact: { phone: ctx.lead.telefoon, email: ctx.lead.email } },
        ctx.rows.map((m) => ({ van: m.type === 'INBOUND' ? 'klant' : 'sonty', tekst: m.message, tijd: m.created_at })));
      const { magDoor } = require('../../scripts/lib/telegram-filter.js');
      const alarm = vang.telegram.some((t) => magDoor(t).door);
      const isEN = (t) => /^(Hi |All set|Thank|Thanks|Sorry you|I'm|I'll|Done)/.test(t) || /Kind regards/.test(t);
      const isNL = (t) => /^(Hoi |Dank|Goede|Sorry dat|Helemaal)/.test(t) || /Groetjes/.test(t);
      const ackTaalOk = vang.wa.every((t) => (s.taal.label === 'en' ? isEN(t) && !isNL(t) : isNL(t) && !isEN(t)));
      return {
        boeken: vang.boeken, nieuwVoorstel: vang.mutatie.length > 0, ack: vang.wa.length, ackTaalOk,
        alarm, sunnyBlijfWeg: rol.blijfWeg, sunnyReden: rol.reden || '', sunnyContext: !!rol.context,
        verlopenGezet: vang.patch.some((p) => p.status === 'verlopen'), melding: alarm,
        excuus: vang.wa.some((t) => /Sorry dat je nog niets|Sorry you haven't heard/.test(t)),
      };
    });
  } finally {
    global.fetch = origFetch; cp.execFile = origExec; Date.prototype.toLocaleString = origTLS;
  }
}

function orakel(s) {
  const r = s.reactie.label, reg = s.register.label;
  const lopend = s.leeftijd.ms + uur(1) < uur(48);
  const afsluiter = r === 'afsluiter' || r === 'emoji';
  const mens = s.mens.label === 'mens-schreef-net';
  const wachthond = !afsluiter && s.leeftijd.ms >= uur(2) && s.leeftijd.ms < uur(72) && s.uur.h >= 8 && s.uur.h < 21;
  // Sunny: bij lopend aanbod weg bij keuzes; anders (vraag/klacht/mens, of +vraag) aanwezig
  const sunnyWeg = lopend && ['akkoord-kaal', 'akkoord-zin', 'ander-moment', 'annuleren', 'afsluiter', 'emoji'].includes(r);
  // register onbereikbaar: niets afvinken; maar een klant die al ≥2u wacht krijgt wél de wachthond
  if (reg === 'onbekend') return { wil: 'retry', sunnyWeg, wachthond, mens };
  if (reg === 'gekozen') {
    if (['akkoord-kaal', 'akkoord-zin', 'afsluiter', 'emoji'].includes(r)) return { wil: 'niets', sunnyWeg, wachthond: false };
    if (['ander-moment', 'ander-moment-vraag', 'annuleren'].includes(r)) return { wil: 'ack-alarm', sunnyWeg, wachthond: false, mens };
    return { wil: 'sunny', sunnyWeg, wachthond, mens };
  }
  if (reg === 'verlopen') {
    if (['akkoord-kaal', 'akkoord-zin', 'afsluiter', 'emoji'].includes(r)) return { wil: 'boeken', sunnyWeg, wachthond: false };
    if (['ander-moment', 'ander-moment-vraag', 'annuleren'].includes(r)) return { wil: 'ack-alarm', sunnyWeg, wachthond: false, mens };
    return { wil: 'sunny', sunnyWeg, wachthond, mens };
  }
  // open
  if (['akkoord-kaal', 'akkoord-zin', 'afsluiter', 'emoji'].includes(r)) return { wil: 'boeken', sunnyWeg, wachthond: false };
  if (r === 'ander-moment' || r === 'ander-moment-vraag') return { wil: 'nieuw-voorstel', sunnyWeg, wachthond: false, mens, sunnyDeel: r === 'ander-moment-vraag' };
  if (r === 'annuleren') return { wil: 'ack-alarm', sunnyWeg, wachthond: false, mens, verlopen: true };
  if (r === 'klacht') return { wil: 'ack-alarm', sunnyWeg, wachthond: false, mens };
  return { wil: 'sunny', sunnyWeg, wachthond, mens }; // vraag, mens
}

function vergelijk(wil, echt) {
  if (echt.sunnyBlijfWeg !== wil.sunnyWeg) return false;
  if (wil.sunnyDeel && echt.sunnyBlijfWeg) return false;
  switch (wil.wil) {
    case 'retry': return !echt.boeken && !echt.nieuwVoorstel && (wil.wachthond ? echt.alarm && (wil.mens ? true : echt.excuus) : echt.ack === 0);
    case 'niets': return !echt.boeken && !echt.nieuwVoorstel && echt.ack === 0 && !echt.excuus;
    case 'boeken': return echt.boeken && !echt.excuus;
    case 'nieuw-voorstel': return echt.nieuwVoorstel && (wil.mens ? true : echt.ack >= 1 && echt.ackTaalOk) && !echt.excuus;
    case 'ack-alarm': return echt.alarm && (wil.mens ? true : echt.ack >= 1 && echt.ackTaalOk) && (!wil.verlopen || echt.verlopenGezet);
    case 'sunny': {
      if (echt.boeken || echt.nieuwVoorstel) return false;
      if (wil.wachthond) return echt.alarm && (wil.mens ? true : echt.excuus && echt.ackTaalOk);
      return echt.ack === 0 || echt.excuus === false;
    }
    default: return false;
  }
}

module.exports = { naam: 'klantreactie', scenarios: () => combinaties(dimensies), orakel, voerUit, vergelijk };
