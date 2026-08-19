// WHATSAPP VERSTUREN ZONDER HET SCHERM OVER TE NEMEN (Daimy 18-08: "zoek een oplossing
// want zo is het niet leuk maar gewoon kut").
//
// De oude route bediende WhatsApp Desktop via AppleScript: die eist een ontgrendeld
// scherm, neemt een minuut lang de muis en het toetsenbord over, vraagt telkens opnieuw
// toestemming voor node, en liep stuk zodra de Mac op slot stond
// (FOUT: spawnSync osascript ETIMEDOUT).
//
// Deze route praat als GEKOPPELD APPARAAT rechtstreeks met WhatsApp, net als WhatsApp
// Desktop zelf. Geen venster, geen toestemming, werkt met het scherm op slot en of Daimy
// nu wel of niet achter de Mac zit.
//
// Eenmalig koppelen: node scripts/wa-koppel.js (QR scannen met de telefoon van Sunny).
// De sessie staat in data/wa-auth/ en blijft geldig; NIET in git (staat in .gitignore).
const fs = require('fs');
const path = require('path');

const AUTH = path.join(__dirname, '..', '..', 'data', 'wa-auth');

/** Is dit apparaat al gekoppeld? */
function isGekoppeld() {
  // Bij koppelen met een koppelcode zet Baileys registered=true, maar bij een QR-koppeling
  // blijft dat veld false; het bestaan van creds.me (het eigen account) is dan het bewijs.
  try {
    const c = JSON.parse(fs.readFileSync(path.join(AUTH, 'creds.json'), 'utf8'));
    return c.registered === true || Boolean(c.me && c.me.id);
  } catch { return false; }
}

/**
 * Stuurt één of meer tekstberichten naar een chat of groep.
 * @param {string} jid  bijv. '31628209480-1583527515@g.us' (groep) of '31612345678@s.whatsapp.net'
 * @param {string[]} berichten  in volgorde, met een korte pauze ertussen
 * @param {{timeoutMs?: number}} opties
 */
async function stuurWhatsApp(jid, berichten, { timeoutMs = 90000 } = {}) {
  if (!isGekoppeld()) throw new Error('WhatsApp is nog niet gekoppeld — draai eerst: node scripts/wa-koppel.js');
  const baileys = require('@whiskeysockets/baileys');
  const makeWASocket = baileys.default || baileys.makeWASocket;
  const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    // Zo verschijnt hij in de gekoppelde-apparatenlijst van de telefoon.
    browser: ['Sonty Sunny', 'Chrome', '1.0.0'],
  });
  sock.ev.on('creds.update', saveCreds);

  const verstuurd = [];
  try {
    await new Promise((klaar, mis) => {
      const klok = setTimeout(() => mis(new Error('geen verbinding met WhatsApp binnen ' + Math.round(timeoutMs / 1000) + 's')), timeoutMs);
      sock.ev.on('connection.update', async (u) => {
        if (u.connection === 'open') {
          clearTimeout(klok);
          try {
            for (const tekst of berichten) {
              await sock.sendMessage(jid, { text: tekst });
              verstuurd.push(tekst);
              await new Promise((r) => setTimeout(r, 1500));
            }
            klaar();
          } catch (e) { mis(e); }
        }
        if (u.connection === 'close') {
          clearTimeout(klok);
          const code = u.lastDisconnect?.error?.output?.statusCode;
          // 401/loggedOut = de koppeling is van de telefoon verwijderd; opnieuw koppelen.
          mis(new Error(code === DisconnectReason.loggedOut
            ? 'de koppeling is verbroken op de telefoon — draai node scripts/wa-koppel.js opnieuw'
            : 'verbinding gesloten (code ' + code + ')'));
        }
      });
    });
  } finally {
    try { sock.end(); } catch { /* al dicht */ }
  }
  return verstuurd.length;
}

module.exports = { stuurWhatsApp, isGekoppeld, AUTH };
