#!/usr/bin/env node
// Telegram Long Polling Daemon
// Runs continuously, saves all messages to a local file
// Uses long polling (30s timeout) so messages arrive within seconds
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const CHAT_ID = 1700128390;
const MSG_FILE = path.join(__dirname, '.telegram-messages.json');
const OFFSET_FILE = path.join(__dirname, '.telegram-offset.txt');
const PID_FILE = path.join(__dirname, '.telegram-daemon.pid');

// Save PID
fs.writeFileSync(PID_FILE, process.pid.toString());

// Load existing messages
let messages = [];
if (fs.existsSync(MSG_FILE)) {
  try { messages = JSON.parse(fs.readFileSync(MSG_FILE, 'utf8')); } catch(e) { messages = []; }
}

// Load offset
let offset = 0;
if (fs.existsSync(OFFSET_FILE)) {
  offset = parseInt(fs.readFileSync(OFFSET_FILE, 'utf8').trim()) || 0;
}

function log(msg) {
  const ts = new Date().toLocaleString('nl-NL');
  console.log(`[${ts}] ${msg}`);
}

function poll() {
  // Long polling with 30 second timeout - Telegram holds the connection open
  // and responds immediately when a new message arrives
  const url = `https://api.telegram.org/bot${TOKEN}/getUpdates?limit=10&timeout=30${offset ? '&offset=' + offset : ''}`;

  const req = https.get(url, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.ok && data.result && data.result.length > 0) {
          for (const update of data.result) {
            if (update.message && update.message.chat?.id === CHAT_ID && !update.message.from?.is_bot) {
              const msg = {
                id: update.update_id,
                date: update.message.date,
                text: update.message.text || '[geen tekst]',
                dateStr: new Date(update.message.date * 1000).toISOString().slice(0, 19).replace('T', ' ')
              };
              messages.push(msg);
              log(`NIEUW BERICHT: ${msg.text}`);

              // macOS notification
              try {
                execSync(`osascript -e 'display notification "${msg.text.replace(/"/g, '\\"').substring(0, 100)}" with title "Telegram - Daimy" sound name "default"'`);
              } catch(e) {}
            }
            // Update offset
            if (update.update_id >= offset) {
              offset = update.update_id + 1;
            }
          }
          // Save state
          fs.writeFileSync(MSG_FILE, JSON.stringify(messages, null, 2));
          fs.writeFileSync(OFFSET_FILE, offset.toString());
        }
      } catch(e) {
        log('Parse error: ' + e.message);
      }
      // Poll again immediately
      setTimeout(poll, 100);
    });
  });

  req.on('error', (e) => {
    log('Connection error: ' + e.message);
    setTimeout(poll, 5000); // Retry after 5 seconds on error
  });

  // Set a generous timeout for long polling
  req.setTimeout(35000, () => {
    req.destroy();
    setTimeout(poll, 100);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  log('Daemon stopping...');
  fs.unlinkSync(PID_FILE);
  process.exit(0);
});
process.on('SIGINT', () => {
  log('Daemon stopping...');
  try { fs.unlinkSync(PID_FILE); } catch(e) {}
  process.exit(0);
});

log('Telegram daemon gestart (long polling, instant delivery)');
log(`Luistert naar berichten van chat ${CHAT_ID}`);
log(`Berichten worden opgeslagen in ${MSG_FILE}`);
poll();
