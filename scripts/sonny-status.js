#!/usr/bin/env node
// SONNY-STATUS — één overzicht of de AI-klantenservice aan staat (vraag Daimy 2026-07-17:
// "hoe gaan we dit noemen zodat ik weet of het aan of uit staat?"). Draaien: node scripts/sonny-status.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const A = (naam, aan, detail) => console.log(`${aan ? '🟢' : '🔴'} ${naam}: ${aan ? 'AAN' : 'UIT'}${detail ? ' — ' + detail : ''}`);

// 1. Watcher (30s-polling) of launchd-fallback (5 min)
let watcher = false;
try { watcher = execSync('ps aux | grep "[d]aemon.js --watch" | grep -v zsh | wc -l').toString().trim() !== '0'; } catch {}
let launchd = false;
try { launchd = execSync('launchctl list 2>/dev/null | grep -c "nl.sonty.sonny$" || true').toString().trim() !== '0'; } catch {}
A('Gesprekken beantwoorden (SONNY)', watcher || launchd, watcher ? 'snelle modus, elke 30s' : (launchd ? 'rustige modus, elke 5 min' : 'NIEMAND antwoordt!'));

// 2. Nieuwe tickets: vast dagritme (ma-zo 08:00-21:00) + evt. handmatig verlengvenster
const CFG = require('./ai-ks/config.js');
const binnenUren = CFG.binnenBotUren();
let nachtTot = null;
try { nachtTot = fs.readFileSync(path.join(__dirname, 'ai-ks', '.nieuwe-tickets-tot'), 'utf8').trim(); } catch {}
const verlengAan = nachtTot && new Date() < new Date(nachtTot);
A('Nieuwe tickets oppakken', binnenUren || !!verlengAan,
  binnenUren ? `dagritme ${CFG.BOT_UREN.start}-${CFG.BOT_UREN.eind} (ma-zo)` :
  (verlengAan ? 'handmatig verlengd tot ' + nachtTot.slice(0, 16).replace('T', ' ') : `buiten boturen (${CFG.BOT_UREN.start}-${CFG.BOT_UREN.eind}) — alleen lopende gesprekken + testnummers`));

// 3. Avonddienst met Sonny-intro (aparte functie!)
let avond = false;
try { avond = fs.readFileSync(path.join(__dirname, 'ai-ks', '.sonny-enabled'), 'utf8').trim() === 'JA ECHT'; } catch {}
A('Avonddienst met AI-intro (buiten openingstijden, alle klanten)', avond, avond ? '' : 'aanzetten: JA ECHT SONNY AAN');

// 4. Actieve (AI-beheerde) gesprekken
let actief = 0;
try { actief = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ai-ks', 'actieve-tickets.json'), 'utf8'))).length; } catch {}
console.log(`📋 AI-beheerde gesprekken: ${actief}`);

// 5. Telegram-poller gezondheid
try {
  const stilMin = Math.round((Date.now() - fs.statSync(path.join(__dirname, '..', 'telegram-inbox.txt')).mtimeMs) / 60000);
  A('Telegram-inbox', stilMin < 240, `laatste bericht ${stilMin} min geleden`);
} catch { A('Telegram-inbox', false, 'inbox niet leesbaar'); }

// 6. Dagrapporten
let rapporten = false;
try { rapporten = execSync('launchctl list 2>/dev/null | grep -c "getekend-rapport\\|sonny-rapport" || true').toString().trim() === '2'; } catch {}
A('Dagrapporten (07:45 + 08:30)', rapporten);
