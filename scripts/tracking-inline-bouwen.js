#!/usr/bin/env node
// Bouwt een variant van de Planado-template waarin de foto's als data-URI in het
// bestand zitten, zodat de pagina geen enkele externe request meer doet. Nodig als
// Planado externe afbeeldingen zou blokkeren. Liquid blijft ongemoeid.
// Gebruik: node scripts/tracking-inline-bouwen.js [breedte] [kwaliteit]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const BREEDTE = +process.argv[2] || 640, KWAL = +process.argv[3] || 55;
const bron = path.join(__dirname, '..', 'templates', 'planado-tracking-sonty.html');
const uit = path.join(__dirname, '..', 'templates', 'planado-tracking-sonty-ingebakken.html');
const web = path.join(process.env.HOME, 'sonty-website', 'public', 'images');

let s = fs.readFileSync(bron, 'utf8');
const tmp = fs.mkdtempSync('/tmp/sonty-inline-');
const namen = [...new Set([...s.matchAll(/images\/([\w\/-]+)\.webp/g)].map(m => m[1]))];
let totaal = 0;
for (const naam of namen) {
  const src = path.join(web, naam + '.webp');
  if (!fs.existsSync(src)) { console.warn('ontbreekt:', naam); continue; }
  const isLogo = naam.includes('logo');
  const doel = path.join(tmp, naam.replace(/\//g, '_') + (isLogo ? '.png' : '.jpg'));
  cp.execFileSync('sips', ['-s', 'format', isLogo ? 'png' : 'jpeg',
    ...(isLogo ? [] : ['-s', 'formatOptions', String(KWAL)]),
    '-Z', String(isLogo ? 320 : BREEDTE), src, '--out', doel], { stdio: 'ignore' });
  const b64 = fs.readFileSync(doel).toString('base64');
  totaal += b64.length;
  s = s.split('https://sonty-website.vercel.app/images/' + naam + '.webp')
       .join('data:image/' + (isLogo ? 'png' : 'jpeg') + ';base64,' + b64);
}
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(uit, s);
console.log(uit);
console.log(namen.length + ' foto\'s ingebakken, bestand is ' + Math.round(s.length / 1024) + ' KB, geen externe requests meer');
