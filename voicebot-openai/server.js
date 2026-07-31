// Bas op OpenAI Realtime API — lokale testserver voor de vergelijking met ElevenLabs-Bas.
// Start: node server.js  →  open http://localhost:3131
// Vereist: OPENAI_API_KEY in voicebot-openai/.env (zie .env.example).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { MODEL_DEFAULT, leesInstructies, TOOLS, prijsBerekenen, kennisbankOpzoeken } = require('./bas-config');

const PORT = 3131;
const ROOT = __dirname;

const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const MODEL = process.env.BAS_REALTIME_MODEL || MODEL_DEFAULT;

async function maakSession(voice) {
  const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: MODEL,
        instructions: leesInstructies(),
        tools: TOOLS,
        audio: {
          input: { transcription: { model: 'gpt-4o-mini-transcribe', language: 'nl' } },
          output: { voice },
        },
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`client_secrets ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(ROOT, 'index.html')));
    } else if (req.method === 'POST' && url.pathname === '/session') {
      if (!process.env.OPENAI_API_KEY) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OPENAI_API_KEY ontbreekt in voicebot-openai/.env' }));
        return;
      }
      const voice = url.searchParams.get('voice') || 'marin';
      const session = await maakSession(voice);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(session));
    } else if (req.method === 'GET' && url.pathname === '/api/prijs') {
      const uit = await prijsBerekenen(Object.fromEntries(url.searchParams));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(uit));
    } else if (req.method === 'GET' && url.pathname === '/api/kennisbank') {
      const uit = kennisbankOpzoeken(url.searchParams.get('vraag') || '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ resultaat: uit }));
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
});

server.listen(PORT, () => {
  console.log(`Bas (OpenAI Realtime, ${MODEL}) testserver: http://localhost:${PORT}`);
});
