#!/usr/bin/env node
// Bouwt een korte social-video: hook (0-3 s) + tekstkaart (vanaf 3 s), uit een bronvideo of een fotoslideshow.
// Gebruik: node scripts/ad-video.js uit.mp4 --format 9x16|1x1 --duur 18 (--bron video.mp4 | --fotos a.webp,b.webp,...) --hook '<json>' --kaart '<json ad-kaart>'
const { execSync } = require('child_process'); const fs = require('fs'); const path = require('path'); const os = require('os');
const a = process.argv.slice(2); const opt = { format: '9x16', duur: 18 }; const rest = [];
for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[++i]; else rest.push(a[i]); }
const out = rest[0]; const { W, H } = { '9x16': { W: 1080, H: 1920 }, '1x1': { W: 1080, H: 1080 } }[opt.format];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adv-')); const q = s => JSON.stringify(s);
const hookPng = path.join(tmp, 'hook.png'), kaartPng = path.join(tmp, 'kaart.png');
execSync(`node ${__dirname}/ad-hook.js ${q(hookPng)} ${q(opt.hook)} --format ${opt.format}`);
execSync(`node ${__dirname}/ad-kaart.js x ${q(kaartPng)} ${q(opt.kaart)} --format ${opt.format} --overlay-only`);
let bronFilter, inputs;
if (opt.bron) { inputs = `-i ${q(opt.bron)}`; bronFilter = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30[v]`; }
else { // slideshow met langzame zoom, ~4,5 s per foto
  const fotos = opt.fotos.split(','); const per = Math.max(3, Math.round(opt.duur / fotos.length)); const fr = per * 30;
  inputs = fotos.map(f => `-loop 1 -t ${per} -i ${q(f)}`).join(' ');
  const parts = fotos.map((f, i) => `[${i}:v]scale=${W * 1.3}:${H * 1.3}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.3)}:${Math.round(H * 1.3)},zoompan=z='min(zoom+0.0008,1.25)':d=${fr}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=30,setsar=1[s${i}]`).join(';');
  bronFilter = `${parts};${fotos.map((_, i) => `[s${i}]`).join('')}concat=n=${fotos.length}:v=1:a=0[v]`;
}
const n = opt.bron ? 1 : opt.fotos.split(',').length;
const filter = `${bronFilter};[v][${n}:v]overlay=0:0:enable='lt(t,3.2)'[v1];[v1][${n + 1}:v]overlay=0:0:enable='gte(t,3.2)'[vo]`;
execSync(`ffmpeg -v error -y ${inputs} -i ${q(hookPng)} -i ${q(kaartPng)} -filter_complex ${q(filter)} -map "[vo]" -t ${opt.duur} -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -an -movflags +faststart ${q(out)}`);
fs.rmSync(tmp, { recursive: true, force: true }); console.log(out);
