#!/usr/bin/env node
// Vergelijkt 2025 en 2026 op gelijke voet. Cruciaal: recente maanden zijn nog niet
// uitgerijpt -- de mediane doorlooptijd offerte->akkoord is ~24 dagen en 90% valt
// binnen ~51 dagen. Een maand die nog geen ~60 dagen achter ons ligt telt dus te laag.
// Peildatum 27-07-2026: jan t/m apr 2026 zijn rijp, mei bijna, juni/juli nog niet.
const fs = require('fs');
const MND = ['','jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer||'') || !!r.akkoordDatum;
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');
const pc = (a,b) => b ? a/b*100 : 0;
const f1 = n => n.toFixed(1).replace('.',',');

const A = a => { const t=String(a||'').trim().toLowerCase();
  if (t.startsWith('face')||t.startsWith('insta')) return 'Meta';
  if (t.startsWith('goog')) return 'Google';
  if (t.includes('beken')||t.startsWith('buren')) return 'Buren/Bekenden';
  if (!t) return 'Niet ingevuld';
  return 'Anders'; };
const P = p => { const t=String(p||'').trim().toLowerCase(); if(!t) return 'Niet ingevuld';
  if (t.startsWith('rolluik')) return 'Rolluiken';
  if (t.startsWith('screen')) return 'Screens';
  if (t.startsWith('knikarm')) return 'Knikarmscherm';
  if (t.startsWith('markiez')) return 'Markiezen';
  if (t.startsWith('pergola')) return 'Pergola';
  if (t.startsWith('repara')) return 'Reparatie';
  if (t.includes('raamdeco')) return 'Raamdecoratie binnen';
  if (t.includes('zonwering buiten')) return 'Zonwering buiten';
  if (t.includes('zonwering binnen')) return 'Zonwering binnen';
  if (t.startsWith('voorraad')||t.startsWith('vooraad')) return 'Voorraadscherm';
  if (t.startsWith('uitval')) return 'Uitvalscherm';
  if (t.startsWith('hor')) return 'Horren';
  return p.trim(); };
const K = r => String(r.kanaal||'').toLowerCase().startsWith('winkel') ? 'Winkel' : 'Online';

const data = {};
for (const j of [2025, 2026]) data[j] = JSON.parse(fs.readFileSync(__dirname+`/../data/conversie-${j}-raw.json`,'utf8')).rows;

function agg(rows, keyfn) {
  const o = {};
  for (const r of rows) { const k = keyfn(r); if (k === null) continue;
    const m = (o[k] = o[k] || {off:0,akk:0,omzet:0,inkoop:0});
    m.off++; if (isAkk(r)) { m.akk++; m.omzet += r.akkoordBedrag||r.bedrag; m.inkoop += r.inkoop; } }
  return o;
}
const RIJP = [1,2,3,4];               // volledig uitgerijpt op 27-07-2026
const RIJP_PLUS = [1,2,3,4,5];        // mei is ~90% uitgerijpt

console.log('== 1. PER MAAND 2026 (met rijpheid) ==');
const m26 = agg(data[2026], r => r.maand), m25 = agg(data[2025], r => r.maand);
console.log('mnd | 2026 offertes | akkoord | conv%  | 2025 conv% | verschil | rijpheid');
const rijpheid = {1:'rijp',2:'rijp',3:'rijp',4:'rijp',5:'~90% rijp',6:'NIET RIJP (~60%)',7:'NIET RIJP (lopend)'};
for (let m=1;m<=7;m++){ const a=m26[m], b=m25[m];
  const ca=pc(a.akk,a.off), cb=pc(b.akk,b.off);
  console.log(`${MND[m]} | ${String(a.off).padStart(13)} | ${String(a.akk).padStart(7)} | ${f1(ca).padStart(5)}% | ${f1(cb).padStart(9)}% | ${(ca-cb>=0?'+':'')}${f1(ca-cb).padStart(5)}pp | ${rijpheid[m]}`); }

function blok(rows, maanden) {
  const s = {off:0,akk:0,omzet:0,inkoop:0};
  for (const r of rows) if (maanden.includes(r.maand)) { s.off++;
    if (isAkk(r)) { s.akk++; s.omzet += r.akkoordBedrag||r.bedrag; s.inkoop += r.inkoop; } }
  return s;
}
console.log('\n== 2. GELIJKE VOET: jan t/m apr (beide jaren volledig uitgerijpt) ==');
for (const [label, maanden] of [['jan-apr', RIJP], ['jan-mei', RIJP_PLUS]]) {
  const a = blok(data[2025], maanden), b = blok(data[2026], maanden);
  console.log(`\n${label}:`);
  console.log(`  2025: ${String(a.off).padStart(5)} offertes | ${String(a.akk).padStart(4)} akkoord | ${f1(pc(a.akk,a.off)).padStart(5)}% | ${eur(a.omzet).padStart(12)} omzet | ${eur(a.omzet-a.inkoop)} marge`);
  console.log(`  2026: ${String(b.off).padStart(5)} offertes | ${String(b.akk).padStart(4)} akkoord | ${f1(pc(b.akk,b.off)).padStart(5)}% | ${eur(b.omzet).padStart(12)} omzet | ${eur(b.omzet-b.inkoop)} marge`);
  console.log(`  delta: offertes ${(b.off/a.off*100-100>=0?'+':'')}${(b.off/a.off*100-100).toFixed(0)}% | akkoorden ${(b.akk/a.akk*100-100>=0?'+':'')}${(b.akk/a.akk*100-100).toFixed(0)}% | conversie ${f1(pc(b.akk,b.off)-pc(a.akk,a.off))}pp | omzet ${(b.omzet/a.omzet*100-100>=0?'+':'')}${(b.omzet/a.omzet*100-100).toFixed(0)}%`);
}

console.log('\n== 3. PER BRON, jan t/m apr ==');
for (const j of [2025,2026]) {
  const g = agg(data[j].filter(r=>RIJP.includes(r.maand)), r=>A(r.afkomst));
  console.log(`${j}:`);
  for (const [k,d] of Object.entries(g).sort((x,y)=>y[1].off-x[1].off))
    console.log(`  ${k.padEnd(16)} ${String(d.off).padStart(5)} off | ${String(d.akk).padStart(4)} akk | ${f1(pc(d.akk,d.off)).padStart(5)}% | ${eur(d.omzet)}`);
}

console.log('\n== 4. PER PRODUCTGROEP, jan t/m apr ==');
const p25 = agg(data[2025].filter(r=>RIJP.includes(r.maand)), r=>P(r.prod));
const p26 = agg(data[2026].filter(r=>RIJP.includes(r.maand)), r=>P(r.prod));
const alleP = [...new Set([...Object.keys(p25),...Object.keys(p26)])]
  .sort((a,b)=>(p26[b]?.off||0)-(p26[a]?.off||0));
console.log('productgroep         | 2025 off/akk/conv        | 2026 off/akk/conv        | omzet 2026');
for (const k of alleP) { const a=p25[k]||{off:0,akk:0,omzet:0}, b=p26[k]||{off:0,akk:0,omzet:0};
  if (a.off < 20 && b.off < 20) continue;
  console.log(`${k.padEnd(20)} | ${String(a.off).padStart(5)}/${String(a.akk).padStart(3)}/${f1(pc(a.akk,a.off)).padStart(5)}%      | ${String(b.off).padStart(5)}/${String(b.akk).padStart(3)}/${f1(pc(b.akk,b.off)).padStart(5)}%      | ${eur(b.omzet)}`); }

console.log('\n== 5. PERGOLA EN VOORRAADSCHERM: omzet per jaar ==');
for (const j of [2025,2026]) {
  const g = agg(data[j], r=>P(r.prod));
  const per = g['Pergola']||{off:0,akk:0,omzet:0,inkoop:0}, vs = g['Voorraadscherm']||{off:0,akk:0,omzet:0,inkoop:0};
  console.log(`${j} (${j===2026?'jan t/m juli, deels onrijp':'heel jaar'}):`);
  for (const [n,d] of [['Pergola',per],['Voorraadscherm',vs]])
    console.log(`  ${n.padEnd(15)} ${String(d.off).padStart(5)} offertes | ${String(d.akk).padStart(3)} akkoord | ${f1(pc(d.akk,d.off)).padStart(5)}% | omzet ${eur(d.omzet).padStart(10)} | marge ${eur(d.omzet-d.inkoop)} | gem. order ${d.akk?eur(d.omzet/d.akk):'-'}`);
}

console.log('\n== 6. KANAAL (winkel vs online), jan t/m apr ==');
for (const j of [2025,2026]) {
  const g = agg(data[j].filter(r=>RIJP.includes(r.maand)), K);
  console.log(`${j}: ` + Object.entries(g).map(([k,d])=>`${k} ${d.off} off / ${d.akk} akk / ${f1(pc(d.akk,d.off))}% / ${eur(d.omzet)}`).join('  |  '));
}
