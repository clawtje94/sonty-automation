#!/usr/bin/env node
/**
 * ZET DE KLANTDATA IN KLAVIYO (Daimy 2026-07-27).
 *
 * Leest data/email/rp-export.json en werkt de profielen bij met de velden die een mail
 * persoonlijk maken. VERSTUURT NIETS.
 *
 * VEILIGHEIDSREGEL, niet aanpassen zonder na te denken
 * ----------------------------------------------------
 * Profielen worden NOOIT aan een lijst toegevoegd. In dit account staat de flow
 * "Offerte aanvraag gedaan SMS en mail" LIVE met een echte SMS- en mailstap, en die triggert op
 * "toegevoegd aan lijst". Eén profiel aan de verkeerde lijst hangen betekent dus een echte SMS
 * en een echte mail naar een klant. Daarom werken we uitsluitend met profieleigenschappen en
 * segmenten: een segment kan per definitie geen flow starten.
 *
 * De fase wordt hier berekend en als vaste waarde meegegeven, in plaats van Klaviyo met datums
 * te laten rekenen. Dat is beter te controleren (je ziet gewoon in het profiel staan waar iemand
 * zit) en het maakt de segmenten simpele gelijk-aan-vergelijkingen. Deze sync hoort dagelijks te
 * draaien, want de fase verschuift met de tijd.
 *
 * Gebruik:
 *   node scripts/email/klaviyo-profielen.js               proefronde, schrijft niets
 *   node scripts/email/klaviyo-profielen.js --doe-het     voert de import uit
 *   node scripts/email/klaviyo-profielen.js --doe-het --max 50
 */
const fs = require('fs');
const path = require('path');
const { KLAVIYO_API_KEY } = require('../secrets.js');

const BRON = path.join(__dirname, '..', '..', 'data', 'email', 'rp-export.json');
const ECHT = process.argv.includes('--doe-het');
const MAX = Number((process.argv.find((a) => a.startsWith('--max')) || '').split('=')[1]
  || process.argv[process.argv.indexOf('--max') + 1]) || 0;

const H = {
  Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY,
  accept: 'application/json',
  'content-type': 'application/json',
  revision: '2024-10-15',
};

const DAG = 86400000;

/**
 * De fase bepaalt in welke campagnereeks iemand valt. Grenzen komen uit de gemeten doorlooptijd:
 * mediaan 24 dagen tot akkoord, 66% binnen 30 dagen, 93% binnen 60 dagen. Na 60 dagen is een
 * offerte praktisch dood en hoort iemand in de reactivering, niet meer in de opvolging.
 */
function bepaalFase(r) {
  if (r.heeftAkkoord) return 'klant';
  if (!r.offerteDatum) return 'geen_offerte';
  const dagen = (Date.now() - r.offerteDatum) / DAG;
  if (dagen <= 14) return 'vers';
  if (dagen <= 60) return 'lopend';
  if (dagen <= 365) return 'koud';
  return 'zeer_koud';
}

/** Grove categorie voor de cross-sell: buiten (zonwering) of binnen (raamdecoratie). */
function categorie(product) {
  const p = String(product || '').toLowerCase();
  if (!p) return null;
  if (/screen|zip|knikarm|uitval|markies|rolluik|pergola|zonwering|suneye|serre|windvast|cassette/.test(p)) return 'buiten';
  if (/gordijn|plisse|plissé|duette|jaloezie|shutter|rolgordijn|raamdec|vouwgordijn|behang|wandbekleding|inbetween/.test(p)) return 'binnen';
  if (/hor(ren)?\b|hordeur|horraam/.test(p)) return 'horren';
  return 'overig';
}

const euro = (n) => typeof n === 'number' && isFinite(n)
  ? '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : null;
const datumNL = (ms) => ms
  ? new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  : null;
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

function bouwProfiel(r) {
  const props = {
    sonty_fase: bepaalFase(r),
    sonty_categorie: categorie(r.product),
    sonty_product: r.product || null,
    sonty_offertenummer: r.offerteNummer || null,
    sonty_offerte_status: r.offerteStatus || null,
    sonty_offerte_link: r.offerteLink || null,
    sonty_bedrag: euro(r.offerteBedrag),
    sonty_bedrag_getal: typeof r.offerteBedrag === 'number' ? Math.round(r.offerteBedrag) : null,
    sonty_offerte_datum: iso(r.offerteDatum),
    sonty_offerte_datum_nl: datumNL(r.offerteDatum),
    sonty_geldig_tot: datumNL(r.offerteVerlooptOp),
    sonty_aantal_offertes: r.aantalOffertes || 0,
    sonty_bron: r.bron || null,
    sonty_bijgewerkt: new Date().toISOString(),
  };
  for (const k of Object.keys(props)) if (props[k] === null) delete props[k];

  const attrs = { email: r.email, properties: props };
  if (r.voornaam) attrs.first_name = r.voornaam;
  if (r.achternaam) attrs.last_name = r.achternaam;
  if (r.plaats || r.postcode) attrs.location = { city: r.plaats || undefined, zip: r.postcode || undefined, country: 'Netherlands' };
  return { type: 'profile', attributes: attrs };
}

(async () => {
  if (!fs.existsSync(BRON)) { console.error('Geen export gevonden. Draai eerst scripts/email/rp-export.js'); process.exit(1); }
  let rijen = JSON.parse(fs.readFileSync(BRON, 'utf8'));
  if (MAX) rijen = rijen.slice(0, MAX);

  const telling = {};
  const profielen = rijen.map((r) => {
    const p = bouwProfiel(r);
    const f = p.attributes.properties.sonty_fase;
    telling[f] = (telling[f] || 0) + 1;
    return p;
  });

  console.log(`${profielen.length} profielen uit de export.`);
  console.log('Verdeling over de fases:');
  for (const [f, n] of Object.entries(telling).sort((a, b) => b[1] - a[1])) console.log(`  ${f.padEnd(14)} ${n}`);
  const metLink = profielen.filter((p) => p.attributes.properties.sonty_offerte_link).length;
  console.log(`Met een offertelink (dus mailbaar met persoonlijke inhoud): ${metLink}`);

  if (!ECHT) {
    console.log('\nVoorbeeldprofiel:');
    console.log(JSON.stringify(profielen.find((p) => p.attributes.properties.sonty_offerte_link) || profielen[0], null, 1).slice(0, 900));
    console.log('\nProefronde. Draai met --doe-het om te importeren. Er wordt niets verstuurd en');
    console.log('niemand wordt aan een lijst toegevoegd.');
    return;
  }

  // Bulk-import in blokken. Bewust ZONDER lijst-relatie: zie de veiligheidsregel bovenaan.
  const BLOK = 1000;
  let gelukt = 0;
  for (let i = 0; i < profielen.length; i += BLOK) {
    const blok = profielen.slice(i, i + BLOK);
    const body = { data: { type: 'profile-bulk-import-job', attributes: { profiles: { data: blok } } } };
    const r = await fetch('https://a.klaviyo.com/api/profile-bulk-import-jobs/', { method: 'POST', headers: H, body: JSON.stringify(body) });
    const t = await r.text();
    if (!r.ok) { console.error(`  blok ${i / BLOK + 1}: FOUT ${r.status} ${t.slice(0, 240)}`); continue; }
    gelukt += blok.length;
    console.log(`  blok ${i / BLOK + 1}: ${blok.length} profielen ingediend (${gelukt}/${profielen.length})`);
    await new Promise((s) => setTimeout(s, 900));
  }
  console.log(`\nKlaar: ${gelukt} profielen ingediend. Klaviyo verwerkt de import op de achtergrond.`);
  console.log('Er is niets verstuurd en niemand is aan een lijst toegevoegd.');
})();
