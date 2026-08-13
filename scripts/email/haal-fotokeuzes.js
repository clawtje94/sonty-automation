#!/usr/bin/env node
/**
 * HAALT DE FOTOKEUZES OP uit het dashboard (/admin/mailfotos op sonty-website).
 *
 * Daimy kiest daar per mail-fotoslot een foto uit de portfolio-bibliotheek. Dit script zet die
 * keuzes in data/email/foto-keuzes.json. Daarna verwerkt de gewone keten ze:
 *   1. node scripts/email/fotos-uploaden.js   (gekozen foto's als JPEG naar de Klaviyo-CDN)
 *   2. node scripts/email/bouw-templates.js   (mails bouwen met de gekozen foto's)
 *   3. checks + previews + klaviyo-sync       (zoals altijd, zie FLOWS.md)
 * Met --alles draait dit script stap 1 en 2 er direct achteraan (sync blijft bewust handmatig).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ADMIN_PASSWORD } = require('../secrets.js');

const DOEL = path.join(__dirname, '..', '..', 'data', 'email', 'foto-keuzes.json');

(async () => {
  const r = await fetch('https://sonty-website.vercel.app/api/admin/mailfotos', {
    headers: { Authorization: 'Bearer ' + ADMIN_PASSWORD },
  });
  if (!r.ok) { console.error(`FOUT: ${r.status} ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  const { keuzes } = await r.json();
  fs.writeFileSync(DOEL, JSON.stringify(keuzes || {}, null, 1));
  const aantal = Object.values(keuzes || {}).reduce((n, slots) => n + Object.keys(slots).length, 0);
  console.log(`${aantal} fotokeuzes opgehaald naar data/email/foto-keuzes.json`);

  if (process.argv.includes('--alles')) {
    for (const stap of ['fotos-uploaden.js', 'bouw-templates.js']) {
      console.log(`\n--- ${stap} ---`);
      execFileSync('node', [path.join(__dirname, stap)], { stdio: 'inherit' });
    }
    console.log('\nKlaar. Controleer previews en draai daarna zelf klaviyo-sync.js --doe-het.');
  }
})();
