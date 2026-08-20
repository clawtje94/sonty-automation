#!/usr/bin/env node
// MONTAGE-VOORSTELLEN in de planning-sheet (Daimy 2026-08-20, voorbeeld rij 1081):
// vanaf rij 1142 vult dit script kolommen S t/m V met een AI-voorstel:
//   S = "AI voorstel dd-mm"   T = datum & tijd met echte plek in de Outlook-agenda
//   U = geschatte montageduur van de VOLLEDIGE order   V = voorgestelde bus
//
// Harde regels (Daimy):
//   - alleen rijen ZONDER datum in kolom M (al gepland = afblijven);
//   - alleen als de order COMPLEET is: elke regel van hetzelfde Gripp-nummer
//     heeft een "Geleverd op" (kolom L);
//   - er wordt NIETS in Outlook gezet en NIETS anders in de sheet gewijzigd
//     (dit script heeft geen enkele schrijfroute naar Outlook/Bookings);
//   - buskeuze NIET op regio of kolom N (Daimy 20-08): puur op wat er al in de
//     agenda staat — de bus met het best passende eerstvolgende gat wint;
//   - 1x per dag verversen (launchd nl.sonty.montage-voorstellen).
// Roosters komen live uit de Bookings-staffprofielen; extra planregels (Yudi's
// even-weken-woensdag, vakanties als agenda-blok) uit docs/montage-planregels.md.
const fs = require('fs');
const path = require('path');
const { google } = require('/Users/clawdboot/sonty/node_modules/googleapis');
const b = require('/Users/clawdboot/sonty/scripts/bookings-api.js');

const SHEET = '1xkQaLKgAgvhP46JtZWRRj2zWpqr5_J5z9xTiiqT9lvs';
const TAB = '2026 goed';
const VANAF_RIJ = 1142;
const BIZ = 'SontyMontage1@sontymontage.nl';
const TIJDEN = JSON.parse(fs.readFileSync('/Users/clawdboot/sonty/data/montagetijden/montagetijden-v1.json', 'utf8')).producten;

// Bookings-busnaam → naam zoals hij in de sheet-dropdown (kolom N/V) heet
const SHEETNAAM = { 'Dennis & Frenky': 'Frenk en Dennis', 'Marvin / Bart': 'Marvin & Bart', 'Marvin / Moa': 'Marvin & Moa', 'Tygo / Kevin': 'Tygo & Kevin', 'Yudi / Nick': 'Yudi & Nick' };

// productgroep-herkenning in kolom P → sleutel in de montagetijden-lijst
const GROEPEN = [
  [/pergola|suncontrol|bovendak/i, 'pergola'],
  [/markies/i, 'markies'],
  [/suneye|knikarm|sunbasic|sunelite|zonnescherm/i, 'knikarmscherm'],
  [/suncube|sunproject|uitval/i, 'uitvalscherm'],
  [/screen|zip/i, 'screen_rits'],
  [/rolluik|pantser/i, 'rolluik'],
  [/\bhor(ren|deur)?\b|rolhor|plisse ?hor/i, 'hor'],
  [/plisse|plissee|vouwgordijn|gordijn|jaloezie|rolgordijn|duette|vitrage|dakraam|fakro/i, 'binnenzonwering'],
];

function duurVanOrder(teksten) {
  const aantal = {};
  for (const t of teksten) {
    for (const deel of String(t).split(/[,+]/)) {
      const groep = (GROEPEN.find(([re]) => re.test(deel)) || [])[1];
      if (!groep) continue;
      const n = parseInt((deel.match(/(\d+)\s*x/i) || [])[1] || '1', 10);
      aantal[groep] = (aantal[groep] || 0) + n;
    }
  }
  let min = 0; const delen = [];
  for (const [groep, n] of Object.entries(aantal)) {
    const t = TIJDEN[groep]; if (!t) continue;
    const st = t.staffels || {};
    const d = st[String(n)] ?? (n >= 4 && st['4+'] !== undefined ? st['4+'] + (n - 4) * (t.perExtra || 0)
      : t.eerste + Math.max(0, n - 1) * (t.perExtra || 0));
    min += d; delen.push(n + 'x ' + groep.replace('_rits', '').replace('binnenzonwering', 'binnenzonw.'));
  }
  if (!min) return { min: 60, label: '60 min (schatting, product onbekend)' };
  return { min, label: min + ' min (' + delen.join(' + ') + ')' };
}

const MIN = 60000;
const kwart = (d) => { const x = new Date(d); x.setUTCMinutes(Math.ceil(x.getUTCMinutes() / 15) * 15, 0, 0); return x; };
const nl = (d, opts) => new Date(d).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', ...opts });

/** Eerste blok van `duurMin` in de agenda van deze bus, binnen het eigen rooster.
 *  `bezetExtra` = slots die deze run al aan eerdere rijen zijn voorgesteld. */
function eersteSlot(busNaam, duurMin, agenda, rooster, bezetExtra, evenWeekWoensdagDicht) {
  const start = new Date(); start.setUTCDate(start.getUTCDate() + 1); start.setUTCHours(0, 0, 0, 0);
  for (let dag = 0; dag < 30; dag++) {
    const d = new Date(+start + dag * 86400000);
    const dagNamen = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const wh = rooster[dagNamen[d.getUTCDay()]];
    if (!wh) continue;
    if (evenWeekWoensdagDicht && d.getUTCDay() === 3) {
      const week = Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000) + new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getUTCDay() + 1) / 7);
      if (week % 2 === 0) continue;
    }
    // rooster is NL-tijd; zomertijd = UTC+2
    const [vanU, vanM] = wh.start.split(':').map(Number);
    const [totU, totM] = wh.end.split(':').map(Number);
    const dagVan = new Date(d); dagVan.setUTCHours(vanU - 2, vanM, 0, 0);
    const dagTot = new Date(d); dagTot.setUTCHours(totU - 2, totM, 0, 0);
    const bezet = [...(agenda[d.toISOString().slice(0, 10)] || []), ...(bezetExtra[d.toISOString().slice(0, 10)] || [])]
      .sort((a, b) => a.van - b.van);
    let cursor = kwart(dagVan);
    for (const blok of bezet) {
      if (+blok.van - +cursor >= duurMin * MIN && +cursor + duurMin * MIN <= +dagTot) return { van: cursor };
      if (+blok.tot > +cursor) cursor = kwart(blok.tot);
    }
    if (+dagTot - +cursor >= duurMin * MIN) return { van: cursor };
  }
  return null;
}

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: '/Users/clawdboot/sonty/data/google-service-account.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET, range: `'${TAB}'!A1:V3000` });
  const rows = r.data.values || [];

  // Bookings: roosters (workingHours per profiel, alleen-lezen via Graph) +
  // de bestaande agenda per bus — dat IS wat er in Outlook staat.
  const src = fs.readFileSync('/Users/clawdboot/sonty/scripts/bookings-api.js', 'utf8');
  const TENANT = (src.match(/TENANT\s*=\s*'([^']+)'/) || [])[1];
  const CLIENT = (src.match(/CLIENT_ID\s*=\s*'([^']+)'/) || [])[1];
  const RT_PAD = '/Users/clawdboot/sonty/scripts/.bookings-refresh-token.txt';
  const tok = await (async () => {
    const d = await (await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT, grant_type: 'refresh_token', refresh_token: fs.readFileSync(RT_PAD, 'utf8').trim(), scope: 'https://graph.microsoft.com/.default' }),
    })).json();
    if (d.refresh_token) fs.writeFileSync(RT_PAD, d.refresh_token);
    return d.access_token;
  })();
  const staffVol = (await (await fetch(`https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/${encodeURIComponent(BIZ)}/staffMembers`, { headers: { Authorization: 'Bearer ' + tok } })).json()).value || [];

  const tot = new Date(); tot.setUTCDate(tot.getUTCDate() + 32);
  const afs = await b.afspraken(BIZ, { start: new Date().toISOString(), end: tot.toISOString() });
  const afsLijst = Array.isArray(afs) ? afs : afs.value || [];
  const perBus = {};
  for (const busNaam of Object.keys(SHEETNAAM)) {
    const lid = staffVol.find((m) => (m.displayName || '').toLowerCase().startsWith(busNaam.toLowerCase().split(' ')[0])
      && (m.displayName || '').toLowerCase().includes((busNaam.split(/ [/&] /)[1] || '').toLowerCase()));
    if (!lid) { console.log('  bus niet gevonden in Bookings: ' + busNaam); continue; }
    const wh = {};
    for (const w of (lid.workingHours || [])) if (w.timeSlots?.length) wh[w.day] = { start: w.timeSlots[0].startTime.slice(0, 5), end: w.timeSlots[0].endTime.slice(0, 5) };
    if (!Object.keys(wh).length) { console.log('  geen rooster voor ' + busNaam + ' — overgeslagen'); continue; }
    const agenda = {};
    afsLijst.filter((a) => (a.staffIds || []).includes(lid.id)).forEach((a) => {
      // Meerdaagse blokken (vakanties!) gelden op ELKE dag die ze raken — anders
      // telde Marvin/Moa's vakantie t/m 21-08 alleen op de startdag mee en werd
      // er doodleuk op hun laatste vakantiedag gepland (eerste run 20-08).
      const van = new Date(a.start), tot = new Date(a.eind || a.end);
      for (let d = new Date(van.toISOString().slice(0, 10)); d < tot; d.setUTCDate(d.getUTCDate() + 1)) {
        const sleutel = d.toISOString().slice(0, 10);
        (agenda[sleutel] = agenda[sleutel] || []).push({ van, tot });
      }
    });
    perBus[busNaam] = { rooster: wh, agenda };
  }
  console.log('bussen geladen: ' + Object.keys(perBus).join(', '));

  // orders groeperen: compleetheid per Gripp-nummer over ALLE rijen van de sheet
  const perGripp = {};
  rows.forEach((row, i) => {
    const nr = String(row[4] || '').trim();
    if (nr) (perGripp[nr] = perGripp[nr] || []).push({ rij: i + 1, geleverd: !!String(row[11] || '').trim(), gepland: !!String(row[12] || '').trim(), wat: row[15] || '' });
  });

  const vandaag = nl(new Date(), { day: '2-digit', month: '2-digit' });
  const bezetExtra = {};   // per bus: deze run al voorgestelde slots
  const updates = [];
  let voorstellen = 0, overgeslagen = 0;
  const behandeld = new Set();

  for (let i = VANAF_RIJ - 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const naam = String(row[5] || '').trim();
    const gripNr = String(row[4] || '').trim();
    if (String(row[12] || '').trim()) continue;                       // M gevuld = gepland
    if (!naam && !gripNr) continue;                                    // lege regel
    const sleutel = gripNr || 'rij' + (i + 1);
    if (behandeld.has(sleutel)) continue;
    behandeld.add(sleutel);

    // compleetheid: alle regels van dit Gripp-nummer geleverd
    const groep = gripNr ? perGripp[gripNr] : [{ rij: i + 1, geleverd: !!String(row[11] || '').trim(), gepland: false, wat: row[15] || '' }];
    if (!groep.every((g) => g.geleverd)) { overgeslagen++; continue; }
    const teplannen = groep.filter((g) => !g.gepland && g.rij >= VANAF_RIJ);
    if (!teplannen.length) continue;

    const { min, label } = duurVanOrder(groep.map((g) => g.wat));

    // buskeuze puur op beschikbaarheid (Daimy 20-08): alle bussen langs, de bus
    // met het vroegste passende gat in de bestaande Outlook-planning wint.
    let keuze = null;
    for (const busNaam of Object.keys(perBus)) {
      const info = perBus[busNaam];
      const evenDicht = busNaam === 'Yudi / Nick';   // even weken: woensdag geen Yudi-bus
      const slot = eersteSlot(busNaam, min, info.agenda, info.rooster, bezetExtra[busNaam] = bezetExtra[busNaam] || {}, evenDicht);
      if (slot && (!keuze || +slot.van < +keuze.slot.van)) keuze = { busNaam, slot };
    }
    if (!keuze) {
      for (const g of teplannen) updates.push({ range: `'${TAB}'!S${g.rij}:V${g.rij}`, values: [[`AI voorstel ${vandaag}`, 'geen plek < 30 dagen', label, '']] });
      voorstellen++;
      continue;
    }
    const van = keuze.slot.van;
    const dEind = new Date(+van + min * MIN);
    const dag = (bezetExtra[keuze.busNaam][van.toISOString().slice(0, 10)] = bezetExtra[keuze.busNaam][van.toISOString().slice(0, 10)] || []);
    dag.push({ van, tot: dEind });
    const tekst = nl(van, { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + nl(van, { hour: '2-digit', minute: '2-digit' });
    for (const g of teplannen) updates.push({ range: `'${TAB}'!S${g.rij}:V${g.rij}`, values: [[`AI voorstel ${vandaag}`, tekst, label, SHEETNAAM[keuze.busNaam]]] });
    voorstellen++;
  }

  for (let i = 0; i < updates.length; i += 80) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET, requestBody: { valueInputOption: 'RAW', data: updates.slice(i, i + 80) } });
  }
  console.log(`[${new Date().toISOString()}] montage-voorstellen: ${voorstellen} order(s) voorgesteld (${updates.length} rijen), ${overgeslagen} niet compleet — overgeslagen`);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
