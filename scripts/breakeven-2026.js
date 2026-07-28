#!/usr/bin/env node
// BREAK-EVEN ADVERTENTIEKOSTEN 2026 — met alle tussenstappen zichtbaar.
//
// Het probleem: de advertentiekosten over 2026 zijn nergens vastgelegd. In plaats van
// die te gokken draaien we de vraag om: bij WELK bedrag per offerte draai je break-even?
// Dat is exact te berekenen, en Daimy kan het naast zijn bankafschrift leggen.
//
// De redenering in vier stappen:
//   1. Uit het offerteregister: productmarge per order (verkoop min inkoop).
//   2. Uit de tab "winst verlies": wat er onderaan echt overblijft.
//   3. Het verschil daartussen = alle overige kosten per order (montage, inmeten,
//      garantie, overhead EN advertenties).
//   4. Advertentiekosten over maart t/m mei 2025 zijn wel bekend, dus die kunnen we
//      eruit lichten. Wat overblijft is montage+overhead per order. Dat getal nemen
//      we mee naar 2026 -- die kosten hangen niet af van waar de lead vandaan kwam.
const fs = require('fs');
const path = require('path');
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');
const f1 = n => n.toFixed(1).replace('.', ',');
const BTW = 1.21;

const T25 = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','conversie-2025-tabellen.json'),'utf8'));
const T26 = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','conversie-2026-tabellen.json'),'utf8'));

// Uit de tab "winst verlies". Drie winstregels; de tab noemt 8,05% maar dat is
// inclusief de bonus van 60k die als kost is teruggeteld. We rekenen met de
// conservatieve regel (winst netto) en tonen de bandbreedte.
const WV = {
  2025: { omzetEx: 3442740, bruto: 236188, netto: 217293, metBonus: 277293 },
  2026: { omzetEx: 2941431, bruto: 329674, netto: 303300, metBonus: 352324 },
};

const blok = (T, maanden) => maanden.reduce((s,m) => { const d = T.maand[m]; if(!d) return s;
  return { off:s.off+d.off, akk:s.akk+d.akk, omzet:s.omzet+d.omzet, inkoop:s.inkoop+d.inkoop }; },
  {off:0,akk:0,omzet:0,inkoop:0});

console.log('='.repeat(72));
console.log('STAP 1 — Productmarge per order, uit het offerteregister');
console.log('='.repeat(72));
const j25 = T25.totaal.alles;
const marge25Ex = (j25.omzet - j25.inkoop) / BTW;
const margePerOrder25 = marge25Ex / j25.akk;
console.log(`2025: ${j25.akk} orders, omzet ${eur(j25.omzet)} incl, inkoop ${eur(j25.inkoop)} incl`);
console.log(`      productmarge ${eur(j25.omzet-j25.inkoop)} incl = ${eur(marge25Ex)} ex btw`);
console.log(`      -> ${eur(margePerOrder25)} productmarge per order (ex btw)\n`);

console.log('='.repeat(72));
console.log('STAP 2 — Wat blijft er onderaan echt over, uit de tab "winst verlies"');
console.log('='.repeat(72));
const w25 = WV[2025];
console.log(`Omzet ex btw volgens die tab: ${eur(w25.omzetEx)}`);
console.log(`  mijn akkoordomzet ex btw  : ${eur(j25.omzet/BTW)}  (${f1((j25.omzet/BTW)/w25.omzetEx*100-100)}% ernaast -- de cijfers matchen)`);
console.log(`Winst bruto ${eur(w25.bruto)} = ${f1(w25.bruto/w25.omzetEx*100)}%`);
console.log(`Winst netto ${eur(w25.netto)} = ${f1(w25.netto/w25.omzetEx*100)}%   <-- hiermee rekenen we (conservatief)`);
console.log(`Met bonus   ${eur(w25.metBonus)} = ${f1(w25.metBonus/w25.omzetEx*100)}%   (de 8,05% die in de tab staat)`);
const winstPerOrder25 = w25.netto / j25.akk;
console.log(`\n-> ${eur(winstPerOrder25)} nettowinst per order in 2025\n`);

console.log('='.repeat(72));
console.log('STAP 3 — Alles wat tussen productmarge en winst zit');
console.log('='.repeat(72));
const overigeKosten25 = margePerOrder25 - winstPerOrder25;
console.log(`${eur(margePerOrder25)} productmarge min ${eur(winstPerOrder25)} winst = ${eur(overigeKosten25)} overige kosten per order.`);
console.log(`Daar zitten montage-uren, inmeten, garantie, overhead EN advertenties in.\n`);

console.log('='.repeat(72));
console.log('STAP 4 — Advertenties eruit lichten (mrt t/m mei 2025, de enige echte kosten)');
console.log('='.repeat(72));
const SPEND = { 3:{Meta:19800,Google:6300}, 4:{Meta:22000,Google:10300}, 5:{Meta:23700,Google:17100} };
const spendTot = Object.values(SPEND).reduce((a,m)=>a+m.Meta+m.Google, 0);
// orders uit Meta+Google in die maanden
const raw25 = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','conversie-2025-raw.json'),'utf8')).rows;
const isAkk = r => r.akkoordBedrag>0 || /^\d{3,6}$/.test(r.nummer||'') || !!r.akkoordDatum;
const betaald = r => { const t=String(r.afkomst||'').trim().toLowerCase();
  return t.startsWith('face')||t.startsWith('insta')||t.startsWith('goog'); };
let bOff=0, bAkk=0;
for (const r of raw25) { if (r.maand<3||r.maand>5||!betaald(r)) continue; bOff++; if (isAkk(r)) bAkk++; }
const adPerOrder25 = spendTot / bAkk;
const adPerOfferte25 = spendTot / bOff;
console.log(`Spend mrt-mei: ${eur(spendTot)} voor ${bOff} betaalde offertes en ${bAkk} orders`);
console.log(`-> ${eur(adPerOfferte25)} per offerte, ${eur(adPerOrder25)} per order`);
const montageOverhead = overigeKosten25 - adPerOrder25;
console.log(`\n${eur(overigeKosten25)} overige kosten min ${eur(adPerOrder25)} advertenties = ${eur(montageOverhead)} montage + overhead per order.`);
console.log(`Dat getal nemen we mee naar 2026: die kosten hangen niet af van waar de lead vandaan komt.\n`);

console.log('='.repeat(72));
console.log('STAP 5 — 2026 doorrekenen (jan t/m apr, volledig uitgerijpt)');
console.log('='.repeat(72));
const b26 = blok(T26, [1,2,3,4]);
const marge26Ex = (b26.omzet - b26.inkoop) / BTW;
const margePerOrder26 = marge26Ex / b26.akk;
console.log(`${b26.off.toLocaleString('nl-NL')} offertes, ${b26.akk} orders`);
console.log(`productmarge ${eur(b26.omzet-b26.inkoop)} incl = ${eur(marge26Ex)} ex btw = ${eur(margePerOrder26)} per order`);
const ruimte = margePerOrder26 - montageOverhead;
console.log(`\n${eur(margePerOrder26)} productmarge min ${eur(montageOverhead)} montage+overhead = ${eur(ruimte)} over per order.`);
console.log(`Dat is de ruimte voor advertenties EN winst samen.\n`);
console.log(`>>> BREAK-EVEN: ${eur(ruimte)} advertentiekosten per order.`);
console.log(`>>> Ofwel ${eur(ruimte*b26.akk/b26.off)} per uitgestuurde offerte (${b26.off.toLocaleString('nl-NL')} offertes).`);
console.log(`>>> Ofwel ${eur(ruimte*b26.akk)} totale spend over jan t/m apr, dus ${eur(ruimte*b26.akk/4)} per maand.`);
console.log(`\nTer vergelijking: in 2025 gaf je ${eur(adPerOfferte25)} per offerte uit.\n`);

console.log('='.repeat(72));
console.log('STAP 6 — Wat het wordt bij verschillende uitgaven (jan t/m apr 2026)');
console.log('='.repeat(72));
console.log('per offerte | totale spend | per order | winst per order | totale winst | oordeel');
for (const kpo of [35, 40, 45, 50, 52, 55, 60, 70]) {
  const spend = kpo * b26.off;
  const perOrder = spend / b26.akk;
  const winstOrder = ruimte - perOrder;
  const oordeel = winstOrder > 100 ? 'gezond' : winstOrder > 0 ? 'krap' : 'VERLIES';
  console.log(`${('€'+kpo).padStart(11)} | ${eur(spend).padStart(12)} | ${eur(perOrder).padStart(9)} | ${eur(winstOrder).padStart(15)} | ${eur(winstOrder*b26.akk).padStart(12)} | ${oordeel}`);
}
console.log(`\nZoek de regel die past bij wat je echt hebt uitgegeven. Dat is je antwoord.`);
console.log(`Weet je het maandbedrag? Deel door ${Math.round(b26.off/4).toLocaleString('nl-NL')} offertes per maand voor de kosten per offerte.`);

console.log('\n' + '='.repeat(72));
console.log('GEVOELIGHEID — wat als de aannames anders liggen');
console.log('='.repeat(72));
console.log(`Met "winst met bonus" (${f1(w25.metBonus/w25.omzetEx*100)}%) i.p.v. netto:`);
const winstBonus = w25.metBonus / j25.akk;
const mo2 = (margePerOrder25 - winstBonus) - adPerOrder25;
console.log(`  montage+overhead wordt ${eur(mo2)} -> break-even ${eur(margePerOrder26 - mo2)} per order`);
console.log(`Als montage+overhead in 2026 10% hoger ligt (loon, brandstof):`);
console.log(`  break-even zakt naar ${eur(margePerOrder26 - montageOverhead*1.1)} per order`);
console.log(`\nDe bandbreedte van het break-evenpunt is dus ruwweg ${eur(margePerOrder26 - mo2)} tot ${eur(margePerOrder26 - montageOverhead*1.1)} per order.`);

console.log('\n' + '='.repeat(72));
console.log('WAAROM HET KRAP IS GEWORDEN — het is niet de advertentieprijs');
console.log('='.repeat(72));
const b25 = blok(T25, [1,2,3,4]);
const conv25 = b25.akk/b25.off, conv26 = b26.akk/b26.off;
console.log(`Stel dat je in 2026 exact hetzelfde per offerte betaalde als in 2025 (${eur(adPerOfferte25)}).`);
console.log(`  2025: ${eur(adPerOfferte25)} per offerte / ${f1(conv25*100)}% conversie = ${eur(adPerOfferte25/conv25)} advertentiekosten per order`);
console.log(`  2026: ${eur(adPerOfferte25)} per offerte / ${f1(conv26*100)}% conversie = ${eur(adPerOfferte25/conv26)} advertentiekosten per order`);
console.log(`\nZelfde prijs per lead, maar ${eur(adPerOfferte25/conv26 - adPerOfferte25/conv25)} duurder per order. Puur doordat er minder sluit.`);
console.log(`Dat verschil is bijna je hele winstmarge van ${eur(winstPerOrder25)} per order.\n`);

const ordersBijHerstel = Math.round(b26.off * conv25);
const spendGelijk = adPerOfferte25 * b26.off;
const winstNu = (ruimte - spendGelijk/b26.akk) * b26.akk;
const winstHerstel = (ruimte - spendGelijk/ordersBijHerstel) * ordersBijHerstel;
console.log(`WAT CONVERSIEHERSTEL WAARD IS (bij ongewijzigd advertentiebudget van ${eur(spendGelijk)}):`);
console.log(`  nu, ${f1(conv26*100)}% conversie   : ${b26.akk} orders -> ${eur(winstNu)} winst over jan t/m apr`);
console.log(`  bij ${f1(conv25*100)}% zoals in 2025: ${ordersBijHerstel} orders -> ${eur(winstHerstel)} winst`);
console.log(`  verschil: ${eur(winstHerstel-winstNu)} over vier maanden, zonder een euro extra advertentiebudget.`);
