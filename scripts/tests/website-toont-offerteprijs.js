#!/usr/bin/env node
/**
 * DE WEBSITE MOET TONEN WAT DE OFFERTE REKENT.
 *
 * Op 2026-08-05 bleek dat de prijsverhoging van 3 augustus wél in alle prijsmotoren zat
 * maar niet in de publieke productpagina's. Die lazen data/sunmaster-prices.json
 * rechtstreeks, en daar staat de oude opslag (1,10) in verwerkt. Gevolg: elke "Vanaf"-prijs
 * en elke cel in de vergelijkingstabel stond 9,1% onder de offerte die de klant daarna
 * kreeg. Bij drie producten (screen square, zipscreen, rolluik S-37) liep het verschil
 * verder op, tot €341 op één scherm, omdat de motor daar een volledige prijstabel leest
 * en de pagina een grove samenvatting toonde.
 *
 * De meetlat mat alleen de twee prijsmotoren, niet de laag die de bezoeker ziet. Dat gat
 * dicht deze test.
 *
 * Twee controles:
 *   1. De keuzegids moet zijn bedragen uit de prijsmotor halen, niet uit de ruwe JSON.
 *   2. De montageprijzen op de website moeten gelijk zijn aan wat v4 factureert.
 *      (Gevonden 2026-08-05: uitvalscherm stond op €195 terwijl v4 €220 rekent.)
 *
 * Alleen-lezen.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const WEB = path.join(ROOT, '..', 'sonty-website');
let fouten = 0;
const meld = (m) => { fouten++; console.log('❌ ' + m); };

/* ─── 1. Keuzegids bevraagt de motor ───────────────────────────────────────── */
const KG = path.join(WEB, 'components', 'ProductKeuzegids.tsx');
if (!fs.existsSync(KG)) {
  meld('components/ProductKeuzegids.tsx niet gevonden — is de keuzegids hernoemd? Dan moet deze test mee.');
} else {
  const src = fs.readFileSync(KG, 'utf8');
  if (!/from ["']@\/lib\/configurator\/pricing["']/.test(src) || !/calculatePrice\(/.test(src)) {
    meld('ProductKeuzegids gebruikt calculatePrice niet meer. Dan toont de pagina weer de ruwe\n' +
         '   bedragen uit sunmaster-prices.json, en die staan op het oude prijspeil (opslag 1,10).');
  }
  // De klassieke terugval: ALL_PRODUCTS weer rechtstreeks uit de JSON.
  if (/const ALL_PRODUCTS\s*(:[^=]+)?=\s*sunmaster\.products/.test(src)) {
    meld('ProductKeuzegids leest sunmaster.products weer rechtstreeks in ALL_PRODUCTS.\n' +
         '   Die bedragen staan op het prijspeil van vóór 3 augustus 2026.');
  }
}

/* ─── 2. Montage: website versus v4 ────────────────────────────────────────── */
// v4 is de motor die de offerte maakt; wat daar uit komt is wat de klant betaalt.
const montageWeb = JSON.parse(fs.readFileSync(path.join(WEB, 'data', 'sunmaster-prices.json'), 'utf8')).montage;
const v4 = require(path.join(ROOT, 'scripts', 'ai-ks', 'v4-pricing.js')).v4;

// sleutel in de website-JSON → (categorie, bedieningstype) waarmee v4 bevraagd wordt.
const KOPPELING = [
  ['knikarmscherm_standaard', 'knikarmscherm', 'bedraad', false],
  ['knikarmscherm_uitgebreid', 'knikarmscherm', 'bedraad', true],
  ['screen_solar', 'screen', 'solar', false],
  ['screen_bedraad', 'screen', 'bedraad', false],
  ['rolluik_solar', 'rolluik', 'solar', false],
  ['rolluik_bedraad', 'rolluik', 'bedraad', false],
  ['uitvalscherm', 'uitvalscherm', 'bedraad', false],
  ['pergola', 'pergola', 'bedraad', false],
  ['serre_suncontrol', 'serre', 'bedraad', false],
  // markies bewust niet: die loopt in v4 via een aparte flow zonder montageprijs hier.
];

for (const [sleutel, cat, bed, uitgebreid] of KOPPELING) {
  const web = montageWeb[sleutel];
  const echt = v4.getMontagePrice(cat, bed, uitgebreid);
  if (web === undefined) { meld(`montage.${sleutel} ontbreekt in de website-JSON`); continue; }
  if (echt === null || echt === undefined) { meld(`v4 kent geen montageprijs voor ${cat}/${bed}`); continue; }
  if (web !== echt) {
    meld(`montage ${sleutel}: website €${web}, v4 factureert €${echt}. De klant ziet een ander\n` +
         `   bedrag dan hij op zijn offerte krijgt.`);
  }
}

console.log('\n' + '─'.repeat(64));
if (fouten) {
  console.log(`❌ ${fouten} plek(ken) waar de website iets anders toont dan de offerte rekent.`);
  process.exit(1);
}
console.log('✅ De website toont dezelfde bedragen als de offertemotor.');
