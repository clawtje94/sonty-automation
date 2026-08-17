#!/usr/bin/env node
/**
 * AI-TRIAGE VAN DASHBOARD-UPLOADS (Daimy 17-08: "ik upload ze, jij zoekt uit wat waar
 * moet, ik akkordeer").
 *
 * Haalt uploads met status "nieuw" op, bekijkt elke foto met vision (Haiku, zelfde key
 * als het avondrapport), bepaalt de categorie en een kwaliteit/emotie-score met één zin
 * uitleg, en zet het voorstel terug. Daimy ziet het voorstel in de Uploaden-tab en drukt
 * op Akkoord (of kiest zelf). Pas ná akkoord doet een foto mee in de mailfoto-kiezer.
 * Video's krijgen een voorstel zonder AI-oordeel (zelf bekijken). Draait mee in de
 * kwartier-cron; met 0 nieuwe uploads kost dit één API-call.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ADMIN_PASSWORD } = require('../secrets.js');

const CATS = ['knikarm', 'uitvalscherm', 'screen', 'rolluik', 'pergola', 'veranda', 'markies', 'raamdeco', 'behang', 'horren', 'vloeren', 'showroom', 'werk', 'zakelijk'];
const API = 'https://sonty-website.vercel.app/api/admin/fotoupload';
const H = { Authorization: 'Bearer ' + ADMIN_PASSWORD, 'Content-Type': 'application/json' };

async function telegram(tekst) {
  try {
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: tekst }),
    });
  } catch { /* best-effort */ }
}

(async () => {
  const r = await fetch(API, { headers: H });
  if (!r.ok) { console.error('uploads ophalen mislukt:', r.status); process.exit(1); }
  const { uploads } = await r.json();
  const nieuw = (uploads || []).filter((u) => (u.status || 'nieuw') === 'nieuw');
  if (!nieuw.length) { console.log('geen nieuwe uploads'); return; }

  const APIKEY = fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();
  const voorstellen = [];
  for (const u of nieuw.slice(0, 20)) {
    if (u.type === 'video') {
      voorstellen.push({ url: u.url, aiCat: u.cat, aiScore: 0, aiOordeel: 'Video: bekijk hem even, na akkoord bewaard voor site en social.' });
      continue;
    }
    try {
      const tmp = '/tmp/triage-src', klein = '/tmp/triage.jpg';
      execFileSync('curl', ['-sf', '-o', tmp, u.url], { timeout: 120000 });
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '60', '--resampleWidth', '1024', tmp, '--out', klein], { stdio: 'ignore' });
      const b64 = fs.readFileSync(klein).toString('base64');
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': APIKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
            { type: 'text', text: `Dit is een foto voor Sonty (zonwering/raamdecoratie, Rijswijk). Kies de best passende categorie uit: ${CATS.join(', ')} (werk = montage in actie, showroom = winkelinterieur, zakelijk = bedrijfspand/projecten, raamdeco = binnenraamdecoratie). Geef ook een marketingscore 1-10 (scherpte, licht, emotie, bruikbaarheid in een klantmail) en één korte zin in het Nederlands over wat erop staat en of hij bruikbaar is. UITSLUITEND JSON: {"cat":"...","score":7,"oordeel":"..."}` },
          ] }],
        }),
      });
      const j = await resp.json();
      const m = (j?.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
      const uit = m ? JSON.parse(m[0]) : null;
      if (uit && CATS.includes(uit.cat)) {
        voorstellen.push({ url: u.url, aiCat: uit.cat, aiScore: Math.max(1, Math.min(10, Number(uit.score) || 5)), aiOordeel: String(uit.oordeel || '').slice(0, 180) });
        console.log(`beoordeeld: ${u.naam} -> ${uit.cat} (${uit.score}/10)`);
      } else {
        voorstellen.push({ url: u.url, aiCat: u.cat, aiScore: 5, aiOordeel: 'Automatisch oordeel mislukt; kies zelf een categorie.' });
      }
    } catch (e) {
      console.error(`triage mislukt voor ${u.naam}: ${String(e.message).slice(0, 80)}`);
    }
    await new Promise((x) => setTimeout(x, 500));
  }

  if (voorstellen.length) {
    const p2 = await fetch(API, { method: 'POST', headers: H, body: JSON.stringify({ beoordeel: voorstellen }) });
    console.log(`${voorstellen.length} voorstel(len) teruggeschreven:`, p2.status);
    await telegram(`📸 ${voorstellen.length} nieuwe upload(s) beoordeeld en ingedeeld. Open de Uploaden-tab in de foto-tool om per stuk akkoord te geven; daarna zijn ze bruikbaar in de mails.`);
  }
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
