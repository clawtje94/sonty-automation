#!/usr/bin/env node
// SEIZOENSPLAN — wat adverteren per maand, per kanaal, van augustus tot februari.
//
// Uitgangspunt: de schaarse hulpbron is niet advertentiegeld maar OFFERTECAPACITEIT
// (~250-280 offertes/week, zie capaciteitsmonitor). De vraag is dus niet "waar krijg
// ik de meeste leads" maar "welke 250 offertes per week leveren de meeste marge op".
// Daarom rangschikken we op MARGE PER OFFERTE = conversie x marge per order.
//
// Aug t/m dec: twee seizoenen (2024 + 2025). Jan/feb: twee seizoenen (2025 + 2026).
const fs = require('fs');
const MND = ['','jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const rows = [];
for (const j of [2024, 2025, 2026]) {
  try { rows.push(...JSON.parse(fs.readFileSync(__dirname + `/../data/conversie-${j}-raw.json`, 'utf8')).rows); }
  catch { console.error(`geen data voor ${j}`); }
}
const isAkk = r => r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer||'') || !!r.akkoordDatum;
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');
const pc = (a,b) => b ? a/b*100 : 0;
const f1 = n => n.toFixed(1).replace('.',',');

const KAN = r => { const t = String(r.afkomst||'').trim().toLowerCase();
  if (t.startsWith('face')||t.startsWith('insta')) return 'Meta';
  if (t.startsWith('goog')) return 'Google';
  if (t.includes('beken')||t.startsWith('buren')) return 'Buren/bekenden';
  return 'Anders'; };
const PROD = p => { const t = String(p||'').trim().toLowerCase(); if(!t) return null;
  if (t.startsWith('rolluik')) return 'Rolluiken';
  if (t.startsWith('screen')) return 'Screens';
  if (t.startsWith('knikarm')) return 'Knikarmscherm';
  if (t.startsWith('markiez')) return 'Markiezen';
  if (t.startsWith('pergola')) return 'Pergola';
  if (t.startsWith('repara')) return 'Reparatie';
  if (t.includes('raamdeco')) return 'Raamdecoratie binnen';
  if (t.includes('zonwering buiten')) return 'Zonwering buiten';
  if (t.includes('zonwering binnen')) return 'Raamdecoratie binnen';
  if (t.startsWith('voorraad')||t.startsWith('vooraad')) return 'Voorraadscherm';
  if (t.startsWith('uitval')) return 'Uitvalscherm';
  if (t.startsWith('hor')) return 'Horren';
  return null; };

// Welke jaren tellen mee per maand: alleen uitgerijpte en representatieve seizoenen.
const SEIZOEN = { 8:[2024,2025], 9:[2024,2025], 10:[2024,2025], 11:[2024,2025], 12:[2024,2025],
                  1:[2025,2026], 2:[2025,2026] };
const MAANDEN = [8,9,10,11,12,1,2];

function verzamel(filter) {
  const s = { off:0, akk:0, omzet:0, inkoop:0 };
  for (const r of rows) { if (!filter(r)) continue;
    s.off++; if (isAkk(r)) { s.akk++; s.omzet += r.akkoordBedrag||r.bedrag; s.inkoop += r.inkoop; } }
  return s;
}
const margePerOfferte = s => s.off ? (s.omzet - s.inkoop) / s.off : 0;
const inSeizoen = (r, m) => r.maand === m && SEIZOEN[m].includes(r.jaar);

console.log('=== 1. MARGE PER OFFERTE PER MAAND (aug t/m feb) ===');
console.log('De vraag is niet hoeveel leads je krijgt maar wat een offerte oplevert.\n');
console.log('mnd | offertes | akkoord | conv%  | marge totaal | MARGE PER OFFERTE | seizoenen');
for (const m of MAANDEN) {
  const s = verzamel(r => inSeizoen(r, m));
  console.log(`${MND[m].padEnd(3)} | ${String(s.off).padStart(8)} | ${String(s.akk).padStart(7)} | ${f1(pc(s.akk,s.off)).padStart(5)}% | ${eur(s.omzet-s.inkoop).padStart(12)} | ${eur(margePerOfferte(s)).padStart(17)} | ${SEIZOEN[m].join('+')}`);
}

console.log('\n\n=== 2. PER PRODUCTGROEP PER MAAND: marge per offerte ===');
const prods = [...new Set(rows.map(r => PROD(r.prod)).filter(Boolean))];
const relevant = prods.filter(p => verzamel(r => PROD(r.prod)===p && SEIZOEN[r.maand]?.includes(r.jaar) && MAANDEN.includes(r.maand)).off >= 40);
console.log('productgroep         | ' + MAANDEN.map(m => MND[m].padStart(7)).join(' |') + ' | totaal aug-feb');
for (const p of relevant) {
  const cel = MAANDEN.map(m => { const s = verzamel(r => PROD(r.prod)===p && inSeizoen(r,m));
    return s.off < 8 ? '     -' : (Math.round(margePerOfferte(s))+'').padStart(6); });
  const tot = verzamel(r => PROD(r.prod)===p && MAANDEN.includes(r.maand) && SEIZOEN[r.maand]?.includes(r.jaar));
  console.log(`${p.padEnd(20)} | ` + cel.map(c=>c.padStart(7)).join(' |') + ` | €${Math.round(margePerOfferte(tot))}/offerte  (${tot.off} off, ${f1(pc(tot.akk,tot.off))}%)`);
}
console.log('(bedragen in euro marge per uitgestuurde offerte; "-" = te weinig data)');

console.log('\n\n=== 3. PER KANAAL PER MAAND: marge per offerte ===');
const kanalen = ['Google','Meta','Buren/bekenden','Anders'];
console.log('kanaal          | ' + MAANDEN.map(m => MND[m].padStart(7)).join(' |') + ' | totaal aug-feb');
for (const k of kanalen) {
  const cel = MAANDEN.map(m => { const s = verzamel(r => KAN(r)===k && inSeizoen(r,m));
    return s.off < 8 ? '     -' : (Math.round(margePerOfferte(s))+'').padStart(6); });
  const tot = verzamel(r => KAN(r)===k && MAANDEN.includes(r.maand) && SEIZOEN[r.maand]?.includes(r.jaar));
  console.log(`${k.padEnd(15)} | ` + cel.map(c=>c.padStart(7)).join(' |') + ` | €${Math.round(margePerOfferte(tot))}/offerte  (${tot.off} off, ${f1(pc(tot.akk,tot.off))}%)`);
}

console.log('\n\n=== 4. KANAAL x PRODUCT (aug t/m feb samen): waar zit het geld ===');
console.log('combinatie                          | offertes | conv%  | marge/order | MARGE/OFFERTE');
const combos = [];
for (const k of kanalen) for (const p of relevant) {
  const s = verzamel(r => KAN(r)===k && PROD(r.prod)===p && MAANDEN.includes(r.maand) && SEIZOEN[r.maand]?.includes(r.jaar));
  if (s.off < 25) continue;
  combos.push({ k, p, s, mpo: margePerOfferte(s) });
}
combos.sort((a,b) => b.mpo - a.mpo);
for (const c of combos)
  console.log(`${(c.k+' - '+c.p).padEnd(35)} | ${String(c.s.off).padStart(8)} | ${f1(pc(c.s.akk,c.s.off)).padStart(5)}% | ${eur(c.s.akk?(c.s.omzet-c.s.inkoop)/c.s.akk:0).padStart(11)} | €${Math.round(c.mpo)}`);

console.log('\n\n=== 5. WANNEER KOMT DE VRAAG BINNEN (aandeel offertes per maand) ===');
console.log('Voor timing: een offerte in maand X wordt mediaan 24 dagen later een order.\n');
console.log('productgroep         | ' + MAANDEN.map(m => MND[m].padStart(6)).join(' |'));
for (const p of relevant) {
  const tot = verzamel(r => PROD(r.prod)===p && MAANDEN.includes(r.maand) && SEIZOEN[r.maand]?.includes(r.jaar)).off;
  const cel = MAANDEN.map(m => { const s = verzamel(r => PROD(r.prod)===p && inSeizoen(r,m));
    return (tot ? Math.round(s.off/tot*100)+'%' : '-').padStart(5); });
  console.log(`${p.padEnd(20)} | ` + cel.map(c=>c.padStart(6)).join(' |'));
}

console.log('\n\n=== 6. CELGROOTTES (aantal offertes per maand per product) ===');
console.log('Cellen onder ~30 offertes zijn ruis; daar geen budget op baseren.\n');
console.log('productgroep         | ' + MAANDEN.map(m => MND[m].padStart(6)).join(' |'));
for (const p of relevant) {
  const cel = MAANDEN.map(m => String(verzamel(r => PROD(r.prod)===p && inSeizoen(r,m)).off).padStart(5));
  console.log(`${p.padEnd(20)} | ` + cel.map(c=>c.padStart(6)).join(' |'));
}

console.log('\n\n=== 7. HUIDIGE VERDELING tegenover WAARDE ===');
console.log('Waar gaat je offertecapaciteit nu heen, en wat levert het op?\n');
const totOff = verzamel(r => MAANDEN.includes(r.maand) && SEIZOEN[r.maand]?.includes(r.jaar)).off;
const rijen = [];
for (const k of kanalen) for (const p of relevant) {
  const s = verzamel(r => KAN(r)===k && PROD(r.prod)===p && MAANDEN.includes(r.maand) && SEIZOEN[r.maand]?.includes(r.jaar));
  if (s.off < 25) continue;
  rijen.push({ naam: k+' - '+p, off: s.off, aandeel: s.off/totOff*100, mpo: margePerOfferte(s), marge: s.omzet-s.inkoop });
}
rijen.sort((a,b) => b.off - a.off);
console.log('combinatie                          | offertes | % capaciteit | marge/offerte | totale marge');
for (const r of rijen.slice(0, 14))
  console.log(`${r.naam.padEnd(35)} | ${String(r.off).padStart(8)} | ${f1(r.aandeel).padStart(11)}% | ${('€'+Math.round(r.mpo)).padStart(13)} | ${eur(r.marge)}`);
const slecht = rijen.filter(r => r.mpo < 140);
console.log(`\nCombinaties onder €140 marge per offerte: ${slecht.reduce((a,r)=>a+r.off,0)} offertes = ${f1(slecht.reduce((a,r)=>a+r.aandeel,0))}% van je capaciteit voor ${eur(slecht.reduce((a,r)=>a+r.marge,0))} marge.`);
const goed = rijen.filter(r => r.mpo >= 230);
console.log(`Combinaties boven €230 marge per offerte: ${goed.reduce((a,r)=>a+r.off,0)} offertes = ${f1(goed.reduce((a,r)=>a+r.aandeel,0))}% van je capaciteit voor ${eur(goed.reduce((a,r)=>a+r.marge,0))} marge.`);

// ---- JSON voor de rapportbouwer ----
const uit = { maanden: {}, producten: {}, kanalen: {}, combos: [], verdeling: [] };
for (const m of MAANDEN) { const s = verzamel(r => inSeizoen(r, m));
  uit.maanden[m] = { ...s, mpo: margePerOfferte(s), seizoenen: SEIZOEN[m] }; }
for (const p of relevant) {
  const tot = verzamel(r => PROD(r.prod)===p && MAANDEN.includes(r.maand) && SEIZOEN[r.maand]?.includes(r.jaar));
  uit.producten[p] = { totaal: { ...tot, mpo: margePerOfferte(tot) }, perMaand: {} };
  for (const m of MAANDEN) { const s = verzamel(r => PROD(r.prod)===p && inSeizoen(r,m));
    uit.producten[p].perMaand[m] = { off: s.off, akk: s.akk, mpo: margePerOfferte(s) }; }
}
for (const k of kanalen) {
  const tot = verzamel(r => KAN(r)===k && MAANDEN.includes(r.maand) && SEIZOEN[r.maand]?.includes(r.jaar));
  uit.kanalen[k] = { totaal: { ...tot, mpo: margePerOfferte(tot) }, perMaand: {} };
  for (const m of MAANDEN) { const s = verzamel(r => KAN(r)===k && inSeizoen(r,m));
    uit.kanalen[k].perMaand[m] = { off: s.off, akk: s.akk, mpo: margePerOfferte(s) }; }
}
uit.combos = combos.map(c => ({ kanaal: c.k, product: c.p, off: c.s.off, akk: c.s.akk,
  conv: pc(c.s.akk, c.s.off), margePerOrder: c.s.akk ? (c.s.omzet-c.s.inkoop)/c.s.akk : 0, mpo: c.mpo,
  marge: c.s.omzet - c.s.inkoop, aandeel: c.s.off/totOff*100 }));
uit.totaalOffertes = totOff;
require('fs').writeFileSync(__dirname + '/../data/seizoensplan.json', JSON.stringify(uit, null, 1));
console.log('\nJSON geschreven: data/seizoensplan.json');
