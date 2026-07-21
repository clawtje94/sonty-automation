// Dagelijkse zelfverbetering van de klantenservice-bot (vraag Daimy 21 juli:
// "leert die QA-poort zich ook te verbeteren?").
// Leest de QA-afkeuringen van de afgelopen 7 dagen (qa-afkeuringen.jsonl, gelogd door agent.js),
// laat Sonnet er terugkerende patronen uit destilleren die nog niet in leerpunten.md staan, en
// schrijft die als leerpunt in leerpunten.md (komt per direct in de system-prompt van de bot).
// Elk nieuw leerpunt wordt op Telegram aan Daimy gemeld, zodat hij kan ingrijpen bij onzin.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const CFG = require('./config.js');

const DATA = path.join(__dirname, '..', '..', 'data', 'ai-ks');
const QA_LOG = path.join(DATA, 'qa-afkeuringen.jsonl');
const LEERPUNTEN = path.join(DATA, 'leerpunten.md');
const MIN_AFKEURINGEN = 3; // onder dit aantal valt er niets zinnigs te leren

const apiKey = process.env.ANTHROPIC_API_KEY ||
  fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();

async function telegram(tekst) {
  const token = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: tekst }),
  }).catch(() => {});
}

async function main() {
  let regels = [];
  try { regels = fs.readFileSync(QA_LOG, 'utf8').trim().split('\n').map(r => JSON.parse(r)); } catch {}
  const grens = Date.now() - 7 * 86400000;
  const recent = regels.filter(r => Date.parse(r.ts) > grens);
  if (recent.length < MIN_AFKEURINGEN) { console.log(`Slechts ${recent.length} QA-afkeuringen in 7 dagen — niets te leren.`); return; }

  const bestaand = (() => { try { return fs.readFileSync(LEERPUNTEN, 'utf8'); } catch { return ''; } })();
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: 'claude-sonnet-5', max_tokens: 600,
    messages: [{ role: 'user', content:
      `Je verbetert een WhatsApp/e-mail-klantenservicebot van Sonty (zonwering). De interne kwaliteitscontrole keurde de afgelopen 7 dagen deze concept-antwoorden af:\n\n` +
      recent.map(r => `- [${r.ts.slice(0, 10)}${r.definitief ? ', 2x afgekeurd' : ''}] REDEN: ${r.oordeel}\n  CONCEPT: ${r.concept.slice(0, 200)}`).join('\n') +
      `\n\n# Bestaande leerpunten van de bot (NIET herhalen)\n${bestaand.slice(-4000)}\n\n` +
      `Zoek naar TERUGKERENDE patronen (minimaal 2 keer hetzelfde soort probleem) die nog NIET door een bestaand leerpunt gedekt worden. Formuleer per patroon één kort, imperatief leerpunt voor de bot (zoals de bestaande leerpunten geformuleerd zijn), maximaal 3 leerpunten. Alleen patronen waar de bot zelf iets aan kan doen; geen vage stijladviezen. Is er geen echt terugkerend nieuw patroon: antwoord exact "GEEN".\nAntwoord uitsluitend met de leerpunt-regels zelf (één per regel, beginnend met "- ") of "GEEN".` }],
  });
  const uit = (resp.content?.[0]?.text || '').trim();
  if (/^GEEN\b/i.test(uit) || !uit.startsWith('-')) { console.log('Geen nieuwe patronen gevonden.'); return; }

  const datum = CFG.amsterdamNu().datum;
  fs.appendFileSync(LEERPUNTEN, `\n\n## ${datum} — automatisch geleerd uit QA-afkeuringen (${recent.length} afkeuringen bekeken)\n${uit}\n`);
  console.log('Nieuwe leerpunten toegevoegd:\n' + uit);
  await telegram(`QA-leerlus: de bot heeft vandaag uit ${recent.length} QA-afkeuringen dit geleerd (staat nu in zijn leerpunten, verwijder het uit data/ai-ks/leerpunten.md als het onzin is):\n${uit}`);
}

main().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
