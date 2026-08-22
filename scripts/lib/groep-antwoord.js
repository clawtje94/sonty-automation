/**
 * SUNNY ANTWOORDT IN DE SONTY TOPPERS-GROEP (Daimy 21-08: "kan je voortaan als iemand in
 * die groep @sunny stuurt daar antwoorden?").
 *
 * Alleen als Sunny echt wordt aangesproken (@-mention, "sunny"/"sonny" in de tekst, of een
 * reactie op een bericht van Sunny). Nooit ongevraagd meepraten. Toon = de weetjesbot:
 * stoere mannen onder elkaar, kort, grappig, plagen mag, nooit gemeen of over de schreef.
 *
 * Veiligheid: nooit politiek/religie/seks/discriminatie, nooit klantnamen of klantgegevens,
 * nooit toezeggingen over werk dat Sunny niet echt doet, geen gedachtestreepjes.
 * Limieten (in wa-luisteraar): max 15 antwoorden per dag, minimaal 40 s tussen twee
 * antwoorden, killswitch data/wa-groep-antwoord-uit.txt.
 *
 * Gebruik los:  node scripts/lib/groep-antwoord.js --proef "Joey: waar zit je joh @Sunny, slaap je?"
 */
const fs = require('fs');
const path = require('path');

const ANTHROPIC_KEY = fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();
const KENNISBANK = path.join(__dirname, '..', '..', 'data', 'trengo-kennisbank.md');
const TEAMINFO = path.join(__dirname, '..', '..', 'data', 'sunny-medewerkers.txt');
const TEAMGEHEUGEN = path.join(__dirname, '..', '..', 'data', 'wa-groep-teamgeheugen.md');
const TEAMROLLEN = path.join(__dirname, '..', '..', 'data', 'sonty-team-rollen.md'); // harde feiten van Daimy, gaan vóór de afgeleide chatkennis // samenvatting van de groepsgeschiedenis (wa-groep-geschiedenis.js)
const GESCHIEDENIS = path.join(__dirname, '..', '..', 'data', 'wa-groep-geschiedenis.jsonl');

/** Namen uit de export ("Boot", "Sjoerd Sonty", "Yudi Joey") koppelen aan de live pushName ("Daimy Boot", "Sjoerd Hoogduin", "~Yudi den Heijer"). */
const ALIAS = { boot: 'daimy', 'sjoerd sonty': 'sjoerd', 'yudi joey': 'yudi', 'jaimy sonty': 'jaimy', 'nanny sonty': 'nanny', 'marvin sonty zzp': 'marvin', 'nick monteur sonty': 'nick', 'tycho sonty': 'tycho' };
function persoonSleutel(naam) {
  const n = String(naam || '').toLowerCase().replace(/^[~\s]+/, '').trim();
  if (ALIAS[n]) return ALIAS[n];
  return n.split(/\s+/)[0] || n;
}
function zelfdePersoon(a, b) { return persoonSleutel(a) && persoonSleutel(a) === persoonSleutel(b); }

/** Oude groepsberichten die bij dit onderwerp/deze persoon passen (simpele woordmatch). */
function relevanteGeschiedenis(tekst, van, max = 12) {
  let regels = [];
  try { regels = fs.readFileSync(GESCHIEDENIS, 'utf8').split('\n').filter(Boolean).map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean); } catch { return []; }
  if (regels.length < 50) return [];
  const woorden = String(tekst || '').toLowerCase().replace(/[^a-zà-ü0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !/^(sunny|sonny|deze|maar|toch|niet|wel|weer|even|gaat|heeft|jullie|zijn|ook|ofzo|joh)$/.test(w));
  const recentGrens = Date.now() - 2 * 86400000;
  const gescoord = regels.filter((r) => r.tijd < recentGrens).map((r) => {
    const t = String(r.tekst || '').toLowerCase();
    let score = 0;
    for (const w of woorden) if (t.includes(w)) score += 2;
    if (van && zelfdePersoon(r.van, van)) score += 1;
    return { r, score };
  }).filter((x) => x.score >= 2).sort((a, b) => b.score - a.score || b.r.tijd - a.r.tijd).slice(0, max);
  const losse = gescoord.map((x) => `${new Date(x.r.tijd).toISOString().slice(0, 10)} ${x.r.van}: ${String(x.r.tekst).slice(0, 200)}`);
  // ook de periode-samenvattingen doorzoeken (rijker dan losse regels): beste 2 passages
  try {
    const delen = Object.values(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'wa-groep-teamgeheugen-delen.json'), 'utf8')));
    const sl = persoonSleutel(van);
    const best = delen.map((d) => {
      const t = String(d).toLowerCase(); let score = 0;
      for (const w of woorden) if (t.includes(w)) score += 2;
      if (sl && t.includes(sl)) score += 1;
      return { d, score };
    }).filter((x) => x.score >= 3).sort((a, b) => b.score - a.score).slice(0, 2);
    for (const x of best) losse.push(`[samenvatting van een periode] ${String(x.d).replace(/\s+/g, ' ').slice(0, 1200)}`);
  } catch { /* nog geen delen */ }
  return losse;
}

const PRODUCTKENNIS = 'Productkennis Sonty (gebruik ALTIJD deze termen): wij verkopen knikarmschermen, uitvalschermen, screens/zipscreens, rolluiken, pergola\'s (hoogwaardig aluminium, op palen), markiezen, horren en raamdecoratie. Zeg NOOIT overkapping, veranda, carport of houten pergola; het heet bij ons een pergola. Doeken zijn waterafstotend, niet waterdicht. Een knikarmscherm hangt aan de gevel zonder palen. Garantie: 3 jaar montage, 5 jaar product, 7 jaar motor. Levertijd na inmeten en aanbetaling: 8 tot 10 weken.';

const PERSONA = `Je bent Sunny, de AI-collega van Sonty (zonwering, Rijswijk). Je zit in de interne WhatsApp-groep "Sonty toppers" met de monteurs, adviseurs en Daimy (de baas). Dit is geen klantcontact: het zijn collega's onder elkaar, stoere mannen, veel geouwehoer.
Wat je ECHT doet bij Sonty (wees hier eerlijk over als het ter sprake komt): je appt en mailt 24/7 met klanten, regelt prijsindicaties en inmeetplanning, beoordeelt foto's uit deze groep voor de marketing, en stuurt 's ochtends de morning motivation en 's avonds het weetje. Je zoekt GEEN personeel, je staat niet in het magazijn en je rijdt geen bus (je hebt een brommer als running gag). Beloof nooit werk dat je niet doet.
Sinds 21 augustus staat er een blauw oog op je profielfoto omdat je de vorige keer te bijdehand was in deze groep; daar mag je zelfspot over maken.
TOON (Daimy 21-08: "zoals Grok in Tesla's, aso antwoorden"): je bent de "unhinged" versie van een collega: sarcastisch, bijdehand, chaotisch grappig, roast-stijl, je editorialiseert over alles en iedereen, je overdrijft flink, je vloekt gerust (kanker NIET, de rest mag: kut, tering, godver, shit, fuck) en je hebt een grote bek. Denk aan een amateur-stand-upcomedian die net te ver gaat, maar dan WEL slim: de punchline moet raak zijn, niet alleen hard. Wie jou aanvalt krijgt het dubbel terug, met een knipoog. Roasts over hun WERK zijn juist de bedoeling en mogen hard (Daimy 21-08: "je had best mogen zeggen: zelfs inmeten kan je niet"): hun inmeetkunsten, montagetempo, koffiepauzes, verkooppraatjes, rijstijl met de bus, telefoon niet opnemen, Mallorca-dromen, de string van Marvin, alles mag. Wees niet braaf, wees scherp. Kort (1 tot 3 zinnen, dit is een appje), 1 of 2 emoji, spreektaal, je-vorm. NOOIT een gedachtestreepje gebruiken, gewoon komma's en punten.
HARDE GRENZEN (ook in aso-modus, hier ga je nooit overheen): nooit politiek, religie, oorlog, seks/seksueel, drugs, discriminatie, ziekte of iets wat op een groep mensen (afkomst, geloof, geaardheid, geslacht, handicap) neerkijkt; het woord kanker nooit; nooit iemands uiterlijk, gezin of privéleven echt kwetsen (plagen over werk, tempo, koffie, de bus, de brommer, Mallorca mag wel); nooit klantnamen, adressen of klantgegevens; nooit bedragen of prijzen uit je hoofd. Wordt er om iets gevraagd dat over de schreef gaat, dan kaats je het met een roast terug zonder erin mee te gaan.
Stelt iemand een ECHTE vraag (garantie, levertijd, product, hoe iets werkt), geef dan naast de grap ook gewoon het juiste antwoord op basis van de kennis hieronder. Weet je het niet zeker: zeg dat eerlijk en verwijs naar Daimy.
Antwoord ALLEEN met de berichttekst die in de groep komt, niets eromheen, geen aanhalingstekens.`;

function leesKennisbank() {
  try { return fs.readFileSync(KENNISBANK, 'utf8').slice(0, 60000); } catch { return ''; }
}

/** Nakijken of het antwoord binnen de grenzen blijft; anders null (dan zwijgt Sunny). */
const VERBODEN = /\b(hitler|nazi|jood|joden|moslim|neger|homo'?s?|flikker|kanker|hoer|verkracht|pedo|islam|wilders|rutte|pvv|vvd|d66|poetin|zelensky|gaza|israel|oekra|palest|abortus|drugs|coke|wiet)\b/i;
function veilig(tekst) {
  const t = String(tekst || '').trim();
  if (!t || t.length > 600) return null;
  if (VERBODEN.test(t)) return null;
  return t.replace(/\s*—+\s*/g, ', ').replace(/^["']|["']$/g, '').trim();
}

/** Is dit bericht aan Sunny gericht? */
function isAanSunny({ tekst, mentionedJids = [], quotedVan = null, eigen = [] }) {
  const t = String(tekst || '');
  if (/(^|[^a-z])@?s[uo]nn?y\b/i.test(t)) return true;
  const nummers = eigen.map((e) => String(e || '').split('@')[0].split(':')[0]).filter(Boolean);
  if (mentionedJids.some((j) => nummers.some((n) => String(j).startsWith(n)) || eigen.includes(j))) return true;
  if (quotedVan && (nummers.some((n) => String(quotedVan).startsWith(n)) || eigen.includes(quotedVan))) return true;
  return false;
}

/**
 * @param {{van:string, tekst:string, context:Array<{van:string,tekst:string}>}} inp
 * @returns {Promise<string|null>} antwoordtekst, of null als Sunny beter kan zwijgen
 */
async function maakGroepAntwoord({ van, tekst, context = [] }) {
  const team = fs.existsSync(TEAMINFO) ? fs.readFileSync(TEAMINFO, 'utf8').trim() : '';
  const rollen = fs.existsSync(TEAMROLLEN) ? fs.readFileSync(TEAMROLLEN, 'utf8').trim() : '';
  const geheugen = fs.existsSync(TEAMGEHEUGEN) ? fs.readFileSync(TEAMGEHEUGEN, 'utf8').trim().slice(0, 12000) : '';
  const oud = relevanteGeschiedenis(tekst, van);
  const historie = context.slice(-20).map((c) => `${c.van}: ${c.tekst}`).join('\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-5', max_tokens: 250,
      system: `${PERSONA}\n\n${PRODUCTKENNIS}${team ? `\n\nTeam-weetjes (voor een plagerige knipoog, nooit gemeen):\n${team}` : ''}${rollen ? `\n\nWIE DOET WAT (harde feiten van Daimy, dit klopt altijd, ook als de chatgeschiedenis iets anders suggereert):\n${rollen}` : ''}${geheugen ? `\n\nTEAMGEHEUGEN (wat er door de jaren heen in deze groep is besproken, wie wie is, running gags; gebruik dit om het persoonlijk en raak te maken):\n${geheugen}` : ''}\n\nDe echte Sonty-kennisbank (feitenbron voor inhoudelijke vragen):\n${leesKennisbank()}`,
      messages: [{ role: 'user', content: `${oud.length ? `Oudere groepsberichten die hierbij passen (voor een persoonlijke verwijzing):\n${oud.join('\n')}\n\n` : ''}Laatste berichten in de groep (oud naar nieuw):\n${historie || '(geen)'}\n\nHet bericht waarin jij wordt aangesproken, van ${van}:\n"""${String(tekst).slice(0, 600)}"""\n\nSchrijf Sunny's antwoord in de groep.` }],
    }),
  });
  const j = await r.json();
  const ruw = ((j?.content || []).find((c) => c.type === 'text')?.text || '').trim();
  if (!ruw) { console.error('groep-antwoord API:', JSON.stringify(j).slice(0, 300)); return null; }
  return veilig(ruw);
}

module.exports = { maakGroepAntwoord, isAanSunny, veilig, relevanteGeschiedenis, PERSONA };

if (require.main === module) {
  (async () => {
    const i = process.argv.indexOf('--proef');
    const vraag = i >= 0 ? process.argv[i + 1] : null;
    if (!vraag) { console.log('gebruik: node groep-antwoord.js --proef "Naam: tekst"'); process.exit(1); }
    const [van, ...rest] = vraag.split(':');
    const context = [
      { van: 'Marvin', tekst: 'Die is verhuisd naar Mallorca sinds vandaag' },
      { van: 'Joey', tekst: 'Lekker zeg' },
      { van: 'Yudi', tekst: 'inclusief magazijnmedewerk(ster)? 👷' },
      { van: 'Joey', tekst: '@Marvin met een string? Met je niet joh 😂' },
    ];
    const uit = await maakGroepAntwoord({ van: van.trim(), tekst: rest.join(':').trim(), context });
    console.log(uit === null ? '(Sunny zwijgt)' : uit);
  })();
}
