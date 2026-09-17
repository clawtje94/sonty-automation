#!/usr/bin/env node
// Dagelijkse back-up van de Vercel KV-database van sonty-website (leads, offertes, instellingen, indexen).
// Waarom (17-09-2026): er was geen enkele back-up; na de domeinswitch is KV de enige plek voor nieuwe leads.
// Werking: SCAN alle sleutels → per sleutel type + waarde via /pipeline (batches) → JSONL.gz in ~/sonty/backups/kv/
// + kopie naar Vercel Blob (backups/kv/…). Houdt 30 dagen lokaal. Telegram-alarm bij fout of als de vorige
// back-up ouder is dan 26 uur (nl.sonty.kv-backup-wacht). Herstelproef: node scripts/kv-backup.js --herstelproef <bestand>
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const ENV = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', 'secrets', 'vercel-kv.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL_ = ENV.KV_REST_API_URL, TOKEN = ENV.KV_REST_API_TOKEN;
const DIR = path.join(__dirname, '..', 'backups', 'kv');
const H = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

async function cmd(arr) { const r = await fetch(URL_, { method: 'POST', headers: H, body: JSON.stringify(arr) }); const j = await r.json(); if (j.error) throw new Error(j.error); return j.result; }
async function pipeline(cmds) { const r = await fetch(URL_ + '/pipeline', { method: 'POST', headers: H, body: JSON.stringify(cmds) }); const j = await r.json(); if (!Array.isArray(j)) throw new Error('pipeline: ' + JSON.stringify(j).slice(0, 200)); return j.map(x => { if (x.error) throw new Error(x.error); return x.result; }); }
const LEES = { string: k => ['GET', k], hash: k => ['HGETALL', k], set: k => ['SMEMBERS', k], zset: k => ['ZRANGE', k, '0', '-1', 'WITHSCORES'], list: k => ['LRANGE', k, '0', '-1'] };

async function alleSleutels() { const keys = []; let cursor = '0'; do { const [c, ks] = await cmd(['SCAN', cursor, 'COUNT', '1000']); cursor = String(c); keys.push(...ks); } while (cursor !== '0'); return keys; }

async function backup() {
  const t0 = Date.now(); const keys = await alleSleutels();
  const datum = new Date().toISOString().slice(0, 10); const bestand = path.join(DIR, `kv-${datum}.jsonl.gz`);
  const gz = zlib.createGzip(); const out = fs.createWriteStream(bestand + '.tmp'); gz.pipe(out);
  const telling = {}; let n = 0;
  for (let i = 0; i < keys.length; i += 300) {
    const deel = keys.slice(i, i + 300);
    const types = await pipeline(deel.map(k => ['TYPE', k]));
    const lees = deel.map((k, j) => LEES[types[j]] ? LEES[types[j]](k) : ['TTL', k]);
    const waarden = await pipeline(lees);
    const ttls = await pipeline(deel.map(k => ['TTL', k]));
    deel.forEach((k, j) => { const t = types[j]; telling[t] = (telling[t] || 0) + 1; if (!LEES[t]) return; gz.write(JSON.stringify({ k, t, v: waarden[j], ttl: ttls[j] }) + '\n'); n++; });
  }
  await new Promise((res, rej) => { gz.end(); out.on('finish', res); out.on('error', rej); });
  fs.renameSync(bestand + '.tmp', bestand);
  const bytes = fs.statSync(bestand).size;
  // Geen Blob-kopie: de Blob-store van sonty-website is PUBLIEK (private access geweigerd, 17-09) en een back-up met
  // klantdata mag niet op een publieke URL staan. Tweede kopie: ~/sonty/backups/kv (lokaal) + wekelijkse kopie naar ~/Backups-sonty.
  let blobUrl = null;
  try { const extra = path.join(process.env.HOME, 'Backups-sonty', 'kv'); fs.mkdirSync(extra, { recursive: true }); fs.copyFileSync(bestand, path.join(extra, path.basename(bestand))); blobUrl = 'kopie:' + path.join(extra, path.basename(bestand)); for (const f of fs.readdirSync(extra)) { const p = path.join(extra, f); if (Date.now() - fs.statSync(p).mtimeMs > 60 * 864e5) fs.unlinkSync(p); } } catch (e) { console.error('[kv-backup] tweede kopie mislukt:', String(e).slice(0, 120)); }
  // opruimen > 30 dagen
  for (const f of fs.readdirSync(DIR)) { const p = path.join(DIR, f); if (f.startsWith('kv-') && Date.now() - fs.statSync(p).mtimeMs > 30 * 864e5) fs.unlinkSync(p); }
  const stand = { tijd: new Date().toISOString(), bestand, sleutels: keys.length, geschreven: n, telling, bytes, blobUrl, duurSec: Math.round((Date.now() - t0) / 1000) };
  fs.writeFileSync(path.join(DIR, 'laatste.json'), JSON.stringify(stand, null, 2));
  console.log('[kv-backup]', JSON.stringify(stand));
  return stand;
}

// Herstelproef: dump lezen, tellen, en 20 sleutels onder prefix herstelproef: terugschrijven en weer verwijderen (bewijst het schrijfpad).
async function herstelproef(bestand) {
  const regels = zlib.gunzipSync(fs.readFileSync(bestand)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const leads = regels.filter(r => r.k.startsWith('lead:')).length;
  const proef = regels.filter(r => r.t === 'string').slice(0, 20);
  const schrijf = proef.map(r => ['SET', 'herstelproef:' + r.k, typeof r.v === 'string' ? r.v : JSON.stringify(r.v)]);
  await pipeline(schrijf);
  const terug = await pipeline(proef.map(r => ['GET', 'herstelproef:' + r.k]));
  const gelijk = proef.filter((r, i) => (typeof r.v === 'string' ? r.v : JSON.stringify(r.v)) === (typeof terug[i] === 'string' ? terug[i] : JSON.stringify(terug[i]))).length;
  await pipeline(proef.map(r => ['DEL', 'herstelproef:' + r.k]));
  const uit = { bestand: path.basename(bestand), regels: regels.length, leads, proefSleutels: proef.length, teruggelezenGelijk: gelijk, ok: gelijk === proef.length && regels.length > 0 };
  console.log('[herstelproef]', JSON.stringify(uit)); if (!uit.ok) process.exit(1); return uit;
}

async function telegram(tekst) { try { const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const tok = /TELEGRAM_BOT_TOKEN=(.+)/.exec(env)[1].trim(); const chat = /TELEGRAM_CHAT_ID=(.+)/.exec(env)[1].trim(); await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: tekst }) }); } catch {} }

(async () => {
  const a = process.argv.slice(2);
  if (a[0] === '--herstelproef') return herstelproef(a[1] || JSON.parse(fs.readFileSync(path.join(DIR, 'laatste.json'))).bestand);
  if (a[0] === '--wacht') { // alarm als laatste back-up > 26 uur of ontbreekt
    try { const l = JSON.parse(fs.readFileSync(path.join(DIR, 'laatste.json'))); const uur = (Date.now() - Date.parse(l.tijd)) / 36e5; if (uur > 26) await telegram(`ALARM KV-back-up: laatste back-up is ${Math.round(uur)} uur oud (${l.bestand}). Check nl.sonty.kv-backup op de Mac mini.`); else console.log('[kv-backup-wacht] ok,', Math.round(uur * 10) / 10, 'uur oud'); } catch (e) { await telegram('ALARM KV-back-up: geen laatste.json gevonden (' + String(e).slice(0, 80) + ')'); }
    return;
  }
  try { await backup(); } catch (e) { console.error('[kv-backup] FOUT', e); await telegram('ALARM KV-back-up mislukt: ' + String(e).slice(0, 200)); process.exit(1); }
})();
