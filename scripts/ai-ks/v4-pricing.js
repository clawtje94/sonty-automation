// Hergebruikt de prijsfuncties van v4-combined 1-op-1 (zelfde eval-aanpak als scripts/tests/verify-fixes.js)
// zodat de AI-klantenservice ALTIJD dezelfde prijzen noemt als de offertecontrole.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'cron-offerte-controle-v4-combined.js');
const src = fs.readFileSync(SRC, 'utf8');
const code = src.slice(src.indexOf('const MK_UITVAL_COLS'), src.indexOf('// ============ MAIN ============'));
const SUNMASTER_PRICES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'sunmaster-prices-2026.json'), 'utf8'));
const MARKUP = 1.10;

const api = eval(code + `;({lookupPrice, calculateCorrectPrice, getProductKey, getCategory, getBedType, getMontagePrice, mkTotaalExcl, findNearest, reorderAndMerge})`);

const UNILUX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'unilux-prijzen-2026.json'), 'utf8'));
const BTW = 1.21;
// Markies bediening-meerprijzen excl BTW (v4/offerte-tool)
const MK_BEDIENING_EXCL = { handbediend: 0, draaischakelaar: 330, io: 495, solarBrel: 565, solar: 665 };

const HOR_TYPES = {
  'raamrolhor comfort': 'comfort', 'rolhor': 'comfort', 'super plus': 'super_plus', 'super+': 'super_plus',
  'voorzethor': 'voorzethor', 'inklemhor': 'inklemhor', 'veerstifthor': 'veerstifthor', 'softfit': 'veerstifthor',
  'plisse voorzet': 'voorzet_unit', 'plisse inklem': 'inklem_unit', 'plisse dubbel': 'unit_dubbel',
  'plissefit dubbel': 'plissefit_dubbel', 'dubbele plissefit': 'plissefit_dubbel', 'plissefit': 'plissefit', 'plisse hordeur': 'plissefit',
  'vaste hordeur': 'vaste_hordeur_luxe', 'schuifhordeur': 'schuifhordeur_luxe', 'schuifpui hordeur': 'plissefit_dubbel',
};

function horPrijs({ type, breedteMM, hoogteMM }) {
  const t = (type || '').toLowerCase().replace(/[éè]/g, 'e').replace(/-/g, ' ');
  let key = null;
  for (const [naam, k] of Object.entries(HOR_TYPES)) if (t.includes(naam)) { key = k; break; }
  if (!key) return { error: 'Onbekend hortype. Kies uit: raamrolhor Comfort of Super+, vaste raamhor (voorzet/inklem/veerstift), raamplissé (voorzet/inklem/dubbel), plisséfit hordeur (enkel of dubbel), vaste hordeur luxe, schuifhordeur luxe. Vraag de klant wat past bij de situatie (openslaande deuren = plisséfit (dubbel), schuifpui = plisséfit dubbel of schuifhordeur).' };
  const p = UNILUX.producten[key];
  const wIdx = p.widths.findIndex(w => w >= breedteMM);
  const hIdx = p.heights.findIndex(h => h >= hoogteMM);
  if (wIdx === -1 || hIdx === -1) return { error: `Maat ${breedteMM}x${hoogteMM}mm valt buiten het leverbare bereik van dit model (max ${p.widths[p.widths.length - 1]}x${p.heights[p.heights.length - 1]}mm).` };
  const prijs = p.prices?.[hIdx]?.[wIdx];
  if (typeof prijs !== 'number') return { error: 'Deze maatcombinatie is bij dit model niet leverbaar.' };
  return { productKey: 'hor:' + key, productPrijsIncl: Math.round(prijs), montageIncl: 0, totaalIncl: Math.round(prijs), toelichting: 'Unilux hor, prijs incl. BTW. Montagekosten worden bij het inmeten bepaald (niet inbegrepen in dit bedrag).' };
}

// Nette totaalprijs incl montage voor een productconfiguratie.
// bediening: 'io' | 'solar' | 'solarBrel' | 'draaischakelaar' | 'handbediend'
function prijsIndicatie({ product, breedteMM, hoogteMM, uitvalMM, bediening = 'io', materiaal }) {
  let zoek = product.toLowerCase();

  // ── Horren (Unilux) ──
  if (/\bhor\b|hordeur|plisse|plissé|rolhor/.test(zoek)) {
    if (!breedteMM || !hoogteMM) return { error: 'Breedte en hoogte (mm) nodig voor een hor.' };
    return horPrijs({ type: zoek, breedteMM, hoogteMM });
  }

  // ── Markiezen (Markiezen NL tabellen, excl BTW × 1.21; zelfde bron als v4) ──
  if (/markies|markiezen/.test(zoek)) {
    const mat = (materiaal || zoek).toLowerCase().includes('alu') ? 'Aluminium'
      : /hardhout|meranti/.test((materiaal || zoek).toLowerCase()) ? 'Hardhout'
      : /grenen|hout/.test((materiaal || zoek).toLowerCase()) ? 'Grenen' : null;
    if (!mat) return { error: 'Materiaalkeuze nodig voor een markies: grenenhouten kap, hardhouten kap (meranti) of aluminium kap. Vraag dit aan de klant (aluminium = onderhoudsvrij, hout = klassiek).' };
    if (!breedteMM) return { error: 'Breedte (mm) nodig.' };
    const uitval = uitvalMM || 1000; // standaard uitval markies als niet opgegeven
    const excl = api.mkTotaalExcl(mat, breedteMM, uitval);
    if (excl == null) return { error: 'Maat buiten het leverbare bereik voor markiezen (breedte tot 4200mm hout / 5000mm aluminium, uitval tot 2000mm).' };
    const bedExcl = MK_BEDIENING_EXCL[bediening] ?? 0;
    const productIncl = Math.round((excl + bedExcl) * BTW);
    const montage = 275;
    return { productKey: 'markies' + mat, productPrijsIncl: productIncl, montageIncl: montage, totaalIncl: productIncl + montage, toelichting: `Markies met ${mat.toLowerCase()} kap, uitval ${uitval}mm, incl. BTW; montage door eigen monteurs. Bediening: ${bediening === 'handbediend' ? 'koord (handbediend)' : bediening}. Indicatie; definitief na inmeten.` };
  }
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
