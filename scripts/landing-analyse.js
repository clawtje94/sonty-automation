#!/usr/bin/env node
// LANDING/CAMPAGNE-PROXY (Daimy 31 juli: "welke ads kosten wat en leveren wat op").
// Zolang er geen UTM-attributie is, is de productregel in de leadomschrijving de beste
// campagne-proxy: elke advertentie landt op een specifieke actie/configurator-pagina.
// Schrijft data/landing-conversie.json voor het dashboard. Akkoord = sheet-definitie.
const fs = require('fs');
const path = require('path');
const KS = require('./ai-ks/config.js');
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;

(async () => {
  const items = (await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${KS.RP_PID}/backlogs/${KS.RP_BACKLOG}/items`, {
    headers: { Authorization: 'Bearer ' + KS.RP_API_KEY } })).json()).items || [];
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'conversie-2026-raw.json'), 'utf8')).rows;
  const akkTel = new Map();
  for (const r of rows) if (r.tel && r.tel.length >= 9 && isAkk(r))
    akkTel.set(r.tel, (akkTel.get(r.tel) || 0) + (r.akkoordBedrag || r.bedrag || 0));

  const grens = Date.now() / 1000 - 45 * 86400;
  const per = {};
  for (const it of items) {
    const ts = it.timestamp_created > 1e12 ? it.timestamp_created / 1000 : it.timestamp_created;
    if (ts < grens) continue;
    const m = String(it.description || '').match(/\d+x\s+([^\n]+)/);
    let label = (m ? m[1] : '(geen productregel)').replace(/\s*-\s*doekkleur.*/i, '').replace(/:\s*$/, '').trim().slice(0, 45);
    const tel = String(it.fields?.phone || '').replace(/\D/g, '').slice(-9);
    const p = (per[label] = per[label] || { leads: 0, akk: 0, waarde: 0 });
    p.leads++;
    if (tel && akkTel.has(tel)) { p.akk++; p.waarde += akkTel.get(tel); }
  }
  const uit = { peildatum: new Date().toISOString(), dagen: 45,
    labels: Object.fromEntries(Object.entries(per).filter(([, v]) => v.leads >= 15).sort((a, b) => b[1].leads - a[1].leads)) };
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'landing-conversie.json'), JSON.stringify(uit, null, 1));
  console.log('landing-conversie.json:', Object.keys(uit.labels).length, 'labels');
})();
