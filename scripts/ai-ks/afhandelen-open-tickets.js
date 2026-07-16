#!/usr/bin/env node
// Eenmalige afhandeling van ALLE open WhatsApp-tickets (opdracht Daimy 2026-07-16:
// "wil je die 20 gesprekken afhandelen aub, en daarna weer uitzetten, wel blijven
// antwoorden als de betreffende persoon een vraag stelt, geen Sonny-intro").
//
// Werkwijze: registreert elk open WA-ticket in data/ai-ks/actieve-tickets.json en laat
// de daemon ze één voor één verwerken (node daemon.js --ticket <id>). De daemon antwoordt
// dan live als Jaimy (actief-gesprek-pad), of doet niets als het laatste bericht al van
// ons is, en escaleert stil bij klachten/foto's/twijfel.
// LET OP: draai dit NIET terwijl de watch-daemon loopt (dubbel-antwoord-risico).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CFG = require('./config.js');

const TT = fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim();
const TH = { Authorization: 'Bearer ' + TT };
const ACTIEF_FILE = path.join(path.dirname(CFG.POLL_STATE_FILE), 'actieve-tickets.json');

(async () => {
  if (require('child_process').execSync('ps aux | grep "[d]aemon.js --watch" | wc -l').toString().trim() !== '0') {
    console.error('STOP: er draait nog een watch-daemon. Eerst pkill -f "daemon.js --watch".');
    process.exit(1);
  }

  // 1. Alle open WhatsApp-tickets ophalen (alle pagina's)
  const open = [];
  for (let page = 1; page <= 30; page++) {
    const res = await fetch('https://app.trengo.com/api/v2/tickets?page=' + page, { headers: TH });
    if (!res.ok) break;
    const data = await res.json();
    open.push(...(data.data || []).filter(t => t.status === 'OPEN' && (t.channel?.id === CFG.WA_CHANNEL_ID || t.channel?.type === 'WA_BUSINESS')));
    if (!data.links?.next) break;
  }
  console.log(`Open WhatsApp-tickets gevonden: ${open.length}`);

  // 2. Registreren als actieve (AI-beheerde) gesprekken
  let actief = {};
  try { actief = JSON.parse(fs.readFileSync(ACTIEF_FILE, 'utf8')); } catch {}
  for (const t of open) {
    if (!actief[t.id]) actief[t.id] = { sinds: new Date().toISOString(), klant: t.contact?.full_name || t.contact?.phone || null, bron: 'batch-2026-07-16' };
  }
  fs.mkdirSync(path.dirname(ACTIEF_FILE), { recursive: true });
  fs.writeFileSync(ACTIEF_FILE, JSON.stringify(actief, null, 1));
  console.log(`Geregistreerd in actieve-tickets.json: ${Object.keys(actief).length} tickets`);

  // 3. Eén voor één door de daemon laten verwerken (sequentieel, met korte pauze)
  let i = 0;
  for (const t of open) {
    i++;
    console.log(`\n[${i}/${open.length}] ticket ${t.id} (${t.contact?.full_name || t.contact?.phone || 'onbekend'})`);
    try {
      const out = execFileSync('node', [path.join(__dirname, 'daemon.js'), '--ticket', String(t.id)], { encoding: 'utf8', timeout: 300000 });
      process.stdout.write(out.split('\n').filter(l => l.includes('→') || l.includes('agent draait') || l.includes('FOUT')).map(l => '  ' + l).join('\n') + '\n');
    } catch (e) {
      console.error(`  FOUT bij ticket ${t.id}: ${String(e.message || e).slice(0, 200)}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('\nBatch klaar.');
})();
