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

/**
 * Leesbare productnaam voor in een zin. De ruwe naam uit de configurator is technisch
 * ("Zip Design 110", "Windvast", "Suneye dichte cassette") en leest in een kop als een
 * artikelnummer: "Je zocht ooit Zip Design 110 zipscreens (2x, solar)". Dit maakt er iets van
 * dat een mens ook zou zeggen.
 */
/**
 * Sommige productvelden bevatten geen product maar een notitie: "Wit op Tramstraat 109, Katwijk
 * aan zee", "745x1720mm", "3000 dit zijn geschatte maten". Vier gevallen in de hele export, maar
 * wel meteen zichtbaar bovenaan de offertekaart. Die vallen terug op een neutrale omschrijving.
 */
function netProduct(product) {
  const p = String(product || '').trim();
  if (!p) return null;
  if (/straat|laan|weg\b|plein|kade|dijk|\d{4}\s?[a-z]{2}\b/i.test(p)) return null;
  if (/^\d/.test(p)) return null;                  // "745x1720mm", "3000 dit zijn geschatte maten"
  if (/^(wit|zwart|grijs|antraciet|cr[eè]me)\b/i.test(p)) return null;
  return p;
}

function leesbaarProduct(product) {
  const p = String(product || '').toLowerCase();
  if (!p) return null;
  if (/zip|screen|windvast/.test(p)) return 'screens';
  if (/rolluik/.test(p)) return 'rolluiken';
  if (/knikarm|suneye|cassette/.test(p)) return 'een knikarmscherm';
  if (/uitval/.test(p)) return 'een uitvalscherm';
  if (/markies/.test(p)) return 'een markies';
  if (/pergola/.test(p)) return 'een pergola';
  if (/serre/.test(p)) return 'serrezonwering';
  if (/hor/.test(p)) return 'horren';
  if (/gordijn|inbetween|vouw/.test(p)) return 'gordijnen';
  if (/plisse|plissé|duette/.test(p)) return 'plissegordijnen';
  if (/jaloezie/.test(p)) return 'jaloezieën';
  if (/shutter/.test(p)) return 'shutters';
  if (/behang|wandbekleding/.test(p)) return 'wandbekleding';
  if (/rolgordijn/.test(p)) return 'rolgordijnen';
  return 'zonwering';
}

/**
 * Voornaam netjes maken voor de aanhef. Uit de export bleek dat 375 klanten hun naam met een
 * kleine letter hebben ingevuld ("vjelko", "martijn") en 32 een dubbele voornaam ("Alexandra
 * Hendrika"). In een mail wordt dat "Hoi vjelko," en "Hoi Alexandra Hendrika,", en dat leest als
 * een slordig samengevoegd bestand. Daarom: eerste naam pakken, eerste letter een hoofdletter,
 * en tussenvoegsels binnen de naam met rust laten.
 */
function netteVoornaam(ruw) {
  let n = String(ruw || '').trim().replace(/\s+/g, ' ');
  if (!n) return null;
  n = n.split(' ')[0];                       // "Alexandra Hendrika" wordt "Alexandra"
  if (n.length < 2 || n.length > 20) return null;
  if (/[0-9@]/.test(n)) return null;         // geen mailadres of nummer als naam
  // INITIALEN, geen voornaam. 111 klanten hebben "PJC", "F.J." of "G.H.V." in het voornaamveld
  // staan. "Hoi F.J.," leest als een aanmaning; dan liever helemaal geen naam, want de mail valt
  // terug op "Hoi daar" en dat is warmer dan een set initialen.
  if (/\./.test(n)) return null;
  if (n === n.toUpperCase() && n.length <= 4) return null;
  // Volledig in hoofdletters geschreven namen worden gewoon netjes: MARIA wordt Maria.
  if (n === n.toUpperCase() && n.length > 4) n = n.toLowerCase();
  // Namen met een koppelteken of apostrof houden hun eigen hoofdletters: Jan-Willem, d'Angelo.
  return n.replace(/(^|[-'])([a-zà-ÿ])/g, (m, sep, letter) => sep + letter.toUpperCase());
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

/**
 * Laatste poort vóór Klaviyo. Klaviyo weigert een heel blok van 1000 profielen zodra er één
 * ongeldig adres in zit, dus één rotte appel kost je duizend profielen. In de eerste volledige
 * import gebeurde dat twee keer, door:
 *   - "kayrawahdat5@gmaıl.com"  een Turkse dotless i (U+0131) in plaats van een gewone i
 *   - "mailto:marco.kranenburg@eracontour.nl"  met de mailto-prefix er nog aan
 *   - adressen als "acicek-@live.nl" die op een streepje vóór de @ eindigen
 * Wat te repareren valt repareren we; de rest gaat eruit met vermelding.
 */
function schoonAdres(ruw) {
  let e = String(ruw || '').trim().toLowerCase();
  e = e.replace(/^mailto:/, '');            // prefix uit een geplakte link
  e = e.replace(/[<>(),;:"\s]/g, '');       // resten van "Naam <adres>"
  if (/[^\x20-\x7e]/.test(e)) return null;  // niet-ascii: gmaıl is niet gmail
  if ((e.match(/@/g) || []).length !== 1) return null;
  const [lokaal, domein] = e.split('@');
  if (!lokaal || !domein) return null;
  if (/^[.\-]|[.\-]$/.test(lokaal)) return null;   // begint of eindigt op . of -
  if (/^[.\-]|[.\-]$/.test(domein)) return null;
  if (/\.\./.test(e)) return null;
  if (!/^[a-z0-9][a-z0-9.\-]*\.[a-z]{2,}$/.test(domein)) return null;
  if (e.length > 100) return null;
  return e;
}

function bouwProfiel(r) {
  const props = {
    // OPT-OUT (Daimy 2026-07-27). Klanten met de Reuzenpanda-status "geen herinnering meer"
    // mogen nooit een campagne krijgen. Elk segment eist sonty_mag_mail = "ja", dus wie dit veld
    // op "nee" heeft of het veld helemaal mist, valt automatisch buiten alles. Bewust zo:
    // ontbrekende data leidt tot niet-mailen, niet tot per ongeluk wel mailen.
    sonty_mag_mail: r.magMail === false ? 'nee' : (r.magMail === true ? 'ja' : 'onbekend'),
    sonty_fase: bepaalFase(r),
    sonty_categorie: categorie(r.product),
    sonty_product: netProduct(r.product),
    sonty_product_kort: leesbaarProduct(r.product),
    sonty_offertenummer: r.offerteNummer || null,
    sonty_offerte_status: r.offerteStatus || null,
    sonty_offerte_link: r.offerteLink || null,
    sonty_bedrag: euro(r.offerteBedrag),
    sonty_bedrag_getal: typeof r.offerteBedrag === 'number' ? Math.round(r.offerteBedrag) : null,
    sonty_offerte_datum: iso(r.offerteDatum),
    sonty_offerte_datum_nl: datumNL(r.offerteDatum),
    // GELDIGHEID (oplevercheck 28 juli). 94% van de mailbare offertes is al verlopen, sommige
    // sinds april 2025. "Geldig tot 11 mei 2025" in een mail van vandaag is niet alleen lelijk,
    // het ondermijnt de hele mail: de klant ziet meteen dat er een automaat aan het werk is.
    // Daarom twee velden: bij een nog geldige offerte de vervaldatum, en bij een verlopen offerte
    // eerlijk de datum waarop de prijs is gemaakt.
    sonty_geldigheid_label: (r.offerteVerlooptOp && r.offerteVerlooptOp > Date.now()) ? 'Geldig tot' : 'Prijs van',
    sonty_geldigheid_waarde: (r.offerteVerlooptOp && r.offerteVerlooptOp > Date.now())
      ? datumNL(r.offerteVerlooptOp)
      : datumNL(r.offerteDatum),
    sonty_offerte_verlopen: (r.offerteVerlooptOp && r.offerteVerlooptOp > Date.now()) ? 'nee' : 'ja',
    sonty_geldig_tot: datumNL(r.offerteVerlooptOp),
    sonty_aantal_offertes: r.aantalOffertes || 0,
    sonty_bron: r.bron || null,
    sonty_bijgewerkt: new Date().toISOString(),
  };
  for (const k of Object.keys(props)) if (props[k] === null) delete props[k];

  const attrs = { email: r.email, properties: props };
  const voornaam = netteVoornaam(r.voornaam);
  if (voornaam) attrs.first_name = voornaam;
  if (r.achternaam) attrs.last_name = r.achternaam;
  if (r.plaats || r.postcode) attrs.location = { city: r.plaats || undefined, zip: r.postcode || undefined, country: 'Netherlands' };
  return { type: 'profile', attributes: attrs };
}

// Geexporteerd zodat preview-echt.js exact dezelfde logica gebruikt. Zonder dit heeft de
// preview zijn eigen kopie en test je uiteindelijk iets anders dan wat de klant krijgt.
module.exports = { netteVoornaam, leesbaarProduct, netProduct, bepaalFase, categorie, euro, datumNL };

if (require.main !== module) return;

(async () => {
  if (!fs.existsSync(BRON)) { console.error('Geen export gevonden. Draai eerst scripts/email/rp-export.js'); process.exit(1); }
  let rijen = JSON.parse(fs.readFileSync(BRON, 'utf8'));
  if (MAX) rijen = rijen.slice(0, MAX);

  const telling = {};
  const geweigerd = [];
  const profielen = [];
  for (const r of rijen) {
    const schoon = schoonAdres(r.email);
    if (!schoon) { geweigerd.push(r.email); continue; }
    const p = bouwProfiel({ ...r, email: schoon });
    telling[p.attributes.properties.sonty_fase] = (telling[p.attributes.properties.sonty_fase] || 0) + 1;
    profielen.push(p);
  }
  if (geweigerd.length) {
    console.log(`${geweigerd.length} adressen geweigerd als onbruikbaar: ${geweigerd.slice(0, 6).map((x) => JSON.stringify(x)).join(', ')}${geweigerd.length > 6 ? ' ...' : ''}`);
  }

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
