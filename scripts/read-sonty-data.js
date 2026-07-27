#!/usr/bin/env node
// Leest nieuwe berichten uit de Sonty DATA-bot inbox (@Sontydatabot).
// Zelfde patroon als read-telegram-webhook.js: leespositie in een apart bestand, en
// altijd de laatste regels als context laten zien (meerdere sessies delen de positie,
// waardoor berichten anders stil 'gelezen' kunnen raken).
const fs = require('fs');
const path = require('path');

const INBOX = path.join(__dirname, '..', 'sonty-data-inbox.txt');
const LASTREAD = path.join(__dirname, '.sonty-data-lastread.txt');
const CHAT_FILE = path.join(__dirname, '..', '.sonty-data-chat.json');

if (!fs.existsSync(INBOX) || !fs.readFileSync(INBOX, 'utf8').trim()) {
  console.log('(data-bot inbox nog leeg)');
  if (!fs.existsSync(CHAT_FILE)) {
    console.log('Let op: nog geen chat_id bekend. Daimy moet eerst /start sturen naar @Sontydatabot.');
  }
  process.exit(0);
}

const regels = fs.readFileSync(INBOX, 'utf8').trim().split('\n').filter(l => l.trim());
let pos = 0;
try { pos = parseInt(fs.readFileSync(LASTREAD, 'utf8').trim()) || 0; } catch {}

const nieuw = regels.slice(pos);
if (nieuw.length) {
  nieuw.forEach(l => console.log(l));
  fs.writeFileSync(LASTREAD, String(regels.length));
  console.log(`\n${nieuw.length} nieuw bericht(en) in de data-bot`);
} else {
  console.log('(geen nieuwe data-bot berichten — laatste 3 ter controle:)');
  regels.slice(-3).forEach(l => console.log('  ' + l));
}

const stil = Math.round((Date.now() - fs.statSync(INBOX).mtimeMs) / 60000);
if (stil > 120) console.log(`\nLET OP: data-inbox ${stil} min stil — check: launchctl list | grep databot`);
