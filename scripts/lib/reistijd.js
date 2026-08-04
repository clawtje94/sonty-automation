// Reistijd-motor voor de inmeet-planner.
// TomTom Routing API met echte vertrektijd (dus files meegerekend), gekalibreerd op
// de werkelijke dagen van juli 2026 en gecachet zodat het aantal API-calls klein blijft.
const fs = require('fs');
const path = require('path');

const KEY_BESTAND = path.join(__dirname, '..', '.tomtom-api-key.txt');
const CACHE_BESTAND = path.join(__dirname, '..', '..', 'data', 'reistijden-cache.json');
const GEO_BESTAND = path.join(__dirname, '..', '..', 'data', 'geocode-cache.json');

// Gekalibreerd op 26 bruikbare ritten uit de echte inmeetdagen (juli 2026):
// TomTom voorspelt de rijtijd, maar deur-tot-deur komt daar parkeren, spullen pakken
// en aanbellen bij. Zie scripts/inmeettijden-analyse.js.
const DEUR_TOT_DEUR = 1.22;
const ONDERGRENS_MIN = 10;

// Het magazijn is start en eind van elke dag (Daimy: teams vertrekken in Berkel).
const MAGAZIJN = 'Noordeindseweg 256a, Berkel en Rodenrijs';

function laad(bestand) {
  try { return JSON.parse(fs.readFileSync(bestand, 'utf8')); } catch { return {}; }
}
function bewaar(bestand, data) {
  fs.mkdirSync(path.dirname(bestand), { recursive: true });
  fs.writeFileSync(bestand, JSON.stringify(data, null, 2));
}

const key = () => fs.readFileSync(KEY_BESTAND, 'utf8').trim();

let geoCache = laad(GEO_BESTAND);
let reisCache = laad(CACHE_BESTAND);

/** Adres → {lat, lon}. Gecachet, want adressen veranderen niet. */
async function geocode(adres) {
  const sleutel = adres.trim().toLowerCase();
  if (geoCache[sleutel]) return geoCache[sleutel];
  const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(adres)}.json`
    + `?key=${key()}&countrySet=NL&limit=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`geocode ${adres}: HTTP ${r.status}`);
  const p = (await r.json())?.results?.[0];
  if (!p) throw new Error(`geocode ${adres}: geen resultaat`);
  geoCache[sleutel] = { lat: p.position.lat, lon: p.position.lon, gevonden: p.address.freeformAddress };
  bewaar(GEO_BESTAND, geoCache);
  return geoCache[sleutel];
}

// Cachesleutel: coördinaten op ~100 m afgerond + weekdag + uur van vertrek.
// Dezelfde rit op hetzelfde moment van de week wordt één keer opgevraagd.
function cacheSleutel(a, b, vertrek) {
  const r = (n) => n.toFixed(3);
  const d = new Date(vertrek);
  return `${r(a.lat)},${r(a.lon)}>${r(b.lat)},${r(b.lon)}@${d.getDay()}-${d.getHours()}`;
}

/**
 * Reistijd in minuten van adres A naar adres B, vertrekkend op `vertrek` (Date of ISO).
 * Rekent met het verwachte verkeer op dat tijdstip.
 */
async function reistijd(vanAdres, naarAdres, vertrek) {
  const a = await geocode(vanAdres);
  const b = await geocode(naarAdres);
  const vertrekISO = new Date(vertrek).toISOString().slice(0, 19);
  const sleutel = cacheSleutel(a, b, vertrek);

  if (reisCache[sleutel]) return reisCache[sleutel];

  // TomTom wil een vertrektijd in de toekomst; ligt hij in het verleden, dan
  // projecteren we op dezelfde weekdag en hetzelfde tijdstip in de komende week.
  let departAt = vertrekISO;
  if (new Date(vertrek) < new Date()) {
    const d = new Date(vertrek);
    while (d < new Date()) d.setDate(d.getDate() + 7);
    departAt = d.toISOString().slice(0, 19);
  }

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${a.lat},${a.lon}:${b.lat},${b.lon}/json`
    + `?key=${key()}&traffic=true&departAt=${departAt}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`routing: HTTP ${r.status}`);
  const s = (await r.json())?.routes?.[0]?.summary;
  if (!s) throw new Error('routing: geen route gevonden');

  const rijtijd = s.travelTimeInSeconds / 60;
  const resultaat = {
    minuten: Math.max(ONDERGRENS_MIN, Math.round(rijtijd * DEUR_TOT_DEUR)),
    rijtijdTomTom: Math.round(rijtijd),
    km: +(s.lengthInMeters / 1000).toFixed(1),
    fileVertragingMin: Math.round((s.trafficDelayInSeconds || 0) / 60),
  };
  reisCache[sleutel] = resultaat;
  bewaar(CACHE_BESTAND, reisCache);
  return resultaat;
}

module.exports = { reistijd, geocode, MAGAZIJN, DEUR_TOT_DEUR, ONDERGRENS_MIN };
