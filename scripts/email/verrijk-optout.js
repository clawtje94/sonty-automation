#!/usr/bin/env node
/**
 * MARKEERT DE KLANTEN DIE GEEN MAIL MEER WILLEN (Daimy 2026-07-27).
 *
 * In Reuzenpanda staat de status "geen herinnering meer" voor klanten die hebben aangegeven geen
 * mails of opvolging meer te willen. De AI-klantenservice zet mensen daar zelf op zodra ze dat
 * vragen (29 keer dit jaar). Die mensen mogen NOOIT in een campagne belanden; dat is niet alleen
 * netjes maar ook wettelijk verplicht.
 *
 * Dit script vult data/email/rp-export.json aan met twee velden per klant:
 *   statusId    de pipelinestatus uit Reuzenpanda
 *   magMail     false zodra die status "geen herinnering meer" is
 *
 * De segmenten eisen vervolgens allemaal magMail = ja. Dat is bewust zo gebouwd dat het veilig
 * faalt: ontbreekt het veld, dan valt iemand buiten élk segment in plaats van erin.
 *
 * Alleen lezen uit Reuzenpanda, schrijft alleen het lokale exportbestand.
 * Gebruik: node scripts/email/verrijk-optout.js
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../ai-ks/config.js');

const BRON = path.join(__dirname, '..', '..', 'data', 'email', 'rp-export.json');
const GEEN_HERINNERING = CFG.RP_STATUS_GEEN_HERINNERING;

(async () => {
  if (!fs.existsSync(BRON)) { console.error('Geen export gevonden. Draai eerst scripts/email/rp-export.js'); process.exit(1); }
  const rijen = JSON.parse(fs.readFileSync(BRON, 'utf8'));

  const board = await (await fetch(
    `https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/boards/${CFG.RP_BOARD}/items`,
    { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } })).json();
  if (!board?.items) { console.error('Reuzenpanda niet bereikbaar.'); process.exit(1); }

  const statusVan = new Map(board.items.map((it) => [it.id, it.status_id || it.status?.id || null]));
  console.log(`${board.items.length} dossiers opgehaald.`);

  // Alle dossiers met deze status, ook die van een tweede dossier van dezelfde klant: één
  // opt-out ergens betekent geen mail, punt. Daarom eerst alle geblokkeerde adressen verzamelen.
  const geblokkeerd = new Set();
  for (const it of board.items) {
    if ((it.status_id || it.status?.id) !== GEEN_HERINNERING) continue;
    const blob = ((it.summary || '') + '\n' + (it.description || '')).toLowerCase();
    for (const m of blob.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []) geblokkeerd.add(m);
  }
  console.log(`${geblokkeerd.size} e-mailadressen staan in Reuzenpanda op "geen herinnering meer".`);

  let uit = 0;
  for (const r of rijen) {
    r.statusId = statusVan.get(r.itemId) || null;
    r.magMail = !(r.statusId === GEEN_HERINNERING || geblokkeerd.has(r.email));
    if (!r.magMail) uit++;
  }

  fs.writeFileSync(BRON, JSON.stringify(rijen, null, 1));
  console.log(`\n${uit} van de ${rijen.length} klanten uitgesloten van alle campagnes.`);
  console.log(`${rijen.length - uit} mogen wel benaderd worden.`);
  console.log('Export bijgewerkt. Draai daarna klaviyo-profielen.js om het door te zetten.');
})();
