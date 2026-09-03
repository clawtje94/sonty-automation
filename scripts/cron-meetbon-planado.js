#!/usr/bin/env node
// MEETBON → PLANADO-MONTAGE-OPDRACHTEN (Daimy 03-09-2026): "hoe we het nu allemaal hebben gemaakt in alle
// montage-opdrachten zetten zodra de meetbon is ingevuld; de nieuwe meetbon bij aanpassingen ook altijd overal
// verwerken ZONDER nieuwe opdrachten aan te maken, alleen update."
//
// Wat dit doet, elke 15 min (launchd nl.sonty.meetbon-planado, vangnet interval-runner):
//   1. lijst ingevulde meetbonnen (compleet/doorgezet) + vulling-hash ophalen van de website
//   2. open Planado-opdrachten ophalen (detail per opdracht, met cache op uuid+updated_at) en de montage-opdrachten
//      koppelen op "Gripp: <nr>" in de omschrijving (gezet door de Outlook-sync)
//   3. per gekoppelde opdracht waarvan de hash verschilt van data/meetbon-planado-vulling.json: vulling ophalen,
//      meetbon-PDF maken (jspdf, met alle velden + foto's), foto's ophalen en verkleinen (sips), en PATCH:
//      tekstvelden (Product 1..4, Algemeen, Product type, Meetgegevens, Bijzonderheden), Meetbon (PDF), Foto 1..4,
//      rapportveld "Werkbon tekenen (klant)" als dat leeg is. Ontbrekende velden worden met field_type toegevoegd.
//   NOOIT: POST /jobs, DELETE, omschrijving wijzigen, ingevulde rapportvelden overschrijven.
// Vlaggen: --dry (alleen plan tonen), --alleen <gripp> (één bon: eerst 1, dan de rest), --max <n> (standaard 6 per run).
// Kill: data/kill/nl.sonty.meetbon-planado. Log: logs/meetbon-planado.log. Fouten → Telegram (via filter, digest).
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { planadoFetch } = require('./lib/planado-fetch.js');
const { plan, maakPatch, verschil, grippUit, isMontage, isOpen } = require('./lib/meetbon-planado-plan.js');
const SECRETS = require('./secrets.js');

const ROOT = path.join(__dirname, '..');
const WEBSITE = process.env.SONTY_WEBSITE || 'https://sonty-website.vercel.app';
const KILL = path.join(ROOT, 'data', 'kill', 'nl.sonty.meetbon-planado');
const LOCK = path.join(ROOT, 'data', '.meetbon-planado.lock');
const STATE = path.join(ROOT, 'data', 'meetbon-planado-vulling.json');
const CACHE = path.join(ROOT, 'data', 'meetbon-planado-jobs-cache.json');
const VELDEN = path.join(ROOT, 'data', 'planado-veld-uuids.json');
const LOG = path.join(ROOT, 'logs', 'meetbon-planado.log');
const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + PLANADO_KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const WH = { Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD };
const JSPDF = '/Users/clawdboot/sonty-website/node_modules/jspdf/dist/jspdf.node.min.js';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ALLEEN = args.includes('--alleen') ? String(args[args.indexOf('--alleen') + 1] || '') : null;
const MAX = args.includes('--max') ? Number(args[args.indexOf('--max') + 1]) : 6;
const PAGINAS = 12; // × 100 opdrachten uit de lijst (nieuwste eerst)
const VENSTER_TERUG_DAGEN = 21; // opdrachten ouder dan dit (en niet-gepland) laten we liggen

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const nu = () => new Date().toISOString();
function log(t) { const r = `[${nu()}] ${t}`; console.log(r); try { fs.appendFileSync(LOG, r + '\n'); } catch { /* geen log */ } }
function leesJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function schrijfJson(p, d) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 1)); }
async function telegramFout(tekst) {
  try { const { planningTelegram } = require('./lib/telegram-planning.js'); await planningTelegram(`🚨 meetbon→Planado: ${tekst}`.slice(0, 900)); } catch (e) { log('telegram mislukt: ' + e.message); }
}
const werkbonLink = (uuid) => `${WEBSITE}/werkbon/${uuid}?t=${crypto.createHmac('sha256', SECRETS.ADMIN_PASSWORD).update('werkbon:' + uuid).digest('hex').slice(0, 24)}`;

// ── Planado: lijst + detail met cache ──
async function planadoJobs(cache) {
  const uit = [];
  let after = null;
  const grens = Date.now() - VENSTER_TERUG_DAGEN * 86400000;
  for (let p = 0; p < PAGINAS; p++) {
    const r = await planadoFetch(`https://api.planadoapp.com/v2/jobs?limit=100${after ? '&after=' + after : ''}`, { headers: PH });
    if (!r.ok) throw new Error('jobs-lijst ' + r.status);
    const jobs = (await r.json()).jobs || [];
    if (!jobs.length) break;
    for (const j of jobs) uit.push(j);
    after = jobs[jobs.length - 1].uuid;
    // de lijst is nieuwste-eerst; stoppen als we ver genoeg terug zijn
    const oudste = Math.min(...jobs.map((j) => Date.parse(j.scheduled_at || j.created_at || 0) || Infinity));
    if (oudste < grens && jobs.every((j) => (Date.parse(j.scheduled_at || 0) || 0) < grens)) break;
    await wacht(1200);
  }
  // kandidaten: open, en gepland in het venster (of ongepland maar recent aangemaakt)
  const kandidaten = uit.filter((j) => isOpen(j) && ((Date.parse(j.scheduled_at || 0) || 0) >= grens || (!j.scheduled_at && (Date.parse(j.created_at || 0) || 0) >= grens)));
  const details = [];
  let calls = 0;
  for (const j of kandidaten) {
    const c = cache[j.uuid];
    const stempel = j.updated_at || j.version || '';
    if (c && c.stempel === stempel && c.job) { details.push(c.job); continue; }
    const r = await planadoFetch(`https://api.planadoapp.com/v2/jobs/${j.uuid}`, { headers: PH });
    calls++;
    if (!r.ok) { log(`detail ${j.serial_no || j.uuid} faalde: ${r.status}`); continue; }
    const job = (await r.json()).job || {};
    // alleen wat we nodig hebben bewaren (geen bestandsinhoud)
    const slank = { uuid: job.uuid, serial_no: job.serial_no, status: job.status, scheduled_at: job.scheduled_at, description: job.description, template: job.template, custom_fields: job.custom_fields, report_fields: (job.report_fields || []).map((f) => ({ uuid: f.uuid, name: f.name, value: typeof f.value === 'string' ? f.value : (f.value ? 'x' : null) })) };
    cache[j.uuid] = { stempel, op: nu(), job: slank };
    details.push(slank);
    await wacht(1200);
  }
  // oude cache-regels opruimen
  for (const k of Object.keys(cache)) if (Date.parse(cache[k].op || 0) < Date.now() - 45 * 86400000) delete cache[k];
  log(`Planado: ${uit.length} in lijst, ${kandidaten.length} open in venster, ${calls} details opgehaald, ${details.filter(isMontage).length} montage`);
  return details;
}

// ── website ──
async function websiteJson(pad) {
  const r = await fetch(WEBSITE + pad, { headers: WH });
  if (!r.ok) throw new Error(`${pad} → ${r.status}`);
  return r.json();
}

// ── bestanden: foto's verkleinen, PDF bouwen ──
async function haalFoto(url, naam) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`foto ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const tmp = path.join(os.tmpdir(), `meetbon-foto-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  const inPad = tmp + path.extname(naam || '.jpg'), uitPad = tmp + '.jpg';
  fs.writeFileSync(inPad, buf);
  let uit = buf, mime = 'JPEG', bestandsnaam = naam;
  try {
    execFileSync('sips', ['-Z', '1600', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', inPad, '--out', uitPad], { stdio: 'ignore' });
    uit = fs.readFileSync(uitPad); bestandsnaam = naam.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
  } catch { mime = /\.png$/i.test(naam) ? 'PNG' : 'JPEG'; }
  try { fs.unlinkSync(inPad); } catch { /* */ } try { fs.unlinkSync(uitPad); } catch { /* */ }
  return { buffer: uit, mime, naam: bestandsnaam };
}
async function maakPdf(vulling, fotoBuffers) {
  const { jsPDF } = require(JSPDF);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 15; let y = M;
  const nieuwePaginaAls = (h) => { if (y + h > 282) { doc.addPage(); y = M; } };
  const kop = (t, size = 14) => { nieuwePaginaAls(10); doc.setFont('helvetica', 'bold').setFontSize(size); doc.text(doc.splitTextToSize(t, W - M * 2), M, y); y += size * 0.5 + 2; };
  const regel = (label, waarde) => { nieuwePaginaAls(6); doc.setFont('helvetica', 'bold').setFontSize(10); doc.text(String(label), M, y); doc.setFont('helvetica', 'normal'); const lines = doc.splitTextToSize(String(waarde), W - M * 2 - 62); doc.text(lines, M + 62, y); y += 5 * lines.length; };
  kop(vulling.pdf.titel, 16);
  doc.setFont('helvetica', 'normal').setFontSize(10); doc.text(doc.splitTextToSize(vulling.pdf.sub, W - M * 2), M, y); y += 8;
  for (const s of vulling.pdf.secties) { y += 3; kop(s.kop, 12); for (const [l, w] of s.regels) regel(l, w); }
  for (const f of fotoBuffers) {
    nieuwePaginaAls(100); doc.setFont('helvetica', 'bold').setFontSize(10); doc.text(f.titel, M, y); y += 4;
    try { doc.addImage(f.buffer.toString('base64'), f.mime, M, y, 120, 90, undefined, 'FAST'); y += 95; } catch (e) { regel(f.titel, 'foto niet geladen: ' + e.message.slice(0, 60)); }
  }
  return Buffer.from(doc.output('arraybuffer'));
}

async function verwerk(job, bon, state) {
  const { vulling } = await websiteJson(`/api/meetbon/bon/${bon.gripp}/planado`);
  const veldUuids = leesJson(VELDEN, null);
  if (!veldUuids) throw new Error('data/planado-veld-uuids.json ontbreekt');
  // foto's: allemaal voor de PDF, de eerste 4 ook als veld
  const fotoBuffers = [];
  for (const f of vulling.alleFotos) { try { const b = await haalFoto(f.url, `foto.jpg`); fotoBuffers.push({ ...b, titel: f.titel, url: f.url }); } catch (e) { log(`  foto overgeslagen (${e.message}): ${f.url.slice(-40)}`); } }
  const bestanden = {};
  const pdf = await maakPdf(vulling, fotoBuffers);
  bestanden['Meetbon (PDF)'] = { name: vulling.pdf.bestandsnaam, base64_content: pdf.toString('base64') };
  vulling.fotos.forEach((f, i) => { const b = fotoBuffers.find((x) => x.url === f.url); if (b) bestanden[`Foto ${i + 1} inmeet`] = { name: f.naam.replace(/\.[a-z0-9]+$/i, '') + (b.mime === 'PNG' ? '.png' : '.jpg'), base64_content: b.buffer.toString('base64') }; });
  const { body, problemen } = maakPatch(job, vulling, veldUuids, bestanden, werkbonLink(job.uuid));
  for (const p of problemen) log(`  let op: ${p}`);
  const v = verschil(job, body);
  const omvang = Math.round(JSON.stringify(body).length / 1024);
  if (DRY) { log(`  DRY #${job.serial_no}: nieuw=[${v.nieuw.join(', ')}] gewijzigd=[${v.gewijzigd.join(', ')}] pdf=${Math.round(pdf.length / 1024)}kB foto's=${fotoBuffers.length} body=${omvang}kB`); return 'dry'; }
  const r = await planadoFetch(`https://api.planadoapp.com/v2/jobs/${job.uuid}`, { method: 'PATCH', headers: PH, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`PATCH #${job.serial_no} → ${r.status} ${(await r.text()).slice(0, 160)}`);
  state[job.uuid] = { gripp: bon.gripp, hash: bon.hash, serial_no: job.serial_no, op: nu(), velden: body.custom_fields.length, fotos: fotoBuffers.length };
  schrijfJson(STATE, state);
  log(`  ✓ #${job.serial_no} (Gripp ${bon.gripp}) bijgewerkt: nieuw=[${v.nieuw.join(', ')}] gewijzigd=[${v.gewijzigd.join(', ')}] pdf=${Math.round(pdf.length / 1024)}kB foto's=${fotoBuffers.length}`);
  return 'ok';
}

async function main() {
  if (fs.existsSync(KILL)) { log('kill-bestand aanwezig, niets doen'); return; }
  if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 20 * 60000) { log('lock actief, andere run bezig'); return; }
  fs.writeFileSync(LOCK, String(process.pid));
  const fouten = [];
  try {
    const { bonnen } = await websiteJson('/api/meetbon/planado-lijst');
    const cache = leesJson(CACHE, {});
    const state = leesJson(STATE, {});
    const jobs = await planadoJobs(cache);
    schrijfJson(CACHE, cache);
    const p = plan(bonnen, jobs, state, { alleen: ALLEEN, max: MAX });
    const redenen = {};
    for (const o of p.overgeslagen) redenen[o.reden] = (redenen[o.reden] || 0) + 1;
    log(`bonnen ingevuld: ${bonnen.length} | acties: ${p.acties.length}${p.uitgesteld.length ? ` (+${p.uitgesteld.length} volgende run)` : ''} | overgeslagen: ${Object.entries(redenen).map(([k, n]) => `${k} ×${n}`).join(', ') || '-'}${DRY ? ' | DRY' : ''}`);
    const perUuid = new Map(jobs.map((j) => [j.uuid, j]));
    const perGripp = new Map(bonnen.map((b) => [String(b.gripp), b]));
    for (const a of p.acties) {
      log(`→ #${a.serial_no} Gripp ${a.gripp}: ${a.reden}`);
      try { await verwerk(perUuid.get(a.uuid), perGripp.get(a.gripp), state); } catch (e) { fouten.push(`#${a.serial_no} (Gripp ${a.gripp}): ${e.message}`); log(`  ✗ ${e.message}`); }
      await wacht(1500);
    }
  } catch (e) {
    fouten.push('run: ' + e.message); log('✗ run mislukt: ' + e.message);
  } finally { try { fs.unlinkSync(LOCK); } catch { /* */ } }
  if (fouten.length && !DRY) await telegramFout(fouten.slice(0, 5).join('\n'));
}
main();
