#!/usr/bin/env node
// Offerte-mail in Sonty-huisstijl via het Trengo-mailkanaal "Aanvragen" (aanvragen@sonty.nl).
// Opdracht Daimy 2026-07-17: niet vanaf joey@sonty.nl maar vanaf aanvragen@sonty.nl mailen.
// Gebruik: node scripts/send-offerte-mail-trengo.js --to x@y.nl --naam "Joey Engelen" --voornaam Joey \
//   --product "..." --bedrag "€ 8.262" --link "https://..." --geldig "23 juli 2026" [--intro "..."] [--subject "..."]
const fs = require('fs');
const path = require('path');

const KANAAL_AANVRAGEN = 1363384;
const TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();

const arg = (naam, verplicht = true) => {
  const i = process.argv.indexOf('--' + naam);
  if (i === -1 || !process.argv[i + 1]) {
    if (verplicht) { console.error(`--${naam} ontbreekt`); process.exit(1); }
    return null;
  }
  return process.argv[i + 1];
};

const to = arg('to');
const naam = arg('naam');
const vars = {
  '{{voornaam}}': arg('voornaam'),
  '{{product}}': arg('product'),
  '{{offertebedrag}}': arg('bedrag'),
  '{{offerte_link}}': arg('link'),
  '{{geldig_tot}}': arg('geldig'),
};
const intro = arg('intro', false);
const subject = arg('subject', false) || 'Je offerte van Sonty';

async function t(method, ep, body) {
  const r = await fetch('https://app.trengo.com/api/v2' + ep, {
    method,
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${ep} → ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

(async () => {
  let html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'emails', '03-definitieve-offerte.html'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
  if (intro) html = html.replace(/<p>Bedankt voor de fijne opmeting![\s\S]*?<\/p>/, `<p>${intro}</p>`);
  for (const [k, v] of Object.entries(vars)) html = html.split(k).join(v);

  // 1. Contact op het Aanvragen-kanaal (bestaat hij al, dan geeft Trengo dezelfde terug)
  const contact = await t('POST', `/channels/${KANAAL_AANVRAGEN}/contacts`, { identifier: to, name: naam });
  const contactId = contact?.id || contact?.data?.id;
  if (!contactId) throw new Error('Geen contact-id terug: ' + JSON.stringify(contact).slice(0, 200));

  // 2. Ticket op het mailkanaal + 3. bericht (= de daadwerkelijke uitgaande mail)
  const ticket = await t('POST', '/tickets', { contact_id: contactId, channel_id: KANAAL_AANVRAGEN, subject });
  const ticketId = ticket?.id || ticket?.data?.id;
  const msg = await t('POST', `/tickets/${ticketId}/messages`, { message: html, subject });

  // Ticket NIET automatisch sluiten — anders valt het uit de inbox en lijkt het alsof de klant
  // niet geholpen is (Daimy 18 juli). Het team ziet het gesprek nu gewoon staan en sluit het zelf.

  console.log(`Verstuurd vanaf aanvragen@sonty.nl naar ${to} (ticket ${ticketId}, bericht ${msg?.message_id || msg?.id || '?'})`);
})().catch(e => { console.error('MISLUKT:', e.message); process.exit(1); });
