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
const GROEP_ZOEK = 'Sonty toppers';

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

/**
 * De verzending neemt het scherm ~1 minuut over (WhatsApp accepteert chatwissels alleen
 * frontmost); daarom sturen we alleen als Daimy niet aan de computer zit (Daimy 17-08:
 * "kan dus alleen als ik niet aan het werk ben"). We wachten tot toetsenbord en muis
 * minstens 3 minuten stil zijn, tot uiterlijk 22:30; anders slaat de bot de dag over.
 */
function idleSeconden() {
  try {
    return Number(execFileSync('sh', ['-c', "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000000; exit}'"], { timeout: 15000 }).toString().trim()) || 0;
  } catch (e) { return 0; }
}

/**
 * Vergrendeld scherm = geen UI-events mogelijk; dat was de oorzaak van de gemiste
 * ochtend-app op 18-08 (osascript hing 4 min en liep stuk om 07:30, Mac stond op slot).
 * Dus: wachten tot het scherm ontgrendeld is EN de gebruiker idle is.
 */
function schermVergrendeld() {
  try {
    const uit = execFileSync('osascript', ['-l', 'JavaScript', '-e',
      'ObjC.import("CoreGraphics"); const d = ObjC.deepUnwrap($.CGSessionCopyCurrentDictionary()); (d && d.CGSSessionScreenIsLocked) ? "1" : "0"'],
      { timeout: 20000 }).toString().trim();
    return uit === '1';
  } catch (e) { return false; }
}

function wachtTotRust(uur, minuut) {
  const deadline = new Date();
  deadline.setHours(uur, minuut, 0, 0);
  while (new Date() < deadline) {
    if (schermVergrendeld()) {
      console.log('scherm vergrendeld, wachten op ontgrendeling...');
      execFileSync('sleep', ['60']);
      continue;
    }
    const idle = idleSeconden();
    if (idle >= 180) return true;
    console.log(`Daimy is aan het werk (idle ${Math.round(idle)}s), wachten...`);
    execFileSync('sleep', ['60']);
  }
  return false;
}

function stuurWhatsApp(doel, berichten) {
  if (schermVergrendeld()) throw new Error('scherm vergrendeld, UI-events onmogelijk');
  // UI-scripting is flaky (stale element-referenties als WhatsApp net ververst):
  // tot 3 pogingen met pauze; de JXA-laag verstuurt pas na header-verificatie, dus
  // een mislukte poging heeft gegarandeerd niets gestuurd
  let uit = '';
  for (let poging = 1; ; poging += 1) {
    try {
      uit = execFileSync('osascript', ['-l', 'JavaScript', path.join(__dirname, 'wa-stuur.jxa.js'), doel, ...berichten], { timeout: 240000 }).toString().trim();
      break;
    } catch (e) {
      // alleen herkansen bij fouten die AANTOONBAAR voor het eerste versturen optreden
      // (chat openen/vinden); fouten tijdens het typen/sturen niet, want dan kan
      // bericht 1 al in de groep staan en zou een retry hem dubbel zetten
      const veiligOmTeHerkansen = /chatrij niet gevonden|matcht het doel niet|berichtvak niet gevonden|venster wil niet openen|Ongeldige index|Object kan niet worden opgevraagd/i.test(String(e.message));
      if (poging >= 3 || !veiligOmTeHerkansen) throw e;
      console.log(`verzendpoging ${poging} mislukt (${String(e.message).split('\n')[0].slice(0, 80)}), opnieuw...`);
      execFileSync('sleep', ['20']);
    }
  }
  console.log(uit);
  // verifieer in de lokale WhatsApp-database dat het laatste bericht er echt staat
  const db = path.join(process.env.HOME, 'Library', 'Group Containers', 'group.net.whatsapp.WhatsApp.shared', 'ChatStorage.sqlite');
  const zoek = berichten[berichten.length - 1].slice(0, 25).replace(/'/g, "''");
  let dbFout = 0;
  for (let i = 0; i < 6; i += 1) {
    execFileSync('sleep', ['5']);
    try {
      const r = execFileSync('sqlite3', ['-readonly', `file:${db}?mode=ro`,
        `SELECT count(*) FROM ZWAMESSAGE WHERE ZISFROMME = 1 AND ZTEXT LIKE '%${zoek}%' AND ZMESSAGEDATE > (strftime('%s','now') - 978307200 - 300);`],
        { timeout: 15000 }).toString().trim();
      if (Number(r) > 0) return;
    } catch (e) { dbFout += 1; }
  }
  if (dbFout >= 3) {
    // database niet leesbaar (macOS-toestemmingspopup "node wil toegang tot gegevens uit
    // andere apps" nog niet op Sta toe): de JXA-laag heeft al geverifieerd dat het vak
    // leeg is na de Stuur-knop, dus behandel als verzonden. NIET falen, anders zou de
    // aanroeper opnieuw sturen en krijgt de groep het bericht dubbel.
    console.warn('let op: WhatsApp-database niet leesbaar voor verificatie, verzending aangenomen op basis van UI-controle');
    return;
  }
  throw new Error('bericht niet teruggevonden in WhatsApp-database, mogelijk niet verzonden');
}

/**
 * Grapverzoeken: de mannen mogen naar het Sunny-nummer appen (Daimy 17-08); binnengekomen
 * priveberichten van de laatste 24 uur gaan als inspiratie mee in het weetje van die dag.
 * Alleen lezen uit de lokale WhatsApp-database, alleen losse chats (nooit de groep zelf).
 */
function grapVerzoeken() {
  try {
    const db = path.join(process.env.HOME, 'Library', 'Group Containers', 'group.net.whatsapp.WhatsApp.shared', 'ChatStorage.sqlite');
    if (!fs.existsSync(db)) return '';
    const q = `SELECT COALESCE(s.ZPARTNERNAME, s.ZCONTACTJID), m.ZTEXT FROM ZWAMESSAGE m
      JOIN ZWACHATSESSION s ON m.ZCHATSESSION = s.Z_PK
      WHERE s.ZCONTACTJID NOT LIKE '%@g.us' AND m.ZISFROMME = 0 AND m.ZTEXT IS NOT NULL
      AND m.ZMESSAGEDATE > (strftime('%s','now') - 978307200 - 86400) ORDER BY m.ZMESSAGEDATE LIMIT 15;`;
    return execFileSync('sqlite3', ['-readonly', '-separator', ': ', `file:${db}?mode=ro`, q], { timeout: 15000 })
      .toString().trim();
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

async function maakOchtend(hist) {
  const APIKEY = fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
  const team = fs.existsSync(TEAMINFO) ? fs.readFileSync(TEAMINFO, 'utf8').trim() : '';
  const nieuws = await haalNieuws();
  const eerder = hist.filter((h) => h.type === 'ochtend').slice(-15).map((h) => h.weetje).join('\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': APIKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 350,
      messages: [{ role: 'user', content: `Schrijf de morning motivation voor de interne WhatsApp-groep van Sonty (zonweringbedrijf, stoere monteurs, ze stappen zo de bus in). Het komt direct na een schreeuwerige opener, dus begin lopend in kleine letters. Eisen: 2 a 3 zinnen spreektaal, opzwepend en ECHT GRAPPIG: er moet een echte grap of droge punchline in zitten waar een monteur om 7 uur s ochtends om grinnikt, niet alleen "gassen mannen". Overdrijven mag flink, plagen mag (nooit gemeen), kleedkamerhumor die net netjes blijft. NOOIT een gedachtestreepje gebruiken, gewoon komma's en punten. Eindig met 1-2 emoji. Verwerk als het kan EEN actueel nieuwtje van vandaag of gisteren met een luchtige knipoog naar het werk (regen = overkappingen verkopen, sport = wij maken de klus wel af, enz). Kies ALLEEN iets luchtigs: sport, weer, verkeer, dieren, opmerkelijk. NOOIT politiek, oorlog, misdaad, dood, ziekte of ander leed. Staat er niks luchtigs tussen, verzin dan GEEN nieuws maar maak pure motivatie.\n${PRODUCTKENNIS}\nDe echte Sonty-kennisbank als feitenbron; alles wat je over producten, garanties of het bedrijf zegt moet hiermee kloppen:\n${leesKennisbank()}\nHet nieuws van nu (koppen):\n${nieuws.join('\n') || '(geen nieuws beschikbaar, dus pure motivatie)'}${team ? `\nTeam-weetjes die je af en toe mag gebruiken voor een grap:\n${team}` : ''}${eerder ? `\nDeze berichten zijn al gebruikt, kom met iets anders:\n${eerder}` : ''}\nGeef UITSLUITEND de berichttekst, niets eromheen.` }],
    }),
  });
  const j = await r.json();
  let tekst = (j?.content?.[0]?.text || '').trim().replace(/^"|"$/g, '');
  tekst = tekst.replace(/\s*\u2014+\s*/g, ', ');
  tekst = tekst.charAt(0).toLowerCase() + tekst.slice(1);
  if (!tekst || tekst.length < 20) throw new Error('ochtend-generatie mislukt');
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
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
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
  if (!tekst || tekst.length < 20) throw new Error('weetje-generatie mislukt');
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
    stuurWhatsApp('31683500506', ['Testje van de weetjesbot, negeer mij 🤖🍻']);
    console.log('testbericht gestuurd en geverifieerd in database');
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
  const { thema, tekst } = soort === 'ochtend' ? await maakOchtend(hist) : await maakWeetje(vanSoort);
  if (process.argv.includes('--proef')) { console.log(`PROEF (niet verstuurd):\n${opener}\n${tekst}`); return; }
  // ochtend: uiterlijk 10:00 (marge voor laat ontgrendelen), avond: uiterlijk 22:30
  const [dlU, dlM] = soort === 'ochtend' ? [10, 0] : [22, 30];
  if (!forceer && !wachtTotRust(dlU, dlM)) {
    console.log(`geen rustig moment gevonden, ${soort} overgeslagen`);
    await telegram(`☀️ Sunny-${soort} vandaag overgeslagen: je was aan de computer aan het werk en ik wilde je niet storen. Volgende keer beter.`);
    return;
  }
  stuurWhatsApp(GROEP_ZOEK, [opener, tekst]);
  hist.push({ datum: vandaag, type: soort, thema, opener, weetje: tekst });
  fs.writeFileSync(HIST, JSON.stringify(hist, null, 1));
  console.log(`gestuurd: ${opener} / ${tekst}`);
  await telegram(`☀️ Sunny heeft de ${soort === 'ochtend' ? 'morning motivation' : 'weetje'} van vandaag in de toppers-groep gezet:\n\n${opener}\n${tekst}`);
})().catch(async (e) => {
  console.error('FOUT:', e.message);
  await telegram(`⚠️ Sunny-bericht mislukt: ${String(e.message).slice(0, 120)}. Ik kijk ernaar.`);
  process.exit(1);
});
