#!/usr/bin/env node
// Vakantie-overzicht voor het admin-dashboard (sonty-website.vercel.app/admin/vakanties).
//
// Bron = Outlook-agenda "Sonty Montage" (het kantoorvenster, zie memory): elk item met
// vakantie/verlof/vrij/ziek in het onderwerp, de persoon is de genodigde (conventie
// sinds 22-08, zelfde regel als de inmeet-planner en het Planado-rooster gebruiken).
// Dit script LEEST alleen. Toevoegen/wijzigen gebeurt in Outlook zelf.
//
// Elke 30 min (launchd nl.sonty.vakanties-collect):
//   1. calendarView -45 dagen .. +400 dagen ophalen
//   2. per item: wie, van/tot in NL-tijd, hele dag of deel, werkdagen (ma-vr, feestdagen
//      eruit), soort, controlepunten (geen genodigde / naam in onderwerp wijkt af)
//   3. aansluitende hele-dag items van dezelfde persoon samenvoegen tot één periode
//   4. pushen naar KV via POST /api/admin/vakanties (Bearer ADMIN_PASSWORD) en lokaal
//      bewaren in data/vakanties-overzicht.json
// Outlook onbereikbaar: laatste bekende lijst opnieuw pushen mét foutmelding, zodat het
// dashboard eerlijk "verouderd" toont in plaats van leeg.
//
// Gebruik: node vakanties-collect.js [--dry]   (--dry = niet pushen, alleen tonen)
const fs = require('fs');
const path = require('path');
const SECRETS = require('./secrets.js');

const API = 'https://sonty-website.vercel.app/api/admin/vakanties';
const UIT = path.join(__dirname, '..', 'data', 'vakanties-overzicht.json');
const TOKEN = path.join(__dirname, '.owa-token.txt');
const DRY = process.argv.includes('--dry');
const DAGEN_TERUG = 45;
const DAGEN_VOORUIT = 400;

// Onderwerp-filter: zelfde woorden als cron-inmeten-planner.js + planado-shifts-rooster.js
const VAKANTIE_RE = /vakantie|verlof|\bvrij\b|ziek|snipper/i;

// Wie is wie: voornaam (kleine letters) -> rol. Namen zoals ze als genodigde in Outlook
// staan; "djo" en "jor" zijn afkortingen die in onderwerpen voorkomen.
const ROL = {
  sjoerd: 'inmeter', joey: 'inmeter', djo: 'inmeter',
  nanny: 'kantoor', jaimy: 'kantoor', daimy: 'kantoor', marijn: 'kantoor',
  yudi: 'montage', nick: 'montage', marvin: 'montage', kevin: 'montage', bart: 'montage',
  mick: 'montage', tygo: 'montage', jorren: 'montage', jor: 'montage', dennis: 'montage',
  frenky: 'montage', zzp: 'montage',
};
const ALIAS = { djo: 'Joey Engelen', jor: 'Jorren Plugge' };

// ---- NL-tijd helpers (Outlook v2.0 geeft UTC terug zonder Prefer-header) ----
const NL = new Intl.DateTimeFormat('nl-NL', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
function nl(date) {
  const p = Object.fromEntries(NL.formatToParts(date).map((x) => [x.type, x.value]));
  const uur = p.hour === '24' ? '00' : p.hour;
  return { datum: `${p.year}-${p.month}-${p.day}`, tijd: `${uur}:${p.minute}`, uur: +uur, min: +p.minute };
}
function dagPlus(datum, n) {
  const d = new Date(datum + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekdag(datum) { return new Date(datum + 'T12:00:00Z').getUTCDay(); } // 0=zo
function werkdagen(van, tot, feestdagen) {
  let n = 0;
  for (let d = van; d <= tot; d = dagPlus(d, 1)) {
    const wd = weekdag(d);
    if (wd >= 1 && wd <= 5 && !feestdagen.has(d)) n++;
  }
  return n;
}
function vandaagNL() { return nl(new Date()).datum; }

// ---- Outlook ----
async function outlook(url, OH) {
  const r = await fetch(url, { headers: OH });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j;
}
async function haalItems(cal, OH, van, tot, select) {
  let url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=500&$select=${select}`
    + `&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
  const evs = [];
  while (url) { const j = await outlook(url, OH); evs.push(...(j.value || [])); url = j['@odata.nextLink'] || null; }
  return evs;
}

function voornaam(naam) { return (naam || '').trim().split(/\s+/)[0].toLowerCase(); }
function rolVan(naam) { return ROL[voornaam(naam)] || 'onbekend'; }

// Onderwerp opschonen tot een korte omschrijving ("Disney", "Sjoerd vrij", "").
function omschrijving(subject) {
  let s = (subject || '')
    .replace(/^geannuleerd:\s*/i, '')
    .replace(/^(telefonisch advies|service afspraak sonty|montage sonty|inmeten sonty)\s*-\s*/i, '')
    .replace(/^vakantie\s*-\s*/i, '')
    .replace(/^vakantie$/i, '')
    .trim();
  return s;
}
function soortVan(subject) {
  const s = subject || '';
  if (/ziek/i.test(s)) return 'ziek';
  if (/vakantie/i.test(s)) return 'vakantie';
  if (/verlof|snipper/i.test(s)) return 'verlof';
  return 'vrije dag';
}

function verwerk(evs, feestdagen) {
  const items = [];
  for (const e of evs) {
    if (e.IsCancelled || !VAKANTIE_RE.test(e.Subject || '')) continue;
    const start = new Date(e.Start.DateTime + 'Z');
    const eind = new Date(e.End.DateTime + 'Z');
    // Hele-dag items geeft Outlook als 00:00 UTC van de kalenderdag zelf: de datumtekst
    // is dan leidend (omrekenen naar NL zou een dag opschuiven). Eind is exclusief.
    const s = e.IsAllDay ? { datum: e.Start.DateTime.slice(0, 10), tijd: '00:00', uur: 0 } : nl(start);
    const t = e.IsAllDay ? { datum: dagPlus(e.End.DateTime.slice(0, 10), -1), tijd: '00:00' } : nl(new Date(+eind - 60000));
    const eindTijd = nl(eind).tijd;
    const genodigden = (e.Attendees || [])
      .map((a) => (a.EmailAddress?.Name || '').replace(/\s*\|\s*sonty\s*$/i, '').trim())
      .filter((n) => n && !/^sonty$/i.test(n));
    const controle = [];
    let wie = genodigden;
    // Naam in het onderwerp die geen genodigde is → controlepunt (bv. "TYGO MAGAZIJN" met Mick
    // als genodigde) of, zonder genodigden, de enige aanwijzing wie het is.
    const inOnderwerp = Object.keys(ROL).filter((v) => new RegExp('\\b' + v + '\\b', 'i').test(e.Subject || ''));
    const nietGenodigd = inOnderwerp.filter((v) => !genodigden.some((g) => voornaam(g) === v || voornaam(ALIAS[v] || '') === voornaam(g)));
    if (!wie.length) {
      if (nietGenodigd.length) {
        wie = nietGenodigd.map((v) => ALIAS[v] || v[0].toUpperCase() + v.slice(1));
        controle.push('Geen genodigde in Outlook; naam alleen uit het onderwerp. De planner koppelt dit item aan niemand.');
      } else {
        wie = ['Onbekend'];
        controle.push('Geen genodigde in Outlook en geen naam in het onderwerp: onbekend wie er vrij is. Planner blokkeert niemand.');
      }
    } else if (nietGenodigd.length) {
      controle.push(`Onderwerp noemt ${nietGenodigd.join(', ')} maar genodigde is ${genodigden.join(', ')}.`);
    }
    const uren = (+eind - +start) / 3600000;
    const meerdereDagen = s.datum !== t.datum;
    // Sonty-conventie: een blokje van ~1 uur 's ochtends betekent "hele dag vrij".
    const heleDag = !!e.IsAllDay || meerdereDagen || uren >= 6 || (s.uur <= 9 && uren <= 2);
    for (const naam of wie) {
      items.push({
        id: e.Id,
        wie: naam,
        rol: rolVan(naam),
        van: s.datum,
        tot: t.datum,
        heleDag,
        tijd: heleDag ? null : `${s.tijd}-${eindTijd}`,
        soort: soortVan(e.Subject),
        omschrijving: omschrijving(e.Subject),
        onderwerp: e.Subject || '',
        werkdagen: heleDag ? werkdagen(s.datum, t.datum, feestdagen) : 0,
        controle,
        bronnen: 1,
      });
    }
  }
  return samenvoegen(items, feestdagen);
}

// Aansluitende/overlappende hele-dag items van dezelfde persoon → één periode
// (Disney 7 + 8 sep als twee losse items, Sjoerd 24 aug-11 sep + losse vrijdagen ervoor niet:
// die grenzen niet aan elkaar en blijven apart).
function samenvoegen(items, feestdagen) {
  items.sort((a, b) => a.wie.localeCompare(b.wie) || a.van.localeCompare(b.van));
  const uit = [];
  for (const it of items) {
    const vorige = uit[uit.length - 1];
    if (vorige && vorige.wie === it.wie && vorige.heleDag && it.heleDag && vorige.soort === it.soort
      && it.van <= dagPlus(vorige.tot, 1)) {
      if (it.tot > vorige.tot) vorige.tot = it.tot;
      vorige.werkdagen = werkdagen(vorige.van, vorige.tot, feestdagen);
      vorige.bronnen += 1;
      if (it.omschrijving && !vorige.omschrijving.includes(it.omschrijving)) {
        vorige.omschrijving = [vorige.omschrijving, it.omschrijving].filter(Boolean).join(' / ');
      }
      for (const c of it.controle) if (!vorige.controle.includes(c)) vorige.controle.push(c);
      continue;
    }
    uit.push({ ...it, controle: [...it.controle] });
  }
  const vandaag = vandaagNL();
  for (const it of uit) {
    it.status = it.tot < vandaag ? 'voorbij' : it.van <= vandaag ? 'nu' : 'komend';
  }
  uit.sort((a, b) => a.van.localeCompare(b.van) || a.wie.localeCompare(b.wie));
  return uit;
}

async function main() {
  let vorige = null;
  try { vorige = JSON.parse(fs.readFileSync(UIT, 'utf8')); } catch { /* eerste run */ }
  const nu = new Date().toISOString();
  let snapshot;
  try {
    const token = fs.readFileSync(TOKEN, 'utf8').trim();
    const OH = { Authorization: 'Bearer ' + token };
    const cals = (await outlook('https://outlook.office.com/api/v2.0/me/calendars', OH)).value || [];
    const cal = cals.find((c) => c.Name === 'Sonty Montage');
    if (!cal) throw new Error('agenda "Sonty Montage" niet gevonden');
    const feestCal = cals.find((c) => /feestdagen in nederland/i.test(c.Name));
    const van = new Date(); van.setDate(van.getDate() - DAGEN_TERUG);
    const tot = new Date(); tot.setDate(tot.getDate() + DAGEN_VOORUIT);
    const evs = await haalItems(cal, OH, van, tot, 'Subject,Start,End,IsAllDay,IsCancelled,Attendees');
    let feestdagen = [];
    if (feestCal) {
      const f = await haalItems(feestCal, OH, van, tot, 'Subject,Start,End,IsAllDay');
      // Alleen echte vrije dagen (Prinsjesdag/Dodenherdenking/Oudejaarsavond staan ook in die agenda).
      const VRIJ_RE = /nieuwjaarsdag|tweede paasdag|koningsdag|bevrijdingsdag|hemelvaart|tweede pinksterdag|eerste kerstdag|tweede kerstdag/i;
      feestdagen = f.filter((e) => VRIJ_RE.test(e.Subject || ''))
        .map((e) => ({ datum: e.IsAllDay ? e.Start.DateTime.slice(0, 10) : nl(new Date(e.Start.DateTime + 'Z')).datum, naam: e.Subject }))
        .filter((x) => weekdag(x.datum) >= 1 && weekdag(x.datum) <= 5);
    }
    const feestSet = new Set(feestdagen.map((x) => x.datum));
    const items = verwerk(evs, feestSet);
    snapshot = {
      bijgewerkt: nu,
      bron: 'Outlook agenda "Sonty Montage" (joey@sonty.nl)',
      venster: { van: nl(van).datum, tot: nl(tot).datum },
      agendaItems: evs.length,
      feestdagen,
      items,
      fout: null,
    };
    fs.writeFileSync(UIT, JSON.stringify(snapshot, null, 2));
    console.log(`${nu.slice(0, 16)} ${evs.length} agenda-items, ${items.length} vakantie-periodes, ${items.filter((i) => i.controle.length).length} te controleren`);
  } catch (e) {
    const msg = 'Outlook niet leesbaar: ' + String(e.message || e).slice(0, 160);
    console.log(`${nu.slice(0, 16)} ! ${msg}`);
    snapshot = {
      ...(vorige || { items: [], feestdagen: [], bron: 'Outlook agenda "Sonty Montage"' }),
      bijgewerkt: vorige?.bijgewerkt || null,
      foutSinds: vorige?.foutSinds || nu,
      fout: msg,
    };
  }
  if (DRY) {
    for (const it of snapshot.items) {
      console.log(`${it.status.padEnd(7)} ${it.wie.padEnd(18)} ${it.rol.padEnd(8)} ${it.van} → ${it.tot} ${it.heleDag ? `${it.werkdagen} wd` : it.tijd} ${it.soort}${it.omschrijving ? ' (' + it.omschrijving + ')' : ''}${it.controle.length ? '  ⚠ ' + it.controle.join(' | ') : ''}`);
    }
    console.log('feestdagen:', snapshot.feestdagen.map((f) => f.datum + ' ' + f.naam).join(', '));
    return;
  }
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD },
    body: JSON.stringify(snapshot),
  });
  console.log('push:', r.status, r.ok ? 'ok' : (await r.text()).slice(0, 200));
  if (!r.ok) process.exitCode = 1;
}

module.exports = { verwerk, samenvoegen, nl, dagPlus, werkdagen };
if (require.main === module) main().catch((e) => { console.error('vakanties-collect fout:', e.message); process.exitCode = 1; });
