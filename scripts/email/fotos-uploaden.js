#!/usr/bin/env node
/**
 * ZET DE MAILFOTO'S OP DE CDN VAN KLAVIYO (Daimy 2026-07-28).
 *
 * Waarom niet gewoon de foto's van de website gebruiken: die staan er als WebP, en Outlook op
 * Windows rendert WebP niet. Klanten met Outlook zien dan lege vlakken waar de foto hoort, precies
 * bij de mails die het meeste van beeld moeten hebben. Daarom worden ze hier omgezet naar JPEG
 * (logo naar PNG, want dat heeft transparantie nodig) en bij Klaviyo neergezet.
 *
 * Formaat: 800 pixels breed. De mail toont ze op 528 pixels, dus dat is scherp genoeg op een
 * retina-scherm zonder dat iemand op mobiel een halve megabyte staat te laden.
 *
 * Resultaat komt in data/email/fotos-cdn.json, waar bouw-templates.js het uit leest.
 *
 * Gebruik: node scripts/email/fotos-uploaden.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { KLAVIYO_API_KEY } = require('../secrets.js');

const BRON = path.join(process.env.HOME, 'sonty-website', 'public', 'images', 'eigen');
const TIJDELIJK = '/tmp/sonty-mailfotos';
const DOEL = path.join(__dirname, '..', '..', 'data', 'email', 'fotos-cdn.json');
const H = { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, accept: 'application/json', revision: '2024-10-15' };

// Alleen foto's waarvan ik zelf heb gecontroleerd wat erop staat. De bestandsnamen in die map
// zijn niet betrouwbaar: "screen-woning" en "screen-rijtjeshuizen" tonen allebei een knikarmscherm.
const FOTOS = ['kantoor-stalen', 'knikarm-gevel', 'montage-team-1', 'pergola-tuin-2',
               'showroom-opening', 'showroom-ramen', 'showroom-tafel', 'sonty-bus', 'team-klant-blij',
               // 13-08 na visuele QA-ronde: betere beelden, inhoud met eigen ogen gecontroleerd
               'showroom-overzicht', 'pergola-tuin-1', 'knikarm-resultaat', 'montage-cassette'];

async function upload(bestandspad, naam, type) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(bestandspad)], { type }), path.basename(bestandspad));
  fd.append('name', naam);
  const r = await fetch('https://a.klaviyo.com/api/image-upload/', {
    method: 'POST', headers: { Authorization: H.Authorization, revision: H.revision, accept: 'application/json' }, body: fd });
  const t = await r.text();
  if (!r.ok) { console.error(`  FOUT ${naam}: ${r.status} ${t.slice(0, 160)}`); return null; }
  return JSON.parse(t).data.attributes.image_url;
}

(async () => {
  fs.mkdirSync(TIJDELIJK, { recursive: true });
  const bestaand = await (await fetch('https://a.klaviyo.com/api/images/', { headers: H })).json();
  const opNaam = new Map((bestaand.data || []).map((d) => [d.attributes.name, d.attributes.image_url]));
  const uit = {};

  for (const naam of FOTOS) {
    const sleutel = 'sonty-' + naam;
    if (opNaam.has(sleutel)) { uit[naam] = opNaam.get(sleutel); console.log(`  staat er al: ${naam}`); continue; }
    const jpg = path.join(TIJDELIJK, naam + '.jpg');
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '55', '--resampleWidth', '800',
      path.join(BRON, naam + '.webp'), '--out', jpg], { stdio: 'ignore' });
    const url = await upload(jpg, sleutel, 'image/jpeg');
    if (url) { uit[naam] = url; console.log(`  geupload: ${naam}`); }
    await new Promise((x) => setTimeout(x, 700));
  }

  // Gekozen dashboard-foto's (/admin/mailfotos): kunnen uit elke portfolio-map komen.
  // Sleutel = bestandsnaam zonder extensie, zelfde afspraak als foto() in bouw-templates.js.
  const keuzesPad = path.join(__dirname, '..', '..', 'data', 'email', 'foto-keuzes.json');
  if (fs.existsSync(keuzesPad)) {
    const keuzes = JSON.parse(fs.readFileSync(keuzesPad, 'utf8'));
    const paden = [...new Set(Object.values(keuzes).flatMap((slots) => Object.values(slots)))];
    for (const src of paden) {
      const rel = String(src).replace(/^\/images\//, '');
      const sleutelBasis = path.basename(rel).replace(/\.(webp|jpe?g|png|avif)$/i, '');
      if (uit[sleutelBasis]) continue;
      const sleutel = 'sonty-' + sleutelBasis;
      if (opNaam.has(sleutel)) { uit[sleutelBasis] = opNaam.get(sleutel); continue; }
      const bronPad = path.join(process.env.HOME, 'sonty-website', 'public', 'images', rel);
      if (!fs.existsSync(bronPad)) { console.error(`  ONTBREEKT lokaal: ${rel}`); continue; }
      const jpg = path.join(TIJDELIJK, sleutelBasis + '.jpg');
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '55', '--resampleWidth', '800', bronPad, '--out', jpg], { stdio: 'ignore' });
      const url = await upload(jpg, sleutel, 'image/jpeg');
      if (url) { uit[sleutelBasis] = url; console.log(`  geupload (keuze): ${sleutelBasis}`); }
      await new Promise((x) => setTimeout(x, 700));
    }
  }

  // Logo apart: PNG vanwege de transparantie.
  if (opNaam.has('sonty-logo-wit')) uit['logo-wit'] = opNaam.get('sonty-logo-wit');
  else {
    const png = path.join(TIJDELIJK, 'logo-wit.png');
    execFileSync('curl', ['-s', '-o', path.join(TIJDELIJK, 'logo.webp'),
      'https://cdn.prod.website-files.com/666ab30f0f595f63bc4b0971/666ab30f0f595f63bc4b0b6e_Logo_White.webp']);
    execFileSync('sips', ['-s', 'format', 'png', '--resampleWidth', '220', path.join(TIJDELIJK, 'logo.webp'), '--out', png], { stdio: 'ignore' });
    const url = await upload(png, 'sonty-logo-wit', 'image/png');
    if (url) { uit['logo-wit'] = url; console.log('  geupload: logo-wit'); }
  }

  fs.mkdirSync(path.dirname(DOEL), { recursive: true });
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1));
  console.log(`\n${Object.keys(uit).length} afbeeldingen beschikbaar in data/email/fotos-cdn.json`);
})();
