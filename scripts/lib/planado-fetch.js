// Centrale Planado-fetch met rate-limit-geduld (Daimy 26-08: "fixen ja").
// Planado gooit bij drukte 429 óf een kale tekst-body "Rate Limit Exceeded" met
// status 200; beide sloopten verspreid over de crons de runs (werkbon-afhandeling,
// outlook-check, boekingen). Drop-in vervanger voor fetch(): zelfde aanroep, zelfde
// response-vorm (ok/status/json()/text()), maar wacht rustig en probeert opnieuw.
// Na 5 pogingen een duidelijke fout in plaats van een JSON-parse-crash.
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const POGINGEN = 5;

async function planadoFetch(url, opties = {}) {
  let laatste = null;
  for (let poging = 0; poging < POGINGEN; poging++) {
    let r, tekst;
    try {
      r = await fetch(url, opties);
      tekst = await r.text();
    } catch (e) {
      laatste = e; // netwerkfout: ook gewoon opnieuw proberen
      await wacht(5000 * (poging + 1));
      continue;
    }
    const rateLimitTekst = /^rate limit/i.test(tekst.trim());
    if (r.status !== 429 && r.status < 500 && !rateLimitTekst) {
      return {
        ok: r.ok, status: r.status, headers: r.headers,
        json: async () => JSON.parse(tekst),
        text: async () => tekst,
      };
    }
    laatste = new Error(`Planado ${r.status}: ${tekst.slice(0, 80)}`);
    await wacht(15000 * (poging + 1));
  }
  throw new Error('Planado blijft weigeren (rate limit?) — ' + (laatste?.message || 'onbekend') + ' voor ' + url);
}

module.exports = { planadoFetch };
