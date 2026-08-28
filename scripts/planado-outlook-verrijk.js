#!/usr/bin/env node
// VERRIJKING PLANADO ← OUTLOOK (Daimy 2026-08-27: "eerste opdracht van Frenk & Dennis heeft geen
// adres en de uitleg klopt niet met Outlook"). Gemeten: bij alle 121 bus-opdrachten ontbrak de
// sectie "Interne notities" uit de Outlook-afspraak, en bij 3 hield Planado alleen de plaats over
// (straat niet herkend). Dit script zet per bus-opdracht (vandaag → +100 dagen) in de omschrijving:
//   - "Interne notities (Outlook): …"  (de uitleg van kantoor)
//   - "Adres (Outlook): …"             (altijd als tekst, ook als Planado het adres niet herkent)
// en probeert het adres zelf te zetten als Planado er geen huisnummer van heeft.
// Idempotent: markering in de omschrijving + state data/outlook-planado-verrijkt.json (hash per
// opdracht), dus alleen PATCH bij nieuwe of gewijzigde notities. Standaard DRY-RUN.
// Sinds 28-08 ook inmeet-opdrachten (Joey/Sjoerd) en Nanny.
// Gebruik: node scripts/planado-outlook-verrijk.js [--execute] [--alleen 1067] [--dagen 100]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let planadoFetch; try { ({ planadoFetch } = require('./lib/planado-fetch.js')); } catch { planadoFetch = (u, o) => fetch(u, o); }

const S = __dirname;
const EXECUTE = process.argv.includes('--execute');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const ALLEEN = arg('--alleen'); const DAGEN = Number(arg('--dagen') || 100);
const STATE_PAD = path.join(S, '..', 'data', 'outlook-planado-verrijkt.json');
const OH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(S, '.owa-token.txt'), 'utf8').trim() };
const PH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(S, 'planado-api-key.txt'), 'utf8').trim(), 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const BUSSEN = {
  '1f19ca1a-5a2d': 'Bus 1 | Frenk & Dennis', '1f122f72-777f': 'Bus 2 | Tygo & Kevin',
  '1f122f37-76db': 'Bus 3 | Yudi & Nick', '1f19ca1c-8ecb': 'Bus 4 | Marvin & Bart',
  '1f19ca1d-fec8': 'Bus 5 | Marvin & Moa', '1f19ca28-ce10': 'Bus 6 | Arnold',
  // Inmeters + binnenhuis ook (Daimy 28-08: "ook in de inmeet opdrachten")
  '1f122cfa-17a2': 'Joey | inmeten', '1f122d19-e43e': 'Sjoerd | inmeten', '1f122cfa-4eba': 'Nanny | binnenhuis',
};
const MARK_NOT = 'Interne notities (Outlook):';
const MARK_ADR = 'Adres (Outlook):';
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const heeftHuisnr = (s) => /\d/.test(String(s || '')) && /[A-Za-z]{3,}/.test(String(s || ''));

const bodyTekst = (html) => String(html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .split('\n').map((r) => r.trim()).filter(Boolean).join('\n');
/** Sectie "Interne notities" uit de Bookings-body (tot het eind of de alleen-lezen-boilerplate). */
function notitiesUit(e) {
  const t = bodyTekst(e.Body?.Content);
  const m = t.match(/Interne notities\n([\s\S]*?)(?:\nOPMERKING: Dit is een alleen-lezen|\nGebruik Microsoft Bookings|$)/i);
  if (!m) return '';
  return m[1].split('\n').filter((r) => !/^\*+$/.test(r) && !/Eventuele wijzigingen gaan verloren|^-{3,}/.test(r)).join('\n').trim().slice(0, 900);
}
/** Adres: eerst de event-locatie, anders de "Adres:"/"Locatie:"-regel uit de body. */
function adresUit(e) {
  const loc = (e.Location?.DisplayName || '').trim();
  if (heeftHuisnr(loc)) return loc;
  const t = bodyTekst(e.Body?.Content);
  const m = t.match(/^(?:Adres|Locatie):\s*(.+)$/im);
  return m && heeftHuisnr(m[1]) ? m[1].trim() : (loc || '');
}
/** Nieuwe omschrijving: bestaande tekst + ontbrekende Outlook-blokken; oude blokken vervangen. */
function verrijk(desc, notities, adres, adresOntbreekt) {
  let d = String(desc || '').replace(/\n*Interne notities \(Outlook\):[\s\S]*?(?=\n\n[A-Z]|\n*Adres \(Outlook\):|$)/, '').replace(/\n*Adres \(Outlook\):.*$/m, '').trimEnd();
  const blokken = [];
  if (notities) blokken.push(`${MARK_NOT}\n${notities}`);
  if (adres && (adresOntbreekt || notities)) blokken.push(`${MARK_ADR} ${adres}`);
  return blokken.length ? d + '\n\n' + blokken.join('\n\n') : d;
}

(async () => {
  const state = (() => { try { return JSON.parse(fs.readFileSync(STATE_PAD, 'utf8')); } catch { return {}; } })();
  const cals = await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json();
  const cal = (cals.value || []).find((c) => /sonty montage/i.test(c.Name));
  if (!cal) throw new Error('agenda "Sonty Montage" niet gevonden');
  const van = new Date(); van.setHours(0, 0, 0, 0); const tot = new Date(van); tot.setDate(tot.getDate() + DAGEN);
  const url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=500&$select=Subject,Start,End,IsCancelled,Location,Body&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
  const events = ((await (await fetch(url, { headers: OH })).json()).value || []).filter((e) => !e.IsCancelled);
  const opExt = new Map(); for (const e of events) opExt.set('ol-' + crypto.createHash('sha1').update(e.Id).digest('hex').slice(0, 20), e);

  let after = null; const jobs = [];
  for (let i = 0; i < 40; i++) {
    const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || []; if (!l.length) break;
    for (const j of l) { const b = Object.keys(BUSSEN).find((p) => (j.assignee?.worker_uuid || '').startsWith(p)); if (b && j.scheduled_at >= van.toISOString() && j.scheduled_at <= tot.toISOString() && !['canceled', 'finished'].includes(j.status)) jobs.push({ ...j, bus: BUSSEN[b] }); }
    after = l[l.length - 1].uuid; await wacht(500);
  }
  jobs.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const kandidaten = ALLEEN ? jobs.filter((j) => String(j.serial_no) === String(ALLEEN)) : jobs;
  console.log(`[${new Date().toISOString()}] verrijk: ${jobs.length} bus-opdrachten, ${kandidaten.length} te bekijken, ${EXECUTE ? 'EXECUTE' : 'dry-run'}`);

  let gedaan = 0, overgeslagen = 0, fouten = 0;
  for (const j of kandidaten) {
    const e = opExt.get(j.external_id) || events.find((x) => Math.abs(Date.parse(x.Start.DateTime + 'Z') - Date.parse(j.scheduled_at)) < 1800000 && norm(x.Subject) && norm(String(j.description || '')).includes(norm(x.Subject).slice(-12)));
    if (!e) { overgeslagen++; continue; }
    const notities = notitiesUit(e); const adres = adresUit(e);
    const hash = crypto.createHash('sha1').update(notities + '|' + adres).digest('hex').slice(0, 12);
    if (state[j.uuid] === hash) { overgeslagen++; continue; }          // al gedaan, niets gewijzigd
    if (!notities && !adres) { state[j.uuid] = hash; overgeslagen++; continue; }
    const det = await (await planadoFetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json(); await wacht(400);
    const huidig = det.job || det;
    const plAdres = huidig.address?.formatted || '';
    const adresOntbreekt = !heeftHuisnr(plAdres);
    const nieuw = verrijk(huidig.description, notities, adres, adresOntbreekt);
    const patch = { version: huidig.version };
    if (nieuw !== String(huidig.description || '')) patch.description = nieuw;
    if (adresOntbreekt && heeftHuisnr(adres)) patch.address = { formatted: adres };
    if (Object.keys(patch).length === 1) { state[j.uuid] = hash; overgeslagen++; continue; }
    console.log(`  ${EXECUTE ? '→' : '~'} #${j.serial_no} ${j.scheduled_at.slice(0, 16)} ${j.bus.split(' | ')[0]}: ${patch.description ? 'omschrijving' : ''}${patch.description && patch.address ? ' + ' : ''}${patch.address ? 'adres "' + adres + '"' : ''}${notities ? ' | notities: "' + notities.slice(0, 70).replace(/\n/g, ' / ') + '"' : ''}`);
    if (!EXECUTE) { gedaan++; continue; }
    const r = await planadoFetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { method: 'PATCH', headers: PH, body: JSON.stringify(patch) });
    if (r.ok) { gedaan++; state[j.uuid] = hash; fs.writeFileSync(STATE_PAD, JSON.stringify(state, null, 1)); }
    else { fouten++; console.log(`    FOUT ${r.status}: ${(await r.text()).slice(0, 140)}`); }
    await wacht(2600);
  }
  if (EXECUTE) fs.writeFileSync(STATE_PAD, JSON.stringify(state, null, 1));
  console.log(`klaar: ${gedaan} ${EXECUTE ? 'bijgewerkt' : 'te doen'}, ${overgeslagen} overgeslagen, ${fouten} fouten`);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
