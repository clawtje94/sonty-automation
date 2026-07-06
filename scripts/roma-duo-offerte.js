// Roma duo-offerte: maakt naast een Sunmaster rolluik/screen-offerte een APART document
// met het Roma-alternatief (instructie Daimy 2026-07-03), incl. het waarom-twee-merken-verhaal.
// Rekenregel: klantprijs incl BTW = Roma netto boekprijs × 1,15; daarna 15% actiekorting (groupDiscount).
const fs = require('fs');
const path = require('path');

const ROMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'roma-prices-2025.json'), 'utf8'));
const ROMA_OPSLAG = 1.15;

const CFG = require('./ai-ks/config.js');
const RP_PID = CFG.RP_PID;
function rpKey() { return CFG.RP_API_KEY; }
const RP = 'https://backend.reuzenpanda.nl';

// Sunmaster-producttitel → Roma-equivalent. Solar-bron → solar-tabel + solar-motor:
// anders vergelijkt de klant een solar-Sunmaster met een bedrade Roma en lijkt Roma
// kunstmatig even duur (Roma solar is ±€300/element duurder, aparte prijsmatrix).
function romaEquivalent(titel, beschrijving) {
  const t = titel.toLowerCase();
  const solar = /solar/i.test(beschrijving || titel);
  if (/rolluik|s-37|s-42|rollsuper/.test(t)) {
    return solar
      ? { key: 'voorzetrolluik_xp_solar', naam: 'ROMA geëxtrudeerd voorzetrolluik .XP Solar', montageTitel: 'rolluik', motor: 'Somfy RS100 Solar io (op zonne-energie, geen bekabeling nodig, inclusief ingeleerde handzender)', solar }
      : { key: 'voorzetrolluik_xp', naam: 'ROMA geëxtrudeerd voorzetrolluik .XP', montageTitel: 'rolluik', motor: 'Somfy io (inclusief ingeleerde handzender)', solar };
  }
  if (/zip|screen/.test(t)) {
    return solar
      ? { key: 'zipscreen2_solar', naam: 'ROMA zipSCREEN.2 Solar (windvast ritsscreen)', montageTitel: 'screen', motor: 'Somfy Solar io (op zonne-energie, geen bekabeling nodig, inclusief ingeleerde handzender)', solar }
      : { key: 'zipscreen2', naam: 'ROMA zipSCREEN.2 (windvast ritsscreen)', montageTitel: 'screen', motor: 'Somfy io (inclusief ingeleerde handzender)', solar };
  }
  return null;
}

function romaPrijsIncl(tabelKey, breedteMM, hoogteMM) {
  const t = ROMA[tabelKey];
  const wIdx = t.widthsMM.findIndex(w => w >= breedteMM);
  const hIdx = t.heightsMM.findIndex(h => h >= hoogteMM);
  if (wIdx === -1 || hIdx === -1) return null;
  const netto = t.prices[hIdx]?.[wIdx];
  if (netto == null) return null;
  return Math.round(netto * ROMA_OPSLAG);
}

// Het merkverhaal — alleen claims uit het Roma-prijsboek (verkoopargumenten p6) en beleid Daimy
const WAAROM_ROMA = `**Waarom bieden wij u twee merken aan?**
Naast Sunmaster werken wij met het Duitse premiummerk ROMA. Beide zijn topkwaliteit; ROMA is de keuze als u nét dat beetje extra wilt:
- Dikker, geëxtrudeerd aluminium: stabielere kast en geleiders, ook op grote maten
- Hogere windweerstandsklasse: blijft ook bij stevige wind veilig in bedrijf
- Geen natlak maar poedercoating: dikkere laklaag die langer mooi blijft
- Keuze uit 209 kleuren (mat en structuur) zonder meerprijs, voor kast, geleiders én onderlijst
- Design-onderlijst, RVS-schroeven en blinde bevestiging standaard
- 5 jaar fabrieksgarantie (7 jaar op de solar-motor) plus onze eigen montagegarantie
De prijzen staan hieronder, inclusief Somfy-motor met afstandsbediening (zelfde uitvoering als in uw andere offerte) en montage door ons eigen team. Zo kunt u beide offertes rustig naast elkaar leggen.`;

/**
 * Bouwt de Roma-prijsregels op basis van de prijsregelgroep van een bron-offerte.
 * @returns {{romaLines, overgeslagen} | {skip, overgeslagen}}
 */
function bouwRomaLines(bronPlg) {
  const romaLines = [];
  const overgeslagen = [];
  const montages = new Map(); // montageTitel → {prijs, aantal}

  for (const l of bronPlg.lines) {
    const titel = (l.description || '').split('\n')[0].replace(/\*\*/g, '').trim();
    if (/inmeten|montage|korting|actie|waarom/i.test(titel)) continue;
    const eq = romaEquivalent(titel, l.description || '');
    if (!eq) continue; // knikarmschermen etc: geen Roma-equivalent in de tool
    const b = (l.description.match(/Breedte:\s*(\d+)\s*mm/i) || [])[1];
    const h = (l.description.match(/Hoogte:\s*(\d+)\s*mm/i) || [])[1];
    if (!b || !h) { overgeslagen.push(titel + ' (maten niet leesbaar)'); continue; }
    const prijs = romaPrijsIncl(eq.key, Number(b), Number(h));
    if (prijs == null) { overgeslagen.push(titel + ` (${b}×${h}mm buiten Roma-leverprogramma)`); continue; }
    romaLines.push({
      units: l.units || 1,
      description: `**${eq.naam}**\nBreedte: ${b} mm\nHoogte: ${h} mm\nBediening: Elektrisch met afstandsbediening\nMotor: ${eq.motor}\nFrame- en pantserkleur: naar keuze uit 209 RAL-kleuren (mat/structuur) zonder meerprijs\nGarantie: 3 jaar montage | 5 jaar ROMA fabrieksgarantie${eq.solar ? ' | 7 jaar op solar-motor' : ''}`,
      pricePerUnit: prijs, imageUri: null, vatPercentage: 21, discount: null, position: null, lockTotalPrice: false,
    });
    const mBron = bronPlg.lines.find(x => new RegExp('inmeten \\+ montage.*' + eq.montageTitel, 'i').test((x.description || '').split('\n')[0]));
    const mPrijs = mBron ? mBron.pricePerUnit : (eq.montageTitel === 'rolluik' ? 195 : 195);
    const cur = montages.get(eq.montageTitel) || { prijs: mPrijs, aantal: 0 };
    cur.aantal += (l.units || 1);
    montages.set(eq.montageTitel, cur);
  }

  if (!romaLines.length) return { skip: 'geen rolluik/screen-producten met Roma-equivalent', overgeslagen };

  // Waarom-blok bovenaan als €0-regel, daarna producten, dan montage
  romaLines.unshift({ units: 1, description: WAAROM_ROMA, pricePerUnit: 0, imageUri: null, vatPercentage: 21, discount: null, position: null, lockTotalPrice: false });
  for (const [mt, m] of montages) {
    romaLines.push({
      units: m.aantal,
      description: `**Inmeten + montage ${mt}**\n- Inmeetafspraak bij je thuis\n- Professionele montage door ons eigen montageteam\n- Klein materiaal en bevestiging\n- Verwerken verpakkingsmateriaal`,
      pricePerUnit: m.prijs, imageUri: null, vatPercentage: 21, discount: null, position: null, lockTotalPrice: false,
    });
  }
  return { romaLines, overgeslagen };
}

/**
 * Maakt het Roma duo-document naast een bestaande Sunmaster-offerte.
 * @param {string} documentId — de bron-offerte (Sunmaster)
 * @returns {{ok, romaDocumentId, romaNummer, link, regels, overgeslagen} | {skip} | {error}}
 */
async function maakRomaDuo(documentId) {
  const H = { Authorization: 'Bearer ' + rpKey(), 'Content-Type': 'application/json' };
  const bron = await (await fetch(`${RP}/document-service/v1/${RP_PID}/quotations/${documentId}`, { headers: H })).json();
  const bronQd = bron.quotationData;
  if (!bronQd) return { error: 'bron-offerte niet gevonden' };
  const bronPlg = bronQd.segments?.defaultTemplatePriceLineGroup?.data;
  if (!bronPlg) return { error: 'bron-offerte zonder prijsregels' };

  // Al een Roma-versie? Nooit dubbel maken.
  if (bronPlg.lines.some(l => /\bROMA\b/i.test(l.description || ''))) return { skip: 'bron is zelf al een Roma-offerte' };

  const gebouwd = bouwRomaLines(bronPlg);
  if (gebouwd.skip) return gebouwd;
  const { romaLines, overgeslagen } = gebouwd;

  // Nieuw document op basis van de bron (zelfde klant/opmaak), eigen nummer
  const qd = JSON.parse(JSON.stringify(bronQd));
  delete qd.documentId; delete qd.versionId; delete qd.documentNumber; delete qd.quotationNumber;
  qd.segments.defaultTemplatePriceLineGroup.data.lines = romaLines;
  qd.segments.defaultTemplatePriceLineGroup.data.groupDiscount = { type: 'PERCENTAGE', amount: 15, name: '15% tijdelijke actie', vatPercentage: 21 };
  qd.quotationCreationTimestamp = Date.now();
  qd.quotationExpirationTimestamp = Date.now() + 7 * 86400000;

  // POST maakt een lege schil; de inhoud gaat er daarna met PUT in (zelfde patroon als offerte-edits)
  const r = await fetch(`${RP}/document-service/v1/${RP_PID}/quotations`, { method: 'POST', headers: H, body: JSON.stringify({ quotationData: qd }) });
  if (!r.ok) return { error: 'aanmaken mislukt: HTTP ' + r.status };
  const nieuw = (await r.json()).quotationData;
  qd.documentId = nieuw.documentId; qd.versionId = nieuw.versionId;
  qd.documentNumber = nieuw.documentNumber; qd.quotationNumber = nieuw.quotationNumber;
  qd.documentTitle = nieuw.documentTitle; qd.title = nieuw.title; qd.quotationTitle = nieuw.quotationTitle;
  const put = await fetch(`${RP}/document-service/v1/${RP_PID}/quotations/${nieuw.documentId}`, { method: 'PUT', headers: H, body: JSON.stringify(qd) });
  if (!put.ok) return { error: 'vullen mislukt: HTTP ' + put.status + ' (leeg document ' + nieuw.quotationNumber + ' blijft achter)' };
  // Verifieer dat de inhoud er echt staat
  const check = await (await fetch(`${RP}/document-service/v1/${RP_PID}/quotations/${nieuw.documentId}`, { headers: H })).json();
  const regelsNa = check.quotationData?.segments?.defaultTemplatePriceLineGroup?.data?.lines?.length || 0;
  if (!regelsNa) return { error: 'document ' + nieuw.quotationNumber + ' bleef leeg na PUT' };
  return {
    ok: true, romaDocumentId: nieuw.documentId, romaNummer: nieuw.quotationNumber,
    link: `https://document.reuzenpanda.nl/nl/${RP_PID}/${nieuw.documentId}/latest`,
    regels: regelsNa, overgeslagen,
  };
}

module.exports = { maakRomaDuo, romaEquivalent, romaPrijsIncl, bouwRomaLines };
