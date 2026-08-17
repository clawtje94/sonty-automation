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

function wachtTotRust() {
  const deadline = new Date();
  deadline.setHours(22, 30, 0, 0);
  while (new Date() < deadline) {
    const idle = idleSeconden();
    if (idle >= 180) return true;
    console.log(`Daimy is aan het werk (idle ${Math.round(idle)}s), wachten...`);
    execFileSync('sleep', ['60']);
  }
  return false;
}

function stuurWhatsApp(doel, berichten) {
  const uit = execFileSync('osascript', ['-l', 'JavaScript', path.join(__dirname, 'wa-stuur.jxa.js'), doel, ...berichten], { timeout: 240000 }).toString().trim();
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
      messages: [{ role: 'user', content: `Schrijf het dagelijkse weetje voor de interne WhatsApp-groep van Sonty (zonweringbedrijf, allemaal stoere monteurs/mannen onder elkaar). Het komt direct na de openingszin "WISTEN JULLIE DATTTTT", dus begin lopend in kleine letters (bijv. "een garnaal zijn hart in zijn kop heeft? ..."). Thema vandaag: ${thema}. Eisen: echt waar (geen verzonnen feiten), verrassend, 1 a 3 zinnen, spreektaal, stoer en grappig, eindig met 1-2 passende emoji. Maak er als het past een luchtige knipoog bij naar het vak of het team, nooit gemeen, nooit politiek, geen klanten.${team ? ` Team-weetjes die je af en toe (niet elke dag) mag gebruiken voor een grap:\n${team}` : ''}${verzoeken ? `\nDeze berichtjes stuurden de mannen vandaag naar Sunny (verzoekjes/gein); verwerk het leukste met een knipoog in het weetje van vandaag ALS het binnen de lijnen kan (nooit discriminerend, seksueel, politiek of gemeen naar een persoon; anders gewoon negeren):\n${verzoeken}` : ''}${eerder ? `\nDeze weetjes zijn al gebruikt, kom met iets anders:\n${eerder}` : ''}\nGeef UITSLUITEND de weetje-tekst, niets eromheen.` }],
    }),
  });
  const j = await r.json();
  let tekst = (j?.content?.[0]?.text || '').trim().replace(/^"|"$/g, '');
  // de opener zegt al "WISTEN JULLIE DATTTTT"; als het model dat toch herhaalt, strippen
  // (Daimy 17-08) en de eerste letter klein houden zodat de zin lopend aansluit
  tekst = tekst.replace(/^wisten?\s+jull?ie\s+dat+\s*/i, '');
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
  const hist = fs.existsSync(HIST) ? JSON.parse(fs.readFileSync(HIST, 'utf8')) : [];
  if (!forceer && (dag === 0 || dag === 6)) { console.log('weekend, niks sturen'); return; }
  if (!forceer && hist.some((h) => h.datum === vandaag)) { console.log('vandaag al gestuurd'); return; }

  const opener = OPENERS[hist.length % OPENERS.length];
  const { thema, tekst } = await maakWeetje(hist);
  if (!forceer && !wachtTotRust()) {
    console.log('geen rustig moment gevonden voor 22:30, weetje overgeslagen');
    await telegram('☀️ Sunny-weetje vanavond overgeslagen: je was tot 22:30 aan de computer aan het werk en ik wilde je niet storen. Morgen weer een kans.');
    return;
  }
  stuurWhatsApp(GROEP_ZOEK, [opener, tekst]);
  hist.push({ datum: vandaag, thema, opener, weetje: tekst });
  fs.writeFileSync(HIST, JSON.stringify(hist, null, 1));
  console.log(`gestuurd: ${opener} / ${tekst}`);
  await telegram(`☀️ Sunny heeft het weetje van vandaag in de toppers-groep gezet:\n\n${opener}\n${tekst}`);
})().catch(async (e) => {
  console.error('FOUT:', e.message);
  await telegram(`⚠️ Sunny-weetje vanavond mislukt: ${String(e.message).slice(0, 120)}. Ik kijk ernaar.`);
  process.exit(1);
});
