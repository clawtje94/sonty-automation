const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3458;
const MSG_FILE = path.join(__dirname, 'telegram-messages.json');

// Load existing messages
let messages = [];
if (fs.existsSync(MSG_FILE)) {
  try { messages = JSON.parse(fs.readFileSync(MSG_FILE, 'utf8')); } catch(e) { messages = []; }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
        if (update.message) {
          const msg = {
            date: update.message.date,
            text: update.message.text || '[geen tekst]',
            from: update.message.from?.first_name || 'unknown'
          };
          messages.push(msg);
          fs.writeFileSync(MSG_FILE, JSON.stringify(messages, null, 2));
          console.log(`[${new Date(msg.date * 1000).toLocaleString('nl-NL')}] ${msg.text}`);
        }
      } catch(e) { console.error('Parse error:', e.message); }
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end('{"ok":true}');
    });
  } else if (req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(messages));
  } else {
    res.writeHead(200);
    res.end('ok');
  }
});

server.listen(PORT, () => console.log(`Telegram webhook server on port ${PORT}`));
