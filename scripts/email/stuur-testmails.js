#!/usr/bin/env node
/**
 * TESTMAILS NAAR DAIMY (opdracht Daimy 16-08: "stuur mij van elke mail een testmail met
 * echte dingen ingevuld naar daimyboot@gmail.com").
 *
 * Verstuurt elke gevulde preview (previews/*.preview.html, voorbeeldklant met echte
 * offertekaart, werkende links en CDN-foto's) als losse mail via de Outlook-API
 * (zelfde weg als de meetbon-doorzetter). Onderwerp krijgt [TEST n/25] + de Klaviyo-naam
 * zodat Daimy ze op volgorde kan beoordelen. Gaat UITSLUITEND naar het testadres.
 *
 * Gebruik: node scripts/email/stuur-testmails.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const NAAR = 'daimyboot@gmail.com';
const DRY = process.argv.includes('--dry');
const PREVIEWS = path.join(__dirname, 'previews');
const owaToken = () => fs.readFileSync(path.join(__dirname, '..', '.owa-token.txt'), 'utf8').trim();
const { SJABLONEN } = { SJABLONEN: null }; // niet nodig; namen komen uit klaviyo-sync
const NAMEN = (() => {
  const src = fs.readFileSync(path.join(__dirname, 'klaviyo-sync.js'), 'utf8');
  const m = src.match(/const NAMEN = \{([\s\S]*?)\};/);
  const map = {};
  for (const r of m[1].split('\n')) {
    const mm = r.match(/"([^"]+)":\s*"([^"]+)"/);
    if (mm) map[mm[1]] = mm[2];
  }
  return map;
})();

(async () => {
  const bestanden = fs.readdirSync(PREVIEWS).filter((f) => f.endsWith('.preview.html')).sort();
  // Logische volgorde: zoals in de flowreeksen, niet alfabetisch
  const volgorde = ['sonty-welkom', 'sonty-rp-offerte', 'sonty-herinnering-1', 'sonty-herinnering-2',
    'sonty-offerte', 'sonty-uitnodiging', 'sonty-afsluiter', 'sonty-akkoord', 'sonty-afwijzing',
    'sonty-service', 'sonty-review', 'sonty-crosssell-binnen', 'sonty-reactivering-1',
    'sonty-reactivering-1-screens', 'sonty-reactivering-1-rolluiken', 'sonty-reactivering-1-knikarm',
    'sonty-reactivering-1-pergola', 'sonty-reactivering-1-markies', 'sonty-reactivering-1-binnen',
    'sonty-reactivering-2', 'sonty-verhaal', 'sonty-bouwvak', 'sonty-weer-hitte', 'sonty-weer-lente', 'sonty-weer-donker'];
  const gesorteerd = bestanden.sort((a, b) => {
    const ia = volgorde.indexOf(a.replace('.preview.html', ''));
    const ib = volgorde.indexOf(b.replace('.preview.html', ''));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  let n = 0, fouten = 0;
  for (const f of gesorteerd) {
    n += 1;
    const sleutel = f.replace('.preview.html', '');
    const naam = NAMEN[sleutel] || sleutel;
    const onderwerp = `[TEST ${n}/${gesorteerd.length}] ${naam}`;
    if (DRY) { console.log('DRY:', onderwerp); continue; }
    const html = fs.readFileSync(path.join(PREVIEWS, f), 'utf8');
    const r = await fetch('https://outlook.office.com/api/v2.0/me/sendmail', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + owaToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Message: {
          Subject: onderwerp,
          Body: { ContentType: 'HTML', Content: html },
          ToRecipients: [{ EmailAddress: { Address: NAAR } }],
        },
        SaveToSentItems: false,
      }),
    });
    if (r.ok || r.status === 202) console.log(`verstuurd: ${onderwerp}`);
    else { fouten += 1; console.error(`FOUT ${onderwerp}: ${r.status} ${(await r.text()).slice(0, 120)}`); }
    await new Promise((x) => setTimeout(x, 4000));
  }
  console.log(`\nKlaar: ${n - fouten}/${n} testmails naar ${NAAR}`);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
