// CENTRALE TRENGO-FETCH MET 429-BACKOFF, TELLER EN ALARM (31-08-2026, opdracht Isa via het Brein).
// Aanleiding: Trengo geeft onder druk 429 "Too Many Attempts"; de meeste daemons hadden al een eigen retry,
// maar er was geen centrale teller/alarm en een paar plekken (notities, ticket-zoeken) hadden niets.
//   trengoFetch(pad, opties?, {pogingen}) → Response (retry op 429/5xx, Retry-After gerespecteerd, backoff 15/30/60s)
//   tel429(bron)                          → registreert een 429 (data/trengo-429.json) en alarmeert de planning-groep
//                                           bij ≥ 12 stuks binnen 15 min (max 1 melding per uur) — stilte nooit meer.
//   moetAlarmeren(tijden, nu)             → pure beslisregel (scenario-lab/onderdelen/trengo-429.js)
const fs = require('fs');
const path = require('path');

const STAND = path.join(__dirname, '..', '..', 'data', 'trengo-429.json');
const TOKEN = () => fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim();
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pure beslisregel: alarm bij ≥ 30 429's in het kwartier (retries vangen ze; alarm is voor abnormale druk), max 1/uur. */
function moetAlarmeren(tijden, nu, laatsteAlarm) {
  const kwartier = tijden.filter((t) => nu - t <= 15 * 60000);
  if (kwartier.length < 30) return false;
  return !laatsteAlarm || nu - laatsteAlarm > 60 * 60000;
}

async function tel429(bron = '') {
  try {
    let d = { tijden: [], laatsteAlarm: 0, bronnen: {} };
    try { d = JSON.parse(fs.readFileSync(STAND, 'utf8')); } catch { /* eerste keer */ }
    const nu = Date.now();
    d.tijden = [...(d.tijden || []).filter((t) => nu - t < 2 * 3600000), nu];
    d.bronnen = d.bronnen || {}; d.bronnen[bron] = (d.bronnen[bron] || 0) + 1;
    if (moetAlarmeren(d.tijden, nu, d.laatsteAlarm)) {
      d.laatsteAlarm = nu;
      const top = Object.entries(d.bronnen).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ');
      try {
        await require('./telegram-planning.js').planningTelegram(
          `Trengo geeft veel rate-limit-fouten (${d.tijden.filter((t) => nu - t <= 15 * 60000).length} in 15 min). Berichten worden automatisch opnieuw geprobeerd, maar het kan trager lopen. Drukste bronnen: ${top}.`
        );
      } catch { /* alarm is extra */ }
    }
    fs.writeFileSync(STAND, JSON.stringify(d));
  } catch { /* teller mag nooit iets breken */ }
}

/** fetch naar Trengo met retry/backoff. Geeft de laatste Response terug (ook bij blijvende 429). */
async function trengoFetch(pad, opties = {}, { pogingen = 4 } = {}) {
  const url = pad.startsWith('http') ? pad : 'https://app.trengo.com/api/v2' + pad;
  let laatste = null;
  for (let i = 0; i < pogingen; i++) {
    laatste = await fetch(url, { ...opties, headers: { Authorization: 'Bearer ' + TOKEN(), 'Content-Type': 'application/json', ...(opties.headers || {}) } });
    if (laatste.status !== 429 && laatste.status < 500) return laatste;
    if (laatste.status === 429) await tel429(pad.split('?')[0].split('/').slice(0, 3).join('/'));
    if (i < pogingen - 1) {
      const retryAfter = Number(laatste.headers?.get?.('retry-after') || 0);
      await wacht(retryAfter > 0 ? Math.min(retryAfter, 120) * 1000 : 15000 * Math.pow(2, i));
    }
  }
  return laatste;
}

module.exports = { trengoFetch, tel429, moetAlarmeren, STAND };
