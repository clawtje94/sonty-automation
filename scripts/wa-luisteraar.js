#!/usr/bin/env node
/**
 * SUNNY WHATSAPP-LUISTERAAR (19-08). Eén permanente verbinding als gekoppeld apparaat
 * die drie dingen doet, allemaal zonder scherm, popups of lokale WhatsApp-bestanden:
 *
 * 1. FOTOS uit de Sonty toppers-groep: binnenkomende afbeeldingen worden gedownload,
 *    door de vision-triage gehaald (categorie + marketingscore) en bij score >= 6 op de
 *    Klaviyo-CDN gezet en in de Uploaden-tab geregistreerd voor Daimy's akkoord.
 *    Vervangt de oude ChatStorage-lezer (die trigggerde macOS-popups).
 * 2. GRAPVERZOEKEN: priveberichten aan Sunny gaan naar data/email/wa-grapverzoeken.jsonl;
 *    de weetjesbot leest daar de laatste 24 uur uit.
 * 3. VERSTUREN: er mag maar één verbinding tegelijk op de sessie zitten, dus verzenden
 *    loopt via de wachtrij data/wa-outbox/ (bestand {jid, berichten}); de daemon stuurt
 *    en schrijft <id>.done.json of <id>.err.json terug. wa-verstuur.js gebruikt die
 *    route automatisch zolang de daemon draait (pidbestand data/wa-luisteraar.pid).
 *
 * Draait permanent via launchd nl.sonty.wa-luisteraar (KeepAlive).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { AUTH, isGekoppeld } = require('./lib/wa-verstuur.js');
const { ADMIN_PASSWORD, KLAVIYO_API_KEY } = require('./secrets.js');

const GROEP = '31628209480-1583527515@g.us';
const DATA = path.join(__dirname, '..', 'data');
const OUTBOX = path.join(DATA, 'wa-outbox');
const PIDBESTAND = path.join(DATA, 'wa-luisteraar.pid');
const VERWERKT = path.join(DATA, 'email', 'wa-luisteraar-verwerkt.json');
const GRAPPEN = path.join(DATA, 'email', 'wa-grapverzoeken.jsonl');
const CATS = ['knikarm', 'uitvalscherm', 'screen', 'rolluik', 'pergola', 'veranda', 'markies', 'raamdeco', 'behang', 'horren', 'vloeren', 'showroom', 'werk', 'zakelijk'];
const SITE = { Authorization: 'Bearer ' + ADMIN_PASSWORD, 'Content-Type': 'application/json' };
const MIN_SCORE = 6;

async function telegram(t) {
  try {
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: t }),
    });
  } catch { /* best-effort */ }
}

async function triage(jpgPad) {
  const APIKEY = fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
  const klein = '/tmp/wa-luister-klein.jpg';
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '55', '--resampleWidth', '1024', jpgPad, '--out', klein], { stdio: 'ignore' });
  const b64 = fs.readFileSync(klein).toString('base64');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': APIKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 250, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
      { type: 'text', text: `Foto uit de interne WhatsApp-groep van Sonty (zonwering/raamdecoratie). Beoordeel voor marketinggebruik. Categorie uit: ${CATS.join(', ')}. Let op: een knikarm(scherm) hangt AAN DE GEVEL zonder palen; een pergola of veranda staat op PALEN boven een terras. Marketingscore 1-10: alleen 6+ bij scherp, goed belicht en representatief. Screenshots, memes, documenten en privefotos altijd 1-4. Eén korte NL-zin. UITSLUITEND JSON: {"cat":"...","score":7,"oordeel":"..."}` },
    ] }] }),
  });
  const j = await r.json();
  const m = (j?.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

async function naarBeoordeling(jpgPad, naam, uit) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(jpgPad)], { type: 'image/jpeg' }), naam + '.jpg');
  fd.append('name', naam);
  const up = await fetch('https://a.klaviyo.com/api/image-upload/', {
    method: 'POST', headers: { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, revision: '2024-10-15', accept: 'application/json' }, body: fd });
  if (!up.ok) throw new Error('cdn ' + up.status);
  const url = (await up.json()).data.attributes.image_url;
  await fetch('https://sonty-website.vercel.app/api/admin/fotoupload', { method: 'POST', headers: SITE, body: JSON.stringify({ registreer: { url, naam: naam + '.jpg', type: 'foto', cat: uit.cat } }) });
  await fetch('https://sonty-website.vercel.app/api/admin/fotoupload', { method: 'POST', headers: SITE, body: JSON.stringify({ beoordeel: [{ url, aiCat: uit.cat, aiScore: Math.min(10, Number(uit.score)), aiOordeel: String(uit.oordeel || '').slice(0, 180) }] }) });
}

(async () => {
  if (!isGekoppeld()) { console.error('niet gekoppeld; draai wa-koppel eerst'); process.exit(1); }
  fs.mkdirSync(OUTBOX, { recursive: true });
  fs.writeFileSync(PIDBESTAND, String(process.pid));
  const verwerkt = fs.existsSync(VERWERKT) ? JSON.parse(fs.readFileSync(VERWERKT, 'utf8')) : {};

  const baileys = require('@whiskeysockets/baileys');
  const makeWASocket = baileys.default || baileys.makeWASocket;
  const { useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage, DisconnectReason } = baileys;

  let sock = null;
  let open = false;

  async function verbind() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH);
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({ version, auth: state, printQRInTerminal: false, syncFullHistory: false, browser: ['Sonty Sunny', 'Chrome', '1.0.0'] });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
      if (u.connection === 'open') { open = true; console.log(new Date().toISOString(), 'verbonden'); }
      if (u.connection === 'close') {
        open = false;
        const code = u.lastDisconnect?.error?.output?.statusCode;
        console.log(new Date().toISOString(), 'dicht', code);
        if (code === DisconnectReason.loggedOut) {
          telegram('⚠️ De Sunny-koppeling is op de telefoon verbroken; foto-lezen en versturen liggen stil tot er opnieuw gekoppeld is.');
          process.exit(1);
        }
        setTimeout(verbind, code === 515 ? 2000 : 15000);
      }
    });
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        try { await verwerkBericht(m); } catch (e) { console.error('bericht-fout:', String(e.message).slice(0, 80)); }
      }
    });
  }

  async function verwerkBericht(m) {
    const jid = m.key?.remoteJid || '';
    if (m.key?.fromMe) return;
    const id = m.key?.id;
    if (!id || verwerkt[id]) return;
    // grapverzoeken: prive-tekstberichten aan Sunny
    if (jid.endsWith('@s.whatsapp.net')) {
      const tekst = m.message?.conversation || m.message?.extendedTextMessage?.text;
      if (tekst) {
        verwerkt[id] = 1;
        fs.appendFileSync(GRAPPEN, JSON.stringify({ tijd: Date.now(), van: m.pushName || jid.split('@')[0], tekst: String(tekst).slice(0, 300) }) + '\n');
        console.log('grapverzoek van', m.pushName || jid);
      }
      fs.writeFileSync(VERWERKT, JSON.stringify(verwerkt));
      return;
    }
    // groepsfotos
    if (jid !== GROEP || !m.message?.imageMessage) return;
    verwerkt[id] = 1;
    fs.writeFileSync(VERWERKT, JSON.stringify(verwerkt));
    const buf = await downloadMediaMessage(m, 'buffer', {});
    const jpg = `/tmp/wa-luister-${id.slice(-8)}.jpg`;
    fs.writeFileSync(jpg, buf);
    const uit = await triage(jpg);
    if (!uit || !CATS.includes(uit.cat) || Math.min(10, Number(uit.score) || 1) < MIN_SCORE) { console.log('foto niet bruikbaar', uit && uit.score); return; }
    const naam = 'wagroep-' + new Date().toISOString().slice(0, 10) + '-' + id.slice(-8);
    await naarBeoordeling(jpg, naam, uit);
    console.log('foto geplaatst:', naam, uit.cat, uit.score);
    await telegram(`📸 Nieuwe foto uit de toppers-groep beoordeeld (${uit.cat} ${uit.score}/10) en klaargezet in de Uploaden-tab voor jouw akkoord.`);
  }

  // outbox: bestanden {jid, berichten[]} versturen en het resultaat terugschrijven
  setInterval(async () => {
    if (!open) return;
    for (const f of fs.readdirSync(OUTBOX).filter((x) => x.endsWith('.json') && !x.includes('.done.') && !x.includes('.err.'))) {
      const p = path.join(OUTBOX, f);
      let taak;
      try { taak = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
      fs.unlinkSync(p);
      const basis = p.replace(/\.json$/, '');
      try {
        let n = 0;
        for (const tekst of taak.berichten || []) {
          await sock.sendMessage(taak.jid, { text: tekst });
          n += 1;
          await new Promise((r) => setTimeout(r, 1500));
        }
        fs.writeFileSync(basis + '.done.json', JSON.stringify({ verstuurd: n }));
        console.log('outbox verstuurd:', f, '->', taak.jid, `(${n})`);
      } catch (e) {
        fs.writeFileSync(basis + '.err.json', JSON.stringify({ fout: String(e.message).slice(0, 200) }));
        console.error('outbox-fout:', f, String(e.message).slice(0, 80));
      }
    }
  }, 2000);

  await verbind();
})();
