#!/usr/bin/env node
// Beeldgeneratie via OpenAI (gpt-image). Gebruik:
//   node scripts/openai-beeld.js "prompt" [uitvoer.png] [--model gpt-image-2] [--size 1536x1024] [--quality medium]
// Key: OPENAI_API_KEY in ~/sonty/.env
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const key = (env.match(/^OPENAI_API_KEY=(.+)$/m) || [])[1];
if (!key) { console.error('OPENAI_API_KEY ontbreekt in .env'); process.exit(1); }

const args = process.argv.slice(2);
const opt = { model: 'gpt-image-1.5', size: '1536x1024', quality: 'medium' };
const rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else rest.push(args[i]);
}
const prompt = rest[0];
const out = rest[1] || path.join(__dirname, '..', 'data', 'beelden', `beeld-${Date.now()}.png`);
if (!prompt) { console.error('Geen prompt'); process.exit(1); }

(async () => {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: opt.model, prompt, size: opt.size, quality: opt.quality, n: 1 }),
  });
  const j = await r.json();
  if (j.error) { console.error('FOUT:', j.error.message); process.exit(1); }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
  const u = j.usage || {};
  console.log(JSON.stringify({ bestand: out, model: opt.model, size: opt.size, quality: opt.quality, tokens_in: u.input_tokens, tokens_out: u.output_tokens }));
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
