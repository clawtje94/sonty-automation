#!/usr/bin/env node
/**
 * WAAKHOND OP DE MAILDATA (18-08): de hele mailmachine (dag-30-instroom, backfill,
 * profielvelden, opt-outs) hangt op de dagelijkse sync van 06:30. Faalt die stil, dan
 * mist er een dagcohort omdat het instap-venster bewust exact dag 30 is. Dit script
 * draait elke ochtend om 08:00 en piept alleen als de data oud is; geen nieuws = stil.
 */
const fs = require('fs');
const path = require('path');

const EXPORT = path.join(__dirname, '..', '..', 'data', 'email', 'rp-export.json');
const MAX_UUR = 26;

(async () => {
  let uren = Infinity;
  try { uren = (Date.now() - fs.statSync(EXPORT).mtimeMs) / 3600000; } catch { /* ontbreekt */ }
  if (uren <= MAX_UUR) { console.log(`sync vers (${uren.toFixed(1)} uur oud), niks aan de hand`); return; }
  const tekst = uren === Infinity
    ? '⚠️ MAILDATA ONTBREEKT: data/email/rp-export.json bestaat niet. De dag-30-mails en backfill draaien op niets. Check nl.sonty.email-sync.'
    : `⚠️ MAILDATA OUD: de dagelijkse sync van 06:30 lijkt niet gedraaid (export is ${Math.round(uren)} uur oud). Risico: het dag-30-cohort van vandaag mist zijn mail en opt-outs zijn niet ververst. Fix: launchctl kickstart -k gui/501/nl.sonty.email-sync`;
  await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: tekst }),
  });
  console.log('ALARM verstuurd:', tekst.slice(0, 60));
})();
