#!/usr/bin/env node
// Investeringsanalyse: koppelt de advertentiekosten uit de tab "conversie %" (alleen
// maart t/m mei 2025 ingevuld) aan de akkoorden en marges uit het offerte-register.
// Marge = (akkoordbedrag - inkoop) uit de sheet zelf, dus PRODUCTmarge: montage-uren
// en overhead zitten er nog NIET af.
const fs = require('fs');
const { rows } = JSON.parse(fs.readFileSync(__dirname+'/../data/conversie-2025-raw.json','utf8'));
const isAkkoord = r => r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer||'') || !!r.akkoordDatum;
const grp = r => { const t=String(r.afkomst||'').trim().toLowerCase();
  if (t.startsWith('face')||t.startsWith('insta')) return 'Meta';
  if (t.startsWith('goog')) return 'Google';
  if (t.includes('beken')||t.startsWith('buren')) return 'Buren/Bekenden';
  return 'Anders'; };
// Advertentiekosten zoals Daimy ze zelf in de tab "conversie %" heeft gezet.
const SPEND = { 3:{Meta:19800,Google:6300}, 4:{Meta:22000,Google:10300}, 5:{Meta:23700,Google:17100} };
const MND=['','jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

const cel = {};
for (const r of rows) {
  const k = r.maand+'|'+grp(r);
  const m = (cel[k] = cel[k] || {off:0,akk:0,omzet:0,inkoop:0});
  m.off++;
  if (isAkkoord(r)) { m.akk++; m.omzet += r.akkoordBedrag || r.bedrag; m.inkoop += r.inkoop; }
}

console.log('== KOSTEN PER AKKOORD & RENDEMENT (maart-mei 2025, de maanden met kostendata) ==');
console.log('mnd Meta/Google | offertes | akkoord | conv%  | adspend  | kosten/akkoord | kosten/offerte | productmarge | marge na ads | ROAS-marge');
for (const m of [3,4,5]) for (const k of ['Meta','Google']) {
  const d = cel[m+'|'+k], s = SPEND[m][k];
  const marge = d.omzet - d.inkoop;
  console.log(`${MND[m]} ${k.padEnd(8)} | ${String(d.off).padStart(8)} | ${String(d.akk).padStart(7)} | ${(d.akk/d.off*100).toFixed(1).padStart(5)}% | €${String(s).padStart(7)} | €${String(Math.round(s/d.akk)).padStart(13)} | €${String(Math.round(s/d.off)).padStart(13)} | €${String(Math.round(marge)).padStart(11)} | €${String(Math.round(marge-s)).padStart(11)} | ${(marge/s).toFixed(2)}x`);
}

console.log('\n== TREND: Meta loopt weg, Google houdt stand ==');
for (const k of ['Meta','Google']) {
  console.log(`${k}:`);
  for (const m of [3,4,5]) { const d=cel[m+'|'+k], s=SPEND[m][k];
    console.log(`  ${MND[m]}: €${s.toLocaleString('nl-NL')} spend -> ${d.akk} akkoord (€${Math.round(s/d.akk)} p/akkoord), marge €${Math.round(d.omzet-d.inkoop).toLocaleString('nl-NL')}, rendement ${((d.omzet-d.inkoop)/s).toFixed(2)}x`);}
}

console.log('\n== KANALEN ZONDER ADVERTENTIEKOSTEN (heel 2025) ==');
const jaar = {};
for (const r of rows) { const k=grp(r); const m=(jaar[k]=jaar[k]||{off:0,akk:0,omzet:0,inkoop:0});
  m.off++; if(isAkkoord(r)){m.akk++;m.omzet+=r.akkoordBedrag||r.bedrag;m.inkoop+=r.inkoop;} }
// Winkel apart: dat is het kanaal, niet de afkomst
const winkel = {off:0,akk:0,omzet:0,inkoop:0};
for (const r of rows) if (String(r.kanaal).toLowerCase().startsWith('winkel')) {
  winkel.off++; if(isAkkoord(r)){winkel.akk++;winkel.omzet+=r.akkoordBedrag||r.bedrag;winkel.inkoop+=r.inkoop;} }
console.log('kanaal            | offertes | akkoord | conv%  | omzet        | productmarge | % v/d offertes | % v/d omzet');
const totOmz = Object.values(jaar).reduce((a,d)=>a+d.omzet,0);
const totOff = rows.length;
for (const [k,d] of Object.entries(jaar).sort((a,b)=>b[1].omzet-a[1].omzet))
  console.log(`${k.padEnd(17)} | ${String(d.off).padStart(8)} | ${String(d.akk).padStart(7)} | ${(d.akk/d.off*100).toFixed(1).padStart(5)}% | €${Math.round(d.omzet).toLocaleString('nl-NL').padStart(10)} | €${Math.round(d.omzet-d.inkoop).toLocaleString('nl-NL').padStart(11)} | ${(d.off/totOff*100).toFixed(1).padStart(5)}%         | ${(d.omzet/totOmz*100).toFixed(1)}%`);
console.log(`${'Winkel (kanaal)'.padEnd(17)} | ${String(winkel.off).padStart(8)} | ${String(winkel.akk).padStart(7)} | ${(winkel.akk/winkel.off*100).toFixed(1).padStart(5)}% | €${Math.round(winkel.omzet).toLocaleString('nl-NL').padStart(10)} | €${Math.round(winkel.omzet-winkel.inkoop).toLocaleString('nl-NL').padStart(11)} | ${(winkel.off/totOff*100).toFixed(1).padStart(5)}%         | ${(winkel.omzet/totOmz*100).toFixed(1)}%`);

console.log('\n== WAT LEVERT 1 EXTRA PROCENTPUNT CONVERSIE OP? ==');
const gemMarge = Object.values(jaar).reduce((a,d)=>a+d.omzet-d.inkoop,0) / Object.values(jaar).reduce((a,d)=>a+d.akk,0);
console.log(`gemiddelde productmarge per akkoord: €${Math.round(gemMarge).toLocaleString('nl-NL')}`);
console.log(`1pp conversie over 9.198 offertes = +92 akkoorden = +€${Math.round(92*gemMarge).toLocaleString('nl-NL')} productmarge per jaar`);
const meta = jaar['Meta'];
console.log(`Meta van 6,8% naar Google-niveau 14,5% = +${Math.round(meta.off*0.145-meta.akk)} akkoorden = +€${Math.round((meta.off*0.145-meta.akk)*gemMarge).toLocaleString('nl-NL')} marge`);

// ---------- CAPACITEITSANALYSE ----------
console.log('\n== CAPACITEIT: conversie zakt juist als de vraag piekt ==');
const pm = {};
for (const r of rows) { const m=(pm[r.maand]=pm[r.maand]||{off:0,akk:0,omzet:0,inkoop:0});
  m.off++; if(isAkkoord(r)){m.akk++;m.omzet+=r.akkoordBedrag||r.bedrag;m.inkoop+=r.inkoop;} }
const xs=[],ys=[];
for(let m=1;m<=12;m++){xs.push(pm[m].off);ys.push(pm[m].akk/pm[m].off);}
const gem=a=>a.reduce((x,y)=>x+y,0)/a.length;
const mx=gem(xs),my=gem(ys);
const cov=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0);
const sx=Math.sqrt(xs.reduce((a,x)=>a+(x-mx)**2,0)), sy=Math.sqrt(ys.reduce((a,y)=>a+(y-my)**2,0));
console.log(`correlatie offertevolume <-> conversie: ${(cov/(sx*sy)).toFixed(2)} (negatief = meer aanvragen, slechtere conversie)`);

const rustig=[1,2,3,4,5], piek=[6,7,8];
const so=(ms,f)=>ms.reduce((a,m)=>a+f(pm[m]),0);
const rConv = so(rustig,d=>d.akk)/so(rustig,d=>d.off);
const pConv = so(piek,d=>d.akk)/so(piek,d=>d.off);
const gemMarge2 = (so([1,2,3,4,5,6,7,8,9,10,11,12],d=>d.omzet-d.inkoop))/(so([1,2,3,4,5,6,7,8,9,10,11,12],d=>d.akk));
const piekOff = so(piek,d=>d.off);
const gemist = Math.round(piekOff*rConv - so(piek,d=>d.akk));
console.log(`jan-mei: ${so(rustig,d=>d.off)} offertes, ${(rConv*100).toFixed(1)}% conversie`);
console.log(`jun-aug: ${piekOff} offertes, ${(pConv*100).toFixed(1)}% conversie  <-- de drukste maanden converteren het slechtst`);
console.log(`Als jun-aug op ${(rConv*100).toFixed(1)}% had gezeten: +${gemist} akkoorden = +€${Math.round(gemist*gemMarge2).toLocaleString('nl-NL')} productmarge`);
console.log(`(dat is meer dan het hele Meta-advertentiebudget van die periode)`);

// ---------- SHOWROOM-HEFBOOM ----------
console.log('\n== SHOWROOM-HEFBOOM per bron ==');
const kan = r => String(r.kanaal||'').toLowerCase().startsWith('winkel') ? 'Winkel' : 'Online';
const kx = {};
for (const r of rows) { const k=kan(r)+'|'+grp(r); const m=(kx[k]=kx[k]||{off:0,akk:0,omzet:0});
  m.off++; if(isAkkoord(r)){m.akk++;m.omzet+=r.akkoordBedrag||r.bedrag;} }
for (const g of ['Meta','Google','Buren/Bekenden','Anders']) {
  const o=kx['Online|'+g], w=kx['Winkel|'+g]; if(!o||!w) continue;
  console.log(`${g.padEnd(15)}: online ${(o.akk/o.off*100).toFixed(1)}% (${o.off} off) -> winkel ${(w.akk/w.off*100).toFixed(1)}% (${w.off} off) = ${((w.akk/w.off)/(o.akk/o.off)).toFixed(1)}x beter`);
}
const totW = ['Meta','Google','Buren/Bekenden','Anders'].reduce((a,g)=>a+(kx['Winkel|'+g]?.off||0),0);
console.log(`Showroom raakt maar ${totW} van ${rows.length} offertes (${(totW/rows.length*100).toFixed(1)}%) maar levert €${Math.round(['Meta','Google','Buren/Bekenden','Anders'].reduce((a,g)=>a+(kx['Winkel|'+g]?.omzet||0),0)).toLocaleString('nl-NL')} = ${(['Meta','Google','Buren/Bekenden','Anders'].reduce((a,g)=>a+(kx['Winkel|'+g]?.omzet||0),0)/so([1,2,3,4,5,6,7,8,9,10,11,12],d=>d.omzet)*100).toFixed(0)}% van de omzet`);
