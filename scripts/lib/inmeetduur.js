// Hoe lang duurt een inmeting?
// Startlijn: 43 echte inmetingen uit juli 2026 (data/inmeettijden-basislijn.json).
// Model: duur = basis + per product. Herijkt zichzelf zodra Planado werkelijke
// tijden oplevert (en_route_at / started_at / finished_at) naast de meetbon-inhoud.
const fs = require('fs');
const path = require('path');

const GELEERD = path.join(__dirname, '..', '..', 'data', 'inmeetduur-geleerd.json');

// Uit de lineaire fit op de 43 metingen: 17,3 min basis + 4,9 min per product.
// Afgerond naar wat je met droge ogen aan een inmeter uitlegt.
// Lineair wint van wortel- en staffelvarianten (mediane fout 7,2 min tegen 8-10);
// een vaste 60 min zit er 38 min naast, een vaste 120 min 98 min.
const STANDAARD = {
  basisMin: 17.3,
  perProductMin: 4.9,
  // VOORLOPIG: elk gebaseerd op 1 à 2 waarnemingen, dus met opzet bescheiden.
  // Pergola: Imhoff 47 min voor 1 stuk. Roma: Van Spijk 55 min voor 2 stuks.
  // Suneye is grillig: Nijland 49 min, Van Tol 10 min, allebei 1 stuk.
  // Deze toeslagen zijn het eerste wat de leerlus moet vervangen.
  toeslagPerProduct: { pergola: 20, roma: 15, suneye: 5, markies: 5 },
  bron: 'basislijn juli 2026 (43 metingen)',
};

function laadModel() {
  try {
    const g = JSON.parse(fs.readFileSync(GELEERD, 'utf8'));
    if (g && typeof g.basisMin === 'number' && typeof g.perProductMin === 'number') return g;
  } catch { /* nog niets geleerd */ }
  return STANDAARD;
}

/**
 * Toeslag voor grote producten. Het model telde alleen aantallen, waardoor een screen
 * van 1500 mm even zwaar woog als een serre-zonwering van 8000 mm. Meer meetpunten,
 * meer uitlijnen, vaker met twee man meten.
 * VOORLOPIG en met opzet bescheiden: de basislijn van juli bevat geen maten, dus dit
 * rust op redenering en niet op metingen. De leerlus moet dit vervangen zodra de
 * meetbon per product de echte maat naast de werkelijke tijd zet.
 */
function maatToeslag(breedteMm) {
  if (!breedteMm) return 0;
  if (breedteMm >= 6000) return 15;
  if (breedteMm >= 4000) return 10;
  if (breedteMm >= 3000) return 5;
  return 0;
}

/**
 * Geschatte inmeetduur in minuten.
 * @param {Array<{type?: string, aantal?: number, breedte?: number}>} producten
 */
function schatDuur(producten = []) {
  const m = laadModel();
  let duur = m.basisMin;
  for (const p of producten) {
    const aantal = p.aantal || 1;
    const toeslag = m.toeslagPerProduct?.[(p.type || '').toLowerCase()] || 0;
    duur += aantal * (m.perProductMin + toeslag + maatToeslag(p.breedte));
  }
  // Afronden op 5 minuten, niet op kwartieren: naar boven afronden op een kwartier
  // maakte van 22 minuten 30, en dat kost bij 6 klussen per dag bijna een uur.
  // Naar het dichtstbijzijnde vijftal, dus de schatting blijft zuiver; de marge
  // zit in de reistijd tussen de afspraken, niet verstopt in elke klus.
  return Math.max(15, Math.round(duur / 5) * 5);
}

/**
 * Herijk het model op werkelijke metingen.
 * @param {Array<{aantalProducten: number, werkelijkeDuurMin: number}>} metingen
 */
function herijk(metingen) {
  const bruikbaar = metingen.filter((m) => m.werkelijkeDuurMin > 0 && m.werkelijkeDuurMin < 240);
  if (bruikbaar.length < 20) {
    return { bijgewerkt: false, reden: `te weinig metingen (${bruikbaar.length}, minimaal 20)` };
  }
  const n = bruikbaar.length;
  const sx = bruikbaar.reduce((a, m) => a + m.aantalProducten, 0);
  const sy = bruikbaar.reduce((a, m) => a + m.werkelijkeDuurMin, 0);
  const sxy = bruikbaar.reduce((a, m) => a + m.aantalProducten * m.werkelijkeDuurMin, 0);
  const sxx = bruikbaar.reduce((a, m) => a + m.aantalProducten ** 2, 0);
  const noemer = n * sxx - sx * sx;
  if (!noemer) return { bijgewerkt: false, reden: 'alle metingen hebben hetzelfde aantal producten' };

  const perProductMin = (n * sxy - sx * sy) / noemer;
  const basisMin = (sy - perProductMin * sx) / n;
  if (basisMin < 0 || perProductMin < 0) {
    return { bijgewerkt: false, reden: 'negatieve uitkomst, metingen niet betrouwbaar' };
  }

  const model = {
    basisMin: +basisMin.toFixed(1),
    perProductMin: +perProductMin.toFixed(1),
    toeslagPerProduct: laadModel().toeslagPerProduct,
    bron: `geleerd uit ${n} werkelijke metingen`,
    bijgewerktOp: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(GELEERD), { recursive: true });
  fs.writeFileSync(GELEERD, JSON.stringify(model, null, 2));
  return { bijgewerkt: true, model };
}

module.exports = { schatDuur, herijk, laadModel, maatToeslag, STANDAARD };
