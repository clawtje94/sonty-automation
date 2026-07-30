#!/usr/bin/env node
// CAPACITEITSMONITOR — zegt of je advertentie-instroom op of af moet.
//
// Het idee: je verkoopteam heeft een plafond in het aantal orders dat het per week
// kan sluiten. Dat plafond bewoog tussen 2025 en 2026 niet, terwijl de instroom
// verdubbelde. Alles wat je bovenop dat plafond inkoopt wordt niet trager verwerkt
// maar verdwijnt: de offerte veroudert, de klant koopt elders.
//
// Drie getallen sturen de beslissing:
//   INSTROOM     offertes per week (leidend: je ziet het meteen)
//   VERWERKING   akkoorden per week op akkoorddatum = echte output van het team
//   RATIO        offertes per order. ~8 bij gezonde bezetting, 16-20 bij overbelasting
//
// Verzadiging = instroom / (aantoonbare capaciteit x gezonde ratio). Boven de 100%
// koop je meer dan je kunt verwerken.
//
// Gebruik: node scripts/capaciteitsmonitor.js [--stuur] [--jaar 2026]
//   --stuur  verstuurt het rapport via de Sonty data-bot
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'capaciteit-config.json');
const JAAR = +(process.argv[process.argv.indexOf('--jaar') + 1]) || new Date().getFullYear();

// Tabnamen per jaar; spelling verschilt (emoji, trailing spaces) dus exact overnemen.
const JAREN = {
  2025: { 'Jan 2025': 1, 'Feb 2025 🐸': 2, 'Maart 2025': 3, 'April 2025': 4, 'Mei 2025 ': 5, 'Juni 2025': 6,
          'Juli 2025': 7, 'Aug 2025': 8, 'Sep 2025': 9, 'Okt 2025': 10, 'Nov 2025': 11, 'Dec 2025': 12 },
  2026: { 'Jan 2026': 1, 'Feb 2026': 2, 'Maart 2026': 3, 'April 2026': 4, 'Mei 2026': 5, 'Juni 2026 ': 6, 'Juli 2026': 7 },
};

const STANDAARD = {
  gezondeRatio: 8,          // offertes per order bij gezonde bezetting (2025 jan-apr: 7,2-9,1)
  ratioLet: 11,             // hierboven: oplopend, in de gaten houden
  ratioAlarm: 13,           // hierboven: je koopt meer dan je verwerkt
  rijpingsdagen: 45,        // 86% van de akkoorden is binnen; jonger = onbetrouwbaar
  marge: 1690,              // gemiddelde productmarge per order (2025)
};
const cfg = Object.assign({}, STANDAARD, fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {});

const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const money = s => { const n = parseFloat(String(s || '').replace(/[€\s.]/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const pd = t => { const s = String(t || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
  return null; };
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;
const weekSleutel = d => { const t = new Date(d); t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const j = new Date(t.getFullYear(), 0, 4);
  return `${t.getFullYear()}-W${String(1 + Math.round(((t - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7)).padStart(2, '0')}`; };

async function leesJaar(sheets, jaar) {
  const tabs = JAREN[jaar]; if (!tabs) return [];
  const rows = [];
  for (const [tab, maand] of Object.entries(tabs)) {
    let res;
    try { res = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${tab}'!A1:AR3100` }); }
    catch (e) { console.error(`tab "${tab}" niet leesbaar: ${e.message}`); continue; }
    const vals = res.data.values || [];
    const hdr = (vals[2] || []).map(norm);
    const col = n => hdr.indexOf(n);
    const cols = {
      datum: col('datum of') >= 0 ? col('datum of') : 0,
      naam: col('naam') >= 0 ? col('naam') : col('achternaam'),
      bedrag: col('incl btw'),
      prod: col('product cat'),
      akkoordDatum: col('akkoord') >= 0 ? hdr.indexOf('akkoord', col('akkoord') + 1) : -1,
      nummer: col('nummer'),
      akkoordBedrag: hdr.lastIndexOf('akkoord'),
      inkoop: col('inkooop incl btw'),   // typo staat zo in de sheet; €1 = akkoord-markering
    };
    for (let i = 3; i < vals.length; i++) {
      const v = vals[i]; if (!v) continue;
      const naam = String(v[cols.naam] || '').trim();
      const bedrag = money(v[cols.bedrag]);
      if (!naam && !bedrag) continue;
      rows.push({ jaar, maand, celDatum: String(v[cols.datum] || ''), bedrag,
        prod: String(v[cols.prod] || '').trim(),
        akkoordDatum: cols.akkoordDatum >= 0 ? String(v[cols.akkoordDatum] || '').trim() : '',
        nummer: cols.nummer >= 0 ? String(v[cols.nummer] || '').trim() : '',
        akkoordBedrag: cols.akkoordBedrag >= 0 ? money(v[cols.akkoordBedrag]) : 0,
        inkoop: cols.inkoop >= 0 ? money(v[cols.inkoop]) : 0 });
    }
  }
  return rows;
}

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Huidig jaar plus vorig jaar: nodig om het aantoonbare capaciteitsplafond te bepalen.
  const rows = [...await leesJaar(sheets, JAAR - 1), ...await leesJaar(sheets, JAAR)];
  if (!rows.length) { console.error('geen rijen gelezen'); process.exit(1); }

  const nu = new Date();
  const dagenGeleden = d => Math.floor((nu - d) / 864e5);

  // ---- INSTROOM: offertes per week over de laatste 4 volle weken ----
  const offPerWeek = {};
  for (const r of rows) { const d = pd(r.celDatum);
    if (!d || dagenGeleden(d) < 0 || dagenGeleden(d) > 400) continue;
    offPerWeek[weekSleutel(d)] = (offPerWeek[weekSleutel(d)] || 0) + 1; }
  const offWeken = Object.keys(offPerWeek).sort();
  const huidigeWeek = weekSleutel(nu);
  const volleOffWeken = offWeken.filter(w => w < huidigeWeek);   // lopende week telt niet mee
  const laatste4 = volleOffWeken.slice(-4);
  const instroom = laatste4.reduce((a, w) => a + offPerWeek[w], 0) / (laatste4.length || 1);

  // ---- VERWERKING: akkoorden per week op akkoorddatum ----
  const akkPerWeek = {};
  for (const r of rows) { if (!isAkk(r)) continue;
    const d = pd(r.akkoordDatum); if (!d || dagenGeleden(d) < 0 || dagenGeleden(d) > 400) continue;
    akkPerWeek[weekSleutel(d)] = (akkPerWeek[weekSleutel(d)] || 0) + 1; }
  const akkWeken = Object.keys(akkPerWeek).sort().filter(w => w < huidigeWeek);
  const laatste8 = akkWeken.slice(-8);
  const verwerking = laatste8.reduce((a, w) => a + akkPerWeek[w], 0) / (laatste8.length || 1);

  // Aantoonbare capaciteit = beste 4 aaneengesloten weken. Dat heeft het team echt
  // gehaald, dus het is een reëel plafond en geen aanname.
  let piek = 0, piekWeken = '';
  for (let i = 0; i + 4 <= akkWeken.length; i++) {
    const s = akkWeken.slice(i, i + 4).reduce((a, w) => a + akkPerWeek[w], 0);
    if (s > piek) { piek = s; piekWeken = `${akkWeken[i]} t/m ${akkWeken[i + 3]}`; }
  }
  const capaciteit = piek / 4;

  // ---- RATIO: offertes per order, alleen op uitgerijpte offertes ----
  const rijp = rows.filter(r => { const d = pd(r.celDatum); return d && dagenGeleden(d) >= cfg.rijpingsdagen && dagenGeleden(d) <= cfg.rijpingsdagen + 60; });
  const rijpAkk = rijp.filter(isAkk).length;
  const ratio = rijpAkk ? rijp.length / rijpAkk : null;

  // ---- DOORLOOPTIJD: mediaan, recent tegenover eerder ----
  const lagsRecent = [], lagsEerder = [];
  for (const r of rows) { if (!isAkk(r)) continue;
    const a = pd(r.akkoordDatum), o = pd(r.celDatum); if (!a || !o) continue;
    const l = Math.round((a - o) / 864e5); if (l < 0 || l > 365) continue;
    (dagenGeleden(a) <= 120 ? lagsRecent : lagsEerder).push(l); }
  const med = arr => arr.length ? arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)] : null;

  // ---- OMSLAGPUNT uit de historie ----
  // Niet aannemen waar het misgaat maar meten: zet per maand de instroom per week af
  // tegen de ratio offertes-per-order. Alleen maanden die minstens rijpingsdagen+30
  // achter ons liggen, anders telt de ratio te hoog.
  const perMaand = {};
  for (const r of rows) {
    const k = `${r.jaar}-${String(r.maand).padStart(2, '0')}`;
    const m = (perMaand[k] = perMaand[k] || { off: 0, akk: 0 });
    m.off++; if (isAkk(r)) m.akk++;
  }
  const banden = [[0, 150], [150, 250], [250, 300], [300, 350], [350, 500], [500, 9999]];
  const bandStat = banden.map(([lo, hi]) => ({ lo, hi, off: 0, akk: 0, maanden: 0 }));
  for (const [k, d] of Object.entries(perMaand)) {
    const [jr, mn] = k.split('-').map(Number);
    const eind = new Date(jr, mn, 0);
    if (dagenGeleden(eind) < cfg.rijpingsdagen + 30) continue;   // nog niet uitgerijpt
    if (!d.akk) continue;
    const perWeek = d.off / 4.33;
    const b = bandStat.find(b => perWeek >= b.lo && perWeek < b.hi);
    if (b) { b.off += d.off; b.akk += d.akk; b.maanden++; }
  }
  const gevuld = bandStat.filter(b => b.maanden > 0);
  // Hoogste band waar de ratio nog echt gezond bleef. Dezelfde drempel als het
  // label hieronder, anders spreekt de conclusie de tabel tegen.
  let omslag = null;
  for (const b of gevuld) { if (b.off / b.akk <= cfg.gezondeRatio + 1) omslag = b; }

  // ---- OORDEEL ----
  const doel = capaciteit * cfg.gezondeRatio;          // offertes/week die je aankunt
  const verzadiging = doel ? instroom / doel * 100 : 0;
  const teveel = Math.round(instroom - doel);

  let oordeel, actie;
  if (verzadiging > 125) {
    oordeel = 'AFSCHALEN';
    actie = `Zet de instroom terug naar ongeveer ${Math.round(doel)} offertes per week. Dat is ${teveel} per week minder, ongeveer ${Math.round(teveel / instroom * 100)}% eraf.`;
  } else if (verzadiging > 105) {
    oordeel = 'IETS AFSCHALEN';
    actie = `Je zit ${Math.round(verzadiging - 100)}% boven wat je kunt verwerken. ${teveel} offertes per week eraf brengt je terug in balans.`;
  } else if (verzadiging < 75) {
    oordeel = 'OPSCHALEN';
    actie = `Je hebt ruimte voor ongeveer ${Math.abs(teveel)} offertes per week extra voordat je tegen je plafond loopt.`;
  } else {
    oordeel = 'VASTHOUDEN';
    actie = 'Instroom en verwerkingscapaciteit zijn in balans. Niet bijstellen.';
  }

  // ---- RAPPORT ----
  const L = [];
  L.push(`CAPACITEITSMONITOR — ${huidigeWeek}`);
  L.push('');
  L.push(`INSTROOM      ${Math.round(instroom)} offertes/week   (laatste ${laatste4.length} volle weken)`);
  L.push(`VERWERKING    ${verwerking.toFixed(1)} orders/week      (laatste ${laatste8.length} weken)`);
  L.push(`CAPACITEIT    ${capaciteit.toFixed(1)} orders/week      (beste 4 weken ooit: ${piekWeken})`);
  L.push(`VERZADIGING   ${Math.round(verzadiging)}%`);
  if (ratio) L.push(`RATIO         ${ratio.toFixed(1)} offertes per order   (gezond is ~${cfg.gezondeRatio})`);
  if (med(lagsRecent) !== null) L.push(`DOORLOOPTIJD  ${med(lagsRecent)} dagen tot akkoord${med(lagsEerder) !== null ? ` (was ${med(lagsEerder)})` : ''}`);
  L.push('');
  L.push(`OORDEEL: ${oordeel}`);
  L.push(actie);
  L.push('');
  if (verzadiging > 105) {
    L.push(`Waarom: je hebt nu ${ratio ? ratio.toFixed(1) : '?'} offertes nodig per order, bij gezonde bezetting is dat ${cfg.gezondeRatio}.`);
    L.push(`Die ${Math.round(instroom - doel)} extra offertes per week leveren geen orders op, ze kosten alleen inmeet- en opvolgtijd.`);
    L.push(`Het plafond van ${capaciteit.toFixed(0)} orders per week gaat niet omhoog door meer leads te kopen; daar is meer mensen of een korter verkoopproces voor nodig.`);
    if (verwerking < capaciteit * 0.9) {
      L.push(`Let op: je verwerkt nu ${verwerking.toFixed(0)} orders per week terwijl je er ${capaciteit.toFixed(0)} hebt gehaald. De output is dus niet alleen gelijk gebleven maar gezakt terwijl de instroom steeg.`);
    }
  }
  if (gevuld.length > 1) {
    L.push('');
    L.push('OMSLAGPUNT UIT JE EIGEN HISTORIE (uitgerijpte maanden):');
    for (const b of gevuld) {
      const r = b.off / b.akk;
      const vlag = r <= cfg.gezondeRatio + 1 ? 'gezond' : r <= cfg.ratioAlarm ? 'oplopend' : 'overbelast';
      L.push(`  ${String(b.lo).padStart(3)}-${b.hi > 999 ? '   ' : String(b.hi).padStart(3)} offertes/week -> ${r.toFixed(1)} offertes per order  (${vlag}, ${b.maanden} mnd)`);
    }
    if (omslag) L.push(`  Tot ongeveer ${omslag.hi} offertes per week blijft het gezond. Daarboven loopt het weg.`);
  }
  const tekst = L.join('\n');
  console.log(tekst);

  fs.writeFileSync(path.join(__dirname, '..', 'data', 'capaciteit-laatste.json'),
    JSON.stringify({ week: huidigeWeek, instroom, verwerking, capaciteit, verzadiging, ratio,
      doorlooptijdRecent: med(lagsRecent), doorlooptijdEerder: med(lagsEerder), oordeel, actie }, null, 1));

  if (process.argv.includes('--stuur')) {
    try { execFileSync('node', [path.join(__dirname, 'sonty-data-send.js'), tekst], { stdio: 'inherit' }); }
    catch (e) { console.error('versturen mislukt:', e.message); }
  }
})();
