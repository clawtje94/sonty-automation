#!/usr/bin/env node
/**
 * EXPORTEERT DE KLANTDATA UIT REUZENPANDA VOOR DE E-MAILCAMPAGNES (Daimy 2026-07-27).
 *
 * Bouwt per e-mailadres één regel met alles wat een mail persoonlijk maakt: naam, plaats,
 * product, offertenummer, bedrag, geldigheidsdatum en de offertelink. Zonder die velden blijven
 * de mails algemeen, en dat is precies waar de campagne van maart op stukliep (46,8% opende hem,
 * maar 1,5% klikte en 4,4% meldde zich af).
 *
 * Dit script LEEST alleen. Het schrijft niets naar Reuzenpanda en verstuurt niets.
 *
 * Werkwijze: het board geeft in één keer alle dossiers met contactgegevens; de offertes moeten
 * per dossier opgehaald worden, want de bulklijst van offertes bevat geen klantverwijzing.
 * Daarom een beperkte parallelliteit: snel genoeg, maar zonder Reuzenpanda te overvragen.
 *
 * Gebruik: node scripts/email/rp-export.js [--max 200]
 * Resultaat: data/email/rp-export.json
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../ai-ks/config.js');

const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY };
const UIT = path.join(__dirname, '..', '..', 'data', 'email');
const MAX = Number((process.argv.find((a) => a.startsWith('--max')) || '').split('=')[1]
  || process.argv[process.argv.indexOf('--max') + 1]) || 0;
const PARALLEL = 6;

const veld = (blob, naam) => {
  const m = blob.match(new RegExp(naam + ':\\s*([^\\n]+)', 'i'));
  return m ? m[1].trim() : null;
};

/**
 * Eigen mensen, leveranciers en testadressen horen niet in een klantcampagne.
 * In de proefronde van 27 juli kwam jur@reuzenpanda.nl als "klant" bovendrijven; dat is een
 * medewerker van onze softwareleverancier. Zulke adressen aanschrijven is op zijn best gênant.
 */
const INTERNE_DOMEINEN = /@(reuzenpanda|sonty|sontymontage|sunmaster|unilux|gripp|trengo)\./i;
const TESTADRES = /^(test|demo|voorbeeld|noreply|no-reply|info|admin|factuur|facturen)@/i;
const GELDIG_ADRES = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

function bruikbaarAdres(email) {
  if (!GELDIG_ADRES.test(email)) return false;
  if (INTERNE_DOMEINEN.test(email)) return false;
  if (TESTADRES.test(email)) return false;
  return true;
}

/** Eerste productregel uit de configurator-aanvraag, bv. "1x Windvast" -> "Windvast". */
function product(blob) {
  const m = blob.match(/^\s*\d+\s*x\s+([^\n:]+)/im);
  if (!m) return null;
  return m[1].replace(/[:,]\s*$/, '').trim().slice(0, 60);
}

async function rp(ep) {
  for (let poging = 0; poging < 3; poging++) {
    try {
      const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: H });
      if (r.ok) return await r.json();
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 1500 * (poging + 1))); continue; }
      return null;
    } catch { await new Promise((s) => setTimeout(s, 700)); }
  }
  return null;
}

(async () => {
  console.log('Dossiers ophalen...');
  const board = await rp(`/contact-service/${CFG.RP_PID}/boards/${CFG.RP_BOARD}/items`);
  if (!board?.items) { console.error('Reuzenpanda niet bereikbaar.'); process.exit(1); }

  let items = board.items.filter((it) => it.item_subject?.id);
  // Nieuwste eerst, zodat een beperkte run (--max) de meest relevante dossiers pakt.
  items.reverse();
  if (MAX) items = items.slice(0, MAX);
  console.log(`${items.length} dossiers met een leadconfiguratie.\n`);

  const perEmail = new Map();
  let verwerkt = 0, metOfferte = 0, geweigerd = 0;

  async function doeItem(it) {
    const blob = (it.summary || '') + '\n' + (it.description || '');
    const email = (veld(blob, 'E-?mailadres') || (blob.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0] || '').toLowerCase().trim();
    if (!bruikbaarAdres(email)) { if (email) geweigerd++; return; }

    const docs = await rp(`/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${it.item_subject.id}`);
    const offertes = (docs?.quotationDatas || [])
      .filter((d) => /SENT|ACCEPTED/i.test(String(d.quotationStatus || '')))
      .sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
    const nieuwste = offertes[0];

    const regel = {
      email,
      voornaam: veld(blob, 'Voornaam'),
      achternaam: veld(blob, 'Achternaam'),
      telefoon: veld(blob, 'Telefoonnummer'),
      plaats: veld(blob, 'Plaats'),
      postcode: veld(blob, 'Postcode'),
      bron: veld(blob, 'Hoe komt u bij ons terecht'),
      product: product(blob),
      itemId: it.id,
      offerteNummer: nieuwste?.quotationNumber || null,
      offerteStatus: nieuwste?.quotationStatus || null,
      offerteBedrag: nieuwste?.pricing?.total ?? null,
      offerteDatum: nieuwste?.quotationCreationTimestamp || null,
      offerteVerlooptOp: nieuwste?.quotationExpirationTimestamp || null,
      offerteLink: nieuwste ? `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${nieuwste.documentId}/latest?pdfAction=DOCSIGN` : null,
      aantalOffertes: offertes.length,
      heeftAkkoord: offertes.some((d) => /ACCEPTED/i.test(String(d.quotationStatus || ''))),
    };
    if (nieuwste) metOfferte++;

    // Eén regel per e-mailadres: bij meerdere dossiers wint de nieuwste offerte. Bij Naumer
    // bleek al dat dezelfde klant twee dossiers kan hebben; dan hoort de mail over de meest
    // recente offerte te gaan, niet over een oude.
    const bestaand = perEmail.get(email);
    if (!bestaand || (regel.offerteDatum || 0) > (bestaand.offerteDatum || 0)) perEmail.set(email, regel);
    else if (bestaand) bestaand.aantalOffertes += regel.aantalOffertes;
  }

  for (let i = 0; i < items.length; i += PARALLEL) {
    await Promise.all(items.slice(i, i + PARALLEL).map(doeItem));
    verwerkt += Math.min(PARALLEL, items.length - i);
    if (verwerkt % 600 < PARALLEL) console.log(`  ${verwerkt}/${items.length} dossiers | ${perEmail.size} adressen | ${metOfferte} met offerte`);
    await new Promise((s) => setTimeout(s, 60));
  }

  fs.mkdirSync(UIT, { recursive: true });
  const rijen = [...perEmail.values()];
  fs.writeFileSync(path.join(UIT, 'rp-export.json'), JSON.stringify(rijen, null, 1));

  const metLink = rijen.filter((r) => r.offerteLink).length;
  const akkoord = rijen.filter((r) => r.heeftAkkoord).length;
  console.log('\nKLAAR');
  console.log(`  unieke e-mailadressen : ${rijen.length}`);
  console.log(`  met een offerte       : ${metLink}`);
  console.log(`  waarvan al akkoord    : ${akkoord}`);
  console.log(`  met productnaam       : ${rijen.filter((r) => r.product).length}`);
  console.log(`  met plaats            : ${rijen.filter((r) => r.plaats).length}`);
  console.log(`  geweigerde adressen   : ${geweigerd} (intern, leverancier, test of ongeldig)`);
  console.log(`  weggeschreven naar    : data/email/rp-export.json`);
})();
