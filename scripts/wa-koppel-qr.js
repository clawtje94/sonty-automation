#!/usr/bin/env node
/**
 * QR-KOPPELING VIA TELEGRAM (19-08): de koppelcode-route bleef op de telefoon "kan
 * apparaat niet koppelen" geven. Een QR heeft geen telefoonnummer nodig en kan dus niet
 * op het verkeerde nummer staan. Dit script stuurt de QR als foto naar Daimy's Telegram;
 * hij toont m op zijn eigen telefoon en scant m met de telefoon van Sunny
 * (WhatsApp > Instellingen > Gekoppelde apparaten > Apparaat koppelen).
 * De QR ververst vanzelf; elke nieuwe QR wordt opnieuw gestuurd (max 5).
 */
const fs = require('fs');
const path = require('path');
const { AUTH } = require('./lib/wa-verstuur.js');

const BOT = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const CHAT = 1700128390;

async function stuurFoto(pad, tekst) {
  const fd = new FormData();
  fd.append('chat_id', String(CHAT));
  fd.append('caption', tekst);
  fd.append('photo', new Blob([fs.readFileSync(pad)], { type: 'image/png' }), 'qr.png');
  await fetch(`https://api.telegram.org/bot${BOT}/sendPhoto`, { method: 'POST', body: fd });
}
async function stuurTekst(t) {
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: t }),
  }).catch(() => {});
}

(async () => {
  fs.rmSync(AUTH, { recursive: true, force: true });
  const baileys = require('baileys');
  const makeWASocket = baileys.default || baileys.makeWASocket;
  const { useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;
  const qrcode = require('qrcode');

  const { state, saveCreds } = await useMultiFileAuthState(AUTH);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, printQRInTerminal: false, browser: ['Sonty Sunny', 'Chrome', '1.0.0'] });
  sock.ev.on('creds.update', saveCreds);

  let qrTeller = 0;
  sock.ev.on('connection.update', async (u) => {
    if (u.qr) {
      qrTeller += 1;
      if (qrTeller > 5) { await stuurTekst('QR-sessie verlopen; zeg QR en ik start een nieuwe.'); process.exit(2); }
      const p = `/tmp/wa-qr-${qrTeller}.png`;
      await qrcode.toFile(p, u.qr, { width: 560, margin: 2 });
      await stuurFoto(p, `Scan deze QR met de telefoon van SUNNY (poging ${qrTeller}): WhatsApp > Instellingen > Gekoppelde apparaten > Apparaat koppelen. Vervalt na ~40 sec; er komt vanzelf een nieuwe als het niet lukt.`);
      console.log('QR verstuurd', qrTeller);
    }
    if (u.connection === 'open') {
      console.log('GEKOPPELD');
      await stuurTekst('✅ GELUKT, Sunny is gekoppeld via de QR! Versturen gaat vanaf nu direct via de verbinding: geen schermovername, geen popups, werkt ook met de Mac op slot. Vanavond 20:00 gaat het weetje al zo.');
      setTimeout(() => process.exit(0), 3000);
    }
    if (u.connection === 'close') {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      console.log('verbinding dicht', code);
      if (code === 401 || code === 403) { await stuurTekst('Koppeling geweigerd door WhatsApp, ik kijk ernaar.'); process.exit(1); }
    }
  });
})();
