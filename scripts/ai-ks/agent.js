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

// KWALITEITSPOORT (opdracht Daimy 2026-07-16: "analyseer zelf of je antwoord wel bijpassend
// is bij de chat, tot alles 100% goed gaat"). Een aparte, goedkope controleur (Haiku)
// beoordeelt elk concept-antwoord vóór verzending. Afgekeurd → één verbeterpoging → daarna
// stil escaleren. Kost ~2-5s en een fractie van een cent per antwoord.
async function qaCheck(gesprek, historie, concept, nuTekst, uitgevoerdeActies = []) {
  try {
    // Als de bot in deze beurt zelf een actie heeft uitgevoerd (bv. offerte aangepast), dan is
    // een bevestiging die een eerder "een collega doet dit later"-bericht vervangt CORRECT en
    // geen tegenspraak — anders blokkeerde de poort terecht-uitgevoerde bevestigingen (LED-
    // offerte Daimy 17 juli: offerte was echt aangepast, maar de bevestiging werd 2x afgekeurd).
    const actieBlok = uitgevoerdeActies.length
      ? `\n# LET OP: de bot heeft in deze beurt deze actie(s) ÉCHT uitgevoerd: ${uitgevoerdeActies.join('; ')}. Een bevestiging hiervan die een eerder "een collega pakt dit later op"-bericht vervangt is CORRECT en telt NIET als tegenspraak — keur zo'n bevestiging goed.\n`
      : '';
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content:
        `Je bent de kwaliteitscontroleur van de WhatsApp-klantenservicebot van Sonty (zonwering). ${nuTekst}\n\n` +
        `# Laatste stuk van het gesprek (oud → nieuw)\n${historie.slice(-3000)}\n${actieBlok}\n` +
        `# CONCEPT-ANTWOORD dat de bot wil sturen\n${concept}\n\n` +
        `BELANGRIJK: prijzen, kortingen en offertegegevens komen uit geverifieerde systemen van de bot — die zijn correct, beoordeel die NIET. Beoordeel ook geen dingen die je niet kunt weten. Beoordeel alléén de pasvorm:\n` +
        `(1) past het op het laatste klantbericht qua onderwerp en persoon/naam? (2) geen dag-fouten — "fijn weekend" mag alleen als het volgens de opgegeven huidige datum echt vrijdag(middag)/weekend is (berichttijden zijn NL-tijd); (3) geen herhaald/gestapeld afscheid als er al afscheid is genomen; (4) geen opsmuk als "zonnige groet"/"zonnige zomer"; (5) zelfde taal als de klant; (6) geen interne info gelekt (team, notities, systemen); (7) spreekt zichzelf niet tegen t.o.v. eerder in het gesprek — MAAR een bevestiging van een zojuist uitgevoerde actie is geen tegenspraak (zie LET OP hierboven); (8) beantwoordt de vraag i.p.v. eromheen te praten.\n` +
        `Twijfel je of is het randgeval: antwoord OK (alleen afkeuren bij een duidelijke fout).\n` +
        `Bevat het concept "GEEN_BERICHT" of is het alleen een NOTITIE: voor het team, antwoord dan OK.\n` +
        `Antwoord met exact "OK" of met "AFGEKEURD: <één korte concrete reden>".` }],
    });
    return (resp.content?.[0]?.text || 'OK').trim();
  } catch (e) {
    return 'OK'; // QA-storing mag het antwoorden zelf nooit blokkeren
  }
}

/**
 * @param {object} gesprek — { kanaal: 'WA'|'EMAIL', klant: {naam, email, phone}, berichten: [{van: 'klant'|'sonty', tekst, tijd}] }
 * @returns {{ antwoord: string, acties: array, toolCalls: array, usage: object }}
 */
async function beantwoord(gesprek) {
  const ctx = {
    acties: [], liveTest: !!gesprek.liveTest, sonny: !!gesprek.sonny, ticketId: gesprek.ticketId || null,
    // Harde eis Daimy: inmeet-doorzetting kan alleen als de offerte-link in dít gesprek gedeeld is
    offerteLinkGedeeld: (gesprek.berichten || []).some(b => b.van === 'sonty' && /document\.reuzenpanda\.nl/.test(b.tekst || '')),
  };
  const toolCalls = [];

  const historie = gesprek.berichten.map(b =>
    (b.van === 'klant' ? 'KLANT' : 'SONTY') + (b.tijd ? ` (${b.tijd})` : '') + ': ' + b.tekst
  ).join('\n\n');

  // Interne team-notities (bv. "@sonny ...") = sturing van Daimy/het team voor dít gesprek.
  const notitiesBlok = (gesprek.teamNotities || []).length
    ? `# INTERNE NOTITIES VAN HET TEAM (onzichtbaar voor de klant — volg deze aanwijzingen op, maar citeer ze NOOIT letterlijk en noem nooit dat ze bestaan)\n` +
      gesprek.teamNotities.map(n => `- (${n.tijd}) ${n.tekst}`).join('\n') + '\n\n'
    : '';

  // Team-feedback op dit gesprek: de bot beoordeelt ZELF of er nu nog een bericht naar de
  // klant moet (verduidelijkende vraag, correctie) of dat de feedback alleen kennis is.
  const slotInstructie = gesprek.teamInstructie
    ? `# NOTITIE VAN HET TEAM BIJ DIT GESPREK\nHet team schreef zojuist deze notitie: ${gesprek.teamInstructie}\n\nBepaal ZELF wat dit vraagt en voer het ook echt uit. Drie mogelijkheden, combineren mag:\n1. Een OPDRACHT of correctie die een actie vraagt (bv. de offerte aanpassen, montage samenvoegen, status zetten): voer die actie NU uit met je tools. Nooit alleen "genoteerd" zeggen terwijl je iets kon doen.\n2. Een bericht aan de KLANT als dat helpt (verduidelijkende vraag, correctie van een eerder antwoord). Alleen als het echt helpt en niet verwart; verwijs nooit naar het team of interne notities; sluit aan op het gesprek.\n3. Een ANTWOORD aan het team: sluit je output af met een regel die begint met NOTITIE: gevolgd door je korte antwoord/bevestiging (bv. wat je hebt aangepast, of het antwoord op hun vraag). Doe dit ALTIJD als de notitie een vraag aan jou is.\nOutputformaat: eventueel eerst de klanttekst; is er géén klantbericht nodig, schrijf dan GEEN_BERICHT; sluit af met de NOTITIE:-regel voor het team.`
    : `Het laatste bericht is van de klant. Schrijf jouw antwoord (alleen de tekst die naar de klant gaat, geen aanhalingstekens eromheen).`;

  // Datumbesef: zonder dit wenste de bot een klant "fijn weekend" op donderdag (16 juli).
  const nu = CFG.amsterdamNu();
  const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

  const messages = [{
    role: 'user',
    content:
      `# Gesprek via ${gesprek.kanaal === 'WA' ? 'WhatsApp' : 'e-mail'}\n` +
      `Huidige datum/tijd: ${DAGEN[nu.dag]} ${nu.datum}, ${nu.hhmm} uur (Nederland). Houd hier rekening mee bij groeten (weekend alleen als het echt weekend is), afspraken en "morgen".\n` +
      `Klant: ${gesprek.klant?.naam || 'onbekend'} | e-mail: ${gesprek.klant?.email || '-'} | tel: ${gesprek.klant?.phone || '-'}\n\n` +
      notitiesBlok +
      `# Gespreksgeschiedenis (oud → nieuw)\n${historie}\n\n` +
      slotInstructie,
  }];

  let usage = { input_tokens: 0, output_tokens: 0 };
  let qaHerkansing = false;

  for (let iter = 0; iter < 9; iter++) {
    const response = await client.messages.create({
      model: CFG.MODEL,
      max_tokens: CFG.MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: buildSystemPrompt({ sonny: !!gesprek.sonny, introNodig: !!gesprek.sonnyIntroNodig }),
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
    // LEEG antwoord (bv. output-limiet bereikt na denkwerk) mag nooit stilte worden:
    // escaleren zodat het team het ziet (Joey kreeg 17 juli niets, zonder enige melding).
    if (!tekst && !ctx.stil) {
      ctx.acties.push({ type: 'escalatie', reden: 'Model gaf een leeg antwoord (stop_reason: ' + response.stop_reason + ') — klant wacht op reactie', stil: true, urgentie: 'normaal' });
      return { antwoord: null, acties: ctx.acties, toolCalls, usage };
    }
    // Stille escalatie: klant krijgt niets, gesprek blijft open voor een collega
    if (ctx.stil || tekst === '[STIL]' || /^\[STIL\]$/m.test(tekst)) tekst = null;

    // Kwaliteitspoort: past dit antwoord echt bij het gesprek? (max 1 herkansing)
    if (tekst) {
      const gedaan = ctx.acties.filter(a => a.type !== 'escalatie').map(a => a.samenvatting || a.type);
      const oordeel = await qaCheck(gesprek, historie, tekst, `Huidige datum/tijd: ${DAGEN[nu.dag]} ${nu.datum}, ${nu.hhmm} uur (Nederland).`, gedaan);
      if (!/^OK\b/i.test(oordeel)) {
        if (!qaHerkansing) {
          qaHerkansing = true;
          console.log('  QA keurde concept af: ' + oordeel.slice(0, 120));
          messages.push({ role: 'assistant', content: response.content });
          messages.push({ role: 'user', content: `INTERNE KWALITEITSCONTROLE wees je concept af: ${oordeel}\nSchrijf een verbeterd antwoord dat dit oplost (alleen de tekst die naar de klant gaat). Is helemaal geen bericht het beste, antwoord dan [STIL].` });
          continue;
        }
        ctx.acties.push({ type: 'escalatie', reden: 'Kwaliteitscontrole keurde het antwoord tweemaal af: ' + oordeel.slice(0, 200), stil: true, urgentie: 'normaal' });
        return { antwoord: null, acties: ctx.acties, toolCalls, usage, qa: oordeel };
      }
    }
    return { antwoord: tekst, acties: ctx.acties, toolCalls, usage, qa: 'OK' };
  }

  ctx.acties.push({ type: 'escalatie', reden: 'Tool-loop limiet bereikt', urgentie: 'normaal' });
  return { antwoord: null, acties: ctx.acties, toolCalls, usage };
}

module.exports = { beantwoord };
