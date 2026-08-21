#!/usr/bin/env node
/**
 * SUNNY-WEETJE (Daimy 17-08, akkoord V16): ma t/m vr om 20:00 stuurt Sunny een weetje in
 * de Sonty toppers-WhatsAppgroep. Twee losse berichten: eerst een stoere binnenkomer,
 * dan het weetje. Toon: stoere mannen onder elkaar; nooit politiek, nooit klantnamen.
 *
 * Werking: weetje via Haiku (met historie tegen herhaling, thema rouleert per dag),
 * verzenden door WhatsApp Desktop te bedienen (zoeken, chat openen, plakken, enter).
 * Historie in data/sunny-weetjes.json voorkomt ook dubbel sturen op één dag.
 * Extra voer: data/sunny-medewerkers.txt (weetjes/trekjes van het team, optioneel).
 *
 * Gebruik:  node sunny-weetje.js            (launchd; stuurt alleen ma-vr en 1x per dag)
 *           node sunny-weetje.js --test     (testbericht naar Sunny's eigen chat, niet de groep)
 *           node sunny-weetje.js --nu       (forceer sturen, ook als al gestuurd/weekend)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HIST = path.join(__dirname, '..', 'data', 'sunny-weetjes.json');
const TEAMINFO = path.join(__dirname, '..', 'data', 'sunny-medewerkers.txt');
// De groep 'Sonty toppers'; zelfde id als de groepswachter in email/wa-groep-wachter.js.
const GROEP_JID = '31628209480-1583527515@g.us';

// juiste Sonty-termen in elke grap (Daimy 17-08: "we verkopen pergola's geen overkappingen")
const PRODUCTKENNIS = 'Productkennis Sonty (gebruik ALTIJD deze termen): wij verkopen knikarmschermen, uitvalschermen, screens/zipscreens, rolluiken, pergola\'s (hoogwaardig aluminium, op palen), markiezen, horren en raamdecoratie. Zeg NOOIT overkapping, veranda, carport of houten pergola; het heet bij ons een pergola. Doeken zijn waterafstotend, niet waterdicht. Een knikarmscherm hangt aan de gevel zonder palen.';

// de echte Sunny-kennisbank als feitenbron voor de grappen (Daimy 17-08)
function leesKennisbank() {
  try { return fs.readFileSync(path.join(__dirname, '..', 'data', 'trengo-kennisbank.md'), 'utf8'); }
  catch (e) { return ''; }
}
const OCHTEND_OPENERS = [
  'GOEIEMORGEN BEESTENNNN 💪☀️',
  'OPSTAAN LEGENDESSSS 🔥',
  'RISE AND SHINE TOPPERSSSS ☀️',
  'WAKKER WORDEN KANJERSSSS 📢💪',
  'GOEDEMORGEN MACHINESSSS 🚐💨',
  'DAAR IS DE ZON WEER BIKKELSSS ☀️😎',
];
const OPENERS = [
  'HEEEEEE MOTHERFUCKERSSSSS 🍻 WISTEN JULLIE DATTTTT',
  'JAAAAA BIKKELS DAAR IS IE WEER 🔥 WISTEN JULLIE DATTTTT',
  'GOEIENAVOND TOPPERSSSS ☀️ WISTEN JULLIE DATTTTT',
  'HOHOHO STOP ALLES ✋😤 WISTEN JULLIE DATTTTT',
  'LUISTEREN MANNEN 📢💪 WISTEN JULLIE DATTTTT',
  'DAAR ZIJN WE WEER KANJERSSSS 😎🍺 WISTEN JULLIE DATTTTT',
  'EFFE JULLIE AANDACHT LEGENDES 🏆 WISTEN JULLIE DATTTTT',
  'ZET JE SCHRAP TIJGERSSSS 🐯🔥 WISTEN JULLIE DATTTTT',
];
const THEMAS = [
  'zonwering, montage of gereedschap (iets wat monteurs cool vinden)',
  'dieren of natuur (bizar record of raar feitje)',
  'bier, eten of bbq',
  'menselijk lichaam, kracht of sport',
  'techniek, machines of wereldrecords',
];

// VERSTUREN ALS GEKOPPELD APPARAAT (Daimy 18-08). Was: WhatsApp Desktop bedienen via
// AppleScript. Dat eiste een ontgrendeld scherm, nam een minuut lang muis en toetsenbord
// over, vroeg telkens opnieuw toestemming voor node en liep stuk zodra de Mac op slot
// stond ("FOUT: spawnSync osascript ETIMEDOUT"). Nu gaat het rechtstreeks via de
// WhatsApp-verbinding: geen venster, geen toestemming, werkt ook met het scherm op slot.
// Eenmalig koppelen met: node scripts/wa-koppel.js
async function stuurWhatsApp(doel, berichten) {
  const { stuurWhatsApp: stuur } = require('./lib/wa-verstuur.js');
  const jid = doel.includes('@') ? doel : `${doel.replace(/\D/g, '')}@s.whatsapp.net`;
  const n = await stuur(jid, berichten);
  console.log(`${n} bericht(en) verstuurd naar ${jid}`);
  return n;
}

/**
 * Grapverzoeken: de mannen mogen naar het Sunny-nummer appen (Daimy 17-08); binnengekomen
 * priveberichten van de laatste 24 uur gaan als inspiratie mee in het weetje van die dag.
 * Alleen lezen uit de lokale WhatsApp-database, alleen losse chats (nooit de groep zelf).
 */
function grapVerzoeken() {
  // Sinds 19-08 vult de luisteraar-daemon (wa-luisteraar.js) dit bestand via de directe
  // WhatsApp-koppeling; geen ChatStorage-lezen en dus geen macOS-popups meer.
  try {
    const p = path.join(__dirname, '..', 'data', 'email', 'wa-grapverzoeken.jsonl');
    if (!fs.existsSync(p)) return '';
    const grens = Date.now() - 86400000;
    return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean)
      .map((r) => { try { return JSON.parse(r); } catch { return null; } })
      .filter((g) => g && g.tijd > grens)
      .slice(-15)
      .map((g) => `${g.van}: ${g.tekst}`)
      .join('\n');
  } catch { return ''; }
}

/**
 * Morning motivation (Daimy 17-08, akkoord op voorbeelden, tijd 07:30): opzwepend
 * ochtendbericht met een luchtige knipoog naar het nieuws van vandaag/gisteren.
 * Nieuws uit de NOS-feeds; nooit politiek, misdaad, dood of ellende. Niks leuks
 * in het nieuws? Dan gewoon pure motivatie.
 */
async function haalNieuws() {
  const titels = [];
  for (const feed of ['nosnieuwsalgemeen', 'nossportalgemeen', 'nosnieuwsopmerkelijk']) {
    try {
      const xml = await (await fetch(`https://feeds.nos.nl/${feed}`, { signal: AbortSignal.timeout(15000) })).text();
      const items = [...xml.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g)].map((m) => m[1]);
      titels.push(...items.slice(0, 8));
    } catch (e) { /* feed even niet bereikbaar, dan de rest */ }
  }
  return titels;
}

/** Herhaling vangen (21-08: Haiku gaf de ochtendtekst van 18-08 letterlijk terug, ondanks
 *  de "al gebruikt"-lijst). Deelt de nieuwe tekst een stuk van 30+ tekens met een eerder
 *  bericht, dan is het een herhaling en genereren we opnieuw met een hardere instructie. */
function lijktOpEerder(tekst, eerderLijst) {
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9à-ü ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const n = norm(tekst);
  if (n.length < 30) return false;
  for (const e of eerderLijst) {
    const m = norm(e);
    for (let i = 0; i + 30 <= n.length; i += 10) if (m.includes(n.slice(i, i + 30))) return true;
  }
  return false;
}

async function maakOchtend(hist, poging = 0) {
  const APIKEY = fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
  const team = fs.existsSync(TEAMINFO) ? fs.readFileSync(TEAMINFO, 'utf8').trim() : '';
  const nieuws = await haalNieuws();
  const eerderLijst = hist.filter((h) => h.type === 'ochtend').slice(-15).map((h) => h.weetje);
  const eerder = eerderLijst.join('\n') + (poging ? '\nLET OP: je vorige poging leek te veel op een eerder bericht. Kies een ANDER onderwerp en andere woorden.' : '');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': APIKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-5', max_tokens: 350, // Sonnet: grappiger dan Haiku (Daimy 21-08 wil echt leuke berichten), 2x per dag dus goedkoop
      messages: [{ role: 'user', content: `Schrijf de morning motivation voor de interne WhatsApp-groep van Sonty (zonweringbedrijf, stoere monteurs, ze stappen zo de bus in). Het komt direct na een schreeuwerige opener, dus begin lopend in kleine letters. Eisen: MAXIMAAL 2 korte zinnen spreektaal (dit is een appje, geen speech), opzwepend en ECHT GRAPPIG: er moet een echte grap of droge punchline in zitten waar een monteur om 7 uur s ochtends om grinnikt, niet alleen "gassen mannen". Overdrijven mag flink, plagen mag (nooit gemeen), kleedkamerhumor die net netjes blijft. NOOIT een gedachtestreepje gebruiken, gewoon komma's en punten. Eindig met 1-2 emoji. Verwerk als het kan EEN actueel nieuwtje van vandaag of gisteren met een luchtige knipoog naar het werk (regen = overkappingen verkopen, sport = wij maken de klus wel af, enz). Kies ALLEEN iets luchtigs: sport, weer, verkeer, dieren, opmerkelijk. NOOIT politiek, oorlog, misdaad, dood, ziekte of ander leed. Staat er niks luchtigs tussen, verzin dan GEEN nieuws maar maak pure motivatie.\n${PRODUCTKENNIS}\nDe echte Sonty-kennisbank als feitenbron; alles wat je over producten, garanties of het bedrijf zegt moet hiermee kloppen:\n${leesKennisbank()}\nHet nieuws van nu (koppen):\n${nieuws.join('\n') || '(geen nieuws beschikbaar, dus pure motivatie)'}${team ? `\nTeam-weetjes die je af en toe mag gebruiken voor een grap:\n${team}` : ''}${eerder ? `\nDeze berichten zijn al gebruikt, kom met iets anders:\n${eerder}` : ''}\nGeef UITSLUITEND de berichttekst, niets eromheen.` }],
    }),
  });
  const j = await r.json();
  let tekst = (j?.content?.[0]?.text || '').trim().replace(/^"|"$/g, '');
  tekst = tekst.replace(/\s*\u2014+\s*/g, ', ');
  tekst = tekst.charAt(0).toLowerCase() + tekst.slice(1);
  if (!tekst || tekst.length < 20) { console.error('API-antwoord:', JSON.stringify(j).slice(0, 400)); throw new Error('ochtend-generatie mislukt'); }
  if (lijktOpEerder(tekst, eerderLijst) && poging < 2) return maakOchtend(hist, poging + 1);
  return { thema: 'ochtend', tekst };
}

async function maakWeetje(hist) {
  const APIKEY = fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
  const team = fs.existsSync(TEAMINFO) ? fs.readFileSync(TEAMINFO, 'utf8').trim() : '';
  const verzoeken = grapVerzoeken();
  const thema = THEMAS[hist.length % THEMAS.length];
  const eerder = hist.slice(-30).map((h) => h.weetje).join('\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': APIKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-5', max_tokens: 300,
      messages: [{ role: 'user', content: `Schrijf het dagelijkse weetje voor de interne WhatsApp-groep van Sonty (zonweringbedrijf, allemaal stoere monteurs/mannen onder elkaar). Het komt direct na de openingszin "WISTEN JULLIE DATTTTT", dus begin lopend in kleine letters (bijv. "een garnaal zijn hart in zijn kop heeft? ..."). Thema vandaag: ${thema}. Eisen: echt waar (geen verzonnen feiten), verrassend, 1 a 3 zinnen, spreektaal, stoer en grappig, nooit een gedachtestreepje, eindig met 1-2 passende emoji. Maak er als het past een luchtige knipoog bij naar het vak of het team, nooit gemeen, nooit politiek, geen klanten.\n${PRODUCTKENNIS}\nDe echte Sonty-kennisbank als feitenbron; alles wat je over producten, garanties of het bedrijf zegt moet hiermee kloppen:\n${leesKennisbank()}${team ? ` Team-weetjes die je af en toe (niet elke dag) mag gebruiken voor een grap:\n${team}` : ''}${verzoeken ? `\nDeze berichtjes stuurden de mannen vandaag naar Sunny (verzoekjes/gein); verwerk het leukste met een knipoog in het weetje van vandaag ALS het binnen de lijnen kan (nooit discriminerend, seksueel, politiek of gemeen naar een persoon; anders gewoon negeren):\n${verzoeken}` : ''}${eerder ? `\nDeze weetjes zijn al gebruikt, kom met iets anders:\n${eerder}` : ''}\nGeef UITSLUITEND de weetje-tekst, niets eromheen.` }],
    }),
  });
  const j = await r.json();
  let tekst = (j?.content?.[0]?.text || '').trim().replace(/^"|"$/g, '');
  // de opener zegt al "WISTEN JULLIE DATTTTT"; als het model dat toch herhaalt, strippen
  // (Daimy 17-08) en de eerste letter klein houden zodat de zin lopend aansluit
  tekst = tekst.replace(/^wisten?\s+jull?ie\s+dat+\s*/i, '');
  tekst = tekst.replace(/\s*\u2014+\s*/g, ', ');
  tekst = tekst.charAt(0).toLowerCase() + tekst.slice(1);
  if (!tekst || tekst.length < 20) { console.error('API-antwoord:', JSON.stringify(j).slice(0, 400)); throw new Error('weetje-generatie mislukt'); }
  return { thema, tekst };
}

async function telegram(t) {
  try {
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: t }),
    });
  } catch { /* best-effort */ }
}

(async () => {
  if (process.argv.includes('--test')) {
    // Test gaat naar Daimy zelf (Daimy 18-08: "whatsapp mij daarna met sunny even een
    // test dan?"). Twee berichten, want zo gaat het in de groep ook: opener + tekst.
    await stuurWhatsApp('31683500506', [
      'YOOO DAIMY 💪',
      'Sunny hier. Dit is een test vanaf de Mac, verstuurd zonder dat er een scherm is overgenomen. Als je dit leest werkt het en kan ik de ochtend van 07:30 en het weetje van 20:00 weer aanzetten 🔧☀️',
    ]);
    console.log('testbericht naar Daimy gestuurd');
    return;
  }
  const vandaag = new Date().toISOString().slice(0, 10);
  const dag = new Date().getDay();
  const forceer = process.argv.includes('--nu');
  const soort = process.argv.includes('--ochtend') ? 'ochtend' : 'weetje';
  const hist = fs.existsSync(HIST) ? JSON.parse(fs.readFileSync(HIST, 'utf8')) : [];
  const vanSoort = hist.filter((h) => (h.type || 'weetje') === soort);
  if (!forceer && (dag === 0 || dag === 6)) { console.log('weekend, niks sturen'); return; }
  if (!forceer && vanSoort.some((h) => h.datum === vandaag)) { console.log(`${soort} vandaag al gestuurd`); return; }

  const openers = soort === 'ochtend' ? OCHTEND_OPENERS : OPENERS;
  const opener = openers[vanSoort.length % openers.length];
  // API hapert soms (21-08: eerste poging "weetje-generatie mislukt", tweede lukte): 3x proberen
  let gen = null, laatsteFout = null;
  for (let poging = 0; poging < 3 && !gen; poging++) {
    try { gen = soort === 'ochtend' ? await maakOchtend(hist) : await maakWeetje(vanSoort); }
    catch (e) { laatsteFout = e; await new Promise((r) => setTimeout(r, 30000)); }
  }
  if (!gen) throw laatsteFout || new Error('generatie mislukt');
  const { thema, tekst } = gen;
  if (process.argv.includes('--proef')) { console.log(`PROEF (niet verstuurd):\n${opener}\n${tekst}`); return; }
  // Wachten tot Daimy weg is hoeft niet meer: er wordt geen scherm meer overgenomen.
  await stuurWhatsApp(GROEP_JID, [opener, tekst]);
  hist.push({ datum: vandaag, type: soort, thema, opener, weetje: tekst });
  fs.writeFileSync(HIST, JSON.stringify(hist, null, 1));
  console.log(`gestuurd: ${opener} / ${tekst}`);
  await telegram(`☀️ Sunny heeft de ${soort === 'ochtend' ? 'morning motivation' : 'weetje'} van vandaag in de toppers-groep gezet:\n\n${opener}\n${tekst}`);
})().catch(async (e) => {
  console.error('FOUT:', e.message);
  await telegram(`⚠️ Sunny-bericht mislukt: ${String(e.message).slice(0, 120)}. Ik kijk ernaar.`);
  process.exit(1);
});
