#!/usr/bin/env node
// TELEGRAM-DIGEST (Daimy 02-09: "ja 17 berichten gaat het ff").
// Alarmen en rapporten komen niet meer los binnen: lib/telegram-filter.routeer() zet ze in
// data/telegram-digest-wachtrij.jsonl en dit script stuurt ze 2x per dag (08:30 en 16:30,
// launchd nl.sonty.telegram-digest) als ÉÉN kort hoofdchat-bericht. Dubbele soorten worden
// samengevoegd (zelfde tekst zonder cijfers = zelfde soort). Lege wachtrij = geen bericht.
// Alles wat verstuurd of ingekort is staat volledig in logs/telegram-digest.log.
//
// Handmatig: node scripts/telegram-digest.js --droog   (toont het bericht, verstuurt niets)
'use strict';
const fs = require('fs');
const path = require('path');

const WACHTRIJ = path.join(__dirname, '..', 'data', 'telegram-digest-wachtrij.jsonl');
const LOG = path.join(__dirname, '..', 'logs', 'telegram-digest.log');
const DROOG = process.argv.includes('--droog');
const MAX_REGELS = 10;
const HOOFD_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const HOOFD_CHAT = 1700128390;

function lees() {
  let regels = [];
  try { regels = fs.readFileSync(WACHTRIJ, 'utf8').split('\n').filter(Boolean).map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean); } catch { /* geen wachtrij */ }
  return regels;
}

/** Zelfde soort (tekst zonder cijfers, eerste 50 tekens) één keer, met teller. */
function bundel(items) {
  const per = new Map();
  for (const it of items) {
    const eerste = String(it.tekst || '').split(/\n| \| /)[0].trim();
    const sleutel = eerste.replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 50);
    const b = per.get(sleutel) || { n: 0, kop: eerste, laatste: it.op };
    b.n++; b.laatste = it.op; b.kop = eerste;
    per.set(sleutel, b);
  }
  return [...per.values()];
}

function tekstVan(bundels, totaal) {
  const regels = bundels.slice(0, MAX_REGELS).map((b) => `• ${b.kop.slice(0, 110)}${b.n > 1 ? ` (${b.n}x)` : ''}`);
  const rest = bundels.length - regels.length;
  const kop = `📬 Samenvatting: ${totaal} melding(en) sinds de vorige ronde. Geen actie nodig tenzij je iets herkent.`;
  return [kop, ...regels, rest > 0 ? `… en ${rest} soort(en) meer, zie logs/telegram-digest.log` : null].filter(Boolean).join('\n');
}

async function main() {
  const items = lees();
  if (!items.length) { console.log('wachtrij leeg — niets te sturen'); return; }
  const bundels = bundel(items);
  const tekst = tekstVan(bundels, items.length);
  try { fs.appendFileSync(LOG, `\n=== ${new Date().toISOString()} (${items.length} meldingen, ${bundels.length} soorten)${DROOG ? ' DROOG' : ''} ===\n` + items.map((i) => `[${i.op}] (${i.reden}) ${String(i.tekst).replace(/\n/g, ' | ')}`).join('\n') + '\n--- verstuurd ---\n' + tekst + '\n'); } catch { /* log is best effort */ }
  if (DROOG) { console.log(tekst); return; }
  const r = await fetch(`https://api.telegram.org/bot${HOOFD_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: HOOFD_CHAT, text: tekst.slice(0, 3900) }),
  }).catch((e) => ({ ok: false, statusText: e.message }));
  if (!r.ok) { console.log('versturen mislukt:', r.status, r.statusText, '— wachtrij blijft staan'); process.exit(1); }
  try { fs.appendFileSync(path.join(__dirname, '..', 'logs', 'telegram-verzonden.log'), `[${new Date().toISOString()}] (hoofdchat/digest) ${tekst.replace(/\n/g, ' | ').slice(0, 300)}\n`); } catch { /* best effort */ }
  fs.writeFileSync(WACHTRIJ, '');
  console.log(`digest verstuurd: ${items.length} meldingen in ${Math.min(bundels.length, MAX_REGELS)} regels`);
}

main().catch((e) => { console.error('digest-fout:', e.message); process.exit(1); });
