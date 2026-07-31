#!/usr/bin/env node
// KOSTEN & OPBRENGST PER META-CAMPAGNE (Daimy 31 juli).
// Campagnenaam bevat het product; de sheet heeft per offerte bron (Meta) én productgroep.
// Per campagne per maand: spend (CSV) x Meta-offertes/akkoorden van dat product (sheet).
const fs = require('fs');
const path = require('path');
const BASIS = path.join(__dirname, '..', 'data');
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;
const isMeta = r => /^face|^insta/.test(String(r.afkomst || '').trim().toLowerCase());
const PROD = p => { const t = String(p || '').trim().toLowerCase();
  if (t.startsWith('rolluik')) return 'Rolluiken';
  if (t.startsWith('screen')) return 'Screens';
  if (t.startsWith('pergola')) return 'Pergola';
  if (t.startsWith('markiez')) return 'Markiezen';
  if (t.startsWith('knikarm') || t.includes('zonwering buiten') || t.startsWith('uitval') || t.startsWith('voorraad') || t.startsWith('vooraad')) return 'Zonwering';
  if (t.includes('raamdeco') || t.includes('gordijn') || t.includes('zonwering binnen')) return 'Gordijnen';
  return null; };
// campagne -> productgroep-sleutel (Retargeting is niet toewijsbaar aan één product)
const CAMPAGNE_PROD = n => { const t = n.toLowerCase();
  if (t.includes('rolluik')) return 'Rolluiken';
  if (t.includes('pergola')) return 'Pergola';
  if (t.includes('screen')) return 'Screens';
  if (t.includes('zonwering')) return 'Zonwering';
  if (t.includes('gordijn')) return 'Gordijnen';
  if (t.includes('markiez')) return 'Markiezen';
  return null; };

const spend = JSON.parse(fs.readFileSync(path.join(BASIS, 'campagne-spend-meta.json'), 'utf8'));
const rows = JSON.parse(fs.readFileSync(path.join(BASIS, 'conversie-2026-raw.json'), 'utf8')).rows;
const per = {}; // maand|prod -> {off, akk}
for (const r of rows) { if (!isMeta(r)) continue;
  const p = PROD(r.prod); if (!p) continue;
  const k = `2026-${String(r.maand).padStart(2, '0')}|${p}`;
  const m = (per[k] = per[k] || { off: 0, akk: 0 });
  m.off++; if (isAkk(r)) m.akk++; }

const uit = {};
for (const [maand, campagnes] of Object.entries(spend)) {
  for (const [naam, v] of Object.entries(campagnes)) {
    if (!v.spend) continue;
    const prod = CAMPAGNE_PROD(naam);
    const st = prod ? (per[`${maand}|${prod}`] || { off: 0, akk: 0 }) : null;
    (uit[maand] = uit[maand] || []).push({
      campagne: naam, spend: v.spend, kliks: v.kliks, product: prod,
      offertes: st ? st.off : null, akkoorden: st ? st.akk : null,
      perOfferte: st && st.off ? +(v.spend / st.off).toFixed(0) : null,
      perOrder: st && st.akk ? +(v.spend / st.akk).toFixed(0) : null,
    });
  }
}
fs.writeFileSync(path.join(BASIS, 'campagne-rendement.json'), JSON.stringify({ peildatum: new Date().toISOString(), maanden: uit }, null, 1));
console.log('campagne-rendement.json geschreven voor', Object.keys(uit).sort().join(', '));
