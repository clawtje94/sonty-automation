#!/usr/bin/env node
// Hook-overlay voor de eerste 3 seconden van een 9:16/1:1 video: grote handgeschreven regel + ondertitel-balk.
// Gebruik: node scripts/ad-hook.js uit.png '{"hook":["Slaapkamer","te warm?"],"sub":"Rolluik op maat, gemonteerd door Sonty"}' [--format 9x16|1x1]
const sharp = require('sharp'); const path = require('path');
const argv = process.argv.slice(2); let format = '9x16'; const rest = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--format') format = argv[++i]; else rest.push(argv[i]); }
const [out, json] = rest; const c = JSON.parse(json);
const F = { '9x16': { W: 1080, H: 1920, top: 250, bottom: 260 }, '1x1': { W: 1080, H: 1080, top: 0, bottom: 0 } }[format]; const { W, H } = F;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const y0 = F.top + Math.round((H - F.top - F.bottom) * 0.28);
const svg = `<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
  <rect x="0" y="${F.top}" width="${W}" height="${y0 - F.top + 320}" fill="url(#g)"/>
  ${c.hook.map((t, i) => `<text x="${W / 2}" y="${y0 + i * 118}" text-anchor="middle" font-family="Permanent Marker" font-size="104" fill="#FFCC01" stroke="#000" stroke-width="3" paint-order="stroke">${esc(t)}</text>`).join('')}
  ${c.sub ? `<rect x="${W / 2 - 420}" y="${y0 + c.hook.length * 118 - 40}" width="840" height="70" rx="12" fill="#000" fill-opacity="0.7"/><text x="${W / 2}" y="${y0 + c.hook.length * 118 + 8}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-size="32" font-weight="700" fill="#fff">${esc(c.sub)}</text>` : ''}</svg>`;
sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: Buffer.from(svg) }]).png().toFile(out).then(() => console.log(out));
