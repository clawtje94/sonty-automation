#!/usr/bin/env node
// ALLEEN LEZEN. Onafhankelijke 100%-controle Outlook ("Sonty Montage") → Planado (Daimy 03-09-2026: "check of 100% zeker
// alles goed in Planado staat wat in Outlook wordt gezet, zodat ik alle bussen Planado kan laten gebruiken").
// Per Outlook-klus (nu → +100 dagen, niet geannuleerd, geen MEENEMEN/LET OP/vrij-blok): is er een Planado-opdracht, bij het
// juiste team, op de juiste (Bookings-)tijd, met de juiste duur, met adres, telefoon en de Outlook-uitleg in de omschrijving?
// Plus: Outlook-klussen van teams ZONDER Planado-account (die staan nergens), en Planado-wezen (opdracht zonder Outlook-event).
// Gebruikt de leesfuncties van de sync zelf (Outlook, Bookings-tijden, Planado-lijst) maar beoordeelt onafhankelijk.
// Uitvoer: data/outlook-planado-audit.json + leesbare samenvatting op stdout.
const fs = require('fs');
const path = require('path');
const S = __dirname;
// sync-module als bibliotheek laden (zonder zijn main te draaien)
const bron = fs.readFileSync(path.join(S, 'cron-outlook-planado-sync.js'), 'utf8')
  .replace(/\nmain\(\)\.catch\([\s\S]*$/, '\nmodule.exports = { outlookEvents, telefoonUit, klantNaamUit, soort, TEAM_SOORTEN, bookingsAfspraken, echteTijd, bodyKern, notitiesUit, adresUitBody, planadoJobs, planadoJson, INMETERS, MONTEURS, MONTAGE_AAN, PH };\n');
const TMP = path.join(S, '.sync-als-lib.tmp.js');
fs.writeFileSync(TMP, bron);
const L = require(TMP);
fs.unlinkSync(TMP);
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const crypto = require('crypto');
const NIET_KLUS = /vrij$|later$|vakantie|ziek|verlof|^(MEENEMEN|LET OP|VOORBEELD)\b/i;
const NAAM_VAN_UUID = {};
for (const [n, u] of Object.entries(L.INMETERS)) NAAM_VAN_UUID[u] = n;
for (const [n, u] of Object.entries(L.MONTEURS)) if (!NAAM_VAN_UUID[u]) NAAM_VAN_UUID[u] = n;
const BUS = { '1f19ca1a-5a2d': 'Bus 1 Frenk&Dennis', '1f122f72-777f': 'Bus 2 Tygo&Kevin', '1f122f37-76db': 'Bus 3 Yudi&Nick', '1f19ca1c-8ecb': 'Bus 4 Marvin&Bart', '1f19ca1d-fec8': 'Bus 5 Marvin&Moa', '1f19ca28-ce10': 'Bus 6 Arnold', '1f122cfa-17a2': 'Joey', '1f122d19-e43e': 'Sjoerd', '1f122cfa-4eba': 'Nanny', '1f122da2-8a5b': 'Jorren' };
const team = (uuid) => BUS[String(uuid || '').slice(0, 13)] || NAAM_VAN_UUID[uuid] || (uuid ? 'onbekend ' + String(uuid).slice(0, 8) : 'geen');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const huisnr = (adres) => { const m = String(adres || '').match(/\b(\d{1,4})\s?[a-zA-Z]?\b/); return m ? m[1] : ''; };
const postcode = (adres) => { const m = String(adres || '').replace(/\s/g, '').match(/\d{4}[A-Za-z]{2}/); return m ? m[0].toUpperCase() : ''; };

(async () => {
  const t0 = Date.now();
  const evs = await L.outlookEvents();
  const wie = (e) => {
    const namen = (e.Attendees || []).map((a) => a.EmailAddress?.Name || '').filter((n) => n && !/^sonty$/i.test(n));
    return namen.find((n) => L.INMETERS[n.split(' ')[0]] || L.MONTEURS[n.split(' ')[0]]) || namen[0] || '';
  };
  const extIdVan = (e) => 'ol-' + crypto.createHash('sha1').update(e.Id).digest('hex').slice(0, 20);
  const klussen = evs.filter((e) => !e.IsCancelled && !/geannuleerd|canceled|cancelled/i.test(e.Subject || '') && !NIET_KLUS.test(e.Subject || ''));
  const totB = new Date(); totB.setDate(totB.getDate() + 100);
  const bookAppts = await L.bookingsAfspraken(new Date().toISOString(), totB.toISOString());
  const jobs = await L.planadoJobs();
  const opExtId = new Map(jobs.map((j) => [j.external_id, j]));
  const nu = Date.now();
  const rapport = { gemaakt: new Date().toISOString(), outlookEvents: evs.length, klussen: klussen.length, bookings: bookAppts.length, planadoJobs: jobs.length, perTeam: {}, zonderAccount: [], ontbreekt: [], afwijkend: [], ok: 0, wezen: [], viaPlanner: 0, montageSyncAan: L.MONTAGE_AAN };
  const tel = (naam, veld) => { rapport.perTeam[naam] = rapport.perTeam[naam] || { outlook: 0, ok: 0, ontbreekt: 0, afwijkend: 0, zonderAccount: 0 }; rapport.perTeam[naam][veld]++; };
  const gebruikt = new Set();
  for (const e of klussen) {
    const voornaam = wie(e).split(' ')[0];
    const srt = L.soort(e.Subject);
    const worker = L.INMETERS[voornaam] || (L.TEAM_SOORTEN.has(srt) || srt === 'inmeet' ? L.MONTEURS[voornaam] : null) || null;
    const echt = L.echteTijd(bookAppts, e);
    const startISO = echt ? new Date(echt.start).toISOString() : new Date(e.Start.DateTime + 'Z').toISOString();
    const eindISO = echt ? new Date(echt.eind).toISOString() : new Date(e.End.DateTime + 'Z').toISOString();
    const minuten = Math.max(15, Math.round((Date.parse(eindISO) - Date.parse(startISO)) / 60000));
    const kop = { wanneer: startISO, team: voornaam || '?', onderwerp: String(e.Subject || '').slice(0, 60), soort: srt };
    if (!worker) {
      // geen Planado-account voor deze deelnemer → staat nergens in Planado
      if (srt === 'winkel' || srt === 'default') continue; // showroom/telefonisch/overig: bewust geen opdracht
      rapport.zonderAccount.push(kop); tel(voornaam || '(geen deelnemer)', 'outlook'); tel(voornaam || '(geen deelnemer)', 'zonderAccount'); continue;
    }
    if (srt === 'winkel') continue; // showroomafspraken: geen busklus
    const teamNaam = team(worker); tel(teamNaam, 'outlook');
    // 1. opdracht vinden: eigen sync-id, anders planner-opdracht op zelfde tijd+team
    let job = opExtId.get(extIdVan(e)); let via = 'sync';
    if (!job) { job = jobs.find((j) => j.scheduled_at && Math.abs(Date.parse(j.scheduled_at) - Date.parse(startISO)) <= 60e3 && j.assignee?.worker_uuid === worker && !(j.external_id || '').startsWith('ol-')); via = job ? 'planner' : null; }
    if (!job) { rapport.ontbreekt.push({ ...kop, team: teamNaam }); tel(teamNaam, 'ontbreekt'); continue; }
    gebruikt.add(job.uuid); if (via === 'planner') rapport.viaPlanner++;
    // 2. detail voor adres/omschrijving/contact
    let det = null; try { const d = await L.planadoJson('https://api.planadoapp.com/v2/jobs/' + job.uuid); det = d.job || d; } catch { /* zonder detail */ }
    await wacht(2600);
    const fouten = [];
    if (Math.abs(Date.parse(job.scheduled_at) - Date.parse(startISO)) > 60e3) fouten.push(`tijd Planado ${job.scheduled_at.slice(11, 16)}Z ≠ Outlook/Bookings ${startISO.slice(11, 16)}Z`);
    const duur = det?.scheduled_duration?.minutes ?? job.scheduled_duration?.minutes;
    if (via === 'sync' && duur && Math.abs(duur - minuten) > 5) fouten.push(`duur ${duur} min ≠ ${minuten} min`);
    if (job.assignee?.worker_uuid !== worker) fouten.push(`team Planado=${team(job.assignee?.worker_uuid)} ≠ Outlook=${teamNaam}`);
    if (det && /cancel|delet/i.test(det.status || '')) fouten.push(`status ${det.status}`);
    const olAdres = (e.Location?.DisplayName || '').trim() || L.adresUitBody(e);
    const pAdres = det?.address?.formatted || '';
    if (det) {
      if (/\d/.test(olAdres) && !pAdres) fouten.push('geen adres in Planado (Outlook: ' + olAdres.slice(0, 40) + ')');
      else if (/\d/.test(olAdres) && pAdres) { const h1 = huisnr(olAdres), h2 = huisnr(pAdres), p1 = postcode(olAdres), p2 = postcode(pAdres); if ((h1 && h2 && h1 !== h2) || (p1 && p2 && p1 !== p2)) fouten.push(`adres wijkt af: Planado "${pAdres.slice(0, 40)}" vs Outlook "${olAdres.slice(0, 40)}"`); }
      else if (!/\d/.test(olAdres) && !pAdres && srt !== 'winkel') fouten.push('geen adres, ook niet in Outlook');
      const olTel = L.telefoonUit(e.Body);
      if (olTel && !(det.contacts || []).length) fouten.push('telefoon uit Outlook ontbreekt in Planado');
      const desc = String(det.description || '');
      const kn = L.klantNaamUit(e.Subject);
      if (kn !== 'klant' && !norm(desc).includes(norm(kn))) fouten.push(`klantnaam "${kn}" niet in omschrijving`);
      const not = L.notitiesUit(e);
      if (not && !norm(desc).includes(norm(not.split('\n')[0]).slice(0, 30))) fouten.push('interne notities uit Outlook niet in omschrijving');
      if (!(det.assignee || job.assignee)) fouten.push('niet toegewezen');
    } else fouten.push('detail niet leesbaar (rate limit) — adres/omschrijving niet gecontroleerd');
    if (fouten.length) { rapport.afwijkend.push({ ...kop, team: teamNaam, planado: '#' + (job.serial_no || job.uuid.slice(0, 8)), via, fouten }); tel(teamNaam, 'afwijkend'); }
    else { rapport.ok++; tel(teamNaam, 'ok'); }
  }
  // 3. wezen: toekomstige Planado-opdrachten van bekende teams zonder Outlook-klus
  const evStarts = new Map();
  for (const e of evs.filter((x) => !x.IsCancelled)) { const echt = L.echteTijd(bookAppts, e); const s = echt ? echt.start : Date.parse(new Date(e.Start.DateTime + 'Z')); evStarts.set(Math.round(s / 60e3), true); const s2 = Date.parse(new Date(e.Start.DateTime + 'Z')); evStarts.set(Math.round(s2 / 60e3), true); }
  for (const j of jobs) {
    if (!j.scheduled_at || Date.parse(j.scheduled_at) < nu || gebruikt.has(j.uuid)) continue;
    if (!NAAM_VAN_UUID[j.assignee?.worker_uuid]) continue;
    if ((j.external_id || '').startsWith('meeneem-')) continue;
    const m = Math.round(Date.parse(j.scheduled_at) / 60e3);
    if (evStarts.get(m) || evStarts.get(m - 1) || evStarts.get(m + 1)) continue;
    rapport.wezen.push({ wanneer: j.scheduled_at, team: team(j.assignee?.worker_uuid), planado: '#' + (j.serial_no || j.uuid.slice(0, 8)), extern: j.external_id || '-' });
  }
  rapport.duurSec = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(S, '..', 'data', 'outlook-planado-audit.json'), JSON.stringify(rapport, null, 1));
  const r = rapport;
  console.log(`\n=== OUTLOOK → PLANADO AUDIT ${r.gemaakt} (${r.duurSec}s) ===`);
  console.log(`Outlook-events ${r.outlookEvents}, klussen ${r.klussen}, Bookings-tijden ${r.bookings}, Planado-opdrachten ${r.planadoJobs}, montage-sync aan: ${r.montageSyncAan}`);
  console.log(`OK ${r.ok} | ontbreekt ${r.ontbreekt.length} | afwijkend ${r.afwijkend.length} | zonder Planado-account ${r.zonderAccount.length} | wezen ${r.wezen.length} | via planner ${r.viaPlanner}`);
  console.log('per team: ' + Object.entries(r.perTeam).map(([k, v]) => `${k}: ${v.ok}/${v.outlook} ok${v.ontbreekt ? ', ' + v.ontbreekt + ' ontbreekt' : ''}${v.afwijkend ? ', ' + v.afwijkend + ' afwijkend' : ''}${v.zonderAccount ? ', ' + v.zonderAccount + ' zonder account' : ''}`).join(' | '));
  for (const x of r.ontbreekt) console.log(`  ONTBREEKT ${x.wanneer.slice(0, 16)} ${x.team}: ${x.onderwerp}`);
  for (const x of r.afwijkend) console.log(`  AFWIJKEND ${x.wanneer.slice(0, 16)} ${x.team} ${x.planado} (${x.via}): ${x.onderwerp} → ${x.fouten.join('; ')}`);
  for (const x of r.zonderAccount) console.log(`  GEEN ACCOUNT ${x.wanneer.slice(0, 16)} ${x.team}: ${x.onderwerp}`);
  for (const x of r.wezen) console.log(`  WEES ${x.wanneer.slice(0, 16)} ${x.team} ${x.planado} (${x.extern})`);
})().catch((e) => { console.error('FOUT', e.stack || e.message); process.exit(1); });
