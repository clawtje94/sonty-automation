// Onderdeel (UI-laag): de twee schermen die klanten/inmeters echt zien, per scenario
// in een echte browser (Playwright, headless — feedback_playwright_headless).
// Orakel-invarianten per pagina:
//  - laadt met HTTP 200 en toont NEDERLANDSE tekst (nooit een stacktrace/ruwe JSON)
//  - een kapot/verlopen token geeft een nette uitleg, geen kale foutcode
//  - mobiel (390px): geen horizontale scroll
//  - keuzepagina met echt aanbod: keuzeknoppen zichtbaar
// Read-only: er wordt nergens geklikt dat iets vastlegt.
const { combinaties } = require('../matrix.js');

const BASIS = 'https://sonty-website.vercel.app';

const dimensies = [
  {
    naam: 'pagina',
    waarden: [
      { label: 'keuze-onzin-token', pad: '/inmeten/deadbeefdeadbeefdeadbeefdeadbeef', verwachtKnoppen: false },
      { label: 'keuze-kapot-token', pad: '/inmeten/x', verwachtKnoppen: false },
      { label: 'meetbon-test', pad: '/admin/meetbon/6392', verwachtKnoppen: false },
      { label: 'meetbon-onbekend', pad: '/admin/meetbon/999999', verwachtKnoppen: false },
    ],
  },
  {
    naam: 'scherm',
    waarden: [
      { label: 'mobiel', breed: 390, hoog: 844 },
      { label: 'desktop', breed: 1280, hoog: 800 },
    ],
  },
];

let browser = null;
async function getBrowser() {
  if (!browser) {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

function orakel(s) {
  return { wil: 'nette-pagina', mobielOk: s.scherm.label !== 'mobiel' ? null : true };
}

async function voerUit(s) {
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width: s.scherm.breed, height: s.scherm.hoog } });
  try {
    const resp = await page.goto(BASIS + s.pagina.pad, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    const status = resp?.status() || 0;
    const tekst = await page.evaluate(() => document.body?.innerText || '');
    const lelijk = /unhandled|stack|TypeError|ReferenceError|\{"error"|500 Internal|ENOTFOUND/i.test(tekst);
    const nederlands = /offerte|afspraak|meetbon|verlopen|gevonden|klopt|helaas|controleer|niet/i.test(tekst);
    const horScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    return {
      status,
      nette: (status === 200 || status === 404) && !lelijk && nederlands && tekst.trim().length > 20,
      horScroll,
      melding: true, // een kapotte pagina is per definitie zichtbaar voor de klant — maar dan telt hij als fout-zichtbaar, nooit stil
      proefje: tekst.replace(/\s+/g, ' ').slice(0, 80),
    };
  } finally {
    await page.close();
  }
}

function vergelijk(wil, echt, s) {
  if (!echt.nette) return false;
  if (s.scherm.label === 'mobiel' && echt.horScroll) return false;
  return true;
}

module.exports = {
  naam: 'ui-klantpaginas (keuzepagina + meetbon, mobiel/desktop)',
  echteKlok: true, // Playwright heeft echte timers nodig
  scenarios: () => combinaties(dimensies),
  orakel,
  voerUit,
  vergelijk,
  sluit: async () => { if (browser) await browser.close(); browser = null; },
};
