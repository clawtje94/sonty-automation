#!/usr/bin/env node
// Anthropic credits-watchdog — elke 2 uur (launchd nl.sonty.credits-check).
// Doet een minimale Haiku-ping (< $0,0001). Credits op → LUID Telegram-alarm
// (klantenservice/Sonny staat dan stil), herhaald elke 12 uur zolang het duurt.
// Weer aangevuld → herstelmelding. State: data/ai-ks/credits-state.json.
const fs = require('fs');
const path = require('path');

const KEY = fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TG_CHAT = 1700128390;
const STATE_FILE = path.join(__dirname, '..', 'data', 'ai-ks', 'credits-state.json');
const HERHAAL_MS = 12 * 3600000;

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { status: 'ok', laatsteAlert: 0 }; } }
function saveState(s) { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); }
async function telegram(text) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text }),
  }).catch(() => {});
}

(async () => {
  const state = loadState();
  let creditsOp = false;
  let andereFout = null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }),
    });
    const body = await r.text();
    if (!r.ok) {
      if (/credit balance/i.test(body)) creditsOp = true;
      else andereFout = `${r.status} ${body.slice(0, 150)}`;
    }
  } catch (e) {
    andereFout = String(e.message || e).slice(0, 150); // netwerkfout ≠ credits op; niet vals alarmeren
  }

  const nu = Date.now();
  if (creditsOp) {
    if (state.status !== 'op' || nu - state.laatsteAlert > HERHAAL_MS) {
      await telegram('🚨🚨 ANTHROPIC CREDITS ZIJN OP 🚨🚨\n\nDe AI-klantenservice (Sonny) staat hierdoor STIL: klanten krijgen geen antwoord tot dit is opgelost.\n\nBijladen: console.anthropic.com/settings/billing → Buy credits.\nTip: zet daar auto-reload aan, dan gebeurt dit nooit meer.\n\n(Ik check elke 2 uur en meld het zodra het weer werkt.)');
      saveState({ status: 'op', laatsteAlert: nu });
    }
    console.log(`[${new Date().toISOString()}] credits OP`);
  } else if (andereFout) {
    // API onbereikbaar of andere fout: loggen, alleen alarmeren als het aanhoudt is v2-werk
    console.log(`[${new Date().toISOString()}] check niet gelukt (geen credits-oordeel): ${andereFout}`);
  } else {
    if (state.status === 'op') {
      await telegram('✅ Anthropic credits zijn weer aangevuld. De AI-klantenservice (Sonny) kan weer reageren.');
    }
    saveState({ status: 'ok', laatsteAlert: 0 });
    console.log(`[${new Date().toISOString()}] credits OK`);
  }
})();
