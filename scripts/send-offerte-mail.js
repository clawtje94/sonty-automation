#!/usr/bin/env node
// Offerte-mail in de eigen Sonty-huisstijl (template 03) — eerste gebruik: test naar Joey
// (opdracht Daimy 2026-07-17: "ik had graag de offerte naar hem gemaild gezien in onze eigen style").
// Gebruik: node scripts/send-offerte-mail.js --to x@y.nl --voornaam Joey --product "..." \
//   --bedrag "€ 8.262" --link "https://..." --geldig "23 juli 2026" [--intro "..."] [--subject "..."]
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const arg = (naam, verplicht = true) => {
  const i = process.argv.indexOf('--' + naam);
  if (i === -1 || !process.argv[i + 1]) {
    if (verplicht) { console.error(`--${naam} ontbreekt`); process.exit(1); }
    return null;
  }
  return process.argv[i + 1];
};

const to = arg('to');
const vars = {
  '{{voornaam}}': arg('voornaam'),
  '{{product}}': arg('product'),
  '{{offertebedrag}}': arg('bedrag'),
  '{{offerte_link}}': arg('link'),
  '{{geldig_tot}}': arg('geldig'),
};
const intro = arg('intro', false); // vervangt de standaard "Bedankt voor de fijne opmeting!"-alinea
const subject = arg('subject', false) || 'Je offerte van Sonty';

(async () => {
  let html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'emails', '03-definitieve-offerte.html'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
  if (intro) html = html.replace(/<p>Bedankt voor de fijne opmeting![\s\S]*?<\/p>/, `<p>${intro}</p>`);
  for (const [k, v] of Object.entries(vars)) html = html.split(k).join(v);

  const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', port: 587, secure: false,
    auth: { user: 'joey@sontymontage.nl', pass: fs.readFileSync(path.join(__dirname, '.outlook-joey-pass.txt'), 'utf8').trim() },
    tls: { ciphers: 'SSLv3' },
  });
  await transporter.sendMail({ from: '"Sonty" <joey@sontymontage.nl>', to, subject, html });
  console.log(`Offerte-mail verstuurd naar ${to} (${vars['{{offertebedrag}}']}, geldig tot ${vars['{{geldig_tot}}']})`);
})().catch(e => { console.error('MISLUKT:', e.message); process.exit(1); });
