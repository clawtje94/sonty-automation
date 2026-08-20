#!/usr/bin/env node
// Rendert templates/planado-tracking-sonty.html (de Planado/Liquid-template) met
// voorbeelddata naar een preview-HTML, zodat je hem kunt bekijken zonder Planado.
// Draait op een echte Liquid-engine, dus dit is meteen een syntaxcontrole.
// Gebruik: [STAND=ingepland|onderweg|klaar] node scripts/tracking-preview-render.js [uit.html]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { Liquid } = require('liquidjs');

const STAND = process.env.STAND || 'onderweg';
const SOORT = process.env.SOORT || 'montage';   // montage | inmeten | onbekend
const bron = path.join(__dirname, '..', 'templates', 'planado-tracking-sonty.html');
const uit = process.argv[2] || path.join(__dirname, '..', 'screenshots', 'tracking-preview.html');

const engine = new Liquid({ strictFilters: false, strictVariables: false });
engine.registerFilter('datetime', v => v || '');
engine.registerFilter('translate', v => v || '');
engine.registerFilter('filled?', v => !!(v && String(v).trim()));
engine.registerFilter('map', (v, dest) =>
  '<div id="map" style="display:grid;place-items:center;background:var(--surface-2);' +
  'color:var(--ink-faint);font-size:13.5px;text-align:center;padding:20px">Hier tekent Planado de live kaart<br>' +
  'met de positie van de monteur</div>');

const ctx = {
  style_variables: '',
  job: {
    template_name: SOORT === 'montage' ? 'Montage afspraak particulier' : SOORT === 'inmeten' ? 'Inmeten particulier' : '',
    serial_no: '5533',
    scheduled_at: 'donderdag 20 augustus, 09:00 – 12:00',
    scheduled_duration: '2 uur',
    finished_at: STAND === 'klaar' ? 'donderdag 20 augustus, 11:52' : null,
    client: { name: 'Familie de Groot' },
    site: { name: 'Woonhuis' },
    address: { full: 'Julianalaan 42, 2282 GR Rijswijk', formatted: 'Julianalaan 42, 2282 GR Rijswijk', geolocation: 'x' },
  },
  worker: {
    name: 'Marvin',
    phone: '06 12 34 56 78',
    geolocation: STAND === 'onderweg' ? 'y' : null,
  },
};

(async () => {
  let s = await engine.parseAndRender(fs.readFileSync(bron, 'utf8'), ctx);
  s = s.replace(/&lt;div id="map"[\s\S]*?&lt;\/div&gt;/g, m =>
    m.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'));

  // foto's insluiten zodat de preview los van internet werkt
  const web = path.join(process.env.HOME, 'sonty-website', 'public', 'images');
  const tmp = fs.mkdtempSync('/tmp/sonty-shot-');
  const namen = [...new Set([...s.matchAll(/images\/([\w\/-]+)\.webp/g)].map(m => m[1]))].filter(n => n !== 'logo-sonty');
  for (const naam of namen) {
    const src = path.join(web, naam + '.webp'), jpg = path.join(tmp, naam.replace(/\//g,'_') + '.jpg');
    try {
      cp.execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '62', '-Z', '900', src, '--out', jpg], { stdio: 'ignore' });
      s = s.split('https://sonty-website.vercel.app/images/' + naam + '.webp')
           .join('data:image/jpeg;base64,' + fs.readFileSync(jpg).toString('base64'));
    } catch { console.warn('foto overslaan:', naam); }
  }
  const logo = path.join(web, 'logo-sonty.webp');
  if (fs.existsSync(logo)) s = s.split('https://sonty-website.vercel.app/images/logo-sonty.webp')
    .join('data:image/webp;base64,' + fs.readFileSync(logo).toString('base64'));
  fs.rmSync(tmp, { recursive: true, force: true });

  // waarschuwingsbalk: dit bestand is een voorbeeld met verzonnen gegevens
  s = s.replace('<div class="wrap">', `<div style="background:#B00020;color:#fff;font:600 13px/1.4 sans-serif;padding:10px 14px;text-align:center">
    VOORBEELD met verzonnen gegevens (${'\u0022'}Marvin${'\u0022'}, ${'\u0022'}Familie de Groot${'\u0022'}). NIET in Planado plakken.<br>
    Voor Planado gebruik je templates/planado-tracking-sonty.html
  </div>\n<div class="wrap">`);
  fs.writeFileSync(uit, s);
  const rest = (s.match(/\{[{%]/g) || []).length;
  console.log('preview:', uit, '(' + Math.round(s.length / 1024) + ' KB, stand ' + STAND + ', ' + rest + ' liquid-resten)');
})().catch(e => { console.error('LIQUID-FOUT:', e.message); process.exit(1); });
