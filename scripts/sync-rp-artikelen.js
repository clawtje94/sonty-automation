#!/usr/bin/env node
/**
 * Synct data/rp-prijzen.json naar de Reuzenpanda artikelen op het SONTY TEST profiel.
 *
 * - Maakt ontbrekende categorieën en artikelen aan (match op SKU, anders naam)
 * - Werkt gewijzigde verkoopprijzen bij (met marge_per_categorie toegepast)
 * - Verwijdert artikelen met "verwijder mij" in de naam
 *
 * Draait via Daimy's hub-sessie (inventory-service is nog niet opengesteld voor de API-user).
 * VEILIGHEID: werkt uitsluitend op het Sonty test profiel.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEST_PID = '23944e59-c24d-4032-a9fa-dbdb6f52bc94';
const BASE = 'https://backend.reuzenpanda.nl';
const PRIJZEN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'rp-prijzen.json'), 'utf8'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  // Login als Daimy
  await page.goto('https://hub.reuzenpanda.nl/login', { timeout: 60000 });
  await page.waitForTimeout(3000);
  const e = await page.$('input[placeholder*="mail"], input[type="email"]');
  if (e) {
    await e.fill('daimyboot@gmail.com');
    let pw = await page.$('input[type="password"]');
    if (!pw) { await page.keyboard.press('Enter'); await page.waitForTimeout(3000); pw = await page.$('input[type="password"]'); }
    if (pw) { await pw.fill('TQGb@eD%5nGRSN9@4Gss'); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(6000);
  }

  const call = (method, ep, body) => page.evaluate(async ({ method, url, body }) => {
    const res = await fetch(url, {
      method, credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { j = text; }
    return { status: res.status, body: j };
  }, { method, url: BASE + ep, body });

  // Huidige stand
  const artRes = await call('GET', `/inventory-service/${TEST_PID}/articles`);
  const catRes = await call('GET', `/inventory-service/${TEST_PID}/categories`);
  const bestaande = artRes.body.article || [];
  const categorieen = catRes.body.category || [];
  console.log(`Huidig: ${bestaande.length} artikelen, ${categorieen.length} categorieën`);

  // Rommel opruimen
  for (const a of bestaande.filter((a) => /verwijder mij/i.test(a.name))) {
    const del = await call('DELETE', `/inventory-service/${TEST_PID}/articles/${a.id}`);
    console.log(`Opruimen "${a.name}" -> ${del.status}`);
  }

  // Categorieën aanmaken waar nodig
  const catByName = new Map(categorieen.map((c) => [c.name, c.id]));
  for (const naam of Object.keys(PRIJZEN.categorieen)) {
    if (catByName.has(naam)) continue;
    let res = await call('POST', `/inventory-service/${TEST_PID}/categories`, {
      category: { id: crypto.randomUUID(), name: naam, companyProfileId: TEST_PID, archived: false },
    });
    if (res.status !== 200 || !res.body.category) {
      console.log(`Categorie "${naam}" formaat-1 faalde (${res.status}), probeer minimaal`);
      res = await call('POST', `/inventory-service/${TEST_PID}/categories`, { category: { name: naam } });
    }
    const id = res.body && res.body.category && res.body.category.id;
    if (id) { catByName.set(naam, id); console.log(`Categorie aangemaakt: ${naam}`); }
    else console.log(`FOUT categorie ${naam}: ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
  }

  // Artikelen syncen
  const bySku = new Map(bestaande.filter((a) => a.sku).map((a) => [a.sku, a]));
  const byName = new Map(bestaande.map((a) => [a.name, a]));
  let nieuw = 0, geupdatet = 0, gelijk = 0, fout = 0;

  for (const [catNaam, items] of Object.entries(PRIJZEN.categorieen)) {
    const marge = (PRIJZEN.marge_per_categorie || {})[catNaam] || 1.0;
    const categoryId = catByName.get(catNaam) || '';
    for (const item of items) {
      const prijs = String(Math.round(item.verkoop_incl * marge));
      const huidig = bySku.get(item.sku) || byName.get(item.naam);
      const artikel = {
        id: (huidig && huidig.id) || crypto.randomUUID(),
        companyProfileId: TEST_PID,
        name: item.naam,
        sku: item.sku || '',
        description: item.omschrijving || '',
        imageSrc: '',
        archived: false,
        categoryId,
        salesPrice: { isoCurrency: 'EUR', amount: prijs, inclusiveExclusive: 'inclusive', vat: 21 },
        purchasePrice: { isoCurrency: 'EUR', amount: '', inclusiveExclusive: '', vat: 21 },
      };
      if (huidig && String(huidig.salesPrice && huidig.salesPrice.amount) === prijs && huidig.categoryId === categoryId) { gelijk++; continue; }
      // POST maakt aan; voor update proberen we PUT op /articles/{id}, anders POST met bestaand id
      let res;
      if (huidig) {
        res = await call('PUT', `/inventory-service/${TEST_PID}/articles/${huidig.id}`, { article: artikel });
        if (res.status !== 200) res = await call('POST', `/inventory-service/${TEST_PID}/articles`, { article: artikel });
        if (res.status === 200) geupdatet++; else fout++;
      } else {
        res = await call('POST', `/inventory-service/${TEST_PID}/articles`, { article: artikel });
        if (res.status === 200) nieuw++; else { fout++; if (fout < 4) console.log('FOUT:', item.naam, res.status, JSON.stringify(res.body).slice(0, 150)); }
      }
    }
    console.log(`${catNaam}: klaar`);
  }

  console.log(`\nResultaat: ${nieuw} nieuw, ${geupdatet} geüpdatet, ${gelijk} ongewijzigd, ${fout} fouten`);
  const check = await call('GET', `/inventory-service/${TEST_PID}/articles`);
  console.log('Totaal artikelen op testprofiel:', (check.body.article || []).length);
  await browser.close();
})();
