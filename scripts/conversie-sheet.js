#!/usr/bin/env node
// Conversie 2025 uit het offerte-register (Google Sheet), per maand x afkomst x productgroep.
// Leest per maandtab de headerrij (rij 3) omdat kolomindexen per tab verschillen.
// Conversie = rijen met Akkoord=TRUE gedeeld door alle offerte-rijen.
const { google } = require('googleapis');
const fs = require('fs');
const ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
// Tabnamen zijn per jaar net anders gespeld (emoji, trailing spaces) — exact overnemen.
const JAREN = {
  // 2024 begint pas in mei; de maanden ervoor staan niet als los tabblad in de sheet.
  2024: {'Mei 2024':5,'Juni 2024':6,'Juli 2024':7,'Aug 2024':8,'Sep 2024':9,'Okt 2024':10,'Nov 2024':11,'Dec 2024':12},
  2025: {'Jan 2025':1,'Feb 2025 🐸':2,'Maart 2025':3,'April 2025':4,'Mei 2025 ':5,'Juni 2025':6,
         'Juli 2025':7,'Aug 2025':8,'Sep 2025':9,'Okt 2025':10,'Nov 2025':11,'Dec 2025':12},
  2026: {'Jan 2026':1,'Feb 2026':2,'Maart 2026':3,'April 2026':4,'Mei 2026':5,'Juni 2026 ':6,'Juli 2026':7},
};
const JAAR = +(process.argv[process.argv.indexOf('--jaar') + 1]) || 2025;
if (!JAREN[JAAR]) { console.error('geen tabs bekend voor', JAAR); process.exit(1); }
const TAB_MAAND = JAREN[JAAR];
const TABS = Object.keys(TAB_MAAND);
// 'Augustus 2025' (leeg) en '2025 alles bij elkaar' (deel-kopie jan t/m 18 mrt) NIET meenemen:
// die zouden dubbeltellen. Wel als controle apart te draaien met --controle.
const EXTRA = (process.argv.includes('--controle') && JAAR === 2025) ? ['Augustus 2025','2025 alles bij elkaar'] : [];

const norm = s => String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const money = s => {
  const t = String(s||'').replace(/[€\s .]/g,'').replace(',','.');
  const n = parseFloat(t); return isFinite(n) ? n : 0;
};
function findCol(hdr, want) {
  const i = hdr.findIndex(h => norm(h) === want);
  return i;
}
function parseDatum(v) {
  const t = String(v||'').trim();
  // ISO: "2025-07-18 19:20:00" / "2025-07-18"
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { jaar: +m[1], maand: +m[2] };
  // NL: "1-1-25", "1-7-2025", "07-01-2025"
  m = t.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return { jaar: y, maand: +m[2] }; }
  return null;
}

(async () => {
  const auth = new google.auth.GoogleAuth({keyFile: __dirname+'/../data/google-service-account.json', scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']});
  const sheets = google.sheets({version:'v4', auth});
  const rows = [];
  const tabInfo = [];
  const geenDatum = [];
  const mismatch = [];

  for (const tab of TABS.concat(EXTRA)) {
    const r = await sheets.spreadsheets.values.get({spreadsheetId: ID, range: `'${tab}'!A1:AR3100`});
    const vals = r.data.values || [];
    const hdr = vals[2] || [];
    const cols = {
      datum: findCol(hdr,'datum of') >= 0 ? findCol(hdr,'datum of') : 0, // Maart 2025 mist deze header
      naam: findCol(hdr,'naam') >= 0 ? findCol(hdr,'naam') : findCol(hdr,'achternaam'),
      tel: findCol(hdr,'telefoon nummer'),
      bedrag: findCol(hdr,'incl btw'),
      kanaal: findCol(hdr,'online'),
      afkomst: findCol(hdr,'afkomst offerte'),
      klant: findCol(hdr,'wat voor klant'),
      prod: findCol(hdr,'product cat'),
      akkoord: findCol(hdr,'akkoord'),                     // checkbox TRUE/FALSE (blijkt slecht bijgehouden)
      akkoordDatum: findCol(hdr,'akkoord') >= 0 ? hdr.map(norm).indexOf('akkoord', findCol(hdr,'akkoord')+1) : -1,
      nummer: findCol(hdr,'nummer'),                       // Gripp-opdrachtnummer = hardste akkoordbewijs
      akkoordBedrag: hdr.map(norm).lastIndexOf('akkoord'),
      inkoop: findCol(hdr,'inkooop incl btw'),
      gebeld: findCol(hdr,'gebeld?'),
    };
    for (const [k,vv] of Object.entries(cols)) if (vv < 0) console.error(`! ${tab}: kolom "${k}" niet gevonden`);
    let n = 0;
    for (let i = 3; i < vals.length; i++) {
      const v = vals[i]; if (!v) continue;
      const naam = String(v[cols.naam]||'').trim();
      const bedrag = money(v[cols.bedrag]);
      const dt = parseDatum(v[cols.datum]);
      if (!naam && !bedrag) continue;
      // Maand komt uit de TAB (autoritatief voor registratiemaand); de datum in de cel is
      // vaak onvolledig ("08-01") of een typfout (jaar 2024 in een 2025-tab).
      const tabMaand = TAB_MAAND[tab] || null;
      if (!dt && !tabMaand) { geenDatum.push({tab, rij: i+1, naam, ruw: String(v[cols.datum]||'')}); continue; }
      if (!dt) geenDatum.push({tab, rij: i+1, naam, ruw: String(v[cols.datum]||'')});
      else if (tabMaand && (dt.maand !== tabMaand || dt.jaar !== JAAR)) mismatch.push({tab, rij: i+1, naam, celMaand: `${dt.jaar}-${dt.maand}`});
      rows.push({
        tab, rij: i+1, jaar: JAAR, maand: tabMaand || dt.maand, celDatum: String(v[cols.datum]||''), naam,
        tel: String(v[cols.tel]||'').replace(/\D/g,'').slice(-9),
        bedrag,
        kanaal: String(v[cols.kanaal]||'').trim() || '(leeg)',
        afkomst: String(v[cols.afkomst]||'').trim() || '(leeg)',
        klanttype: String(v[cols.klant]||'').trim() || '(leeg)',
        prod: String(v[cols.prod]||'').trim() || '(leeg)',
        akkoord: String(v[cols.akkoord]||'').trim().toUpperCase() === 'TRUE',
        akkoordDatum: String(v[cols.akkoordDatum]||'').trim(),
        nummer: String(v[cols.nummer]||'').trim(),
        akkoordBedrag: money(v[cols.akkoordBedrag]),
        inkoop: money(v[cols.inkoop]),
        gebeld: cols.gebeld >= 0 ? String(v[cols.gebeld]||'').trim() : '',
      });
      n++;
    }
    tabInfo.push({tab, rijen: n});
  }
  fs.writeFileSync(__dirname+`/../data/conversie-${JAAR}-raw.json`, JSON.stringify({tabInfo, geenDatum, mismatch, rows}, null, 0));
  console.log('TAB-RIJEN:'); tabInfo.forEach(t => console.log(`  ${t.tab.padEnd(24)} ${t.rijen}`));
  console.log('totaal rijen:', rows.length);
  console.log('rijen zonder leesbare datum (overgeslagen):', geenDatum.length);
  if (geenDatum.length) console.log('  voorbeelden:', geenDatum.slice(0,6).map(g=>`${g.tab} r${g.rij} "${g.ruw}" ${g.naam}`).join(' | '));
  console.log('rijen waar celdatum afwijkt van tabmaand (tab is leidend):', mismatch.length);
  if (mismatch.length) console.log('  voorbeelden:', mismatch.slice(0,10).map(m=>`${m.tab} r${m.rij} cel=${m.celMaand}`).join(' | '));
  // dubbeling-check: zelfde telefoonnummer + zelfde bedrag meer dan 1x
  const key = r => `${r.tel}|${Math.round(r.bedrag)}`;
  const cnt = {}; rows.forEach(r => { if (r.tel.length>=9) cnt[key(r)] = (cnt[key(r)]||0)+1; });
  const dubbel = Object.entries(cnt).filter(([,c])=>c>1);
  console.log('mogelijke dubbele rijen (zelfde tel+bedrag):', dubbel.reduce((a,[,c])=>a+c-1,0), 'over', dubbel.length, 'sleutels');
  // Welk akkoordsignaal is betrouwbaar? Vergelijk de drie kandidaten.
  const cb = rows.filter(r=>r.akkoord).length;
  const nr = rows.filter(r=>/^\d{3,6}$/.test(r.nummer)).length;
  const bd = rows.filter(r=>r.akkoordBedrag>0).length;
  const dat = rows.filter(r=>r.akkoordDatum).length;
  const unie = rows.filter(r=>r.akkoord || /^\d{3,6}$/.test(r.nummer) || r.akkoordBedrag>0).length;
  console.log(`\nAKKOORDSIGNALEN (van ${rows.length} offertes):`);
  console.log(`  checkbox TRUE      : ${cb}  (${(cb/rows.length*100).toFixed(1)}%)`);
  console.log(`  Gripp-nummer gevuld: ${nr}  (${(nr/rows.length*100).toFixed(1)}%)`);
  console.log(`  akkoordbedrag > 0  : ${bd}  (${(bd/rows.length*100).toFixed(1)}%)`);
  console.log(`  akkoorddatum gevuld: ${dat}  (${(dat/rows.length*100).toFixed(1)}%)`);
  console.log(`  unie van bovenste 3: ${unie}  (${(unie/rows.length*100).toFixed(1)}%)`);
  const perMaandSig = {};
  rows.forEach(r=>{const m=(perMaandSig[r.maand]=perMaandSig[r.maand]||{off:0,cb:0,nr:0,bd:0});m.off++;if(r.akkoord)m.cb++;if(/^\d{3,6}$/.test(r.nummer))m.nr++;if(r.akkoordBedrag>0)m.bd++;});
  console.log('  per maand  off | checkbox | grippnr | bedrag');
  for(let m=1;m<=12;m++){const d=perMaandSig[m];if(!d)continue;console.log(`    ${String(m).padStart(2)}  ${String(d.off).padStart(5)} | ${String(d.cb).padStart(8)} | ${String(d.nr).padStart(7)} | ${String(d.bd).padStart(6)}`);}
})();
