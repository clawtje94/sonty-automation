// Agent-kern: draait de tool-loop met Claude en geeft een concept-antwoord + acties terug.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const CFG = require('./config.js');
const { buildSystemPrompt } = require('./system-prompt.js');
const { TOOL_DEFS, runTool } = require('./tools.js');

const apiKey = process.env.ANTHROPIC_API_KEY ||
  fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();
const client = new Anthropic({ apiKey });

/**
 * @param {object} gesprek — { kanaal: 'WA'|'EMAIL', klant: {naam, email, phone}, berichten: [{van: 'klant'|'sonty', tekst, tijd}] }
 * @returns {{ antwoord: string, acties: array, toolCalls: array, usage: object }}
 */
async function beantwoord(gesprek) {
  const ctx = {
    acties: [], liveTest: !!gesprek.liveTest, ticketId: gesprek.ticketId || null,
    // Harde eis Daimy: inmeet-doorzetting kan alleen als de offerte-link in dít gesprek gedeeld is
    offerteLinkGedeeld: (gesprek.berichten || []).some(b => b.van === 'sonty' && /document\.reuzenpanda\.nl/.test(b.tekst || '')),
  };
  const toolCalls = [];

  const historie = gesprek.berichten.map(b =>
    (b.van === 'klant' ? 'KLANT' : 'SONTY') + (b.tijd ? ` (${b.tijd})` : '') + ': ' + b.tekst
  ).join('\n\n');

  const messages = [{
    role: 'user',
    content:
      `# Gesprek via ${gesprek.kanaal === 'WA' ? 'WhatsApp' : 'e-mail'}\n` +
      `Klant: ${gesprek.klant?.naam || 'onbekend'} | e-mail: ${gesprek.klant?.email || '-'} | tel: ${gesprek.klant?.phone || '-'}\n\n` +
      `# Gespreksgeschiedenis (oud → nieuw)\n${historie}\n\n` +
      `Het laatste bericht is van de klant. Schrijf jouw antwoord (alleen de tekst die naar de klant gaat, geen aanhalingstekens eromheen).`,
  }];

  let usage = { input_tokens: 0, output_tokens: 0 };

  for (let iter = 0; iter < 8; iter++) {
    const response = await client.messages.create({
      model: CFG.MODEL,
      max_tokens: CFG.MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: buildSystemPrompt(),
      tools: TOOL_DEFS,
      messages,
    });
    usage.input_tokens += response.usage.input_tokens + (response.usage.cache_read_input_tokens || 0) + (response.usage.cache_creation_input_tokens || 0);
    usage.output_tokens += response.usage.output_tokens;

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      const results = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        toolCalls.push({ tool: block.name, input: block.input });
        let out;
        try { out = await runTool(block.name, block.input, ctx); }
        catch (e) { out = JSON.stringify({ error: String(e.message || e) }); }
        results.push({ type: 'tool_result', tool_use_id: block.id, content: out });
      }
      messages.push({ role: 'user', content: results });
      continue;
    }

    if (response.stop_reason === 'refusal') {
      ctx.acties.push({ type: 'escalatie', reden: 'Model weigerde te antwoorden (safety)', urgentie: 'normaal' });
      return { antwoord: null, acties: ctx.acties, toolCalls, usage };
    }

    let tekst = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    // Stille escalatie: klant krijgt niets, gesprek blijft open voor een collega
    if (ctx.stil || tekst === '[STIL]' || /^\[STIL\]$/m.test(tekst)) tekst = null;
    return { antwoord: tekst, acties: ctx.acties, toolCalls, usage };
  }

  ctx.acties.push({ type: 'escalatie', reden: 'Tool-loop limiet bereikt', urgentie: 'normaal' });
  return { antwoord: null, acties: ctx.acties, toolCalls, usage };
}

module.exports = { beantwoord };
