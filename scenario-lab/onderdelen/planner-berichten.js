// Onderdeel: PLANNER-BERICHTEN — elk automatisch klantbericht uit de planningsketen
// (aanbod, herhaald aanbod, antwoord op klantreactie, boekingsbevestiging, aanbod-
// reminder, afspraak-herinnering, geen-alternatief) over alle omstandigheden.
//
// Aanleiding (Daimy 21-08, Fatih/Marius/Mirjam): Engelstalige klant kreeg Nederlands,
// reminder om 03:49, kale template "goed nieuws" na twee dagen stilte, de verzendpoort
// zweeg op de klant z'n eigen bericht, spook-aanbiedingen.
//
// Orakel (beleid):
//  1. Taal van de klant = taal van ELK bericht (WhatsApp én mail).
//  2. Staat het 24-uursvenster open (klant schreef <24u geleden) dan geen standaard-
//     template zodra er iets persoonlijks te zeggen is: Engels, moment ≥3 weken weg,
//     herhaling, of antwoord op een klantreactie. Venster dicht: template als vangnet mag.
//  3. Moment ≥3 weken weg: nooit "goed nieuws", eerlijk benoemen (in vrij bericht/mail).
//  4. Herhaling: herhalingstekst, nooit een kopie van het eerste voorstel.
//  5. Antwoord op klantreactie: begint met dank/excuus en benoemt wat de klant vroeg.
//  6. Een MENS (niet het bot-account) schreef <24u: automatiek zwijgt, behalve de
//     boekingsbevestiging. Bot-berichten, notities en klantberichten blokkeren NIET.
//  7. Al 2 voorstellen deze week: geen derde automatisch → mens nodig (zichtbaar).
//  8. Reminders nooit tussen 21:00 en 08:00.
//  9. Geen alternatief te vinden: eerlijk bericht in de taal van de klant.
const { combinaties } = require('../matrix.js');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const NL_TEL = '+31600000001', EN_TEL = '+31600000002';
const lead = (taal) => (taal === 'en'
  ? { naam: 'Fatih Test', telefoon: EN_TEL, email: 'fatih@lab.test', rpItemId: 'rp-lab-en' }
  : { naam: 'Mirjam Test', telefoon: NL_TEL, email: 'mirjam@lab.test', rpItemId: 'rp-lab-nl' });
const NU = Date.now();
const uur = (h) => h * 3600000;
// Trengo geeft created_at als Amsterdamse lokale tijd zonder zone ('2026-08-21 10:12:44')
const ts = (msAgo) => new Date(NU - msAgo).toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).replace('T', ' ').slice(0, 19);
const BOT = 747786, MENS = 736327;

const dimensies = [
  { naam: 'taal', waarden: [{ label: 'nl' }, { label: 'en' }] },
  { naam: 'venster', waarden: [{ label: 'open', klantMsAgo: uur(2) }, { label: 'dicht', klantMsAgo: uur(30) }] },
  { naam: 'soort', waarden: [
    { label: 'voorstel' }, { label: 'voorstel-herhaling' }, { label: 'voorstel-klant-reply' },
    { label: 'bevestiging-boeking' }, { label: 'reminder-aanbod' }, { label: 'herinnering-afspraak' }, { label: 'geen-alternatief' },
  ] },
  { naam: 'moment', waarden: [{ label: '2wk', dagen: 14 }, { label: '5wk', dagen: 38 }] },
  { naam: 'gesprek', waarden: [
    { label: 'schoon', extra: [] },
    { label: 'sunny-schreef-net', extra: [{ type: 'OUTBOUND', user_id: BOT, created_at: ts(uur(1)), message: 'Sure, happy to help with that question.' }] },
    { label: 'mens-schreef-net', extra: [{ type: 'OUTBOUND', user_id: MENS, created_at: ts(uur(2)), message: 'Hi, ik kijk er even naar. Daimy' }] },
    { label: 'mens-schreef-gisteren', extra: [{ type: 'OUTBOUND', user_id: MENS, created_at: ts(uur(30)), message: 'Hi, ik kijk er even naar. Daimy' }] },
    { label: 'notitie-daimy', extra: [{ type: 'NOTE', user_id: MENS, created_at: ts(uur(1)), message: '@jorren even checken' }] },
  ] },
  { naam: 'eerder', waarden: [{ label: '0-voorstellen', n: 0 }, { label: '2-voorstellen', n: 2 }] },
  { naam: 'uur', waarden: [{ label: '03u', h: 3 }, { label: '09u', h: 9 }, { label: '19u', h: 19 }] },
];

// ── nep-omgeving ─────────────────────────────────────────────────────────────
function maakFetch(s, vang) {
  const rows = [
    { id: 1, type: 'OUTBOUND', user_id: BOT, created_at: ts(uur(40)), message: 'Hoi, goed nieuws: we kunnen bij je langskomen om in te meten. Groetjes, Nanny van Sonty' },
    { id: 2, type: 'INBOUND', user_id: null, created_at: ts(s.venster.klantMsAgo), message: s.taal.label === 'en' ? 'Hi, is there another option?' : 'Hoi, is er nog een andere optie?' },
    ...s.gesprek.extra.map((m, i) => ({ id: 10 + i, ...m })),
  ];
  const ok = (obj, status = 200) => ({ ok: status < 300, status, json: async () => obj, text: async () => JSON.stringify(obj) });
  return async (url, opts = {}) => {
    const u = String(url);
    const method = (opts.method || 'GET').toUpperCase();
    let body = {};
    try { body = opts.body ? JSON.parse(opts.body) : {}; } catch { /* geen json */ }
    if (u.includes('api.telegram.org')) { vang.telegram.push(body.text || ''); return ok({ ok: true }); }
    if (u.includes('/api/v2/tickets?term=')) {
      const term = decodeURIComponent(u.split('term=')[1]);
      if (/@/.test(term)) return ok({ data: [] });
      return ok({ data: [{ id: 555, status: 'OPEN', updated_at: ts(0), channel: { id: 1359857, type: 'WA_BUSINESS' } }] });
    }
    if (/\/api\/v2\/tickets\/555\/messages/.test(u) && method === 'GET') return ok({ data: rows });
    if (/\/api\/v2\/tickets\/555\/messages/.test(u) && method === 'POST') {
      if (body.type === 'OUTBOUND' && s.venster.label === 'dicht') return ok({ message: 'buiten 24-uursvenster' }, 422);
      vang.wa.push(body.message || '');
      return ok({ id: 900 });
    }
    if (u.endsWith('/api/v2/wa_sessions') && method === 'POST') { vang.template.push(body.hsm_id); return ok({ message: { ticket_id: 555 } }); }
    if (u.endsWith('/api/v2/tickets') && method === 'POST') return ok({ id: 777 });
    if (/\/api\/v2\/tickets\/777\/messages/.test(u) && method === 'POST') { vang.mail.push(body.message || ''); return ok({ id: 901 }); }
    if (/\/close$/.test(u)) return ok({});
    return ok({});
  };
}

function metNepBestanden(s, fn) {
  const origRead = fs.readFileSync, origWrite = fs.writeFileSync;
  const l = lead(s.taal.label);
  const state = { aanbodTickets: {} };
  for (let i = 0; i < s.eerder.n; i++) state.aanbodTickets['lab-eerder-' + i] = { naam: l.naam, telefoon: l.telefoon, email: l.email, waTicket: 555, verstuurdOp: new Date(NU - uur(24 * (i + 1))).toISOString() };
  const taal = { '600000002': { taal: 'en', op: '2026-08-01', bron: 'lab' } };
  fs.readFileSync = function (p, ...rest) {
    const sp = String(p);
    if (sp.endsWith('inmeten-planner-state.json')) return JSON.stringify(state);
    if (sp.endsWith('taal-voorkeur.json')) return JSON.stringify(taal);
    if (sp.endsWith('inmeet-boekingen.json')) return '{}';
    if (sp.endsWith('monitor-stil.json')) return '{}';
    if (sp.endsWith('telegram-alarm-dedup.json')) return '{}';
    return origRead.call(fs, p, ...rest);
  };
  fs.writeFileSync = function (p, ...rest) {
    if (String(p).includes(path.join(ROOT, 'data'))) return; // lab schrijft nooit in echte data
    return origWrite.call(fs, p, ...rest);
  };
  return fn().finally(() => { fs.readFileSync = origRead; fs.writeFileSync = origWrite; });
}

const isEN = (t) => /^(Hi |All set|In English)/.test(String(t).replace(/^<p>/, ''));
const isNL = (t) => /^(Hoi |Helemaal goed)/.test(String(t).replace(/^<p>/, ''));
const taalOk = (t, taal) => (taal === 'en' ? isEN(t) && !isNL(t) : isNL(t) && !isEN(t));

// ── uitvoeren ────────────────────────────────────────────────────────────────
async function voerUit(s) {
  const vang = { wa: [], template: [], mail: [], telegram: [] };
  const origFetch = global.fetch;
  global.fetch = maakFetch(s, vang);
  try {
    return await metNepBestanden(s, async () => {
      const av = require('../../scripts/lib/aanbod-versturen.js');
      const poort = require('../../scripts/lib/verzend-poort.js');
      const planner = require('../../scripts/cron-inmeten-planner.js');
      const monitor = require('../../scripts/cron-aanbod-replies.js');
      const l = lead(s.taal.label);
      const taal = s.taal.label;
      const slot = { aankomst: new Date(NU + s.moment.dagen * 86400000).toISOString(), inmeter: 'Sjoerd', datum: '2026-09-28' };
      const uit = { verzonden: false, via: 'geen', taalOk: true, mailOk: true, eerlijk: false, herhaling: false, aanhef: false, melding: false, reden: '' };
      const soort = s.soort.label;

      if (soort.startsWith('voorstel')) {
        const r = await av.verstuurAanbod({ lead: l, duurMin: 30, ver: false, slots: [slot], geldigUren: 24, herhaling: soort === 'voorstel-herhaling', klantReply: soort === 'voorstel-klant-reply' ? { dagen: [2] } : null }, 'https://sonty-website.vercel.app/inmeten/labtoken');
        uit.verzonden = !!(r.wa.ok || r.mail.ok);
        uit.reden = r.poort || r.wa.reden || '';
        if (r.wa.ok) uit.via = vang.wa.length ? 'vrij' : 'template';
        else uit.via = r.mail.ok ? 'alleen-mail' : 'geen';
        const tekst = vang.wa[0] || '';
        uit.taalOk = uit.via === 'vrij' ? taalOk(tekst, taal) : true;
        uit.mailOk = r.mail.ok ? taalOk(vang.mail[0] || '', taal) : false;
        uit.eerlijk = /eerlijk|honest/.test(tekst) || (uit.via !== 'vrij' && /eerlijk|honest/.test(vang.mail[0] || ''));
        uit.herhaling = /even een berichtje|quick follow-up/.test(tekst);
        uit.aanhef = /dank voor je bericht|thanks for your message/i.test(tekst);
      } else if (soort === 'bevestiging-boeking') {
        // pad 1: planner (na klantkeuze) → bevestigingsTekst uit de monitor, taal uit taalVan
        const t1 = monitor.bevestigingsTekst(slot, av.taalVan(l));
        // pad 2: winkel-/dashboardboeking → verstuurBevestiging via verzendpoort (fail-open)
        const r = await av.verstuurBevestiging({ lead: l, duurMin: 30 }, slot);
        uit.verzonden = !!(r.wa?.ok || r.mail?.ok);
        uit.via = r.wa?.ok ? 'vrij' : (r.mail?.ok ? 'alleen-mail' : 'geen');
        uit.reden = r.poort || r.wa?.reden || '';
        uit.taalOk = taalOk(t1, taal) && (!vang.wa[0] || taalOk(vang.wa[0], taal));
        uit.mailOk = r.mail?.ok ? taalOk(vang.mail[0] || '', taal) : true;
      } else if (soort === 'reminder-aanbod') {
        const mag = planner.reminderNu(uur(3), s.uur.h);
        const p = await poort.magSturen({ telefoon: l.telefoon, ticketId: 555, soort: 'herinnering' });
        const tekst = planner.reminderTekst(l, slot);
        uit.verzonden = mag && p.ok;
        uit.via = uit.verzonden ? 'vrij' : 'geen';
        uit.reden = !mag ? 'buiten uren' : (p.ok ? '' : p.reden);
        uit.taalOk = taalOk(tekst, taal);
      } else if (soort === 'herinnering-afspraak') {
        const p = await poort.magSturen({ telefoon: l.telefoon, ticketId: 555, soort: 'herinnering' });
        const tekst = av.herinneringTekst(l.naam.split(' ')[0], slot, 30, 1, av.taalVan(l));
        uit.verzonden = p.ok; uit.via = p.ok ? 'vrij' : 'geen'; uit.reden = p.ok ? '' : p.reden;
        uit.taalOk = taalOk(tekst, taal);
      } else if (soort === 'geen-alternatief') {
        const p = await poort.magSturen({ telefoon: l.telefoon, ticketId: 555, soort: 'ontvangst' });
        const tekst = av.geenAlternatiefTekst(l.naam.split(' ')[0], { slots: [], dagen: [5], taal: av.taalVan(l) });
        uit.verzonden = p.ok; uit.via = p.ok ? 'vrij' : 'geen'; uit.reden = p.ok ? '' : p.reden;
        uit.taalOk = taalOk(tekst, taal) && /maandag tot en met donderdag|Monday to Thursday/.test(tekst);
      }
      uit.melding = vang.telegram.length > 0;
      return uit;
    });
  } finally {
    global.fetch = origFetch;
  }
}

function orakel(s) {
  const taal = s.taal.label, soort = s.soort.label;
  const mens = s.gesprek.label === 'mens-schreef-net';
  if (soort.startsWith('voorstel')) {
    if (mens) return { wil: 'blokkeer', waarom: 'mens in gesprek' };
    if (s.eerder.n >= 2) return { wil: 'blokkeer', waarom: 'max 2 voorstellen/week', melding: true };
    const persoonlijk = taal === 'en' || s.moment.label === '5wk' || soort !== 'voorstel';
    const via = s.venster.label === 'open' && persoonlijk ? 'vrij' : 'template';
    return {
      wil: 'verstuur', via, mail: true,
      eerlijk: via === 'vrij' && s.moment.label === '5wk' && soort !== 'voorstel-herhaling',
      herhaling: via === 'vrij' && soort === 'voorstel-herhaling',
      aanhef: via === 'vrij' && soort === 'voorstel-klant-reply',
    };
  }
  if (soort === 'bevestiging-boeking') return { wil: 'verstuur', via: 'vrij', mail: true }; // ook bij mens-actief: nooit stil na een boeking
  if (soort === 'reminder-aanbod') {
    if (s.uur.h < 8 || s.uur.h >= 21) return { wil: 'blokkeer', waarom: 'nacht' };
    if (mens) return { wil: 'blokkeer', waarom: 'mens in gesprek' };
    return { wil: 'verstuur', via: 'vrij' };
  }
  if (mens) return { wil: 'blokkeer', waarom: 'mens in gesprek' };
  return { wil: 'verstuur', via: 'vrij' };
}

function vergelijk(wil, echt, s) {
  if (wil.wil === 'blokkeer') return echt.verzonden === false && (!wil.melding || echt.melding);
  if (!echt.verzonden) return false;
  // venster dicht + vrij bericht lukt niet → template/mail mag als vangnet, maar dan moet het wél ergens aankomen
  if (wil.via === 'vrij' && echt.via !== 'vrij') {
    if (s.soort.label.startsWith('voorstel') && s.venster.label === 'dicht') return echt.via === 'template' || echt.via === 'alleen-mail' ? echt.mailOk || echt.via === 'template' : false;
    if (s.soort.label === 'bevestiging-boeking' && s.venster.label === 'dicht') return echt.mailOk; // WA dicht: mail draagt de bevestiging
    return false;
  }
  // standaard verwacht maar persoonlijk gestuurd: nooit fout
  if (!echt.taalOk) return false;
  if (wil.mail && !echt.mailOk) return false;
  if (wil.eerlijk && !echt.eerlijk) return false;
  if (wil.herhaling && !echt.herhaling) return false;
  if (wil.aanhef && !echt.aanhef) return false;
  return true;
}

module.exports = {
  naam: 'planner-berichten',
  scenarios: () => combinaties(dimensies),
  orakel,
  voerUit,
  vergelijk,
};
