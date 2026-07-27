#!/usr/bin/env node
/**
 * STIJLCONTROLE op de e-mailsjablonen (Daimy 2026-07-27: "geen AI-slop, het moet Sonty ademen").
 *
 * Controleert de leesbare tekst van elk sjabloon tegen de regels in STIJL.md. Die regels komen
 * niet uit de lucht vallen: ze staan al in de systeemprompt van de AI-klantenservice en zijn
 * daar door Daimy stuk voor stuk aangescherpt. Wat voor WhatsApp geldt, geldt hier ook.
 *
 * Draait automatisch mee na het bouwen van de sjablonen. Faalt hij, dan gaat er niets naar
 * Klaviyo tot de tekst klopt.
 *
 * Gebruik: node scripts/email/stijlcheck.js
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');

/** Haalt de leesbare tekst uit de html, zonder stijlblokken, links en variabelen. */
function leesbareTekst(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')     // Klaviyo-variabelen tellen niet mee
    .replace(/\{%[\s\S]*?%\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VERBODEN_FRASEN = [
  'dat waardeer ik', 'dat waarderen we', 'wij waarderen', 'ik waardeer',
  'dank voor je bericht', 'bedankt voor uw bericht', 'hartelijk dank voor',
  'aarzel niet', 'neem gerust contact op met ons team', 'wij staan voor u klaar',
  'graag informeren wij', 'wij willen u graag', 'geheel vrijblijvend en zonder verplichting',
  'in de huidige tijd', 'het is ons een genoegen', 'wij hopen u hiermee voldoende',
  'droomterras', 'genieten van de zon', 'zonnige groet', 'heerlijk genieten',
];

// Een gedachtestreepje tussen zinsdelen: streepje met spaties eromheen, of een em-dash.
const GEDACHTESTREEPJE = /(\s[—–]\s|\s-\s)/g;
// Emoji-bereiken. Sterren (★) staan bewust NIET in deze lijst: die gebruiken we als
// grafisch element bij de review, niet als smiley.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{2604}\u{FE0F}]/gu;

let fouten = 0;
const bestanden = fs.readdirSync(DIST).filter((f) => f.endsWith('.html'));

console.log('Stijlcontrole op ' + bestanden.length + ' sjablonen\n');

for (const bestand of bestanden) {
  const ruw = fs.readFileSync(path.join(DIST, bestand), 'utf8');
  // De <title> telt niet mee: die ziet een klant nooit.
  const tekst = leesbareTekst(ruw.replace(/<title>[\s\S]*?<\/title>/gi, ' '));
  const meldingen = [];

  const streepjes = tekst.match(GEDACHTESTREEPJE) || [];
  if (streepjes.length) {
    // Toon de context, anders is het zoeken naar een speld
    const plek = tekst.search(GEDACHTESTREEPJE);
    meldingen.push(`${streepjes.length}x gedachtestreepje, bv: "...${tekst.slice(Math.max(0, plek - 40), plek + 40)}..."`);
  }

  const emojis = tekst.match(EMOJI) || [];
  if (emojis.length) meldingen.push(`${emojis.length}x emoji: ${[...new Set(emojis)].join(' ')}`);

  for (const frase of VERBODEN_FRASEN) {
    if (tekst.toLowerCase().includes(frase)) meldingen.push(`verboden frase: "${frase}"`);
  }

  // Zinslengte meten we alleen op echte lopende tekst uit de alinea's. Op de volledige,
  // aan elkaar geplakte tekst lijken losse labels en bijschriften samen één eindeloze zin,
  // en dan meldt de controle problemen die er niet zijn.
  const alineas = [...ruw.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => leesbareTekst(m[1]));
  const zinnen = alineas.flatMap((a) => a.split(/(?<=[.!?])\s+/)).filter((z) => z.trim().length > 12);
  const teLang = zinnen.filter((z) => z.split(/\s+/).length > 30);
  if (teLang.length) meldingen.push(`${teLang.length} zin(nen) langer dan 30 woorden: "${teLang[0].slice(0, 100)}..."`);

  if (meldingen.length) {
    fouten += meldingen.length;
    console.log(`  ${bestand}`);
    for (const m of meldingen) console.log(`     ${m}`);
  } else {
    console.log(`  ${bestand}  in orde`);
  }
}

console.log('');
if (fouten) {
  console.error(`${fouten} stijlprobleem(en). Zie scripts/email/STIJL.md.`);
  process.exit(1);
}
console.log('Alle sjablonen voldoen aan de Sonty-schrijfstijl.');
