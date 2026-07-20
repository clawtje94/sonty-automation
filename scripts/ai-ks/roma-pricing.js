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
  // STANDAARD = .P (Daimy 20 juli: "niet standaard XP aanhouden maar P — de XP is de variant
  // met hor-mogelijkheid"). De .XP alleen als de klant een hor(mogelijkheid) op het rolluik wil.
  'roma:rolluik': { naam: 'ROMA geëxtrudeerd voorzetrolluik .P', tabel: 'voorzetrolluik_p', solarTabel: 'voorzetrolluik_p_solar', montageTitel: 'rolluik', montagePrijs: 195 },
  'roma:rolluik_xp': { naam: 'ROMA geëxtrudeerd voorzetrolluik .XP (met hor-mogelijkheid)', tabel: 'voorzetrolluik_xp', solarTabel: 'voorzetrolluik_xp_solar', montageTitel: 'rolluik', montagePrijs: 195 },
  'roma:zipscreen': { naam: 'ROMA zipSCREEN.2 (windvast ritsscreen)', tabel: 'zipscreen2', solarTabel: 'zipscreen2_solar', montageTitel: 'screen', montagePrijs: 195 },
};

// Herken een Roma-product uit de vrije productnaam van de agent ("roma rolluik", "roma
// rolluik xp", "roma zipscreen", ...). Geen /roma/ in de naam = geen Roma.
function herkenRoma(product) {
  const p = String(product || '').toLowerCase();
  if (!/roma/.test(p)) return null;
  if (/\bxp\b|hor/.test(p)) return 'roma:rolluik_xp';
  if (/rolluik|voorzet/.test(p)) return 'roma:rolluik';
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

// KLOPPEND optieblok voor Roma-regels (Daimy 20 juli: de v4-verrijking zette Sunmaster-
// up/downgrades op Roma-regels, incl. "RAL +20%" terwijl Roma alle kleuren gratis heeft).
// prijsIndicatie wordt meegegeven om een circulaire require met v4-pricing te vermijden.
function romaOptiesBlok(r, item, prijsIndicatie) {
  const regels = [];
  const isRolluik = r.productKey.startsWith('roma:rolluik');
  const kaalProduct = r.productKey === 'roma:rolluik_xp' ? 'roma rolluik xp' : isRolluik ? 'roma rolluik' : 'roma zipscreen';
  try {
    const eqNaam = isRolluik ? 'Rolluik S-42' : 'Zip Design 110';
    const eq = prijsIndicatie({ product: isRolluik ? 'rolluik s-42' : 'zip design 110', breedteMM: item.breedteMM, hoogteMM: item.hoogteMM, bediening: r.solar ? 'solar' : 'io' });
    if (eq && !eq.error && eq.productPrijsIncl) {
      const d = eq.productPrijsIncl - r.prijsIncl;
      regels.push(`Voordeliger alternatief:\n• Zelfde maat in Sunmaster ${eqNaam}: ${d < 0 ? '-' : '+'}€${Math.abs(Math.round(d))} per stuk (RAL-kleuren buiten standaard hebben daar wél een meerprijs)`);
    }
  } catch {}
  try {
    const andere = romaPrijs({ product: kaalProduct, breedteMM: item.breedteMM, hoogteMM: item.hoogteMM, bediening: r.solar ? 'io' : 'solar' });
    if (!andere.error) {
      const d = andere.prijsIncl - r.prijsIncl;
      regels.push(`Andere bediening:\n• ${r.solar ? 'Bekabeld i.p.v. solar' : 'Solar (zonne-energie, geen bekabeling nodig) i.p.v. bekabeld'}: ${d < 0 ? '-' : '+'}€${Math.abs(d)} per stuk`);
    }
  } catch {}
  // Hor-wissel binnen Roma: .P (standaard) ↔ .XP (met hor-mogelijkheid)
  try {
    if (r.productKey === 'roma:rolluik') {
      const xp = romaPrijs({ product: 'roma rolluik xp', breedteMM: item.breedteMM, hoogteMM: item.hoogteMM, bediening: r.solar ? 'solar' : 'io' });
      if (!xp.error) regels.push(`Hor-mogelijkheid:\n• Uitvoering .XP (voorbereid voor een hor in de kast): +€${Math.abs(xp.prijsIncl - r.prijsIncl)} per stuk`);
    } else if (r.productKey === 'roma:rolluik_xp') {
      const p = romaPrijs({ product: 'roma rolluik', breedteMM: item.breedteMM, hoogteMM: item.hoogteMM, bediening: r.solar ? 'solar' : 'io' });
      if (!p.error) regels.push(`Geen hor nodig?\n• Uitvoering .P (zonder hor-mogelijkheid): -€${Math.abs(r.prijsIncl - p.prijsIncl)} per stuk`);
    }
  } catch {}
  regels.push('Kleur:\n• Alle 209 RAL-kleuren (mat en structuur) zijn bij ROMA gratis, ook voor kast, geleiders en onderlijst');
  regels.push('Smart home:\n• Tahoma Switch (bedien alles via je telefoon): +€195');
  return `\n\n**Liever een ander model of bediening?**\n\n${regels.join('\n\n')}\n\nLaat het ons weten, we passen het graag voor je aan.`;
}

module.exports = { herkenRoma, romaPrijs, romaBeschrijving, romaOptiesBlok };
