// Adres-vangnet (Daimy 07-08: "staat gewoon een adres in de getekende offerte,
// zorg dat je dit gewoon zelf kunt"): sommige leads (winkel/telefoon) hebben geen
// adresvelden in de lead-tekst en fields.address is leeg. Het adres staat dan alléén
// in het gerenderde offerte-PDF (de RP-API geeft het nergens terug — bewezen 07-08:
// quotation-JSON, item.fields en alle lead-endpoints zijn leeg of 400).
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PDFTOTEXT = fs.existsSync('/opt/homebrew/bin/pdftotext') ? '/opt/homebrew/bin/pdftotext' : 'pdftotext';

/** Eerste klant-adresregel uit de PDF-tekst: "Straat 10, 2151DV, Nieuw-Vennep, Nederland".
 *  Sonty's eigen adresblok (Frijdastraat/Rijswijk) wordt overgeslagen. Pure functie,
 *  los getest in tests/keten-regressie.js. */
function adresUitTekst(tekst) {
  for (const regel of tekst.split('\n').map((r) => r.trim())) {
    // komma's tolerant: RP rendert soms "Texellaan 22,, 2809 SB, Gouda" (dubbele komma)
    const m = regel.match(/^(.+?\d[^,]*)\s*,+\s*(\d{4}\s?[A-Za-z]{2})\s*,+\s*([^,]+?)(?:\s*,+\s*Nederland)?$/);
    if (!m) continue;
    // Alleen Sonty's EIGEN adres overslaan. Eerder stond hier ook |rijswijk, maar
    // dan valt elke KLANT uit Rijswijk weg (Daimy 22-08, geval van Beek: adres
    // stond gewoon in de PDF en het dashboard bleef toch op "geen adres" staan).
    if (/frijdastraat/i.test(regel)) continue; // Sonty zelf
    const [, straat, postcode, plaats] = m;
    return {
      adres: straat.trim(),
      postcode: postcode.replace(/\s/g, '').toUpperCase(),
      plaats: plaats.trim(),
      volledigAdres: `${straat.trim()}, ${postcode.replace(/\s/g, '').toUpperCase()}, ${plaats.trim()}`,
    };
  }
  return null;
}

/** De klant-adresregel in het PDF-kopblok: de niet-lege regel direct boven het
 *  e-mailadres van de klant (layout: naam / adres / e-mail / telefoon). Nodig voor
 *  winkel-offertes waar het adres zonder postcode of komma is ingevoerd
 *  ("Coba ritsemastraat 14 Woerden" — Daimy 22-08, 3 van de 4 geen-adres-gevallen). */
function klantAdresregelUitTekst(tekst) {
  const regels = tekst.split('\n').map((r) => r.trim());
  const mailIdx = regels.findIndex((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));
  if (mailIdx < 1) return null;
  for (let i = mailIdx - 1; i >= Math.max(0, mailIdx - 3); i--) {
    const r = regels[i];
    if (!r) continue;
    if (/frijdastraat|^sonty\b/i.test(r)) return null; // in Sonty's eigen blok beland
    if (!/\d/.test(r)) return null;                    // regel boven mail is de naam: geen adres te vinden
    return r;
  }
  return null;
}

/** Vrije adrestekst → volledig adres via PDOK (postcode en plaats aangevuld).
 *  Alleen geaccepteerd als straat-eerste-woord én huisnummer echt in de invoer
 *  staan, anders kan PDOK fuzzy een heel ander adres teruggeven. */
async function pdokAdres(regel) {
  if (!regel) return null;
  try {
    const r = await fetch('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=' + encodeURIComponent(regel) + '&fq=type:adres&rows=1');
    if (!r.ok) return null;
    const d = (await r.json()).response?.docs?.[0];
    if (!d?.straatnaam || !d.huis_nlt || !d.postcode || !d.woonplaatsnaam) return null;
    const eersteWoord = d.straatnaam.split(/\s+/)[0].toLowerCase();
    const nummers = (regel.match(/\d+/g) || []);
    if (!regel.toLowerCase().includes(eersteWoord) || !nummers.includes(String(d.huis_nlt).match(/\d+/)?.[0])) return null;
    const straat = `${d.straatnaam} ${d.huis_nlt}`;
    return {
      adres: straat, postcode: d.postcode, plaats: d.woonplaatsnaam,
      volledigAdres: `${straat}, ${d.postcode}, ${d.woonplaatsnaam}`,
    };
  } catch { return null; }
}

/** Detecteer een adres-correctie in de lead-tekst (geval Franken 07-08: "LET OP
 *  adres corrigeren: bezoek/adres moet zijn Houtrijk 10, NIET Haarlemmermeer 10").
 *  Dan mag het offerte-adres NIET blind gebruikt worden — mens beslist. */
function heeftAdresCorrectie(leadTekst) {
  return /adres[^\n]{0,100}(corrigeren|aanpassen|moet zijn|klopt niet|is fout)/i.test(leadTekst || '');
}

/** Adres uit het gerenderde offerte-PDF van een RP-document. null = niet gelukt. */
async function adresUitOfferte(pid, documentId) {
  if (!documentId) return null;
  const r = await fetch(`https://document.reuzenpanda.nl/renderer/v1/${pid}/quotations/${documentId}/artifact.pdf?artifact_name=`);
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const tmp = path.join(os.tmpdir(), `rp-offerte-${documentId}.pdf`);
  try {
    fs.writeFileSync(tmp, buf);
    const tekst = execFileSync(PDFTOTEXT, [tmp, '-'], { encoding: 'utf8', timeout: 20000 });
    // 1. strak patroon (straat, postcode, plaats); 2. losse klantregel via PDOK
    return adresUitTekst(tekst) || await pdokAdres(klantAdresregelUitTekst(tekst));
  } catch { return null; } finally {
    try { fs.unlinkSync(tmp); } catch { /* opruimen is best effort */ }
  }
}

module.exports = { adresUitOfferte, adresUitTekst, heeftAdresCorrectie, klantAdresregelUitTekst, pdokAdres };
