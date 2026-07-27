#!/usr/bin/env node
/**
 * ZET DE SJABLONEN IN KLAVIYO (Daimy 2026-07-27).
 *
 * Maakt of werkt de vier Sonty-sjablonen bij. Dit VERSTUURT NIETS: een sjabloon is alleen een
 * ontwerp dat later aan een flow of campagne gekoppeld kan worden. Zolang Daimy geen groen licht
 * geeft blijft alles daar staan.
 *
 * Idempotent: bestaat een sjabloon met dezelfde naam al, dan wordt hij bijgewerkt in plaats van
 * gedupliceerd. Zo kan dit script na elke ontwerpwijziging opnieuw draaien zonder rommel achter
 * te laten.
 *
 * Gebruik:
 *   node scripts/email/klaviyo-sync.js            (toont wat er zou gebeuren)
 *   node scripts/email/klaviyo-sync.js --doe-het  (voert het uit)
 */
const fs = require('fs');
const path = require('path');
const { KLAVIYO_API_KEY } = require('../secrets.js');

const DIST = path.join(__dirname, 'dist');
const ECHT = process.argv.includes('--doe-het');
const H = {
  Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY,
  accept: 'application/json',
  'content-type': 'application/json',
  revision: '2024-10-15',
};

const NAMEN = {
  'sonty-offerte': 'Sonty | Offerte',
  'sonty-uitnodiging': 'Sonty | Showroom-uitnodiging',
  'sonty-verhaal': 'Sonty | Verhaal',
  'sonty-service': 'Sonty | Service en nazorg',
};

async function api(pad, opties = {}) {
  const r = await fetch('https://a.klaviyo.com/api/' + pad, { headers: H, ...opties });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { ok: r.ok, status: r.status, j, t };
}

/** Platte tekstversie: verplicht naast html, en clients die geen html tonen krijgen dit. */
function tekstversie(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

(async () => {
  const bestaand = await api('templates/');
  if (!bestaand.ok) { console.error('Kan sjablonen niet ophalen: ' + bestaand.status + ' ' + bestaand.t.slice(0, 200)); process.exit(1); }
  const opNaam = new Map((bestaand.j.data || []).map((d) => [d.attributes.name, d.id]));
  console.log(`Klaviyo bevat nu ${opNaam.size} sjablonen: ${[...opNaam.keys()].join(', ') || '(geen)'}\n`);

  for (const [bestandsnaam, weergavenaam] of Object.entries(NAMEN)) {
    const html = fs.readFileSync(path.join(DIST, bestandsnaam + '.html'), 'utf8');
    const bestaatId = opNaam.get(weergavenaam);
    const attrs = { name: weergavenaam, editor_type: 'CODE', html, text: tekstversie(html) };

    if (!ECHT) {
      console.log(`${bestaatId ? 'ZOU BIJWERKEN' : 'ZOU AANMAKEN'}: ${weergavenaam} (${(html.length / 1024).toFixed(1)} kB)`);
      continue;
    }

    const res = bestaatId
      ? await api(`templates/${bestaatId}/`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'template', id: bestaatId, attributes: attrs } }) })
      : await api('templates/', { method: 'POST', body: JSON.stringify({ data: { type: 'template', attributes: attrs } }) });

    if (!res.ok) { console.error(`  FOUT bij ${weergavenaam}: ${res.status} ${res.t.slice(0, 260)}`); continue; }
    console.log(`  ${bestaatId ? 'bijgewerkt' : 'aangemaakt'}: ${weergavenaam}  (id ${res.j?.data?.id || bestaatId})`);
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!ECHT) console.log('\nProefronde. Draai met --doe-het om het echt te doen.');
  else console.log('\nKlaar. Er is niets verstuurd; dit zijn alleen ontwerpen.');
})();
