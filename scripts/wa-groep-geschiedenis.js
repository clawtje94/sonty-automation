#!/usr/bin/env node
/**
 * GROEPSGESCHIEDENIS SONTY TOPPERS (Daimy 22-08: "kan je de hele geschiedenis teruglezen
 * zodat je het echt persoonlijk kan maken?").
 *
 * Sunny's nummer zit pas sinds 17-08-2026 in de groep; WhatsApp geeft een nieuw lid geen oude
 * berichten. De jaren ervoor komen dus alleen via een EXPORT van een oud lid (Daimy):
 * WhatsApp → groep → ⋮ → Meer → Exporteer chat → Zonder media → .txt/.zip.
 *
 *   node scripts/wa-groep-geschiedenis.js import <pad-naar-export.txt|.zip>
 *       → berichten toevoegen aan data/wa-groep-geschiedenis.jsonl (ontdubbeld)
 *   node scripts/wa-groep-geschiedenis.js geheugen
 *       → data/wa-groep-teamgeheugen.md: samenvatting per persoon, running gags, gebeurtenissen
 *         (Sonnet, in blokken), die de groep-antwoorder als context gebruikt
 *   node scripts/wa-groep-geschiedenis.js stats
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const DATA = path.join(__dirname, '..', 'data');
const JSONL = path.join(DATA, 'wa-groep-geschiedenis.jsonl');
const GEHEUGEN = path.join(DATA, 'wa-groep-teamgeheugen.md');
const KEY = fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();

function lees() {
  try { return fs.readFileSync(JSONL, 'utf8').split('\n').filter(Boolean).map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean); } catch { return []; }
}

/** WhatsApp-exportregels: "[21-08-2026 18:25:03] Joey: tekst" (iOS) of "21-08-2026 18:25 - Joey: tekst" (Android),
 *  ook Engelse varianten "8/21/26, 6:25 PM - Joey: tekst". Vervolgregels horen bij het vorige bericht. */
function parseExport(txt) {
  const uit = [];
  // datumvolgorde per bestand bepalen: iOS-NL export is dd/mm/yyyy met slashes; US is mm/dd.
  // Staat er ergens een eerste getal > 12, dan is het dd/mm; alleen een tweede > 12 → mm/dd.
  let ddmm = true;
  { const eerste = [], tweede = [];
    for (const m of txt.matchAll(/^\[?(\d{1,2})[-\/.](\d{1,2})[-\/.]\d{2,4}/gm)) { eerste.push(Number(m[1])); tweede.push(Number(m[2])); if (eerste.length > 5000) break; }
    if (eerste.some((x) => x > 12)) ddmm = true; else if (tweede.some((x) => x > 12)) ddmm = false; }
  const re = /^\[?(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\]?\s*(?:-\s*)?([^:]{1,60}?):\s(.*)$/i;
  let huidig = null;
  for (const regel of txt.split(/\r?\n/)) {
    const m = regel.replace(/‎|‏|‪|‬/g, '').match(re);
    if (m) {
      let [, d, mo, y, h, mi, se, ampm, van, tekst] = m;
      y = y.length === 2 ? '20' + y : y;
      h = Number(h); if (ampm) { const pm = /p/i.test(ampm); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
      const dag = ddmm ? { dd: Number(d), mm: Number(mo) } : { dd: Number(mo), mm: Number(d) };
      const tijd = new Date(Number(y), dag.mm - 1, dag.dd, h, Number(mi), Number(se || 0)).getTime();
      if (huidig) uit.push(huidig);
      huidig = { tijd, van: van.trim(), tekst: tekst.trim(), bron: 'export' };
    } else if (huidig && regel.trim()) {
      huidig.tekst += '\n' + regel.trim();
    }
  }
  if (huidig) uit.push(huidig);
  return uit.filter((r) => r.tekst && !/^(<Media weggelaten>|<Media omitted>|‎?afbeelding weggelaten|image omitted|null)$/i.test(r.tekst));
}

function importeer(pad) {
  let txt;
  if (pad.endsWith('.zip')) {
    const map = fs.mkdtempSync('/tmp/wa-export-');
    execFileSync('unzip', ['-o', '-q', pad, '-d', map]);
    const t = fs.readdirSync(map).find((f) => f.endsWith('.txt'));
    if (!t) throw new Error('geen .txt in de zip');
    txt = fs.readFileSync(path.join(map, t), 'utf8');
  } else txt = fs.readFileSync(pad, 'utf8');
  const nieuw = parseExport(txt);
  const bestaand = lees();
  const sleutel = (r) => `${Math.round(r.tijd / 60000)}|${r.van}|${r.tekst.slice(0, 60)}`;
  const gezien = new Set(bestaand.map(sleutel));
  let n = 0;
  const out = [];
  for (const r of nieuw) { const k = sleutel(r); if (gezien.has(k)) continue; gezien.add(k); out.push(JSON.stringify(r)); n += 1; }
  if (out.length) fs.appendFileSync(JSONL, out.join('\n') + '\n');
  console.log(`export: ${nieuw.length} berichten gelezen, ${n} nieuw toegevoegd (totaal ${bestaand.length + n})`);
  const per = {}; for (const r of nieuw) per[r.van] = (per[r.van] || 0) + 1;
  console.log('per persoon:', Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(', '));
  if (nieuw.length) console.log('periode:', new Date(Math.min(...nieuw.map((r) => r.tijd))).toISOString().slice(0, 10), 't/m', new Date(Math.max(...nieuw.map((r) => r.tijd))).toISOString().slice(0, 10));
}

async function sonnet(prompt, maxTokens = 1800) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json();
  if (!j?.content?.[0]?.text) throw new Error('API: ' + JSON.stringify(j).slice(0, 200));
  return j.content[0].text.trim();
}

async function bouwGeheugen() {
  const alles = lees().sort((a, b) => a.tijd - b.tijd);
  if (!alles.length) { console.log('geen geschiedenis'); return; }
  // in blokken van ~400 berichten samenvatten, daarna één eindsamenvatting
  const blokken = [];
  for (let i = 0; i < alles.length; i += 400) blokken.push(alles.slice(i, i + 400));
  const deel = [];
  for (const [i, b] of blokken.entries()) {
    const tekst = b.map((r) => `${new Date(r.tijd).toISOString().slice(0, 10)} ${r.van}: ${String(r.tekst).replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
    deel.push(await sonnet(`Dit is blok ${i + 1}/${blokken.length} uit de interne WhatsApp-groep "Sonty toppers" van zonweringbedrijf Sonty. Maak er een compacte samenvatting van (max 500 woorden) voor het geheugen van Sunny, de AI-collega die in deze groep meepraat: wie zijn de mensen en wat is hun rol/stijl, running gags en bijnamen, opvallende gebeurtenissen (klussen, blunders, feestjes, vakanties, personeelswissels), terugkerende discussies, en dingen waarmee Sunny later persoonlijk en raak kan plagen. GEEN klantnamen, adressen of telefoonnummers overnemen. Gewone tekst met kopjes, geen gedachtestreepjes.\n\n${tekst}`));
    console.log(`blok ${i + 1}/${blokken.length} samengevat`);
  }
  const eind = deel.length === 1 ? deel[0] : await sonnet(`Voeg deze deelsamenvattingen van de WhatsApp-groep "Sonty toppers" samen tot één teamgeheugen (max 1500 woorden) voor Sunny, de AI-collega in de groep. Structuur: 1) Wie is wie (naam, rol, stijl, bijnaam, typische dingen), 2) Running gags en inside jokes, 3) Tijdlijn van memorabele gebeurtenissen, 4) Gevoeligheden om NIET op te grappen. GEEN klantnamen/adressen/telefoonnummers. Gewone tekst met kopjes, geen gedachtestreepjes.\n\n${deel.map((d, i) => `--- deel ${i + 1} ---\n${d}`).join('\n\n')}`, 2500);
  fs.writeFileSync(GEHEUGEN, `# Teamgeheugen Sonty toppers (gebouwd ${new Date().toISOString().slice(0, 10)} uit ${alles.length} berichten, ${new Date(alles[0].tijd).toISOString().slice(0, 10)} t/m ${new Date(alles[alles.length - 1].tijd).toISOString().slice(0, 10)})\n\n${eind}\n`);
  console.log('teamgeheugen geschreven:', GEHEUGEN, eind.length, 'tekens');
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'import' && arg) return importeer(arg);
  if (cmd === 'geheugen') return bouwGeheugen();
  const a = lees();
  console.log(`${a.length} berichten in de geschiedenis${a.length ? ` (${new Date(Math.min(...a.map((r) => r.tijd))).toISOString().slice(0, 10)} t/m ${new Date(Math.max(...a.map((r) => r.tijd))).toISOString().slice(0, 10)})` : ''}; teamgeheugen: ${fs.existsSync(GEHEUGEN) ? 'aanwezig' : 'nog niet gebouwd'}`);
  console.log('gebruik: import <export.txt|.zip> | geheugen | stats');
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
