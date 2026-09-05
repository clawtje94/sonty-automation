#!/usr/bin/env node
// Sonty ad-kaart (winnende formule): foto + witte kaart + geel label + vinkjes + offerte-balk + logo.
// Gebruik: node scripts/ad-kaart.js foto.webp uit.png '<json>' [--format 1x1|4x5|9x16] [--overlay-only]
// json: {label, kop:[r1,r2], vinkjes:[..], cta, boven:bool, mini:bool, kopSize}
const sharp = require('sharp'); const path = require('path'); const fs = require('fs');
const argv = process.argv.slice(2); const opt = { format: '1x1' }; const rest = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--format') opt.format = argv[++i]; else if (argv[i] === '--overlay-only') opt.overlay = true; else rest.push(argv[i]); }
const [bg, out, json] = rest;
const c = Object.assign({ label: '', kop: ['', ''], vinkjes: [], cta: 'VRAAG NU EEN OFFERTE AAN' }, JSON.parse(json || '{}'));
const F = { '1x1': { W: 1080, H: 1080, top: 0, bottom: 0 }, '4x5': { W: 1080, H: 1350, top: 0, bottom: 0 }, '9x16': { W: 1080, H: 1920, top: 250, bottom: 260 } }[opt.format];
const { W, H } = F; const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const geel = '#E9B400', font = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const barH = 90, barY = H - F.bottom - barH;
const cardX = 45, cardW = W - 90, cardH = c.mini ? 150 : 380;
const cardY = c.boven ? F.top + 150 : barY - 30 - cardH;
const maxLen = Math.max(...c.kop.map(k => k.length));
const fsz = c.kopSize || Math.min(62, Math.floor((cardW - 84) / (maxLen * 0.56)));
const kopLines = c.kop.map((k, i) => `<text x="${cardX + 42}" y="${cardY + (c.mini ? 92 : 95) + i * (fsz + 11)}" font-family="${font}" font-size="${fsz}" font-weight="800" fill="#000">${esc(k)}</text>`).join('');
const last = c.kop.length - 1;
const hl = `<rect x="${cardX + 40}" y="${cardY + 95 + last * (fsz + 11) - 10}" width="${Math.min(cardW - 80, Math.round(c.kop[last].length * fsz * 0.5))}" height="20" fill="${geel}" fill-opacity="0.85"/>`;
const vink = c.vinkjes.map((t, i) => `<text x="${cardX + 40}" y="${cardY + 245 + i * 42}" font-family="${font}" font-size="${t.length > 34 ? 21 : 25}" font-weight="500" fill="#111" letter-spacing="1.2"><tspan font-weight="700">✓</tspan><tspan dx="14">${esc(t.toUpperCase())}</tspan></text>`).join('');
const label = c.label ? `<g transform="translate(${cardX} ${cardY - 8}) skewX(-8)"><rect x="0" y="-22" width="${c.label.length * 22 + 30}" height="50" fill="${geel}"/></g>
  <text x="${cardX + 14}" y="${cardY + 6}" font-family="${font}" font-size="32" font-weight="800" font-style="italic" fill="#fff">${esc(c.label)}</text>` : '';
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" fill="#fff" fill-opacity="0.93"/>
  ${hl}${kopLines}${vink}${label}
  <rect x="0" y="${barY}" width="${W}" height="${barH}" fill="#fff"/>
  <text x="${W / 2}" y="${barY + 57}" text-anchor="middle" font-family="${font}" font-size="36" font-weight="700" letter-spacing="6" fill="#111">${esc(c.cta)}</text>
</svg>`;
(async () => {
  const logo = await sharp(path.join(__dirname, '..', 'data', 'ads', 'logo-wit.webp')).resize({ width: 190 }).toBuffer();
  const lm = await sharp(logo).metadata();
  const pill = Buffer.from(`<svg width="${lm.width + 40}" height="${lm.height + 24}"><rect width="100%" height="100%" rx="14" fill="#000" fill-opacity="0.45"/></svg>`);
  const comps = [{ input: Buffer.from(svg) }, { input: pill, left: 30, top: F.top + 30 }, { input: logo, left: 50, top: F.top + 42 }];
  let base = opt.overlay ? sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }) : sharp(bg).resize(W, H, { fit: 'cover', position: c.positie || 'centre' });
  await base.composite(comps).png().toFile(out); console.log(out);
})().catch(e => { console.error('FOUT', e.message); process.exit(1); });
