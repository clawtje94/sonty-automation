/**
 * WEBSITE-MOTOREN — meet de twee prijsmotoren die in sonty-website staan.
 *
 * Die zijn in TypeScript geschreven en gebruiken @/-imports, dus ze kunnen niet
 * zomaar vanuit een gewoon node-script geladen worden. Daarom draait dit bestand
 * als los proces met een kleine resolver (ts-hook.mjs) ervoor.
 *
 * Zonder dit deel zou de meetlat alleen v4 en de bot bewijzen, en zou een verbouwing
 * van de offerte-tool of de configurator onopgemerkt door kunnen glippen. Juist die
 * twee zien klanten rechtstreeks.
 *
 * Alleen-lezen: netwerk wordt hier net zo hard geblokkeerd als in engines.js.
 */
const stop = (wat) => () => { throw new Error(`MEETLAT: ${wat} geblokkeerd`); };
globalThis.fetch = stop('fetch');
for (const k of Object.keys(process.env)) if (/RP_|API_KEY|TOKEN|SECRET|PASSWORD/i.test(k)) delete process.env[k];

const W = '/Users/clawdboot/sonty-website/';
const ot = await import(W + 'lib/offerte-tool/pricing.ts');
const cf = await import(W + 'lib/configurator/pricing.ts');
const prod = await import(W + 'lib/configurator/products.ts');

// Maatraster in mm. Bewust ruim: van kleiner dan de kleinste staffel tot groter dan de
// grootste, zodat ook "valt buiten de tabel" een vastgelegde uitkomst is.
const BREEDTES = [500, 800, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 7000];
const HOOGTES = [500, 800, 1000, 1500, 2000, 2500, 3000, 3500, 4000];
const KLEUREN = ['standaard', 'trend', 'ral'];

// Alleen voor de zelftest: opslag in het geheugen omzetten om te bewijzen dat de meting
// een wijziging ziet. Raakt niets op schijf.
const MARKUP_OVERRIDE = process.argv.includes('--markup') ? Number(process.argv[process.argv.indexOf('--markup') + 1]) : null;
if (MARKUP_OVERRIDE && typeof ot.zetRekenConfig === 'function') ot.zetRekenConfig({ sunmasterMarkup: MARKUP_OVERRIDE });

const uit = { offerteTool: {}, configurator: {}, meta: { markupOverride: MARKUP_OVERRIDE } };

// ─── offerte-tool ────────────────────────────────────────────────────────────
const bedieningen = ot.BEDIENINGEN.map((b) => b.key);
uit.meta.offerteToolProducten = ot.PRODUCTS.length;
uit.meta.offerteToolBedieningen = bedieningen;
uit.meta.rekenConfig = ot.rekenConfig;

for (const p of ot.PRODUCTS) {
  for (const b of BREEDTES) for (const h of HOOGTES) for (const bed of bedieningen) for (const kl of KLEUREN) {
    const k = ['ot', p.key, b, h, bed, kl].join('|');
    try {
      const r = ot.berekenPrijs(p.key, b, h, bed, kl);
      // Niet alleen het totaal vastleggen maar ook de onderdelen. Anders zou een verbouwing
      // die geld tussen productprijs en kleurmeerprijs verschuift onzichtbaar blijven.
      uit.offerteTool[k] = r?.error ? null
        : [r.totaal ?? null, r.productPrijs ?? null, r.kleurMeerprijs ?? null, r.montagePrijs ?? null];
    } catch (e) { uit.offerteTool[k] = 'FOUT: ' + e.message; }
  }
}

// ─── configurator ────────────────────────────────────────────────────────────
const lijst = Array.isArray(prod.PRODUCTS) ? prod.PRODUCTS : Object.values(prod.PRODUCTS || {});
uit.meta.configuratorProducten = lijst.length;
let cfCombis = 0;

for (const p of lijst) {
  const varianten = (p.variants && p.variants.length ? p.variants.map((v) => v.id) : [undefined]);
  const bedOpties = (p.bedieningen && p.bedieningen.length ? p.bedieningen : ['io', 'draaischakelaar', 'handbediend', 'solar']);
  for (const v of varianten) for (const b of BREEDTES) for (const h of HOOGTES) for (const bed of bedOpties) {
    // configurator rekent in cm, niet in mm
    const k = ['cf', p.id, v || '-', b, h, typeof bed === 'string' ? bed : bed.key || '?'].join('|');
    try {
      const r = cf.calculatePrice({
        productId: p.id, variantId: v,
        breedte: b / 10, hoogte: h / 10, uitval: h / 10,
        bediening: typeof bed === 'string' ? bed : bed.key,
        quantity: 1,
      });
      // Net als bij de offerte-tool de onderdelen apart vastleggen: het totaal bevat
      // montage, en die hoort niet mee te bewegen met de opslag. Alleen naar het totaal
      // kijken maakt elke meting van een prijswijziging onbruikbaar.
      uit.configurator[k] = r ? [r.total ?? null, r.productPrice ?? null, r.bedieningAdjustment ?? null, r.montagePrice ?? null] : null;
      cfCombis++;
    } catch (e) { uit.configurator[k] = 'FOUT: ' + e.message; }
  }
}
uit.meta.configuratorCombinaties = cfCombis;

process.stdout.write(JSON.stringify(uit));
