#!/usr/bin/env node
// Legt de Sonty-tekstkaart (winnende ad-formule) over een achtergrondfoto.
// Gebruik: node scripts/ad-kaart.js achtergrond.png uit.png '{"label":"SPECIALE AANBIEDING!","kop":["Binnen 2 weken een","nieuw zonnescherm!"],"vinkjes":["...","...","..."],"cta":"VRAAG NU EEN OFFERTE AAN"}'
const sharp = require('sharp');
const [bg, out, json] = process.argv.slice(2);
const c = Object.assign({ label: 'SPECIALE AANBIEDING!', kop: ['', ''], vinkjes: [], cta: 'VRAAG NU EEN OFFERTE AAN' }, JSON.parse(json || '{}'));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const W = 1080, H = 1080;
const cardX = 45, cardY = c.boven ? 70 : 520, cardW = 690, cardH = 380;
const geel = '#E9B400';
const vink = c.vinkjes.map((t, i) => `
  <text x="${cardX + 40}" y="${cardY + 245 + i * 42}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${t.length > 34 ? 21 : 25}" font-weight="500" fill="#111" letter-spacing="1.2">
    <tspan font-weight="700">✓</tspan><tspan dx="14">${esc(t.toUpperCase())}</tspan></text>`).join('');
const maxLen = Math.max(c.kop[0].length, c.kop[1].length);
const fs = c.kopSize || Math.min(62, Math.floor((cardW - 84) / (maxLen * 0.56)));
const kop2w = Math.min(cardW - 80, Math.round(c.kop[1].length * fs * 0.5));
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" fill="#fff" fill-opacity="0.93"/>
  <rect x="${cardX + 40}" y="${cardY + 158}" width="${kop2w}" height="20" fill="${geel}" fill-opacity="0.85"/>
  <text x="${cardX + 42}" y="${cardY + 95}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${fs}" font-weight="800" fill="#000">${esc(c.kop[0])}</text>
  <text x="${cardX + 42}" y="${cardY + 168}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${fs}" font-weight="800" fill="#000">${esc(c.kop[1])}</text>
  ${vink}
  <g transform="translate(${cardX} ${cardY - 8}) skewX(-8)">
    <rect x="0" y="-22" width="${c.label.length * 22 + 30}" height="50" fill="${geel}"/>
  </g>
  <text x="${cardX + 14}" y="${cardY + 6}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="32" font-weight="800" font-style="italic" fill="#fff">${esc(c.label)}</text>
  <rect x="0" y="${H - 90}" width="${W}" height="90" fill="#fff"/>
  <text x="${W / 2}" y="${H - 33}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="36" font-weight="700" letter-spacing="6" fill="#111">${esc(c.cta)}</text>
</svg>`;
(async () => {
  await sharp(bg).resize(W, H, { fit: 'cover' })
    .composite([{ input: Buffer.from(svg) }]).png().toFile(out);
  console.log(out);
})().catch(e => { console.error('FOUT', e.message); process.exit(1); });
