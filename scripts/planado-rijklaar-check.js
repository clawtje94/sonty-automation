#!/usr/bin/env node
// ALLEEN LEZEN. Volledige "rijklaar"-controle van Planado voor de montagebussen
// (Daimy 28-08: maandag rijdt iedereen met Planado — staat ECHT alles goed?).
//
// Per Outlook-teamafspraak (agenda "Sonty Montage", montage/service/stoffering met een
// monteur als deelnemer) wordt gecontroleerd:
//   1. bestaat de Planado-opdracht (external_id ol-<hash van event-id>)
//   2. staat hij op de juiste bus (voornaam deelnemer → busaccount, zelfde map als de sync)
//   3. starttijd = ECHTE Bookings-tijd (dus zonder buffer); duur = Bookings-duur
//   4. adres met huisnummer, en gelijk aan Outlook-locatie/Bookings-adres
//   5. "Interne notities" uit Outlook volledig in de omschrijving
//   6. werkbon: sjabloon "Montage afspraak particulier" + alle rapportvelden
//   7. telefoonnummer klant als contact (voor de klant-sms)
//   8. Gripp-nummer + TE MONTEREN-regels
//   9. status (published), opdrachttype
// Andersom: Planado-busopdrachten ZONDER actieve Outlook-afspraak (wezen) en
// overlappende opdrachten op dezelfde bus.
// Gebruik: node scripts/planado-rijklaar-check.js [--dagen 14] [--json pad]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { planadoFetch } = require('./lib/planado-fetch.js');

const S = __dirname;
const OH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(S, '.owa-token.txt'), 'utf8').trim() };
const PH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(S, 'planado-api-key.txt'), 'utf8').trim() };
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const DAGEN = Number(arg('--dagen', 14));
const JSON_PAD = arg('--json', null);
const MONTAGE_TEMPLATE = '1f11c802-6613-6d00-9d06-7e73cee772e4';
const TYPE_MONTAGE = '1f11c802-634b-6ef0-9d06-7e73cee772e4';
const BUS = {
  '1f19ca1a-5a2d-66c0-8759-4e9ffeb6d4ca': 'Bus 1 | Frenk & Dennis',
  '1f122f72-777f-6e80-8139-6e820cb7b164': 'Bus 2 | Tygo & Kevin',
  '1f122f37-76db-68b0-9aad-4269fe2bbe9c': 'Bus 3 | Yudi & Nick',
  '1f19ca1c-8ecb-6b90-8759-4e9ffeb6d4ca': 'Bus 4 | Marvin & Bart',
  '1f19ca1d-fec8-6e40-afc6-3674195d7c3f': 'Bus 5 | Marvin & Moa',
  '1f19ca28-ce10-6130-8d3e-1253432d7d62': 'Bus 6 | Arnold',
  '1f122cfa-4eba-6810-9aad-4269fe2bbe9c': 'Nanny',
  '1f122da2-8a5b-6c80-9ca9-72f9240343d3': 'Jorren',
  '1f122d19-e43e-6da0-8ffb-661a4ff9bb36': 'Sjoerd',
  '1f122cfa-17a2-6580-8257-7e80f004db9c': 'Joey',
};
const MONTEURS = { // identiek aan cron-outlook-planado-sync.js
  Dennis: '1f19ca1a-5a2d-66c0-8759-4e9ffeb6d4ca', Frenky: '1f19ca1a-5a2d-66c0-8759-4e9ffeb6d4ca', Frenk: '1f19ca1a-5a2d-66c0-8759-4e9ffeb6d4ca',
  Mick: '1f122f72-777f-6e80-8139-6e820cb7b164', Kevin: '1f122f72-777f-6e80-8139-6e820cb7b164', Tygo: '1f122f72-777f-6e80-8139-6e820cb7b164',
  Yudi: '1f122f37-76db-68b0-9aad-4269fe2bbe9c', Nick: '1f122f37-76db-68b0-9aad-4269fe2bbe9c',
  ZZP: '1f19ca1c-8ecb-6b90-8759-4e9ffeb6d4ca', Bart: '1f19ca1c-8ecb-6b90-8759-4e9ffeb6d4ca',
  Marvin: '1f19ca1d-fec8-6e40-afc6-3674195d7c3f', Moa: '1f19ca1d-fec8-6e40-afc6-3674195d7c3f',
  Arnold: '1f19ca28-ce10-6130-8d3e-1253432d7d62', Nanny: '1f122cfa-4eba-6810-9aad-4269fe2bbe9c',
  Jorren: '1f122da2-8a5b-6c80-9ca9-72f9240343d3', Sjoerd: '1f122d19-e43e-6da0-8ffb-661a4ff9bb36',
};
const INMETERS = new Set(['Joey', 'Sjoerd']);
const NIET_KLUS = /vrij$|later$|vakantie|ziek|verlof|^(MEENEMEN|LET OP|VOORBEELD)\b/i;
const soort = (s) => { s = (s || '').toLowerCase(); if (/inmeet|inmeten/.test(s)) return 'inmeet'; if (/montage/.test(s)) return 'montage'; if (/service/.test(s)) return 'service'; if (/stoffering|behangen/.test(s)) return 'stoffering'; if (/winkel|showroom|telefonisch/.test(s)) return 'winkel'; return 'default'; };
const TEAM = new Set(['montage', 'service', 'stoffering']);
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').toLowerCase().replace(/&nbsp;/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const nl = (iso) => new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
const nlT = (ms) => new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
const extIdVan = (e) => 'ol-' + crypto.createHash('sha1').update(e.Id).digest('hex').slice(0, 20);
const evMs = (dt) => Date.parse(String(dt).replace(/\.\d+$/, '') + 'Z');

const tekstUit = (html) => String(html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .split('\n').map((r) => r.trim()).filter(Boolean).join('\n');
function notitiesUit(e) {
  const m = tekstUit(e.Body?.Content).match(/Interne notities\n([\s\S]*?)(?:\nOPMERKING: Dit is een alleen-lezen|\nGebruik Microsoft Bookings|$)/i);
  return m ? m[1].split('\n').filter((r) => !/^\*+$/.test(r) && !/Eventuele wijzigingen gaan verloren|^-{3,}/.test(r)).join('\n').trim() : '';
}
function telefoonUit(e) {
  const m = tekstUit(e.Body?.Content).replace(/\n/g, ' ').match(/(?:\+31|0031|0)[\s-]?[1-9](?:[\s-]?\d){8}/);
  if (!m) return null; let c = m[0].replace(/[^\d+]/g, '');
  if (c.startsWith('0031')) c = '+31' + c.slice(4); else if (c.startsWith('0')) c = '+31' + c.slice(1);
  return c;
}
const adresUitBody = (e) => { const m = tekstUit(e.Body?.Content).match(/^\s*(?:Adres|Locatie):\s*(.+)$/im); return m && /\d/.test(m[1]) ? m[1].trim() : ''; };
const heeftHuisnr = (s) => /\d/.test(String(s || '')) && /[A-Za-z]{3,}/.test(String(s || ''));
const wie = (e) => {
  const namen = (e.Attendees || []).map((a) => a.EmailAddress?.Name || '').filter((n) => n && !/^sonty$/i.test(n));
  return (namen.find((n) => INMETERS.has(n.split(' ')[0]) || MONTEURS[n.split(' ')[0]]) || namen[0] || '').split(' ')[0];
};

async function bookings(vanISO, totISO) {
  const b = require(path.join(S, 'bookings-api.js'));
  const uit = []; let van = new Date(vanISO); const tot = new Date(totISO);
  while (van < tot) {
    const stuk = new Date(Math.min(+van + 14 * 86400000, +tot));
    const l = await b.afspraken('SontyMontage1@sontymontage.nl', { start: van.toISOString(), end: stuk.toISOString() });
    uit.push(...(Array.isArray(l) ? l : [])); van = stuk;
  }
  const staff = await b.staff('SontyMontage1@sontymontage.nl');
  const staffMail = new Map((Array.isArray(staff) ? staff : staff.value || []).map((m) => [m.id, String(m.mail || '').toLowerCase()]));
  const p = (dt) => Date.parse(String(dt || '').replace(/\.\d+/, '').replace(/Z?$/, 'Z'));
  return uit.map((a) => ({ klant: norm(a.klant), klantNaam: a.klant || null, tel: a.tel || null, locatie: a.locatie || null,
    mails: (a.staffIds || []).map((id) => staffMail.get(id)).filter(Boolean), start: p(a.start), eind: p(a.eind) })).filter((a) => a.start && a.eind);
}
function echteTijd(bookAppts, e) {
  const evStart = evMs(e.Start.DateTime), evEind = evMs(e.End.DateTime);
  const onderwerp = norm(e.Subject);
  const opNaam = bookAppts.find((a) => a.klant && a.klant.length >= 4 && onderwerp.includes(a.klant) && a.start >= evStart && a.eind <= evEind);
  if (opNaam) return opNaam;
  const attMails = (e.Attendees || []).map((a) => String(a.EmailAddress?.Address || '').toLowerCase()).filter(Boolean);
  const opStaff = bookAppts.filter((a) => a.start >= evStart && a.eind <= evEind && a.mails.some((m) => attMails.includes(m)));
  return opStaff.length === 1 ? opStaff[0] : null;
}

(async () => {
  const van = new Date(); van.setHours(0, 0, 0, 0);
  const tot = new Date(van); tot.setDate(tot.getDate() + DAGEN);
  console.log(`Rijklaar-check Planado ${van.toISOString().slice(0, 10)} t/m ${tot.toISOString().slice(0, 10)} (alleen lezen)\n`);

  // Outlook
  const cals = await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json();
  const cal = (cals.value || []).find((c) => /sonty montage/i.test(c.Name));
  if (!cal) throw new Error('agenda "Sonty Montage" niet gevonden (token verlopen?)');
  const url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=500&$select=Id,Subject,Start,End,IsCancelled,Location,Attendees,Body&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
  const alleEvents = (await (await fetch(url, { headers: OH })).json()).value || [];
  const actief = alleEvents.filter((e) => !e.IsCancelled && !/geannuleerd|canceled|cancelled/i.test(e.Subject || ''));
  const teamEvents = actief.filter((e) => TEAM.has(soort(e.Subject)) && !NIET_KLUS.test(e.Subject || ''));
  console.log(`Outlook "Sonty Montage": ${alleEvents.length} afspraken in venster, ${teamEvents.length} team-afspraken (montage/service/stoffering)`);

  // Bookings (echte klanttijden)
  let bookAppts = [];
  try { bookAppts = await bookings(van.toISOString(), tot.toISOString()); console.log(`Bookings: ${bookAppts.length} afspraken geladen (bron voor tijden zonder buffer)`); }
  catch (e) { console.log('LET OP: Bookings niet bereikbaar: ' + e.message.slice(0, 80)); }

  // Planado: alle jobs
  let after = null; const jobs = [];
  for (let i = 0; i < 40; i++) {
    const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || []; if (!l.length) break; jobs.push(...l); after = l[l.length - 1].uuid; await wacht(1500);
  }
  const opExt = new Map(jobs.map((j) => [j.external_id, j]));
  const inVenster = jobs.filter((j) => j.scheduled_at >= van.toISOString() && j.scheduled_at < tot.toISOString() && j.status !== 'canceled');
  const busJobs = inVenster.filter((j) => BUS[j.assignee?.worker_uuid] && !/^(Joey|Sjoerd)$/.test(BUS[j.assignee?.worker_uuid]));
  console.log(`Planado: ${jobs.length} opdrachten totaal, ${inVenster.length} in venster, ${busJobs.length} bij bussen/binnenhuis\n`);
  const details = new Map();
  const detailVan = async (uuid) => { if (details.has(uuid)) return details.get(uuid); const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs/' + uuid, { headers: PH })).json(); const job = d.job || d; details.set(uuid, job); await wacht(400); return job; };

  const rapport = []; const fouten = []; const waarschuwingen = []; const geenAccount = {};
  for (const e of teamEvents.sort((a, b) => evMs(a.Start.DateTime) - evMs(b.Start.DateTime))) {
    const voornaam = wie(e);
    const bus = MONTEURS[voornaam];
    const item = { wanneer: nl(evMs(e.Start.DateTime)), onderwerp: e.Subject, deelnemer: voornaam || '(geen)', problemen: [], waarschuwingen: [] };
    rapport.push(item);
    if (!bus) { geenAccount[voornaam || '(geen deelnemer)'] = (geenAccount[voornaam || '(geen deelnemer)'] || 0) + 1; item.problemen.push(voornaam ? `deelnemer "${voornaam}" heeft geen Planado-bus (niet gesynct)` : 'GEEN monteur als deelnemer (niet gesynct)'); continue; }
    const ext = extIdVan(e);
    const j0 = opExt.get(ext);
    if (!j0) { item.problemen.push('GEEN Planado-opdracht'); continue; }
    if (j0.status === 'canceled') { item.problemen.push(`Planado-opdracht #${j0.serial_no} is GEANNULEERD terwijl Outlook actief is`); continue; }
    const j = await detailVan(j0.uuid);
    item.planado = `#${j.serial_no}`; item.bus = BUS[j.assignee?.worker?.uuid] || j.assignee?.worker?.uuid;
    // 2. bus
    if (j.assignee?.worker?.uuid !== bus) item.problemen.push(`verkeerde bus: Planado ${item.bus}, Outlook ${voornaam} → ${BUS[bus]}`);
    // 3. tijden
    const echt = echteTijd(bookAppts, e);
    const evStart = evMs(e.Start.DateTime), evEind = evMs(e.End.DateTime);
    const wilStart = echt ? echt.start : evStart, wilEind = echt ? echt.eind : evEind;
    const wilMin = Math.max(15, Math.round((wilEind - wilStart) / 60000));
    const plStart = Date.parse(j.scheduled_at), plMin = j.scheduled_duration?.minutes;
    item.tijd = `${nlT(plStart)}-${nlT(plStart + plMin * 60000)}`;
    if (plStart !== wilStart) {
      const buffer = echt && plStart === evStart;
      item.problemen.push(`starttijd ${nlT(plStart)} ≠ ${echt ? 'Bookings' : 'Outlook'} ${nlT(wilStart)}${buffer ? ' (BUFFERTIJD meegenomen)' : ''}`);
    }
    if (plMin !== wilMin) item.problemen.push(`duur ${plMin} min ≠ ${echt ? 'Bookings' : 'Outlook'} ${wilMin} min${echt && plMin === Math.round((evEind - evStart) / 60000) ? ' (BUFFERTIJD meegenomen)' : ''}`);
    if (!echt) item.waarschuwingen.push('geen Bookings-afspraak gevonden (handmatig blok?) → tijd uit Outlook-blok');
    // 4. adres
    const loc = (e.Location?.DisplayName || '').trim();
    const olAdres = heeftHuisnr(loc) ? loc : (adresUitBody(e) || (echt?.locatie && /\d/.test(echt.locatie) ? echt.locatie : ''));
    const plAdres = j.address?.formatted || '';
    item.adres = plAdres;
    if (!heeftHuisnr(plAdres)) item.problemen.push(`adres ontbreekt/onvolledig in Planado ("${plAdres || '-'}")${olAdres ? ` — Outlook: "${olAdres}"` : ' — Outlook heeft ook geen adres'}`);
    else if (olAdres) { // zelfde huisnummer + zelfde straatkern (spelling/afkortingen zoals "Dr." vs "Doctor" tellen niet als fout)
      const nr = (a) => (String(a).match(/\b(\d{1,4})\s*[a-zA-Z]?\b/) || [])[1];
      const kern = (a) => norm(a).replace(/\b(dr|ds|mr|prof|ir|sint|st|van|de|der|den|het|monseigneur|mgr|doctor|dokter)\b/g, '').replace(/\d.*$/, '').replace(/\s+/g, '');
      if (nr(plAdres) !== nr(olAdres) || !(kern(plAdres).slice(-6) === kern(olAdres).slice(-6) || kern(plAdres).includes(kern(olAdres).slice(0, 5)))) item.problemen.push(`adres wijkt af: Planado "${plAdres}" vs Outlook "${olAdres}"`);
    }
    // 5. interne notities + kern
    const desc = String(j.description || '');
    const notities = notitiesUit(e);
    if (notities) {
      const regels = notities.split('\n').map((r) => r.trim()).filter((r) => r.length > 2);
      const mis = regels.filter((r) => !norm(desc).includes(norm(r).slice(0, 40)));
      if (!desc.includes('Interne notities')) item.problemen.push(`Interne notities uit Outlook ONTBREKEN in Planado (${regels.length} regels)`);
      else if (mis.length) item.problemen.push(`Interne notities onvolledig: ${mis.length}/${regels.length} regels missen, bv "${mis[0].slice(0, 50)}"`);
    }
    if (desc.trim().length < 20) item.problemen.push('omschrijving (vrijwel) leeg');
    // 6. werkbon
    const rf = j.report_fields || [];
    // sjabloon "Montage afspraak particulier" heeft 8 rapportvelden (gemeten 28-08 tegen /v2/templates; HANDOFF 20-08 noemde 19, dat klopte niet)
    if (j.template?.uuid !== MONTAGE_TEMPLATE) item.problemen.push(`werkbon-sjabloon ontbreekt (sjabloon: ${j.template?.name || 'geen'})`);
    else if (rf.length < 8 || !rf.some((f) => /werk gereed/i.test(f.name))) item.problemen.push(`werkbon onvolledig: ${rf.length} rapportvelden, "Werk gereed?" ${rf.some((f) => /werk gereed/i.test(f.name)) ? 'aanwezig' : 'ONTBREEKT'}`);
    item.werkbon = `${j.template?.name || '-'} (${rf.length} velden)`;
    // 7. telefoon
    const tel = telefoonUit(e) || echt?.tel;
    const contact = (j.contacts || []).find((c) => c.type === 'phone' && c.value);
    if (!contact) item[tel ? 'problemen' : 'waarschuwingen'].push(tel ? `telefoon ${tel} bekend maar GEEN contact op de opdracht (geen klant-sms)` : 'geen telefoonnummer bekend (Outlook noch Bookings)');
    // 8. gripp
    if (soort(e.Subject) === 'montage' && !/Gripp:? ?\d{3,}/.test(desc + JSON.stringify(j.custom_fields || []))) item.waarschuwingen.push('geen Gripp-nummer/productregels op de opdracht');
    // 9. status/type
    if (!/published|scheduled/.test(j.status)) item.waarschuwingen.push(`status ${j.status}`);
    if (soort(e.Subject) === 'montage' && j.type?.uuid !== TYPE_MONTAGE) item.waarschuwingen.push(`type "${j.type?.code || '-'}" i.p.v. Montage afspraak`);
    item.klaar = item.problemen.length === 0;
  }

  // Wezen: bus-opdrachten zonder actieve Outlook-afspraak
  const actieveExt = new Set(actief.map(extIdVan));
  const wezen = busJobs.filter((j) => !(j.external_id || '').startsWith('meeneem-') && !actieveExt.has(j.external_id));
  for (const j of wezen) { const d = await detailVan(j.uuid); j.kop = String(d.description || '').split('\n')[0].slice(0, 50); }
  // Overlap per bus
  const overlap = [];
  const perBus = {}; for (const j of busJobs) (perBus[j.assignee.worker_uuid] ||= []).push(j);
  for (const [b, l] of Object.entries(perBus)) {
    l.sort((a, c) => a.scheduled_at.localeCompare(c.scheduled_at));
    for (let i = 1; i < l.length; i++) { const p = l[i - 1]; if (Date.parse(p.scheduled_at) + (p.scheduled_duration?.minutes || 0) * 60000 > Date.parse(l[i].scheduled_at)) overlap.push(`${BUS[b]}: #${p.serial_no} ${nl(p.scheduled_at)} (${p.scheduled_duration?.minutes} min) overlapt #${l[i].serial_no} ${nl(l[i].scheduled_at)}`); }
  }

  // ── Uitvoer ──
  const ok = rapport.filter((r) => r.klaar), fout = rapport.filter((r) => !r.klaar);
  console.log(`RESULTAAT: ${ok.length} van ${rapport.length} team-afspraken volledig in orde | ${fout.length} met problemen | ${wezen.length} Planado-wezen | ${overlap.length} overlappen\n`);
  if (Object.keys(geenAccount).length) console.log('Deelnemers zonder Planado-bus: ' + Object.entries(geenAccount).map(([k, v]) => `${k} (${v}x)`).join(', ') + '\n');
  if (fout.length) { console.log('── PROBLEMEN ──'); for (const r of fout) { console.log(`✗ ${r.wanneer} | ${r.onderwerp} | ${r.deelnemer}${r.planado ? ' → ' + r.planado + ' ' + (r.bus || '') : ''}`); for (const p of r.problemen) console.log('     - ' + p); for (const w of r.waarschuwingen) console.log('     ~ ' + w); } console.log(); }
  const metW = ok.filter((r) => r.waarschuwingen.length);
  if (metW.length) { console.log('── IN ORDE, MET OPMERKING ──'); for (const r of metW) console.log(`~ ${r.wanneer} | ${r.onderwerp} → ${r.planado} ${r.bus}: ${r.waarschuwingen.join('; ')}`); console.log(); }
  if (wezen.length) { console.log('── PLANADO-OPDRACHTEN ZONDER OUTLOOK-AFSPRAAK ──'); for (const j of wezen) console.log(`? #${j.serial_no} ${nl(j.scheduled_at)} ${BUS[j.assignee.worker_uuid]} "${j.kop}" ext=${j.external_id || '-'} status=${j.status}`); console.log(); }
  if (overlap.length) { console.log('── OVERLAP OP DEZELFDE BUS ──'); overlap.forEach((o) => console.log('! ' + o)); console.log(); }
  // Dagoverzicht
  console.log('── DAGOVERZICHT (Planado, per bus) ──');
  const perDag = {}; for (const j of busJobs) (perDag[new Date(j.scheduled_at).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })] ||= []).push(j);
  for (const j of busJobs) { const d = details.get(j.uuid); j.kop = d ? String(d.description || '').split('\n')[0].slice(0, 40) : '(detail niet geladen)'; }
  for (const [dag, l] of Object.entries(perDag)) {
    console.log(dag);
    for (const j of l.sort((a, c) => (BUS[a.assignee.worker_uuid] + a.scheduled_at).localeCompare(BUS[c.assignee.worker_uuid] + c.scheduled_at))) console.log(`   ${BUS[j.assignee.worker_uuid].padEnd(22)} ${nlT(Date.parse(j.scheduled_at))}-${nlT(Date.parse(j.scheduled_at) + (j.scheduled_duration?.minutes || 0) * 60000)} #${j.serial_no} ${j.kop}`);
  }
  if (JSON_PAD) fs.writeFileSync(JSON_PAD, JSON.stringify({ rapport, wezen: wezen.map((j) => ({ nr: j.serial_no, wanneer: j.scheduled_at, bus: BUS[j.assignee.worker_uuid], kop: j.kop })), overlap, geenAccount }, null, 1));
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
