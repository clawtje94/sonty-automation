#!/usr/bin/env node
// Sunny-testbank: draait gesimuleerde klantgesprekken tegen het Sunny-brein
// (zelfde prompt + kennisbank + prijs-tool als de ElevenLabs-agent) en beoordeelt
// elk gesprek automatisch. Kernprincipe (Daimy 2026-07-24): perfect helpen of
// correct doorsturen; een fout antwoord weegt zwaarder dan een doorverwijzing.
// Gebruik: node scripts/sunny-testbank.js [aantal] [offset]
const fs = require('fs');
const path = require('path');

const KEY = process.env.ANTHROPIC_API_KEY || fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
const SUNNY_MODEL = 'claude-sonnet-4-5';
const SIM_MODEL = 'claude-haiku-4-5-20251001';
const AANTAL = parseInt(process.argv[2] || '10');
const OFFSET = parseInt(process.argv[3] || '0');

const SUNNY_PROMPT = fs.readFileSync(path.join(__dirname, '..', 'data', 'sunny-prompt.txt'), 'utf8');
const KENNISBANK = fs.readFileSync(path.join(__dirname, '..', 'data', 'trengo-kennisbank.md'), 'utf8');
const VRAGENBESTAND = process.env.VRAGEN_BESTAND || 'sunny-testvragen.json';
const VRAGEN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', VRAGENBESTAND), 'utf8'));

async function claude(model, system, messages, tools) {
  const body = { model, max_tokens: 700, system, messages };
  if (tools) body.tools = tools;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.error) throw new Error(model + ': ' + JSON.stringify(j.error).slice(0, 200));
  return j;
}

const PRIJS_TOOL = [{
  name: 'prijs_berekenen',
  description: 'Berekent de actuele Sonty-prijs (product+montage, incl btw). product: rolluikS37, rolluikS42, screenSquare85100, zipSquare85100, suneye, sunbasic, suneyeXL, sunelite, suncube150, sunproject100, suncontrol150. breedte/hoogte in mm (hoogte = uitval bij knikarm/veranda). bediening: io, draaischakelaar, solar, handbediend.',
  input_schema: { type: 'object', properties: {
    product: { type: 'string' }, breedte: { type: 'number' }, hoogte: { type: 'number' }, bediening: { type: 'string' } },
    required: ['product', 'breedte', 'hoogte'] },
}];

async function prijsBerekenen(inp) {
  const u = `https://sonty-website.vercel.app/api/offerte-tool?action=prijs&product=${encodeURIComponent(inp.product)}&breedte=${inp.breedte}&hoogte=${inp.hoogte}&bediening=${encodeURIComponent(inp.bediening || 'io')}`;
  const r = await fetch(u);
  const j = await r.json();
  return { totaal: j.totaal, boekprijs: j.boekprijs, montagePrijs: j.montagePrijs, error: j.error || null };
}

async function sunnyBeurt(messages) {
  const system = SUNNY_PROMPT + '\n\n=== KENNISBANK ===\n' + KENNISBANK;
  let resp = await claude(SUNNY_MODEL, system, messages, PRIJS_TOOL);
  const toolCalls = [];
  while (resp.stop_reason === 'tool_use') {
    const assistantContent = resp.content;
    const results = [];
    for (const c of resp.content) {
      if (c.type === 'tool_use') {
        const uit = await prijsBerekenen(c.input);
        toolCalls.push({ input: c.input, output: uit });
        results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(uit) });
      }
    }
    messages = [...messages, { role: 'assistant', content: assistantContent }, { role: 'user', content: results }];
    resp = await claude(SUNNY_MODEL, system, messages, PRIJS_TOOL);
  }
  const tekst = resp.content.filter(c => c.type === 'text').map(c => c.text).join(' ').trim();
  return { tekst, toolCalls, messages: [...messages, { role: 'assistant', content: resp.content }] };
}

async function draaiGesprek(tc) {
  const transcript = [{ rol: 'sunny', tekst: 'Hoi, je spreekt met Bas van Sonty. Waar kan ik je mee helpen?' }];
  const alleTools = [];
  let sunnyMsgs = [{ role: 'user', content: '[De klant belt. Jij nam op met: "Hoi, je spreekt met Bas van Sonty. Waar kan ik je mee helpen?" De klant zegt:] ' }];
  let klantMsgs = [{ role: 'user', content: 'De assistent zegt: "Hoi, je spreekt met Bas van Sonty. Waar kan ik je mee helpen?" Wat zeg jij?' }];
  const klantSysteem = `Je bent een Nederlandse klant die Sonty (zonwering) belt. Jouw doel: ${tc.vraag}.${tc.persona ? ' Jouw karakter en gedrag: ' + tc.persona + '.' : ''} Praat natuurlijk en kort (1-2 zinnen), soms wat vaag zoals echte bellers. Stel hoogstens 2 relevante vervolgvragen (bv. doorvragen op prijs, garantie of vervolgstappen). Als je geholpen bent, rond je af. Antwoord ALLEEN met wat je zegt. Als het gesprek klaar is, antwoord exact: EINDE`;

  let eerste = true;
  for (let beurt = 0; beurt < 5; beurt++) {
    const kResp = await claude(SIM_MODEL, klantSysteem, klantMsgs);
    const klantTekst = kResp.content.filter(c => c.type === 'text').map(c => c.text).join(' ').trim();
    if (/^EINDE/i.test(klantTekst)) break;
    transcript.push({ rol: 'klant', tekst: klantTekst });
    klantMsgs.push({ role: 'assistant', content: klantTekst });

    if (eerste) { sunnyMsgs[0].content += klantTekst; eerste = false; }
    else sunnyMsgs.push({ role: 'user', content: klantTekst });
    const s = await sunnyBeurt(sunnyMsgs);
    sunnyMsgs = s.messages;
    alleTools.push(...s.toolCalls);
    transcript.push({ rol: 'sunny', tekst: s.tekst });
    klantMsgs.push({ role: 'user', content: 'De assistent zegt: "' + s.tekst + '" Wat zeg jij? (of EINDE)' });
  }
  return { transcript, toolCalls: alleTools };
}

function hardeChecks(transcript) {
  const fouten = [];
  const sunnyTeksten = transcript.filter(t => t.rol === 'sunny').map(t => t.tekst);
  const alles = sunnyTeksten.join('\n');
  if (/(^|[^bBnNjJ])\bu\b(?![-\w])/.test(alles.replace(/\bU\b/g, 'u'))) {
    const m = alles.match(/[^.!?]*(^|[\s"])u[\s,.!?][^.!?]*/);
    if (m && !/menu|paraplu/i.test(m[0])) fouten.push('Mogelijke u-vorm: "' + m[0].trim().slice(0, 80) + '"');
  }
  const telCount = (alles.match(/085\s?006\s?9681|0850069681/g) || []).length;
  if (telCount > 1) fouten.push(`Telefoonnummer ${telCount}x genoemd (max 1x)`);
  if (/gratis inmeting|gratis inmeet/i.test(alles) && !/akkoord/i.test(alles)) fouten.push('"gratis inmeting" zonder akkoord-voorwaarde');
  const zinnen = alles.split(/[.!?]\s+/).map(z => z.trim().toLowerCase()).filter(z => z.length > 25);
  const dubbel = zinnen.filter((z, i) => zinnen.indexOf(z) !== i);
  if (dubbel.length) fouten.push('Herhaalde zin: "' + dubbel[0].slice(0, 70) + '"');
  return fouten;
}

async function beoordeel(tc, transcript, toolCalls) {
  const txt = transcript.map(t => (t.rol === 'sunny' ? 'BAS: ' : 'KLANT: ') + t.tekst).join('\n');
  const toolTxt = toolCalls.map(t => `tool ${JSON.stringify(t.input)} → ${JSON.stringify(t.output)}`).join('\n') || 'geen';
  const vraag = `Beoordeel dit telefoongesprek van Bas, de AI-assistent van Sonty (zonwering, Rijswijk).

KERNPRINCIPE: Sunny moet de klant PERFECT helpen OF warm doorverwijzen naar een collega/085 006 9681/showroom. Netjes doorverwijzen bij twijfel is GOED. Een fout of half antwoord is een ZWARE fout.

HARDE FEITEN om op te controleren:
- Proces: prijsindicatie → akkoord → gratis inmeten → harde offerte → akkoord → aanbetalingsfactuur 40% → bestelling (8-10 wkn) → montage → restbedrag na montage. Elke andere volgorde = zware fout.
- Garantie: 3 jaar montage, 5 jaar product, 7 jaar motor.
- Inmeten: gratis alleen bij akkoord, anders 75 euro.
- Werkgebied: 60 km vanaf Rijswijk, >€7500 tot 125 km.
- Prijzen mogen ALLEEN uit de prijs-tool komen (zie tool-log). Elk genoemd bedrag zonder tool = zware fout. Let op: toolprijzen ZIJN totaalprijzen inclusief montage en btw, dus "inclusief montage" zeggen bij een toolprijs is CORRECT. Afronden op tientjes is prima.
- Identieke exemplaren: toolbedrag per stuk × aantal als INDICATIE noemen is TOEGESTAAN, mits gezegd wordt dat het exacte totaal in de offerte komt. Verschillende formaten moeten elk apart in de tool-log staan.
- Kortingen of acties noemen/beloven = altijd zware fout. Garantie anders dan 3/5/7 = zware fout. Inmeten aanbieden vóór akkoord op prijsindicatie = zware fout.
- Bestaande klanten met een lopend dossier (verkeerde inmeting, wijziging, klacht over bestelling): Bas hoort dit NIET zelf op te lossen maar door te verwijzen; zelf oplossen of prijzen noemen = zware fout.
- Toon: je-vorm, kort, vriendelijk, geen herhaling.

TOOL-LOG:
${toolTxt}

GESPREK:
${txt}

BEOORDEEL EERLIJK, NIET OVERDREVEN STRENG:
- Een bedrag dat hoogstens 15 euro afwijkt van een toolwaarde in de tool-log is gewoon dat toolresultaat (afgerond) en dus CORRECT.
- Meerprijzen van opties die letterlijk in de Sonty-kennisbank staan (bv. windsensor) mag Bas noemen als "meerprijs vanaf"; dat is GEEN fout, zolang ze niet zelf totalen optelt.
- Als het gesprek stopt doordat de KLANT afrondt of ophangt terwijl Sunny net een correct vervolg aanbood (bv. "zal ik het uitrekenen?"), reken dat Bas NIET aan.

Antwoord ALLEEN met JSON: {"cijfer": 1-10, "zware_fouten": ["..."], "kleine_punten": ["..."], "doorverwezen": true/false, "oordeel": "één zin"}`;
  const r = await claude(SIM_MODEL, 'Je bent een strenge maar eerlijke kwaliteitsbeoordelaar.', [{ role: 'user', content: vraag }]);
  const t = r.content.filter(c => c.type === 'text').map(c => c.text).join('');
  const m = t.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : { cijfer: 0, zware_fouten: ['judge-parse-fout'], kleine_punten: [], oordeel: t.slice(0, 100) };
}

(async () => {
  const selectie = VRAGEN.slice(OFFSET, OFFSET + AANTAL);
  const resultaten = [];
  for (const [i, tc] of selectie.entries()) {
    process.stderr.write(`\r[${i + 1}/${selectie.length}] ${tc.categorie}: ${tc.vraag.slice(0, 60)}...        `);
    try {
      const { transcript, toolCalls } = await draaiGesprek(tc);
      const hard = hardeChecks(transcript);
      const judge = await beoordeel(tc, transcript, toolCalls);
      resultaten.push({ tc, transcript, toolCalls, hardeFouten: hard, judge });
    } catch (e) {
      resultaten.push({ tc, fout: e.message.slice(0, 200) });
    }
  }
  process.stderr.write('\n');
  const dir = path.join(__dirname, '..', 'data', 'sunny-testbank');
  fs.mkdirSync(dir, { recursive: true });
  const bestand = path.join(dir, `run-${Date.now()}.json`);
  fs.writeFileSync(bestand, JSON.stringify(resultaten, null, 1));

  const ok = resultaten.filter(r => r.judge && r.judge.cijfer >= 8 && !r.hardeFouten?.length && !(r.judge.zware_fouten || []).length);
  const zwaar = resultaten.filter(r => (r.judge?.zware_fouten || []).length || r.fout);
  console.log(`\n=== SUNNY TESTBANK: ${resultaten.length} gesprekken ===`);
  console.log(`Goed (cijfer 8+, geen fouten): ${ok.length} | met zware fouten: ${zwaar.length} | gemiddeld cijfer: ${(resultaten.reduce((s, r) => s + (r.judge?.cijfer || 0), 0) / resultaten.length).toFixed(1)}`);
  for (const r of resultaten) {
    const status = r.fout ? 'CRASH' : (r.judge.zware_fouten || []).length || r.hardeFouten.length ? 'FOUT' : r.judge.cijfer >= 8 ? 'OK' : 'MATIG';
    console.log(`\n[${status}] (${r.judge?.cijfer ?? '-'}) ${r.tc.categorie} | ${r.tc.vraag.slice(0, 80)}`);
    if (r.fout) { console.log('   crash:', r.fout); continue; }
    for (const f of r.judge.zware_fouten || []) console.log('   ZWAAR:', f);
    for (const f of r.hardeFouten) console.log('   HARD :', f);
    for (const f of (r.judge.kleine_punten || []).slice(0, 2)) console.log('   klein:', f);
  }
  console.log('\nVolledige transcripts:', bestand);
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
