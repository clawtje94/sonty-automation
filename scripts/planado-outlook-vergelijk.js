#!/usr/bin/env node
// ALLEEN LEZEN: vergelijkt elke bus-opdracht in Planado (vandaag → +100 dagen) met de
// bijbehorende afspraak in de Outlook-agenda "Sonty Montage": klopt het adres, en staat
// de Outlook-uitleg (body) volledig in de Planado-omschrijving?
// Aanleiding Daimy 2026-08-27: eerste opdracht Bus 1 vandaag zonder adres en met minder
// uitleg dan in Outlook. Gebruik: node scripts/planado-outlook-vergelijk.js [--alles] [--json pad]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let planadoFetch; try { ({ planadoFetch } = require('./lib/planado-fetch.js')); } catch { planadoFetch = (u, o) => fetch(u, o); }

const S = __dirname;
const OH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(S, '.owa-token.txt'), 'utf8').trim() };
const PH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(S, 'planado-api-key.txt'), 'utf8').trim() };
const BUSSEN = {
  '1f19ca1a-5a2d': 'Bus 1 | Frenk & Dennis', '1f122f72-777f': 'Bus 2 | Tygo & Kevin',
  '1f122f37-76db': 'Bus 3 | Yudi & Nick', '1f19ca1c-8ecb': 'Bus 4 | Marvin & Bart',
  '1f19ca1d-fec8': 'Bus 5 | Marvin & Moa', '1f19ca28-ce10': 'Bus 6 | Arnold',
};
const ALLES = process.argv.includes('--alles');
const JSON_PAD = (() => { const i = process.argv.indexOf('--json'); return i > 0 ? process.argv[i + 1] : null; })();

const strip = (h) => String(h || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
function bodyKern(html) {
  return strip(html).split('\n').map((r) => r.trim())
    .filter((r) => r && !/^\*+$/.test(r) && !/OPMERKING: Dit is een alleen-lezen|Gebruik Microsoft Bookings|Eventuele wijzigingen gaan verloren|^-{3,}/.test(r))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
// Nederlands adres: straat + huisnummer (+ evt. postcode/plaats) uit tekst
const ADRES_RE = /([A-Z][\w.'-]+(?:\s[\w.'-]+){0,3}\s\d{1,4}[a-zA-Z]?(?:[-\s]?\d{1,3})?)(?:,?\s*(\d{4}\s?[A-Z]{2}))?(?:,?\s*([A-Z][\w' -]{2,30}))?/;
const adresUit = (t) => { const m = String(t || '').match(ADRES_RE); return m ? m[0].replace(/\s+/g, ' ').trim() : null; };
const heeftHuisnr = (s) => /\d/.test(String(s || '')) && /[A-Za-z]{3,}/.test(String(s || ''));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

(async () => {
  // Outlook: agenda Sonty Montage
  const cals = await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json();
  const cal = (cals.value || []).find((c) => /sonty montage/i.test(c.Name));
  if (!cal) throw new Error('agenda "Sonty Montage" niet gevonden');
  const van = new Date(); van.setHours(0, 0, 0, 0); const tot = new Date(van); tot.setDate(tot.getDate() + 100);
  const url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=500&$select=Subject,Start,End,IsCancelled,Location,Attendees,Body&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
  const events = ((await (await fetch(url, { headers: OH })).json()).value || []).filter((e) => !e.IsCancelled);
  const opExt = new Map(); for (const e of events) opExt.set('ol-' + crypto.createHash('sha1').update(e.Id).digest('hex').slice(0, 20), e);

  // Planado: bus-opdrachten vanaf vandaag
  let after = null; const jobs = [];
  for (let i = 0; i < 40; i++) {
    const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || []; if (!l.length) break;
    for (const j of l) { const b = Object.keys(BUSSEN).find((p) => (j.assignee?.worker_uuid || '').startsWith(p)); if (b && j.scheduled_at >= van.toISOString() && j.status !== 'canceled') jobs.push({ ...j, bus: BUSSEN[b] }); }
    after = l[l.length - 1].uuid; await new Promise((r) => setTimeout(r, 500));
  }
  jobs.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  // De lijst is compact (geen omschrijving/adres): details per opdracht ophalen
  for (const j of jobs) {
    try { const det = await (await planadoFetch("https://api.planadoapp.com/v2/jobs/" + j.uuid, { headers: PH })).json(); const job = det.job || det; j.description = job.description; j.address = job.address; j.contacts = job.contacts; j.external_id = job.external_id || j.external_id; }
    catch (e) { j.detailFout = e.message; }
    await new Promise((r) => setTimeout(r, 350));
  }

  const uit = []; let zonderEvent = 0;
  for (const j of jobs) {
    let e = opExt.get(j.external_id);
    if (!e) { // vangnet: zelfde starttijd (±30 min) en naam in onderwerp
      const kop = norm(String(j.description || '').split('\n')[0]).replace(/^(montage|inmeten|service afspraak)? ?(sonty)? ?/, '');
      e = events.find((x) => Math.abs(Date.parse(x.Start.DateTime + 'Z') - Date.parse(j.scheduled_at)) < 1800000 && (norm(x.Subject).includes(kop.slice(0, 12)) || kop.includes(norm(x.Subject).slice(-12))));
    }
    if (!e) { zonderEvent++; uit.push({ nr: j.serial_no, dag: j.scheduled_at.slice(0, 16), bus: j.bus, kop: String(j.description || '').split('\n')[0].slice(0, 45), event: null }); continue; }
    const kern = bodyKern(e.Body?.Content);
    const loc = (e.Location?.DisplayName || '').trim();
    const olAdres = heeftHuisnr(loc) ? loc : (adresUit(kern) || loc || null);
    const plAdres = j.address?.formatted || '';
    const desc = String(j.description || '');
    // welke inhoudelijke regels uit Outlook ontbreken in Planado?
    const kernRegels = kern.split('\n').map((r) => r.trim()).filter((r) => r.length > 3);
    const ontbreekt = kernRegels.filter((r) => !norm(desc).includes(norm(r).slice(0, 40)));
    uit.push({
      nr: j.serial_no, dag: j.scheduled_at.slice(0, 16), bus: j.bus, kop: String(desc).split('\n')[0].slice(0, 45),
      event: e.Subject, plAdres, olLocatie: loc, olAdres,
      adresOk: heeftHuisnr(plAdres) && (!olAdres || norm(plAdres).includes(norm(olAdres).split(' ')[0])),
      kernRegels: kernRegels.length, ontbreekt: ontbreekt.length, ontbreektVb: ontbreekt.slice(0, 3),
      descLen: desc.length, kernLen: kern.length, kern,
    });
  }
  const met = uit.filter((u) => u.event);
  const adresFout = met.filter((u) => !u.adresOk), uitlegFout = met.filter((u) => u.ontbreekt > 0);
  console.log(`Bus-opdrachten vanaf vandaag: ${jobs.length} | Outlook-afspraak gevonden: ${met.length} | geen event: ${zonderEvent}`);
  console.log(`Adres niet volledig/afwijkend: ${adresFout.length} | Outlook-uitleg (deels) niet in Planado: ${uitlegFout.length}`);
  const toon = ALLES ? uit : uit.filter((u) => !u.event || !u.adresOk || u.ontbreekt > 0);
  for (const u of toon) {
    if (!u.event) { console.log(`  #${u.nr} ${u.dag} ${u.bus.split(' | ')[0]} "${u.kop}" — GEEN Outlook-afspraak gevonden`); continue; }
    console.log(`  #${u.nr} ${u.dag} ${u.bus.split(' | ')[0]} "${u.kop}"`);
    console.log(`      adres Planado: "${u.plAdres || '-'}" | Outlook: "${u.olAdres || '-'}" ${u.adresOk ? '✓' : '✗'}`);
    console.log(`      uitleg: Outlook ${u.kernRegels} regels, ${u.ontbreekt} ontbreken in Planado ${u.ontbreekt ? '✗' : '✓'}${u.ontbreektVb.length ? ' — bv: ' + u.ontbreektVb.map((r) => JSON.stringify(r.slice(0, 60))).join(', ') : ''}`);
  }
  if (JSON_PAD) fs.writeFileSync(JSON_PAD, JSON.stringify(uit, null, 1));
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
