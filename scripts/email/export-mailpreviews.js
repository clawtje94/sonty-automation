#!/usr/bin/env node
/**
 * ZET DE MAILPREVIEWS OP DE WEBSITE (verzoek Daimy 13-08: "volledige mails kunnen openen").
 *
 * Kopieert de gevulde preview-HTML (previews/*.preview.html, gemaakt door preview.js met
 * voorbeeldklant Marleen) naar sonty-website/public/mail-previews/. De fotokiezer in
 * /admin/mailfotos toont ze in een venster zodat je bij het kiezen ziet waar de mail over gaat.
 * Draai preview.js eerst; daarna dit script; daarna committen/pushen in sonty-website.
 */
const fs = require('fs');
const path = require('path');

const BRON = path.join(__dirname, 'previews');
const DOEL = path.join(process.env.HOME, 'sonty-website', 'public', 'mail-previews');

fs.mkdirSync(DOEL, { recursive: true });
const bestanden = fs.readdirSync(BRON).filter((f) => f.endsWith('.preview.html'));
for (const f of bestanden) {
  fs.copyFileSync(path.join(BRON, f), path.join(DOEL, f.replace('.preview.html', '.html')));
}
console.log(`${bestanden.length} mailpreviews naar ${DOEL}`);
