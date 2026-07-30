#!/usr/bin/env node
// Analyse van data/conversie-2025-raw.json: conversie per maand x afkomst x productgroep.
const fs = require('fs');
const { rows } = JSON.parse(fs.readFileSync(__dirname+'/../data/conversie-2025-raw.json','utf8'));
const MND = ['','jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

// AKKOORD-DEFINITIE. De checkbox-kolom "Akkoord" is structureel slecht bijgehouden
// (mei 1, juni 0, aug 2 akkoorden op >1200 offertes = onmogelijk). Het akkoord-BLOK
// (Gripp-opdrachtnummer, akkoorddatum, akkoordbedrag) is wel consistent gevuld en
// onderling in overeenstemming (1059 / 1081 / 1088 rijen). Dat is dus de maatstaf.
const isAkkoord = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer||'') || !!r.akkoordDatum;

// Afkomst normaliseren (trailing spaces, spelling)
const normAfkomst = a => {
  const t = a.trim().toLowerCase();
  if (!t || t === '(leeg)') return '(niet ingevuld)';
  if (t.startsWith('face')) return 'Facebook';
  if (t.startsWith('goog')) return 'Google';
  if (t.startsWith('insta')) return 'Instagram';
  if (t.includes('beken')) return 'Bekenden';
  if (t.includes('mond')) return 'Mond-tot-mond';
  if (t.includes('bestaan') || t.includes('klant')) return 'Bestaande klant';
  return a.trim();
};
const normProd = p => {
  const t = p.trim().toLowerCase();
  if (!t || t === '(leeg)') return '(niet ingevuld)';
  if (t.startsWith('rolluik')) return 'Rolluiken';
  if (t.startsWith('screen')) return 'Screens';
  if (t.startsWith('knikarm')) return 'Knikarmscherm';
  if (t.startsWith('markiez')) return 'Markiezen';
  if (t.startsWith('pergola')) return 'Pergola';
  if (t.startsWith('repara')) return 'Reparatie';
  if (t.includes('raamdeco')) return 'Raamdecoratie binnen';
  if (t.includes('zonwering binnen')) return 'Zonwering binnen';
  if (t.includes('zonwering buiten')) return 'Zonwering buiten';
  if (t.startsWith('voorraad') || t.startsWith('vooraad')) return 'Voorraadscherm'; // typo VOORAADSCHERM
  if (t.startsWith('uitval')) return 'Uitvalscherm';
  if (t.startsWith('horren') || t.startsWith('hor')) return 'Horren';
  return p.trim();
};

function agg(keyFn) {
  const out = {};
  for (const r of rows) {
    const k = keyFn(r);
    const m = (out[k] = out[k] || { off:0, akk:0, omzet:0, offBedrag:0, inkoop:0 });
    m.off++; m.offBedrag += r.bedrag;
    if (isAkkoord(r)) { m.akk++; m.omzet += r.akkoordBedrag || r.bedrag; m.inkoop += r.inkoop; }
  }
  return out;
}
const pct = (a,b) => b ? (a/b*100) : 0;

// ---------- 1. Totaal per maand ----------
console.log('== 1. CONVERSIE PER MAAND (2025) ==');
console.log('mnd | offertes | akkoord | conv%  | omzet akkoord | gem. orderwaarde');
const perM = agg(r => r.maand);
let tO=0,tA=0,tR=0;
for (let m=1;m<=12;m++){ const d=perM[m]; if(!d) continue; tO+=d.off; tA+=d.akk; tR+=d.omzet;
  console.log(`${MND[m]} | ${String(d.off).padStart(8)} | ${String(d.akk).padStart(7)} | ${pct(d.akk,d.off).toFixed(1).padStart(5)}% | €${Math.round(d.omzet).toLocaleString('nl-NL').padStart(11)} | €${Math.round(d.omzet/(d.akk||1)).toLocaleString('nl-NL')}`);}
console.log(`TOT | ${String(tO).padStart(8)} | ${String(tA).padStart(7)} | ${pct(tA,tO).toFixed(1).padStart(5)}% | €${Math.round(tR).toLocaleString('nl-NL').padStart(11)} | €${Math.round(tR/(tA||1)).toLocaleString('nl-NL')}`);

// ---------- 2. Per afkomst (jaar) ----------
console.log('\n== 2. PER AFKOMST OFFERTE (heel 2025) ==');
const perA = agg(r => normAfkomst(r.afkomst));
const afkomsten = Object.entries(perA).sort((a,b)=>b[1].off-a[1].off);
console.log('afkomst              | offertes | akkoord | conv%  | omzet        | gem.order | % v/d offertes');
for (const [k,d] of afkomsten)
  console.log(`${k.padEnd(20)} | ${String(d.off).padStart(8)} | ${String(d.akk).padStart(7)} | ${pct(d.akk,d.off).toFixed(1).padStart(5)}% | €${Math.round(d.omzet).toLocaleString('nl-NL').padStart(10)} | €${Math.round(d.omzet/(d.akk||1)).toLocaleString('nl-NL').padStart(7)} | ${pct(d.off,tO).toFixed(1)}%`);

// ---------- 3. Matrix maand x afkomst ----------
const topA = afkomsten.filter(([,d])=>d.off>=100).map(([k])=>k);
console.log('\n== 3. CONVERSIE% PER MAAND x AFKOMST (offertes tussen haakjes) ==');
console.log('mnd  | '+topA.map(a=>a.slice(0,13).padEnd(14)).join('| '));
const perMA = agg(r => r.maand+'||'+normAfkomst(r.afkomst));
for (let m=1;m<=12;m++){
  const cells = topA.map(a=>{ const d=perMA[m+'||'+a]; return d ? `${pct(d.akk,d.off).toFixed(0)}% (${d.off})`.padEnd(14) : '-'.padEnd(14); });
  console.log(`${MND[m].padEnd(4)} | `+cells.join('| '));
}
console.log('JAAR | '+topA.map(a=>{const d=perA[a];return `${pct(d.akk,d.off).toFixed(1)}% (${d.off})`.padEnd(14);}).join('| '));

// ---------- 4. Per productgroep ----------
console.log('\n== 4. PER PRODUCTGROEP (heel 2025) ==');
const perP = agg(r => normProd(r.prod));
const prods = Object.entries(perP).sort((a,b)=>b[1].off-a[1].off);
console.log('productgroep         | offertes | akkoord | conv%  | omzet        | gem.order | marge%');
for (const [k,d] of prods) {
  const marge = d.omzet ? pct(d.omzet-d.inkoop, d.omzet) : 0;
  console.log(`${k.padEnd(20)} | ${String(d.off).padStart(8)} | ${String(d.akk).padStart(7)} | ${pct(d.akk,d.off).toFixed(1).padStart(5)}% | €${Math.round(d.omzet).toLocaleString('nl-NL').padStart(10)} | €${Math.round(d.omzet/(d.akk||1)).toLocaleString('nl-NL').padStart(7)} | ${d.inkoop?marge.toFixed(0)+'%':'n.b.'}`);
}

// ---------- 5. Matrix maand x productgroep ----------
const topP = prods.filter(([,d])=>d.off>=150).map(([k])=>k);
console.log('\n== 5. CONVERSIE% PER MAAND x PRODUCTGROEP (offertes tussen haakjes) ==');
console.log('mnd  | '+topP.map(a=>a.slice(0,13).padEnd(14)).join('| '));
const perMP = agg(r => r.maand+'||'+normProd(r.prod));
for (let m=1;m<=12;m++){
  const cells = topP.map(a=>{ const d=perMP[m+'||'+a]; return d ? `${pct(d.akk,d.off).toFixed(0)}% (${d.off})`.padEnd(14) : '-'.padEnd(14); });
  console.log(`${MND[m].padEnd(4)} | `+cells.join('| '));
}
console.log('JAAR | '+topP.map(a=>{const d=perP[a];return `${pct(d.akk,d.off).toFixed(1)}% (${d.off})`.padEnd(14);}).join('| '));

// ---------- 6. Kanaal ----------
console.log('\n== 6. PER KANAAL (Online / Winkel) ==');
const perK = agg(r => r.kanaal);
for (const [k,d] of Object.entries(perK).sort((a,b)=>b[1].off-a[1].off))
  console.log(`${k.padEnd(20)} | ${String(d.off).padStart(8)} | ${String(d.akk).padStart(7)} | ${pct(d.akk,d.off).toFixed(1).padStart(5)}% | €${Math.round(d.omzet).toLocaleString('nl-NL')}`);

// ---------- 7. Datakwaliteit ----------
console.log('\n== 7. DATAKWALITEIT ==');
console.log(`akkoorden volgens akkoord-blok (gebruikt): ${rows.filter(isAkkoord).length}`);
console.log(`akkoorden volgens checkbox-kolom        : ${rows.filter(r=>r.akkoord).length}  <-- NIET gebruikt, slecht bijgehouden`);
console.log(`  waarvan checkbox TRUE maar geen akkoord-blok: ${rows.filter(r=>r.akkoord && !isAkkoord(r)).length}`);
console.log(`akkoord zonder akkoordbedrag: ${rows.filter(r=>isAkkoord(r) && !r.akkoordBedrag).length} (omzet dan = offertebedrag)`);
console.log(`afkomst niet ingevuld: ${rows.filter(r=>normAfkomst(r.afkomst)==='(niet ingevuld)').length}`);
console.log(`productgroep niet ingevuld: ${rows.filter(r=>normProd(r.prod)==='(niet ingevuld)').length}`);
console.log(`inkoop ontbreekt bij akkoord: ${rows.filter(r=>r.akkoord && !r.inkoop).length} van ${tA} akkoorden`);

// ---------- 8. META-CORRECTIE ----------
// De labeling is medio 2025 omgezet: t/m aug werd Meta-traffic "Facebook" genoemd,
// vanaf sep "Instagram" (Facebook zakt van 558 naar 4/maand, Instagram springt van 63
// naar 345). Voor jaarvergelijking moeten ze samen als één kanaal Meta gelezen worden.
console.log('\n== 8. META (Facebook+Instagram samen) vs GOOGLE per maand ==');
const grp = r => { const a=normAfkomst(r.afkomst); return (a==='Facebook'||a==='Instagram')?'Meta':a; };
const perMG = agg(r => r.maand+'||'+grp(r));
const perG = agg(grp);
console.log('mnd  | Meta offertes conv%   | Google offertes conv%  | verschil');
for (let m=1;m<=12;m++){
  const me=perMG[m+'||Meta'], go=perMG[m+'||Google'];
  if(!me&&!go) continue;
  const mp=me?pct(me.akk,me.off):0, gp=go?pct(go.akk,go.off):0;
  console.log(`${MND[m].padEnd(4)} | ${String(me?me.off:0).padStart(8)} ${mp.toFixed(1).padStart(5)}%        | ${String(go?go.off:0).padStart(8)} ${gp.toFixed(1).padStart(5)}%       | ${(gp-mp>=0?'+':'')}${(gp-mp).toFixed(1)}pp Google`);
}
for (const k of ['Meta','Google','Bekenden','Buren','Anders']) { const d=perG[k]; if(!d) continue;
  console.log(`JAAR ${k.padEnd(9)}: ${String(d.off).padStart(5)} offertes | ${String(d.akk).padStart(4)} akkoord | ${pct(d.akk,d.off).toFixed(1)}% | €${Math.round(d.omzet).toLocaleString('nl-NL')} omzet | €${Math.round(d.omzet/(d.akk||1)).toLocaleString('nl-NL')} gem.`);}

// ---------- 9. DOORLOOPTIJD offerte -> akkoord ----------
function pd(t){ const s=String(t||'').trim();
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return new Date(+m[1],+m[2]-1,+m[3]);
  m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/); if(m){let y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1]);}
  return null; }
console.log('\n== 9. DOORLOOPTIJD OFFERTE -> AKKOORD (dagen) ==');
const lags=[]; const lagPerM={};
for (const r of rows){ if(!isAkkoord(r)) continue; const a=pd(r.akkoordDatum), o=pd(r.celDatum); if(!a||!o) continue;
  const d=Math.round((a-o)/864e5); if(d<0||d>365) continue; lags.push(d); (lagPerM[r.maand]=lagPerM[r.maand]||[]).push(d); }
lags.sort((a,b)=>a-b);
const q=p=>lags[Math.floor(lags.length*p)];
console.log(`n=${lags.length} akkoorden met beide datums | mediaan ${q(.5)} dgn | 25% binnen ${q(.25)} dgn | 75% binnen ${q(.75)} dgn | 90% binnen ${q(.9)} dgn`);
console.log('mnd  | mediaan dagen tot akkoord (n)');
for(let m=1;m<=12;m++){const l=lagPerM[m];if(!l)continue;l.sort((a,b)=>a-b);console.log(`${MND[m].padEnd(4)} | ${String(l[Math.floor(l.length/2)]).padStart(3)} dgn (${l.length})`);}

// ---------- 10. INVESTERINGSTABEL ----------
console.log('\n== 10. VRAAG & CAPACITEIT PER MAAND ==');
console.log('mnd  | offertes | index vs gem | akkoorden | omzet        | index omzet');
const gemOff=tO/12, gemOmz=tR/12;
for(let m=1;m<=12;m++){const d=perM[m];if(!d)continue;
  console.log(`${MND[m].padEnd(4)} | ${String(d.off).padStart(8)} | ${(d.off/gemOff*100).toFixed(0).padStart(4)}         | ${String(d.akk).padStart(9)} | €${Math.round(d.omzet).toLocaleString('nl-NL').padStart(10)} | ${(d.omzet/gemOmz*100).toFixed(0)}`);}
