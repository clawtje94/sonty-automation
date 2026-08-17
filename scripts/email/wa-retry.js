#!/usr/bin/env node
/**
 * HERKANSING voor foto's die op de Klaviyo-uploadlimiet strandden (429). De map
 * data/email/wa-retry/ bevat de wachtenden; elke kwartier-cron-run probeert ze opnieuw
 * (beoordelen, uploaden, registreren als voorstel) en verwijdert wat lukt. Lege map = klaar.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ADMIN_PASSWORD, KLAVIYO_API_KEY } = require('../secrets.js');

const MAP = path.join(__dirname, '..', '..', 'data', 'email', 'wa-retry');
const CATS = ['knikarm', 'uitvalscherm', 'screen', 'rolluik', 'pergola', 'veranda', 'markies', 'raamdeco', 'behang', 'horren', 'vloeren', 'showroom', 'werk', 'zakelijk'];
const SITE = { Authorization: 'Bearer ' + ADMIN_PASSWORD, 'Content-Type': 'application/json' };

(async () => {
  if (!fs.existsSync(MAP)) return;
  const rest = fs.readdirSync(MAP).filter((f) => /\.jpe?g$/i.test(f));
  if (!rest.length) { console.log('wa-retry: leeg'); return; }
  const APIKEY = fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();
  let gelukt = 0;
  for (const f of rest) {
    const p = path.join(MAP, f);
    try {
      const klein = '/tmp/wa-retry.jpg';
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '55', '--resampleWidth', '1024', p, '--out', klein], { stdio: 'ignore' });
      const b64 = fs.readFileSync(klein).toString('base64');
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': APIKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 250, messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text: `Foto uit de interne WhatsApp-groep van Sonty (zonwering/raamdecoratie). Beoordeel voor marketinggebruik. Categorie uit: ${CATS.join(', ')}. Let op: een knikarm(scherm) hangt AAN DE GEVEL zonder palen; een pergola of veranda staat op PALEN boven een terras. Marketingscore 1-10 (screenshots/memes/documenten/privefotos altijd 1-4). Eén korte NL-zin. UITSLUITEND JSON: {"cat":"...","score":7,"oordeel":"..."}` },
        ] }] }),
      });
      const j = await resp.json();
      const m = (j?.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
      const uit = m ? JSON.parse(m[0]) : null;
      if (!uit || !CATS.includes(uit.cat) || (Number(uit.score) || 1) < 6) { fs.unlinkSync(p); console.log(`- ${f}: niet bruikbaar, weg`); continue; }
      const naam = 'wa2-' + (f.match(/PHOTO-([0-9-]+)/) || [null, f.replace(/\W/g, '-')])[1];
      const fd = new FormData();
      fd.append('file', new Blob([fs.readFileSync(p)], { type: 'image/jpeg' }), naam + '.jpg');
      fd.append('name', naam);
      const up = await fetch('https://a.klaviyo.com/api/image-upload/', { method: 'POST', headers: { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, revision: '2024-10-15', accept: 'application/json' }, body: fd });
      if (up.status === 429) { console.log('wa-retry: limiet nog actief, later opnieuw'); return; }
      if (!up.ok) throw new Error('cdn ' + up.status);
      const url = (await up.json()).data.attributes.image_url;
      await fetch('https://sonty-website.vercel.app/api/admin/fotoupload', { method: 'POST', headers: SITE, body: JSON.stringify({ registreer: { url, naam: naam + '.jpg', type: 'foto', cat: uit.cat } }) });
      await fetch('https://sonty-website.vercel.app/api/admin/fotoupload', { method: 'POST', headers: SITE, body: JSON.stringify({ beoordeel: [{ url, aiCat: uit.cat, aiScore: Math.min(10, Number(uit.score)), aiOordeel: String(uit.oordeel || '').slice(0, 180) }] }) });
      fs.unlinkSync(p);
      gelukt += 1;
      console.log(`+ ${f} alsnog geplaatst (${uit.cat} ${uit.score}/10)`);
    } catch (e) { console.error(`fout ${f}: ${String(e.message).slice(0, 60)}`); }
    await new Promise((x) => setTimeout(x, 500));
  }
  if (gelukt) console.log(`wa-retry: ${gelukt} alsnog geplaatst`);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
