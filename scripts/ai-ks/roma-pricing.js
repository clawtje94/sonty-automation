// Roma-prijzen voor de AI-klantenservice (Daimy 20 juli: "koppel de Roma-prijsinformatie aan
// de mail- en WhatsApp-daemon" — Sunny kon Angela's offerte niet naar Roma omzetten omdat zijn
// tools alleen Sunmaster kenden). Zelfde bron en rekenregel als de v4 duo-flow
// (scripts/roma-duo-offerte.js): klantprijs incl BTW = Roma netto boekprijs × 1,15; de 15%
// actiekorting staat daarna als groupDiscount op de offerte, zoals altijd.
const fs = require('fs');
const path = require('path');

const ROMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'roma-prices-2025.json'), 'utf8'));
const OPSLAG = 1.15;

const PRODUCTEN = {
  'roma:rolluik': { naam: 'ROMA geëxtrudeerd voorzetrolluik .XP', tabel: 'voorzetrolluik_xp', solarTabel: 'voorzetrolluik_xp_solar', montageTitel: 'rolluik', montagePrijs: 195 },
  'roma:zipscreen': { naam: 'ROMA zipSCREEN.2 (windvast ritsscreen)', tabel: 'zipscreen2', solarTabel: 'zipscreen2_solar', montageTitel: 'screen', montagePrijs: 195 },
};

// Herken een Roma-product uit de vrije productnaam van de agent ("roma rolluik", "roma
// voorzetrolluik xp solar", "roma zipscreen", ...). Geen /roma/ in de naam = geen Roma.
function herkenRoma(product) {
  const p = String(product || '').toLowerCase();
  if (!/roma/.test(p)) return null;
  if (/rolluik|voorzet|\bxp\b/.test(p)) return 'roma:rolluik';
  if (/zip|screen/.test(p)) return 'roma:zipscreen';
  return null;
}

function romaPrijs({ product, breedteMM, hoogteMM, bediening }) {
  const key = herkenRoma(product);
  if (!key) return { error: 'Geen Roma-product herkend. Ondersteund: "roma rolluik" en "roma zipscreen". Andere Roma-producten: escaleren.' };
  if (!breedteMM || !hoogteMM) return { error: 'breedteMM en hoogteMM zijn verplicht bij Roma-producten' };
  if (bediening === 'draaischakelaar' || bediening === 'handbediend') return { error: 'Roma leveren wij uitsluitend elektrisch: io (bekabeld) of solar' };
  const def = PRODUCTEN[key];
  const solar = bediening === 'solar' || bediening === 'solarBrel' || /solar/i.test(String(product));
  const t = ROMA[solar ? def.solarTabel : def.tabel];
  const wIdx = t.widthsMM.findIndex(w => w >= breedteMM);
  const hIdx = t.heightsMM.findIndex(h => h >= hoogteMM);
  if (wIdx === -1 || hIdx === -1) return { error: `${breedteMM}×${hoogteMM}mm valt buiten het Roma-leverprogramma (max ${t.widthsMM[t.widthsMM.length - 1]}×${t.heightsMM[t.heightsMM.length - 1]}mm) — escaleren` };
  const netto = t.prices[hIdx] && t.prices[hIdx][wIdx];
  if (netto == null) return { error: `${breedteMM}×${hoogteMM}mm is niet leverbaar in deze Roma-uitvoering — escaleren` };
  return {
    productKey: key,
    naam: def.naam + (solar ? ' Solar' : ''),
    prijsIncl: Math.round(netto * OPSLAG),
    montagePrijs: def.montagePrijs,
    montageTitel: def.montageTitel,
    motor: solar
      ? 'Somfy RS100 Solar io (op zonne-energie, geen bekabeling nodig, inclusief ingeleerde handzender)'
      : 'Somfy io (inclusief ingeleerde handzender)',
    solar,
    staffel: { breedteMM: t.widthsMM[wIdx], hoogteMM: t.heightsMM[hIdx] },
  };
}

// Offerte-regelbeschrijving in dezelfde stijl als de Roma-duo-offertes.
function romaBeschrijving(r, item) {
  return `**${r.naam}**\nBreedte: ${item.breedteMM} mm\nHoogte: ${item.hoogteMM} mm\nBediening: Elektrisch met afstandsbediening\nMotor: ${r.motor}\nFrame- en pantserkleur: ${item.framekleur || 'naar keuze uit 209 RAL-kleuren (mat/structuur) zonder meerprijs'}\nGarantie: 3 jaar montage | 5 jaar ROMA fabrieksgarantie${r.solar ? ' | 7 jaar op solar-motor' : ''}`;
}

module.exports = { herkenRoma, romaPrijs, romaBeschrijving };
