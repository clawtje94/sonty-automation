// Reads Telegram messages — checks inbox file + auto-restarts daemon if needed
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const CHAT_ID = 1700128390;
const TELEGRAM_FALLBACK_IP = '149.154.167.220';
const INBOX_FILE = path.join(__dirname, '..', 'telegram-inbox.txt');
const INBOX_READ_FILE = path.join(__dirname, '.telegram-inbox-lastread.txt');
const DAEMON_SCRIPT = path.join(__dirname, '..', 'tools', 'telegram-poll.js');

// === Step 0: Ensure exactly 1 daemon is running ===
try {
  const result = execSync('pgrep -f "telegram-poll.js"', { encoding: 'utf8' }).trim();
  const pids = result.split('\n').filter(p => p.trim());
  if (pids.length === 0) throw new Error('not running');
  // Kill extra daemons if more than 1
  if (pids.length > 1) {
    for (let i = 1; i < pids.length; i++) {
      try { execSync(`kill ${pids[i]}`); } catch(e) {}
    }
  }
} catch(e) {
  if (e.message === 'not running' || e.status) {
    try {
      const child = spawn('node', [DAEMON_SCRIPT], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      console.log('[daemon herstart]');
    } catch(e2) {}
  }
}

// === Step 1: Read from telegram-inbox.txt (daemon output) ===
if (fs.existsSync(INBOX_FILE)) {
  try {
    const content = fs.readFileSync(INBOX_FILE, 'utf8').trim();
    if (content) {
      let lastPos = 0;
      if (fs.existsSync(INBOX_READ_FILE)) {
        lastPos = parseInt(fs.readFileSync(INBOX_READ_FILE, 'utf8').trim()) || 0;
      }

      const lines = content.split('\n');
      if (lines.length > lastPos) {
        const newLines = lines.slice(lastPos).filter(l => l.trim());
        // Deduplicate consecutive identical lines
        const deduped = newLines.filter((line, i) => i === 0 || line !== newLines[i - 1]);
        if (deduped.length > 0) {
          deduped.forEach(m => console.log(m));
          fs.writeFileSync(INBOX_READ_FILE, lines.length.toString());
          console.log(`\n${deduped.length} bericht(en)`);
          process.exit(0);
        }
      }
    }
  } catch(e) {}
}

// === Step 2: Direct API poll as fallback ===
const urlPath = `/bot${TOKEN}/getUpdates?limit=10&timeout=5`;
const options = {
  hostname: TELEGRAM_FALLBACK_IP,
  port: 443,
  path: urlPath,
  method: 'GET',
  headers: { 'Host': 'api.telegram.org' },
  rejectUnauthorized: false,
  timeout: 15000
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (data.ok && data.result && data.result.length > 0) {
        const msgs = data.result.filter(u =>
          u.message && u.message.chat?.id === CHAT_ID && !u.message.from?.is_bot
        );

        if (msgs.length === 0) {
          console.log('(geen nieuwe berichten)');
          return;
        }

        msgs.forEach(u => {
          const text = u.message.text || '[geen tekst]';
          const d = new Date(u.message.date * 1000);
          const dateStr = d.toISOString().slice(0, 19).replace('T', ' ');
          console.log(`[${dateStr}] ${text}`);
        });
        console.log(`\n${msgs.length} bericht(en)`);
      } else {
        console.log('(geen nieuwe berichten)');
      }
    } catch(e) {
      console.error('Parse error:', e.message);
    }
  });
});
req.on('error', e => console.error('Request error:', e.message));
req.on('timeout', () => { req.destroy(); console.error('Request timeout'); });
req.end();
