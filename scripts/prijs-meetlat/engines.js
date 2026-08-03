/**
 * ENGINES — laadt elke prijsmotor die Sonty heeft, in leesmodus.
 *
 * VEILIGHEID: dit bestand blokkeert het netwerk voordat er ook maar iets geladen wordt.
 * fetch, http en https gooien een fout. Zou er ergens diep in de code toch een aanroep
 * naar Reuzenpanda zitten, dan crasht de meetlat in plaats van dat hij iets wijzigt.
 * Er is dus geen enkele manier waarop deze code een offerte kan aanpassen.
 */
const fs = require('fs');
const path = require('path');

// ─── SLOT 1: netwerk dicht ───────────────────────────────────────────────────
function blokkeerNetwerk() {
  const stop = (wat) => () => { throw new Error(`MEETLAT: ${wat} geblokkeerd — deze code mag niets naar buiten sturen`); };
  globalThis.fetch = stop('fetch');
  for (const mod of ['http', 'https']) {
    const m = require(mod);
    m.request = stop(`${mod}.request`);
    m.get = stop(`${mod}.get`);
  }
  try {
    const net = require('net');
    const origConnect = net.Socket.prototype.connect;
    net.Socket.prototype.connect = function () { throw new Error('MEETLAT: socket geblokkeerd'); };
    net.Socket.prototype._origConnect = origConnect;
  } catch { /* niet fataal */ }
}
blokkeerNetwerk();

// ─── SLOT 2: geen sleutels in het geheugen ───────────────────────────────────
// Zonder API-sleutel kan er niets ingelogd worden, ook niet per ongeluk.
for (const k of Object.keys(process.env)) {
  if (/RP_|API_KEY|TOKEN|SECRET|PASSWORD/i.test(k)) delete process.env[k];
}

const ROOT = path.join(__dirname, '..', '..');
const WEBSITE = path.join(ROOT, '..', 'sonty-website');
const V4_SRC = path.join(ROOT, 'scripts', 'cron-offerte-controle-v4-combined.js');

/**
 * Laadt de prijsfuncties uit v4 op precies dezelfde manier als v4 zelf en als de bot:
 * de broncode tussen MK_UITVAL_COLS en MAIN wordt ge-eval'd.
 *
 * LET OP — dit is geen detail: die slice begint op regel 62, terwijl `const MARKUP`
 * op regel 23 staat. De ge-eval'de code pakt de MARKUP dus uit de scope van wie hem
 * inlaadt, niet uit v4 zelf. Daarom geeft deze functie de markup expliciet mee, en
 * meten we v4 en de bot los van elkaar.
 */
function laadV4Api({ markup, prices } = {}) {
  const src = fs.readFileSync(V4_SRC, 'utf8');
  const start = src.indexOf('const MK_UITVAL_COLS');
  const eind = src.indexOf('// ============ MAIN ============');
  if (start < 0 || eind < 0) throw new Error('MEETLAT: kan de prijscode niet uit v4 knippen — is het bestand verbouwd?');
  let code = src.slice(start, eind);

  // De opslag staat sinds 2026-08-03 BINNEN de slice en komt uit data/prijsconfig.json.
  // Voor de zelftest vervangen we die ene regel in de tekst, zodat een andere opslag
  // doorgerekend kan worden zonder ook maar iets op schijf aan te raken.
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prijsconfig.json'), 'utf8'));
  const MARKUP = markup !== undefined ? markup : config.sunmasterMarkup;
  if (!MARKUP) throw new Error('MEETLAT: geen sunmasterMarkup in data/prijsconfig.json');
  if (markup !== undefined) {
    const regel = 'const MARKUP = PRIJSCONFIG.sunmasterMarkup;';
    if (!code.includes(regel)) throw new Error('MEETLAT: kan de opslagregel niet vinden om te overschrijven — is v4 verbouwd?');
    code = code.replace(regel, 'const MARKUP = ' + markup + ';');
  }
  const SUNMASTER_PRICES = prices || JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sunmaster-prices-2026.json'), 'utf8'));

  const api = eval(code + ';({lookupPrice, calculateCorrectPrice, getProductKey, getCategory, getBedType, getMontagePrice, findNearest, extractMaatFromDesc, isStandaardKleur, mkTotaalExcl, MK_BEDIENING, MARKIEZEN_FACTOR, STANDAARD_KLEUREN_MAP, PRODUCT_MAP})');
  api._markup = MARKUP;
  return api;
}

/** De motor zoals v4 hem zelf draait (markup uit v4 regel 23). */
function motorV4() {
  const api = laadV4Api();
  return {
    naam: 'v4',
    markup: api._markup,
    api,
    prijs: (v) => api.calculateCorrectPrice(v.productKey, v.breedte, v.hoogte, v.uitval, v.bedType),
    montage: (cat, bed) => api.getMontagePrice(cat, bed),
  };
}

/** De motor zoals de bot hem draait: via ai-ks/v4-pricing.js, met díens eigen MARKUP. */
function motorBot() {
  const botSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'ai-ks', 'v4-pricing.js'), 'utf8');
  // De bot hoort GEEN eigen opslag meer te hebben; hij erft die uit het ingelezen v4-blok.
  // Staat er toch weer een eigen kopie, dan is dat precies de fout die we hebben opgelost
  // en moet de meting daarop stukvallen in plaats van hem te verbergen.
  if (/^const MARKUP = [\d.]+;/m.test(botSrc)) {
    throw new Error('MEETLAT: ai-ks/v4-pricing.js heeft weer een eigen MARKUP — die hoort uit prijsconfig.json te komen');
  }
  const api = laadV4Api();
  const markup = api._markup;
  return {
    naam: 'bot',
    markup,
    api,
    prijs: (v) => api.calculateCorrectPrice(v.productKey, v.breedte, v.hoogte, v.uitval, v.bedType),
    montage: (cat, bed) => api.getMontagePrice(cat, bed),
  };
}

/** Markiezen: eigen tabellen in v4, verkoopprijs excl BTW, geen Sunmaster-opslag. */
function motorMarkiezen(api) {
  return {
    naam: 'markiezen',
    prijs: (v) => {
      const excl = api.mkTotaalExcl(v.materiaal, v.breedteMM, v.uitvalMM);
      if (excl == null) return null;
      const bed = api.MK_BEDIENING?.[v.bediening]?.excl || 0;
      // Factor uit prijsconfig.json via de v4-code, NIET hier hardcoden. Stond hier eerst
      // een eigen 1.21, en toen bewoog de markiezenmeting niet mee met de config — precies
      // de fout die deze meetlat hoort te vinden, dus die mocht hij niet zelf maken.
      if (!api.MARKIEZEN_FACTOR) throw new Error('MEETLAT: geen MARKIEZEN_FACTOR uit de v4-code');
      return Math.round((excl + bed) * api.MARKIEZEN_FACTOR * 100) / 100;
    },
  };
}

/** Roma: eigen prijsboek (netto dealer excl BTW) met eigen opslag in roma-pricing.js. */
function motorRoma() {
  const roma = require(path.join(ROOT, 'scripts', 'ai-ks', 'roma-pricing.js'));
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'ai-ks', 'roma-pricing.js'), 'utf8');
  return {
    naam: 'roma',
    opslag: Number(src.match(/^const OPSLAG = ([\d.]+);/m)?.[1]) || null,
    prijs: (v) => {
      try {
        const r = roma.romaPrijs({ product: v.product, breedteMM: v.breedteMM, hoogteMM: v.hoogteMM, bediening: v.bediening });
        // romaPrijs geeft {error} terug voor maten buiten het leverprogramma; dat is een
        // geldige uitkomst ("geen prijs"), geen crash.
        if (!r || r.error) return null;
        return r.prijsIncl ?? null;
      } catch { return null; }
    },
  };
}

/** De markup die de regressietest (run-v4-safe.sh pre-check) verwacht. */
function markupVanRegressietest() {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'tests', 'verify-fixes.js'), 'utf8');
  return Number(src.match(/^const MARKUP = ([\d.]+);/m)?.[1]) || null;
}

/** De markups die in de website-code staan (offerte-tool en configurator). */
function markupsWebsite() {
  const uit = {};
  const ot = path.join(WEBSITE, 'lib', 'offerte-tool', 'pricing.ts');
  const cf = path.join(WEBSITE, 'lib', 'configurator', 'pricing.ts');
  if (fs.existsSync(ot)) {
    const s = fs.readFileSync(ot, 'utf8');
    uit.offerteToolConfig = Number(s.match(/sunmasterMarkup:\s*([\d.]+)/)?.[1]) || null;
    uit.offerteToolDeprecated = Number(s.match(/^const MARKUP = ([\d.]+);/m)?.[1]) || null;
    uit.offerteToolLosseVermenigvuldigingen = (s.match(/\*\s*1\.1\b/g) || []).length;
    uit.romaOpslag = Number(s.match(/^const ROMA_OPSLAG = ([\d.]+);/m)?.[1]) || null;
  }
  if (fs.existsSync(cf)) {
    const s = fs.readFileSync(cf, 'utf8');
    uit.configuratorLosseVermenigvuldigingen = (s.match(/\*\s*1\.1\b/g) || []).length;
  }
  return uit;
}

/** Zit de markup ingebakken in een configurator-prijstabel? Zo ja: met welke factor?
 *  Vergelijkt de tabel cel voor cel met het boek. */
function ingebakkenMarkup(tabelBestand, boekPad) {
  const cfgPad = path.join(WEBSITE, 'data', tabelBestand);
  if (!fs.existsSync(cfgPad)) return { bestand: tabelBestand, status: 'niet gevonden' };
  const cfg = JSON.parse(fs.readFileSync(cfgPad, 'utf8'));
  const boek = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sunmaster-prices-2026.json'), 'utf8'));
  const tbl = boekPad.split('.').reduce((o, k) => o?.[k], boek);
  if (!cfg.prices || !tbl) return { bestand: tabelBestand, status: 'structuur onbekend' };

  const ratios = {};
  let vergeleken = 0, nietInBoek = 0;
  for (const h of Object.keys(cfg.prices)) {
    for (const w of Object.keys(cfg.prices[h])) {
      const c = cfg.prices[h][w];
      const b = tbl[w]?.[h];
      if (b == null) { nietInBoek++; continue; }
      vergeleken++;
      const r = (Math.round((c / b) * 100) / 100).toFixed(2);
      ratios[r] = (ratios[r] || 0) + 1;
    }
  }
  const top = Object.entries(ratios).sort((a, b) => b[1] - a[1])[0];
  return { bestand: tabelBestand, vergeleken, nietInBoek, factor: top ? Number(top[0]) : null, verdeling: ratios };
}

module.exports = { motorV4, motorBot, motorMarkiezen, motorRoma, laadV4Api, markupVanRegressietest, markupsWebsite, ingebakkenMarkup, WEBSITE, ROOT };
