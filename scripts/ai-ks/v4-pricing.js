// Hergebruikt de prijsfuncties van v4-combined 1-op-1 (zelfde eval-aanpak als scripts/tests/verify-fixes.js)
// zodat de AI-klantenservice ALTIJD dezelfde prijzen noemt als de offertecontrole.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'cron-offerte-controle-v4-combined.js');
const src = fs.readFileSync(SRC, 'utf8');
const code = src.slice(src.indexOf('const MK_UITVAL_COLS'), src.indexOf('// ============ MAIN ============'));
const SUNMASTER_PRICES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'sunmaster-prices-2026.json'), 'utf8'));
const MARKUP = 1.10;

const api = eval(code + `;({lookupPrice, calculateCorrectPrice, getProductKey, getCategory, getBedType, getMontagePrice, mkTotaalExcl, findNearest})`);

// Nette totaalprijs incl montage voor een productconfiguratie.
// bediening: 'io' | 'solar' | 'solarBrel' | 'draaischakelaar' | 'handbediend'
function prijsIndicatie({ product, breedteMM, hoogteMM, uitvalMM, bediening = 'io' }) {
  let zoek = product.toLowerCase();
  // VALKUIL: "sunbasic open cassette" (= de open-arm variant, Daimy's terminologie) bevat
  // het woord 'cassette' en zou anders naar het duurdere dichte-cassette-model mappen.
  if (/sunbasic/.test(zoek)) {
    zoek = /\bopen\b/.test(zoek) ? 'sunbasic' : (/cassette|dicht|gesloten/.test(zoek) ? 'sunbasic cassette' : 'sunbasic');
  }
  const productKey = api.getProductKey(zoek);
  if (!productKey) return { error: 'Onbekend product: ' + product + '. Bekende producten: zonneschermen (SunEye/SunBasic/SunElite), screens (Zip Design/Zip Square), rolluiken (S-37/S-42), uitvalschermen (SunCube/SunProject), serre zonwering (SunControl), pergola.' };

  const b = breedteMM ? breedteMM / 10 : null;
  const h = hoogteMM ? hoogteMM / 10 : null;
  const u = uitvalMM ? uitvalMM / 10 : null;
  if (!b) return { error: 'Breedte ontbreekt' };

  const bedType = bediening === 'io' ? 'afstandsbediening' : bediening;
  const prijs = api.calculateCorrectPrice(productKey, b, h, u, bedType);
  if (!prijs) return { error: 'Geen prijs gevonden voor deze maten — buiten leverbaar bereik. Geef dit door aan een medewerker.' };

  const cat = api.getCategory(productKey.replace(/S37|S42/, ' rolluik').replace(/zip/i, 'zip design').toLowerCase()) ||
    (productKey.startsWith('rolluik') ? 'rolluik' : productKey.startsWith('zip') || productKey.startsWith('screen') ? 'screen' :
     productKey.startsWith('sun') && ['suncube150', 'sunproject100'].includes(productKey) ? 'uitvalscherm' :
     productKey.startsWith('suncontrolPergola') ? 'pergola' : productKey.startsWith('suncontrol') ? 'serre' : 'knikarmscherm');
  const montageBed = bediening === 'solar' ? 'solar' : bediening === 'draaischakelaar' ? 'draaischakelaar' : bediening === 'handbediend' ? 'handbediend' : 'bedraad';
  const montage = api.getMontagePrice(cat === 'pergola' ? 'pergola' : cat, montageBed, false) || 195;

  return {
    productKey,
    productPrijsIncl: Math.round(prijs),
    montageIncl: montage,
    totaalIncl: Math.round(prijs + montage),
    toelichting: 'Prijzen incl. BTW, product incl. Somfy motor, montage door eigen monteurs. Indicatie op basis van opgegeven maten; definitief na inmeten.',
  };
}

module.exports = { prijsIndicatie, v4: api, SUNMASTER_PRICES, MARKUP };
