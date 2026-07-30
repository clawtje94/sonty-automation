#!/usr/bin/env node
// ADVERTENTIERENDEMENT — adverteren we positief of negatief?
//
// Combineert drie bronnen:
//   1. Advertentiekosten uit de tab "conversie %" (ALLEEN maart t/m mei 2025 gevuld)
//   2. Orders en omzet uit het offerteregister
//   3. De nettomarge van het bedrijf uit de tab "winst verlies" (8,05% over 2025)
//
// Waarom die derde bron nodig is: de productmarge van 45% uit het offerteregister is
// GEEN winst. Daar moeten montage-uren, inmeten, garantie en overhead nog vanaf. De
// tab "winst verlies" geeft wat er echt onderaan overblijft, en dat is het enige
// getal waarmee je kunt zeggen of een order geld oplevert of kost.
//
// LET OP: de nettomarge bevat AL de advertentiekosten. Je mag die er dus niet nog
// eens vanaf trekken; je kunt alleen kijken hoeveel een kanaal AFWIJKT van het
// gemengde gemiddelde. Dat is precies wat dit script doet.
//
// Zodra de kostenkolom voor 2026 gevuld is: vul SPEND aan en dit rapport klopt weer.
const fs=require('fs');
const rows=JSON.parse(fs.readFileSync(__dirname+'/../data/conversie-2025-raw.json','utf8')).rows;
const isAkk=r=>r.inkoop > 0 || r.akkoordBedrag>0||/^\d{3,6}$/.test(r.nummer||'')||!!r.akkoordDatum;
const KAN=r=>{const t=String(r.afkomst||'').trim().toLowerCase();
 if(t.startsWith('face')||t.startsWith('insta'))return'Meta';if(t.startsWith('goog'))return'Google';return null;};
const SPEND={3:{Meta:19800,Google:6300},4:{Meta:22000,Google:10300},5:{Meta:23700,Google:17100}};
const eur=n=>'€'+Math.round(n).toLocaleString('nl-NL');
// orders per kanaal in mrt-mei
const tot={Meta:{off:0,akk:0,omzet:0},Google:{off:0,akk:0,omzet:0}};
for(const r of rows){const k=KAN(r); if(!k||r.maand<3||r.maand>5)continue;
 tot[k].off++; if(isAkk(r)){tot[k].akk++;tot[k].omzet+=r.akkoordBedrag||r.bedrag;}}
const spendMeta=SPEND[3].Meta+SPEND[4].Meta+SPEND[5].Meta;
const spendGoog=SPEND[3].Google+SPEND[4].Google+SPEND[5].Google;
console.log('MAART T/M MEI 2025 (de enige maanden met echte kosten)\n');
console.log(`Meta  : ${tot.Meta.off} offertes, ${tot.Meta.akk} orders, spend ${eur(spendMeta)}  -> ${eur(spendMeta/tot.Meta.akk)} advertentiekosten per order`);
console.log(`Google: ${tot.Google.off} offertes, ${tot.Google.akk} orders, spend ${eur(spendGoog)}  -> ${eur(spendGoog/tot.Google.akk)} per order`);
const blend=(spendMeta+spendGoog)/(tot.Meta.akk+tot.Google.akk);
console.log(`Gemengd: ${eur(blend)} advertentiekosten per order\n`);

// Uit de tab "winst verlies": netto bedrijfsmarge
const NETTO_MARGE_2025=0.0805, OMZET_EX_2025=3442740;
const alle={akk:0,omzet:0};
for(const r of rows){if(isAkk(r)){alle.akk++;alle.omzet+=r.akkoordBedrag||r.bedrag;}}
const gemOrderEx=alle.omzet/alle.akk/1.21;
console.log('KRUISCHECK MET JE EIGEN TAB "winst verlies"');
console.log(`  mijn akkoordomzet 2025: ${eur(alle.omzet)} incl btw = ${eur(alle.omzet/1.21)} ex btw`);
console.log(`  jouw tab zegt        : ${eur(OMZET_EX_2025)} ex btw   -> verschil ${((alle.omzet/1.21)/OMZET_EX_2025*100-100).toFixed(1)}%\n`);
const nettoPerOrder=gemOrderEx*NETTO_MARGE_2025;
console.log(`Gemiddelde order: ${eur(gemOrderEx)} ex btw. Nettomarge bedrijf 2025: ${(NETTO_MARGE_2025*100).toFixed(2)}%`);
console.log(`-> netto winst per order (gemengd): ${eur(nettoPerOrder)}\n`);
console.log('Die nettomarge bevat AL de advertentiekosten. Het verschil per kanaal is dus:');
console.log(`  Meta-order  : ${eur(nettoPerOrder)} - (${eur(spendMeta/tot.Meta.akk)} - ${eur(blend)}) = ${eur(nettoPerOrder-(spendMeta/tot.Meta.akk-blend))} netto winst`);
console.log(`  Google-order: ${eur(nettoPerOrder)} + (${eur(blend)} - ${eur(spendGoog/tot.Google.akk)}) = ${eur(nettoPerOrder+(blend-spendGoog/tot.Google.akk))} netto winst`);
console.log(`\nBreak-even advertentiekosten per order: ${eur(blend+nettoPerOrder)} -- daarboven kost een order je geld.`);

// ---- SCENARIO 2026: wat als de kosten per offerte gelijk bleven aan 2025? ----
const r26=JSON.parse(fs.readFileSync(__dirname+'/../data/conversie-2026-raw.json','utf8')).rows;
const t26={Meta:{off:0,akk:0},Google:{off:0,akk:0}};
for(const r of r26){const k=KAN(r);if(!k||r.maand<1||r.maand>4)continue;
 t26[k].off++;if(isAkk(r))t26[k].akk++;}
const kpoMeta=spendMeta/tot.Meta.off, kpoGoog=spendGoog/tot.Google.off;
console.log('\n\n=== SCHATTING 2026 (jan t/m apr), ALS de kosten per offerte gelijk bleven ===');
console.log('LET OP: dit is een AANNAME, geen meting. De echte spend voor 2026 heb ik niet.\n');
for(const [k,kpo] of [['Meta',kpoMeta],['Google',kpoGoog]]){
 const d=t26[k], geschat=d.off*kpo, perOrder=geschat/d.akk;
 const netto=nettoPerOrder-(perOrder-blend);
 console.log(`${k.padEnd(7)}: ${d.off} offertes x ${eur(kpo)}/offerte = ${eur(geschat)} geschatte spend voor ${d.akk} orders`);
 console.log(`         -> ${eur(perOrder)} per order (was ${eur(k==='Meta'?spendMeta/tot.Meta.akk:spendGoog/tot.Google.akk)}), netto winst ${eur(netto)} per order ${netto<0?'  <-- VERLIESGEVEND':''}`);
}
const totGeschat=t26.Meta.off*kpoMeta+t26.Google.off*kpoGoog;
const totOrders=t26.Meta.akk+t26.Google.akk;
console.log(`\nSamen: ${eur(totGeschat)} geschatte spend, ${totOrders} orders = ${eur(totGeschat/totOrders)} per order.`);
console.log(`Break-even ligt op ${eur(blend+nettoPerOrder)}. Je zit daar dus ${totGeschat/totOrders>blend+nettoPerOrder?'BOVEN':'onder'}.`);
