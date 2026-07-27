#!/usr/bin/env node
// Maakt data/conversie-<jaar>-tabellen.json (geaggregeerd, zonder klantgegevens)
// uit data/conversie-<jaar>-raw.json. Gebruik: node scripts/maak-conversie-tabellen.js --jaar 2026
const fs = require('fs');
const JAAR = +(process.argv[process.argv.indexOf('--jaar') + 1]) || 2025;
const { rows } = JSON.parse(fs.readFileSync(__dirname + `/../data/conversie-${JAAR}-raw.json`, 'utf8'));

// Akkoord volgens het akkoord-BLOK, niet de vinkjeskolom (die is onbruikbaar bijgehouden).
const isAkk = r => r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;

const A = a => { const t = String(a || '').trim().toLowerCase(); if (!t) return 'Niet ingevuld';
  if (t.startsWith('face')) return 'Facebook';
  if (t.startsWith('insta')) return 'Instagram';
  if (t.startsWith('goog')) return 'Google';
  if (t.includes('beken')) return 'Bekenden';
  if (t.startsWith('buren')) return 'Buren';
  if (t.startsWith('anders')) return 'Anders';
  return a.trim(); };
const P = p => { const t = String(p || '').trim().toLowerCase(); if (!t) return 'Niet ingevuld';
  if (t.startsWith('rolluik')) return 'Rolluiken';
  if (t.startsWith('screen')) return 'Screens';
  if (t.startsWith('knikarm')) return 'Knikarmscherm';
  if (t.startsWith('markiez')) return 'Markiezen';
  if (t.startsWith('pergola')) return 'Pergola';
  if (t.startsWith('repara')) return 'Reparatie';
  if (t.includes('raamdeco')) return 'Raamdecoratie binnen';
  if (t.includes('zonwering buiten')) return 'Zonwering buiten';
  if (t.includes('zonwering binnen')) return 'Zonwering binnen';
  if (t.startsWith('voorraad') || t.startsWith('vooraad')) return 'Voorraadscherm';
  if (t.startsWith('uitval')) return 'Uitvalscherm';
  if (t.startsWith('hor')) return 'Horren';
  return p.trim(); };
const groep = a => ['Facebook', 'Instagram'].includes(a) ? 'Meta'
  : ['Bekenden', 'Buren'].includes(a) ? 'Buren/Bekenden'
  : a === 'Google' ? 'Google' : 'Anders';
const K = r => String(r.kanaal || '').toLowerCase().startsWith('winkel') ? 'Winkel' : 'Online';

function tab(keyfn) {
  const o = {};
  for (const r of rows) { const k = keyfn(r); if (k === null) continue;
    const m = (o[k] = o[k] || { off: 0, akk: 0, omzet: 0, inkoop: 0 });
    m.off++; if (isAkk(r)) { m.akk++; m.omzet += r.akkoordBedrag || r.bedrag; m.inkoop += r.inkoop; } }
  return o;
}

const out = {
  jaar: JAAR,
  maandenAanwezig: [...new Set(rows.map(r => r.maand))].sort((a, b) => a - b),
  maand: tab(r => r.maand),
  afkomst: tab(r => A(r.afkomst)),
  product: tab(r => P(r.prod)),
  maandAfkomst: tab(r => r.maand + '|' + A(r.afkomst)),
  maandProduct: tab(r => r.maand + '|' + P(r.prod)),
  maandGroep: tab(r => r.maand + '|' + groep(A(r.afkomst))),
  kanaalGroep: tab(r => K(r) + '|' + groep(A(r.afkomst))),
  maandKanaal: tab(r => r.maand + '|' + K(r)),
  kanaal: tab(K),
  totaal: tab(() => 'alles'),
};
fs.writeFileSync(__dirname + `/../data/conversie-${JAAR}-tabellen.json`, JSON.stringify(out, null, 1));
const t = out.totaal.alles;
console.log(`${JAAR}: ${t.off} offertes, ${t.akk} akkoord (${(t.akk / t.off * 100).toFixed(1)}%), omzet €${Math.round(t.omzet).toLocaleString('nl-NL')}`);
