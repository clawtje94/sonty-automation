#!/usr/bin/env node
/**
 * WHATSAPP-GROEPSWACHTER (Daimy 17-08: foto's uit de Sonty toppers-groep automatisch de
 * beoordeling in). Het Sunny-nummer is als gekoppeld apparaat op deze Mac ingelogd;
 * WhatsApp Desktop slaat binnenkomende groepsmedia lokaal op. Dit script kijkt UITSLUITEND
 * in de mediamap van die ene groep (31628209480-1583527515@g.us), nooit in gesprekken.
 *
 * Nieuwe foto's: vision-oordeel (categorie/score/zin); score >= 6 gaat naar de Klaviyo-CDN
 * en de Uploaden-tab als voorstel, wachtend op Daimy's akkoord. Lager wordt genegeerd.
 * Verwerkt-lijst in data/email/wa-groep-verwerkt.json voorkomt dubbel werk.
 * Draait mee in de kwartier-cron (fotokeuzes-sync, stap 0b).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ADMIN_PASSWORD, KLAVIYO_API_KEY } = require('../secrets.js');

const GROEP = '31628209480-1583527515@g.us';
const SHARED = path.join(process.env.HOME, 'Library', 'Group Containers', 'group.net.whatsapp.WhatsApp.shared');
const STAAT = path.join(__dirname, '..', '..', 'data', 'email', 'wa-groep-verwerkt.json');
const CATS = ['knikarm', 'uitvalscherm', 'screen', 'rolluik', 'pergola', 'veranda', 'markies', 'raamdeco', 'behang', 'horren', 'vloeren', 'showroom', 'werk', 'zakelijk'];
const SITE = { Authorization: 'Bearer ' + ADMIN_PASSWORD, 'Content-Type': 'application/json' };
const MIN_SCORE = 6;

function vindGroepsMedia() {
  const uit = [];
  for (const basis of [path.join(SHARED, 'Message', 'Media', GROEP), path.join(SHARED, 'Media', GROEP)]) {
    if (!fs.existsSync(basis)) continue;
    const stack = [basis];
    while (stack.length) {
      const d = stack.pop();
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) stack.push(p);
        else if (/\.(jpe?g|png|heic|webp)$/i.test(f.name)) uit.push(p);
      }
    }
  }
  return uit;
}

(async () => {
  const verwerkt = fs.existsSync(STAAT) ? JSON.parse(fs.readFileSync(STAAT, 'utf8')) : {};
  const media = vindGroepsMedia();
  const nieuw = media.filter((p) => !verwerkt[path.basename(p)]);
  if (!nieuw.length) { console.log(`wa-groep: geen nieuwe media (${media.length} bekend)`); return; }
  console.log(`wa-groep: ${nieuw.length} nieuwe foto(s)`);

  const APIKEY = fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();
  let geplaatst = 0;
  for (const p of nieuw.slice(0, 30)) {
    const naam = path.basename(p);
    verwerkt[naam] = new Date().toISOString().slice(0, 10);
    try {
      const klein = '/tmp/wa-wachter.jpg';
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '55', '--resampleWidth', '1024', p, '--out', klein], { stdio: 'ignore' });
      const b64 = fs.readFileSync(klein).toString('base64');
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': APIKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 250,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
            { type: 'text', text: `Foto uit de interne WhatsApp-groep van Sonty (zonwering/raamdecoratie). Beoordeel voor marketinggebruik. Categorie uit: ${CATS.join(', ')}. Let op het verschil: een knikarm(scherm) hangt AAN DE GEVEL zonder palen; een pergola of veranda staat op PALEN boven een terras. Marketingscore 1-10: alleen 6+ bij scherp, goed belicht en representatief (mooi geplaatst product, showroom, monteur netjes aan het werk, blije klant). Screenshots, memes, documenten en privefotos altijd 1-4. Eén korte NL-zin. UITSLUITEND JSON: {"cat":"...","score":7,"oordeel":"..."}` },
          ] }],
        }),
      });
      const j = await resp.json();
      const m = (j?.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
      const uit = m ? JSON.parse(m[0]) : null;
      if (!uit || !CATS.includes(uit.cat) || Math.min(10, Number(uit.score) || 1) < MIN_SCORE) { console.log(`  - ${naam}: niet bruikbaar`); continue; }

      const jpg = '/tmp/wa-wachter-vol.jpg';
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', p, '--out', jpg], { stdio: 'ignore' });
      const cdnNaam = 'wagroep-' + naam.replace(/\.[^.]+$/, '').replace(/[^\w.-]/g, '-').slice(0, 60);
      const fd = new FormData();
      fd.append('file', new Blob([fs.readFileSync(jpg)], { type: 'image/jpeg' }), cdnNaam + '.jpg');
      fd.append('name', cdnNaam);
      const up = await fetch('https://a.klaviyo.com/api/image-upload/', {
        method: 'POST', headers: { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, revision: '2024-10-15', accept: 'application/json' }, body: fd });
      if (!up.ok) throw new Error('cdn ' + up.status);
      const url = (await up.json()).data.attributes.image_url;
      await fetch('https://sonty-website.vercel.app/api/admin/fotoupload', { method: 'POST', headers: SITE, body: JSON.stringify({ registreer: { url, naam: cdnNaam + '.jpg', type: 'foto', cat: uit.cat } }) });
      await fetch('https://sonty-website.vercel.app/api/admin/fotoupload', { method: 'POST', headers: SITE, body: JSON.stringify({ beoordeel: [{ url, aiCat: uit.cat, aiScore: Math.min(10, Number(uit.score)), aiOordeel: String(uit.oordeel || '').slice(0, 180) }] }) });
      geplaatst += 1;
      console.log(`  + ${naam} -> ${uit.cat} ${uit.score}/10`);
    } catch (e) { console.error(`  fout ${naam}: ${String(e.message).slice(0, 60)}`); }
    await new Promise((x) => setTimeout(x, 400));
  }
  fs.writeFileSync(STAAT, JSON.stringify(verwerkt, null, 1));
  if (geplaatst) {
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: `📸 ${geplaatst} nieuwe foto(s) uit de Sonty toppers-groep beoordeeld en klaargezet in de Uploaden-tab voor jouw akkoord.` }),
    });
  }
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
