#!/usr/bin/env node
// Alternatieve ad-stijlen voor A/B-test (marker, donker, grid, vraag, minimaal).
// Gebruik: FONTCONFIG_FILE=data/ads/fonts/fonts.conf node scripts/ad-stijlen.js spec.json uitmap [1x1|4x5|9x16]
const sharp = require('sharp'); const fs = require('fs'); const path = require('path');
const [specPad, uitmap, format = '1x1'] = process.argv.slice(2);
const P = process.env.AD_FOTOMAP || '/Users/clawdboot/sonty-website/public/images/portfolio/rolluik/';
const F = { '1x1': { W: 1080, H: 1080, top: 0, bottom: 0 }, '4x5': { W: 1080, H: 1350, top: 0, bottom: 0 }, '9x16': { W: 1080, H: 1920, top: 250, bottom: 260 } }[format];
const { W, H } = F; const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const HV = 'Helvetica Neue, Helvetica, Arial, sans-serif', MK = 'Permanent Marker', OR = '#FF6B00', GEEL = '#FFCC01';
const fotoPad = n => { const b = P + n; for (const e of ['.webp', '.jpg', '.jpeg', '.png']) if (fs.existsSync(b + e)) return b + e; return b + '.webp'; };
const foto = (naam, w, h, pos) => sharp(fotoPad(naam)).resize(w, h, { fit: 'cover', position: pos || 'centre' }).toBuffer();
const rond = (w, h, r) => Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);
async function fotoRond(naam, w, h, r, pos) { return sharp(await foto(naam, w, h, pos)).composite([{ input: rond(w, h, r), blend: 'dest-in' }]).png().toBuffer(); }
const cta = (x, y, w, tekst, kleur = OR) => `<rect x="${x}" y="${y}" width="${w}" height="84" rx="42" fill="${kleur}"/><text x="${x + w / 2}" y="${y + 55}" text-anchor="middle" font-family="${HV}" font-size="32" font-weight="700" fill="#fff">${esc(tekst)}</text>`;
const lijnen = (arr, x, y, size, fam, w8, fill, lh) => arr.map((t, i) => `<text x="${x}" y="${y + i * lh}" font-family="${fam}" font-size="${size}" font-weight="${w8}" fill="${fill}">${esc(t)}</text>`).join('');
async function logo(wit = true) { const b = await sharp(path.join(__dirname, '..', 'data', 'ads', wit ? 'logo-wit.webp' : 'logo-wit.webp')).resize({ width: 170 }).toBuffer(); return { input: b, left: 40, top: F.top + 40 }; }

const stijlen = {
  // S1 Marker: full-bleed foto, donkere gradient, handgeschreven kop, pijl, CTA-pill
  async marker(a) {
    const bg = await foto(a.foto, W, H, a.positie);
    const gy = H - F.bottom - 600; if (a.pijl) a.pijl = [a.pijl[0], H - F.bottom - 470, a.pijl[2], a.pijl[3], a.pijl[4], a.pijl[5]];
    const svg = `<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></linearGradient></defs>
      <rect x="0" y="${gy}" width="${W}" height="${H - gy}" fill="url(#g)"/>
      ${a.pijl ? `<path d="M ${a.pijl[0]} ${a.pijl[1]} q ${a.pijl[2]} ${a.pijl[3]} ${a.pijl[4]} ${a.pijl[5]}" stroke="${GEEL}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M ${a.pijl[0] + a.pijl[4]} ${a.pijl[1] + a.pijl[5]} l -38 -8 M ${a.pijl[0] + a.pijl[4]} ${a.pijl[1] + a.pijl[5]} l -10 -38" stroke="${GEEL}" stroke-width="9" fill="none" stroke-linecap="round"/>` : ''}
      ${lijnen(a.kop, 60, H - F.bottom - 400, 78, MK, 400, GEEL, 92)}
      ${lijnen(a.sub, 60, H - F.bottom - 215, 30, HV, 500, '#fff', 40)}
      ${cta(60, H - F.bottom - 110, 520, a.cta || 'Vraag een prijsindicatie aan')}</svg>`;
    return sharp(bg).composite([{ input: Buffer.from(svg) }, await logo()]);
  },
  // S2 Donker: zwarte achtergrond, foto in afgerond kader, oranje label, witte statement
  async donker(a) {
    const fh = Math.round((H - F.top - F.bottom) * (format === '1x1' ? 0.42 : 0.5)), fw = W - 120;
    const f = await fotoRond(a.foto, fw, fh, 36, a.positie);
    const ty = F.top + 80 + fh + 70;
    const svg = `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0a0a0a"/>
      <text x="60" y="${ty}" font-family="${MK}" font-size="40" fill="${OR}">${esc(a.label)}</text>
      ${lijnen(a.kop, 60, ty + 85, 68, HV, 800, '#fff', 78)}
      ${lijnen(a.sub, 60, ty + 85 + a.kop.length * 78 + 10, 30, HV, 400, '#bdbdbd', 42)}
      ${cta(60, Math.min(H - F.bottom - 130, ty + 85 + a.kop.length * 78 + 10 + a.sub.length * 42 + 20), 520, a.cta || 'Vraag een prijsindicatie aan')}</svg>`;
    return sharp({ create: { width: W, height: H, channels: 4, background: '#0a0a0a' } }).composite([{ input: Buffer.from(svg) }, { input: f, left: 60, top: F.top + 80 }, await logo()]);
  },
  // S3 Grid: 4 foto's 2x2, witte band onderin
  async grid(a) {
    const g = 12, band = 400, gh = H - F.top - F.bottom - band, cw = (W - 3 * g) / 2, ch = (gh - 3 * g) / 2;
    const comps = [];
    for (let i = 0; i < 4; i++) comps.push({ input: await foto(a.fotos[i], Math.round(cw), Math.round(ch)), left: Math.round(g + (i % 2) * (cw + g)), top: Math.round(F.top + g + Math.floor(i / 2) * (ch + g)) });
    const by = H - F.bottom - band;
    const svg = `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><rect x="0" y="${by}" width="${W}" height="${band}" fill="#fff"/>
      ${lijnen(a.kop, 60, by + 95, 60, HV, 800, '#0a0a0a', 70)}
      ${lijnen(a.sub, 60, by + 95 + a.kop.length * 70 + 8, 28, HV, 400, '#444', 38)}
      ${cta(60, by + band - 110, 440, a.cta || 'Prijsindicatie aanvragen')}</svg>`;
    return sharp(Buffer.from(svg)).composite(comps);
  },
  // S4 Vraag & antwoord: crème achtergrond, grote vraag, antwoordkaart, ronde foto
  async vraag(a) {
    const fr = 300; const f = await fotoRond(a.foto, fr, fr, fr / 2, a.positie);
    const qy = F.top + 170 + (H > 1200 ? 120 : 0);
    const kaartY = qy + a.kop.length * 84 + 60, kaartH = 100 + a.antwoord.length * 44;
    const svg = `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#FAF8F5"/>
      <text x="60" y="${qy - 60}" font-family="${MK}" font-size="36" fill="${OR}">${esc(a.label || 'Veelgestelde vraag')}</text>
      ${lijnen(a.kop, 60, qy + 40, 74, HV, 800, '#0a0a0a', 84)}
      <rect x="60" y="${kaartY}" width="${W - 120}" height="${kaartH}" rx="28" fill="#fff" stroke="#e8e2da" stroke-width="2"/>
      <text x="100" y="${kaartY + 58}" font-family="${HV}" font-size="26" font-weight="700" fill="${OR}">ANTWOORD</text>
      ${lijnen(a.antwoord, 100, kaartY + 108, 30, HV, 400, '#222', 44)}
      ${cta(60, H - F.bottom - 130, 520, a.cta || 'Stel je vraag of vraag een prijs')}</svg>`;
    return sharp(Buffer.from(svg)).composite([{ input: f, left: W - 60 - fr, top: H - F.bottom - 130 - fr - 40 }]);
  },
  // S5 Minimaal: full-bleed foto, één handgeschreven regel, kleine CTA-tekst
  async minimaal(a) {
    const bg = await foto(a.foto, W, H, a.positie);
    const svg = `<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/></linearGradient></defs>
      <rect x="0" y="${H - F.bottom - 420}" width="${W}" height="${F.bottom + 420}" fill="url(#g)"/>
      ${lijnen(a.kop, 60, H - F.bottom - 270, 84, MK, 400, '#fff', 100)}
      <text x="60" y="${H - F.bottom - 80}" font-family="${HV}" font-size="30" fill="${GEEL}" font-weight="700" letter-spacing="3">${esc((a.cta || 'ROLLUIKEN OP MAAT  ·  SONTY.NL').toUpperCase())}</text></svg>`;
    return sharp(bg).composite([{ input: Buffer.from(svg) }, await logo()]);
  },
};
(async () => {
  fs.mkdirSync(uitmap, { recursive: true });
  for (const a of JSON.parse(fs.readFileSync(specPad, 'utf8'))) {
    const img = await stijlen[a.stijl](a); const out = path.join(uitmap, `${a.id}.png`); await img.png().toFile(out); console.log('ok', a.id);
  }
})().catch(e => { console.error('FOUT', e.message); process.exit(1); });
