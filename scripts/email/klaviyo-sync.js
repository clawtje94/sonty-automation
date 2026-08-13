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
  "sonty-offerte": "Sonty | A1 Offerte staat klaar",
  "sonty-uitnodiging": "Sonty | A3 Showroom-uitnodiging",
  "sonty-verhaal": "Sonty | Verhaal",
  "sonty-service": "Sonty | E1 Service en nazorg",
  "sonty-weer-hitte": "Sonty | W1 Weer, hitte op komst",
  "sonty-weer-lente": "Sonty | W2 Weer, eerste lentedag",
  "sonty-weer-donker": "Sonty | W3 Weer, donkere dagen",
  "sonty-welkom": "Sonty | G1 Welkom na aanvraag",
  "sonty-rp-offerte": "Sonty | RP1 Offerte verstuurd",
  "sonty-herinnering-1": "Sonty | RP2 Herinnering dag 6",
  "sonty-herinnering-2": "Sonty | RP3 Herinnering dag 10",
  "sonty-akkoord": "Sonty | RP4 Na akkoord",
  "sonty-afwijzing": "Sonty | RP5 Na afwijzing",
  "sonty-afsluiter": "Sonty | A5 Laatste mail in de reeks",
  "sonty-reactivering-1": "Sonty | C1 Reactivering",
  "sonty-reactivering-1-screens": "Sonty | C1 Reactivering (screens)",
  "sonty-reactivering-1-rolluiken": "Sonty | C1 Reactivering (rolluiken)",
  "sonty-reactivering-1-binnen": "Sonty | C1 Reactivering (binnen)",
  "sonty-bouwvak": "Sonty | S1 Na de bouwvak",
  "sonty-reactivering-2": "Sonty | C2 Wat er veranderd is",
  "sonty-crosssell-binnen": "Sonty | D1 Cross-sell naar binnen",
  "sonty-review": "Sonty | E2 Reviewverzoek"
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
  // STIJLPOORT (Daimy 2026-07-27: "geen AI-slop, het moet Sonty ademen"). Een sjabloon dat de
  // schrijfstijl niet haalt gaat niet naar Klaviyo. Zo kan het niet gebeuren dat er ooit een mail
  // klaarstaat met gedachtestreepjes of kantoortaal erin, ook niet als iemand het even vergeet.
  if (ECHT) {
    const { execFileSync } = require('child_process');
    try {
      execFileSync(process.execPath, [require('path').join(__dirname, 'stijlcheck.js')], { stdio: 'inherit' });
    } catch {
      console.error('\nStijlcontrole niet gehaald. Er gaat niets naar Klaviyo tot de tekst klopt.');
      process.exit(1);
    }
    console.log('');
  }

  // ALLE PAGINA'S OPHALEN. De templates-endpoint geeft er 10 per pagina. Zonder doorbladeren
  // denkt dit script dat de sjablonen op pagina 2 niet bestaan en maakt het ze opnieuw aan; zo
  // ontstonden op 28 juli negen duplicaten in een keer.
  const opNaam = new Map();
  let pad = 'templates/';
  for (let i = 0; i < 15 && pad; i++) {
    const r = await api(pad);
    if (!r.ok) { console.error('Kan sjablonen niet ophalen: ' + r.status + ' ' + r.t.slice(0, 200)); process.exit(1); }
    for (const d of (r.j.data || [])) opNaam.set(d.attributes.name, d.id);
    pad = r.j.links?.next ? r.j.links.next.replace('https://a.klaviyo.com/api/', '') : null;
  }
  console.log(`Klaviyo bevat nu ${opNaam.size} sjablonen: ${[...opNaam.keys()].join(', ') || '(geen)'}\n`);

  for (const [bestandsnaam, weergavenaam] of Object.entries(NAMEN)) {
    const html = fs.readFileSync(path.join(DIST, bestandsnaam + '.html'), 'utf8');
    const bestaatId = opNaam.get(weergavenaam);
    // editor_type mag alleen mee bij AANMAKEN. Bij een update weigert Klaviyo het veld met
    // "'editor_type' is not a valid field for the resource 'template'".
    const attrs = { name: weergavenaam, html, text: tekstversie(html) };
    if (!bestaatId) attrs.editor_type = 'CODE';

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
