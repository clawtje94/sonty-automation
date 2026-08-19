#!/usr/bin/env node
/**
 * EENMALIG KOPPELEN VAN SUNNY'S WHATSAPP (Daimy 18-08).
 *
 * Draai dit één keer en scan de QR met de telefoon van Sunny:
 *   WhatsApp openen > Instellingen > Gekoppelde apparaten > Apparaat koppelen.
 *
 * Daarna kan de bot berichten sturen zonder het scherm over te nemen, ook als de Mac op
 * slot staat. WhatsApp staat vier gekoppelde apparaten toe, dus WhatsApp Desktop op deze
 * Mac kan gewoon ingelogd blijven.
 *
 * De sessie komt in data/wa-auth/ te staan. Die map hoort NIET in git.
 */
const path = require('path');
const { AUTH, isGekoppeld } = require('./lib/wa-verstuur.js');

(async () => {
  if (isGekoppeld() && !process.argv.includes('--opnieuw')) {
    console.log('Al gekoppeld. Opnieuw koppelen? Verwijder data/wa-auth of draai met --opnieuw.');
    return;
  }
  const baileys = require('baileys');
  const makeWASocket = baileys.default || baileys.makeWASocket;
  const { useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;
  const qr = require('qrcode-terminal');

  const { state, saveCreds } = await useMultiFileAuthState(AUTH);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, printQRInTerminal: false, browser: ['Sonty Sunny', 'Chrome', '1.0.0'] });
  sock.ev.on('creds.update', saveCreds);

  // KOPPELCODE in plaats van QR (Daimy 18-08): een QR moet je op een scherm tonen en met
  // de andere telefoon scannen, en hij verloopt binnen ~20 seconden. Een koppelcode is
  // acht tekens die je gewoon kunt doorgeven en op de telefoon intikt:
  // WhatsApp > Instellingen > Gekoppelde apparaten > Koppel met telefoonnummer.
  //   node scripts/wa-koppel.js --code 31628209480
  const codeIdx = process.argv.indexOf('--code');
  if (codeIdx > -1) {
    const nummer = String(process.argv[codeIdx + 1] || '').replace(/\D/g, '');
    if (!nummer) { console.log('geef het telefoonnummer mee, bijv. --code 31628209480'); process.exit(1); }
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(nummer);
        console.log('\nKOPPELCODE: ' + code);
        console.log('Op de telefoon: WhatsApp > Instellingen > Gekoppelde apparaten >');
        console.log('Apparaat koppelen > Koppel met telefoonnummer, en tik deze code in.');
        console.log('De code is ongeveer een minuut geldig.\n');
      } catch (e) { console.log('koppelcode aanvragen mislukt: ' + e.message); process.exit(1); }
    }, 3000);
  }

  sock.ev.on('connection.update', (u) => {
    if (u.qr) {
      console.log('\nScan deze QR met de telefoon van Sunny:\n');
      qr.generate(u.qr, { small: true });
      console.log('\nWhatsApp > Instellingen > Gekoppelde apparaten > Apparaat koppelen\n');
    }
    if (u.connection === 'open') {
      console.log('\nGEKOPPELD. Sessie staat in ' + AUTH);
      console.log('Test met: node scripts/sunny-weetje.js --test');
      setTimeout(() => process.exit(0), 1500);
    }
    if (u.connection === 'close') {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code === 401) { console.log('Koppeling geweigerd of ingetrokken. Verwijder data/wa-auth en probeer opnieuw.'); process.exit(1); }
    }
  });
})();
