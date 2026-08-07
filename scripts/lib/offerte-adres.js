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
    if (/frijdastraat|rijswijk/i.test(regel)) continue; // Sonty zelf
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
    return adresUitTekst(tekst);
  } catch { return null; } finally {
    try { fs.unlinkSync(tmp); } catch { /* opruimen is best effort */ }
  }
}

module.exports = { adresUitOfferte, adresUitTekst, heeftAdresCorrectie };
