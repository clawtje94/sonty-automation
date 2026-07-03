#!/usr/bin/env node
// Replay-harnas: laat de AI-agent antwoorden op ECHTE historische gesprekken en zet
// het AI-antwoord naast wat het team (Daimy) werkelijk antwoordde. Raakt Trengo niet aan.
//
// Gebruik: node scripts/ai-ks/replay.js [aantal=5] [bron=daimy|alle]
//   bron 'daimy' = data/ks-analyse/daimy-antwoorden.json (goudstandaard, laatste 2 weken)
//   bron 'alle'  = data/ks-analyse/convs-clean.json (hele dataset)
// Output: data/ai-ks/replay-<timestamp>.md — naast elkaar, om te beoordelen.
const fs = require('fs');
const path = require('path');
const { beantwoord } = require('./agent.js');

const N = parseInt(process.argv[2] || '5', 10);
const BRON = process.argv[3] || 'daimy';
const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'ai-ks');

function laadGesprekken() {
  if (BRON === 'daimy') {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'ks-analyse', 'daimy-antwoorden.json'), 'utf8'));
    return d.map(c => ({
      id: c.id, kanaal: 'WA',
      klant: { naam: c.contact, email: null, phone: typeof c.contact === 'string' && c.contact.startsWith('+') ? c.contact : null },
      messages: c.messages.map(m => ({ van: m.type === 'INBOUND' ? 'klant' : 'sonty', tekst: m.body, tijd: m.at })),
    }));
  }
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'ks-analyse', 'convs-clean.json'), 'utf8'));
  return d.filter(c => c.n_in > 0 && c.n_out > 0).map(c => ({
    id: c.id, kanaal: c.channel === 'WA_BUSINESS' ? 'WA' : 'EMAIL',
    klant: { naam: c.contact, email: c.channel === 'EMAIL' ? c.contact : null, phone: c.channel === 'WA_BUSINESS' ? c.contact : null },
    messages: c.messages.map(m => ({ van: m.type === 'INBOUND' ? 'klant' : 'sonty', tekst: m.body, tijd: m.at })),
  }));
}

(async () => {
  const alle = laadGesprekken();
  // Pak gesprekken waar een klantbericht gevolgd wordt door een echt team-antwoord:
  // we knippen het gesprek af NA het klantbericht en laten de AI het team-antwoord "voorspellen".
  const cases = [];
  for (const c of alle) {
    for (let i = 1; i < c.messages.length; i++) {
      if (c.messages[i].van === 'sonty' && c.messages[i - 1].van === 'klant' && c.messages[i].tekst.length > 30) {
        cases.push({ ...c, knip: i });
        break; // één case per gesprek
      }
    }
  }
  // Deterministische spreiding over de dataset
  const stap = Math.max(1, Math.floor(cases.length / N));
  const selectie = cases.filter((_, i) => i % stap === 0).slice(0, N);
  console.log(`${cases.length} bruikbare cases, ${selectie.length} geselecteerd (bron: ${BRON})`);

  const secties = [];
  for (const c of selectie) {
    const historie = c.messages.slice(0, c.knip);
    const echtAntwoord = c.messages[c.knip].tekst;
    console.log(`Case ticket ${c.id}...`);
    let res;
    try {
      res = await beantwoord({ kanaal: c.kanaal, klant: c.klant, berichten: historie.slice(-25) });
    } catch (e) {
      res = { antwoord: 'FOUT: ' + e.message, acties: [], toolCalls: [] };
    }
    secties.push([
      `## Ticket ${c.id} (${c.kanaal}, ${c.klant.naam || 'onbekend'})`,
      `**Laatste klantbericht:**\n> ${historie[historie.length - 1].tekst.substring(0, 600)}`,
      `**Team antwoordde (echt):**\n> ${echtAntwoord.substring(0, 800)}`,
      `**AI-concept:**\n> ${(res.antwoord || '(geen)').replace(/\n/g, '\n> ')}`,
      res.toolCalls.length ? `**Tool-calls:** ${res.toolCalls.map(t => t.tool).join(', ')}` : '',
      res.acties.length ? `**Acties:** ${JSON.stringify(res.acties)}` : '',
    ].filter(Boolean).join('\n\n'));
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `replay-${Date.now()}.md`);
  fs.writeFileSync(outFile, `# AI-KS Replay — ${new Date().toISOString()} (bron: ${BRON})\n\n` + secties.join('\n\n---\n\n'));
  console.log('Geschreven: ' + outFile);
})();
