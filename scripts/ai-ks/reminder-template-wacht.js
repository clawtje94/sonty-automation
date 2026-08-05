#!/usr/bin/env node
/**
 * WACHT OP GOEDKEURING VAN DE REMINDERTEMPLATE (Daimy 2026-08-04).
 *
 * Daimy heeft "Reminder whatsapp sunny" (243872) in Meta aangemaakt. Zolang die op PENDING staat
 * valt de terugkomer-opvolging terug op een Telegram-melding. Dit script kijkt periodiek of hij
 * is goedgekeurd en meldt dat.
 *
 * Waarom niet blind vertrouwen op de status: bij AB1 (242731) stond de template in Trengo op
 * ACCEPTED terwijl Meta hem bij het versturen alsnog weigerde. 16 van de 18 berichten kwamen niet
 * aan en lieten lege tickets achter. Daarom doet dit script bij goedkeuring ook een echte
 * testverzending naar het testnummer van Daimy, precies zoals bij AB1.
 *
 * Draait via launchd (nl.sonty.reminder-template), elk half uur, en stopt zichzelf zodra het klaar is.
 */
const fs = require('fs');
const path = require('path');
const CFG = require('./config.js');
const { getToken } = require('../trengo-api.js');

const TEMPLATE_ID = 243872;
// GEEN TESTNUMMER MEER (2026-08-05): +31643473757 bleek van een echte klant, Nikki Lutz.
// Expliciet meegeven via SONTY_TESTNUMMER, anders wordt er niet getest maar alleen gemeld.
const TESTNUMMER = process.env.SONTY_TESTNUMMER || null;
const KANAAL = 1359857;
const KLAAR = path.join(__dirname, '..', '..', 'data', 'ai-ks', '.reminder-template-getest');

async function telegram(tekst) {
  await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: tekst }),
  }).catch(() => {});
}

(async () => {
  if (fs.existsSync(KLAAR)) { console.log('Al getest en in gebruik, niets te doen.'); return; }

  const jwt = await getToken();
  const H = { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' };
  const r = await fetch(`https://app.trengo.com/api/v2/wa_templates/${TEMPLATE_ID}`, { headers: H });
  if (!r.ok) { console.log('kan template niet ophalen: ' + r.status); return; }
  const j = await r.json();
  const d = j.data || j;
  const status = String(d.status || d.state || '').toUpperCase();
  console.log(`Reminder whatsapp sunny (${TEMPLATE_ID}): ${status}`);

  if (status === 'DECLINED') {
    fs.writeFileSync(KLAAR, 'declined ' + new Date().toISOString());
    await telegram(`⚠️ Meta heeft "Reminder whatsapp sunny" AFGEWEZEN. De terugkomer-opvolging valt terug op een Telegram-melding zolang er geen goedgekeurde template is.`);
    return;
  }
  if (status !== 'ACCEPTED') { console.log('Nog niet goedgekeurd, volgende ronde opnieuw.'); return; }

  // Goedgekeurd. Eerst echt uitproberen voordat we hem op klanten loslaten.
  if (!TESTNUMMER) {
    await telegram(`✅ "Reminder whatsapp sunny" is door Meta goedgekeurd.\n\nIk heb hem NIET automatisch aangezet, want er staat geen testnummer ingesteld. Geef me een nummer waar ik veilig op mag testen (SONTY_TESTNUMMER), dan doe ik eerst een proefverzending en zet ik hem daarna aan.`);
    fs.writeFileSync(KLAAR, 'goedgekeurd, wacht op testnummer ' + new Date().toISOString());
    return;
  }
  const tw = await fetch('https://app.trengo.com/api/v2/wa_sessions', {
    method: 'POST', headers: H,
    body: JSON.stringify({ recipient_phone_number: TESTNUMMER, hsm_id: TEMPLATE_ID, channel_id: KANAAL,
      params: [{ type: 'body', key: '{{1}}', value: 'Daimy' }] }),
  });
  const body = await tw.text();

  if (!tw.ok) {
    await telegram(`⚠️ "Reminder whatsapp sunny" staat op ACCEPTED, maar de testverzending naar ${TESTNUMMER} werd geweigerd:\n\n${body.slice(0, 250)}\n\nPrecies wat er met AB1 gebeurde. Hij wordt NIET gebruikt; ik blijf het proberen.`);
    return;
  }

  fs.writeFileSync(KLAAR, new Date().toISOString());
  await telegram(`✅ "Reminder whatsapp sunny" is goedgekeurd en de testverzending naar ${TESTNUMMER} is echt aangekomen.\n\nVanaf nu krijgt iemand die zei terug te komen, maar bij wie het 24-uursvenster inmiddels dicht is, dit korte berichtje in plaats van alleen een melding aan jou.\n\nCheck even of het er goed uitziet op je toestel.`);
  console.log('Goedgekeurd, getest en in gebruik.');
})().catch(async (e) => {
  console.error(e);
  await telegram(`⚠️ Wachter voor de remindertemplate crashte: ${(e.message || e).toString().slice(0, 200)}`);
  process.exit(1);
});
