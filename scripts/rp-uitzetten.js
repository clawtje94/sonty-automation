#!/usr/bin/env node
// REUZENPANDA UITZETTEN / WEER AANZETTEN (blok 5, 30-08-2026). Eén schakelaar voor de automation op de Mac mini.
//   node scripts/rp-uitzetten.js status    → wat staat er nu
//   node scripts/rp-uitzetten.js uit       → vlag data/.rp-uit zetten + RP-only jobs stoppen (launchd bootout)
//   node scripts/rp-uitzetten.js aan       → vlag weg + jobs weer laden
// Wat de vlag doet: scripts/lib/dossiers.js (rapporten lezen eigen CRM), cron-inmeten-planner rpGet (geen RP-items meer),
// ai-ks/klant-context (geen RP-zoekacties), inmeet-tijden/daemon (alleen eigen ids). Website-kant is een aparte schakelaar:
// verzendcentrum bron=eigen (+ testmodus uit, automatisch versturen aan) — die zet je in /admin/verzendcentrum.
// RP-ONLY jobs (lezen/schrijven uitsluitend RP; zonder RP zinloos): worden gestopt, plist blijft staan voor 'aan'.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VLAG = path.join(__dirname, '..', 'data', '.rp-uit');
const RP_ONLY = ['nl.sonty.v4-selfcheck', 'nl.sonty.gripp-verrijken', 'nl.sonty.keten-zelfcontrole', 'nl.sonty.prijs-steekproef', 'nl.sonty.markiezen', 'nl.sonty.meeneem-melding', 'nl.sonty.offerte-v4'];
const PLIST = (l) => path.join(process.env.HOME, 'Library', 'LaunchAgents', l + '.plist');
const sh = (c) => { try { return execSync(c, { stdio: 'pipe' }).toString().trim(); } catch (e) { return 'FOUT: ' + String(e.message).split('\n')[0]; } };
const geladen = (l) => !/Could not find/.test(sh(`launchctl print gui/501/${l} 2>&1 | head -1`)) && !/FOUT/.test(sh(`launchctl print gui/501/${l} 2>&1 | head -1`));

const cmd = process.argv[2] || 'status';
if (cmd === 'status') {
  console.log('RP-uit vlag:', fs.existsSync(VLAG) ? 'AAN (RP wordt niet meer gelezen)' : 'uit (RP leidend)');
  for (const l of RP_ONLY) console.log(`  ${l}: ${fs.existsSync(PLIST(l)) ? (geladen(l) ? 'draait' : 'gestopt') : 'geen plist'}`);
} else if (cmd === 'uit') {
  fs.writeFileSync(VLAG, new Date().toISOString() + ' RP uitgezet via scripts/rp-uitzetten.js\n');
  for (const l of RP_ONLY) if (fs.existsSync(PLIST(l))) console.log(`  stop ${l}: ${sh(`launchctl bootout gui/501/${l}`) || 'ok'}`);
  console.log('RP-uit vlag gezet. Vergeet niet: /admin/verzendcentrum → bron eigen; RP-automation "Offerte verstuurd" uit in RP; Zapier "RP Offerte → Sheets" uit.');
} else if (cmd === 'aan') {
  if (fs.existsSync(VLAG)) fs.unlinkSync(VLAG);
  for (const l of RP_ONLY) if (fs.existsSync(PLIST(l))) console.log(`  start ${l}: ${sh(`launchctl bootstrap gui/501 ${PLIST(l)}`) || 'ok'}`);
  console.log('RP weer leidend (vlag weg).');
} else {
  console.log('gebruik: status | uit | aan');
}
