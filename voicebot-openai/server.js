// Bas op OpenAI Realtime API — lokale testserver voor de vergelijking met ElevenLabs-Bas.
// Start: node server.js  →  open http://localhost:3131
// Vereist: OPENAI_API_KEY in voicebot-openai/.env (zie .env.example).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3131;
const ROOT = __dirname;

const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const MODEL = process.env.BAS_REALTIME_MODEL || 'gpt-realtime-2.1';
const PRIJS_API = 'https://sonty-website.vercel.app/api/offerte-tool';

function leesInstructies() {
  const prompt = fs.readFileSync(path.join(ROOT, '..', 'data', 'sunny-prompt.txt'), 'utf8');
  const kennisbank = fs.readFileSync(path.join(ROOT, '..', 'data', 'trengo-kennisbank.md'), 'utf8');
  return prompt + '\n\n=== KENNISBANK ===\n' + kennisbank;
}

// Zelfde tool-contract als de ElevenLabs-agent en sunny-testbank.js
const TOOLS = [
  {
    type: 'function',
    name: 'prijs_berekenen',
    description:
      'Berekent de actuele Sonty-prijs (product+montage, incl btw). product: rolluikS37, rolluikS42, ' +
      'screenSquare85100, zipSquare85100, suneye, sunbasic, suneyeXL, sunelite, suncube150, ' +
      'sunproject100, suncontrol150. breedte/hoogte in mm (hoogte = uitval bij knikarm/veranda). ' +
      'bediening: io, draaischakelaar, solar, handbediend.',
    parameters: {
      type: 'object',
      properties: {
        product: { type: 'string' },
        breedte: { type: 'number' },
        hoogte: { type: 'number' },
        bediening: { type: 'string' },
      },
      required: ['product', 'breedte', 'hoogte'],
    },
  },
  {
    type: 'function',
    name: 'end_call',
    description: 'Beëindigt het telefoongesprek nadat de klant afscheid heeft genomen.',
    parameters: { type: 'object', properties: {} },
  },
];

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

async function prijsBerekenen(q) {
  const u = `${PRIJS_API}?action=prijs&product=${encodeURIComponent(q.product || '')}` +
    `&breedte=${encodeURIComponent(q.breedte || '')}&hoogte=${encodeURIComponent(q.hoogte || '')}` +
    `&bediening=${encodeURIComponent(q.bediening || 'io')}`;
  const r = await fetch(u);
  const j = await r.json();
  return { totaal: j.totaal, boekprijs: j.boekprijs, montagePrijs: j.montagePrijs, error: j.error || null };
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
