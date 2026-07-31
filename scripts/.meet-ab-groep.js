// Meet de ECHTE response rate van de oude offerte-template (29 juni t/m 26 juli),
// met dezelfde definitie als ab-test-rapport.js: INBOUND-bericht na het verstuurmoment.
// Steekproef n=120 (vaste seed), vensters 3 en 7 dagen. Rustig tempo + 429-backoff.
const fs = require('fs');
const KS = require('./ai-ks/config.js');
const { getToken } = require('./trengo-api.js');

function rng(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; }

(async () => {
  const st = JSON.parse(fs.readFileSync(__dirname + '/../data/ab-test-state.json', 'utf8'));
  const steekproef = Object.entries(st.toewijzingen).map(([tel, v]) => ({ tel: '+' + tel, tijd: v.tijd }));
  console.log('A/B-verzendingen:', steekproef.length);
  const jwt = await getToken();
  const H = { Authorization: 'Bearer ' + jwt };

  let n = 0, reageer3 = 0, reageer7 = 0, nietGevonden = 0;
  for (const k of steekproef) {
    await new Promise(res => setTimeout(res, 1300));
    let msgs = [];
    try {
      let zoek;
      for (let poging = 1; poging <= 3; poging++) {
        const resp = await fetch(`https://app.trengo.com/api/v2/tickets?term=${encodeURIComponent(k.tel)}`, { headers: H });
        if (resp.status === 429) { await new Promise(res => setTimeout(res, 25000)); continue; }
        zoek = await resp.json(); break;
      }
      const ticket = (zoek?.data || [])[0];
      if (!ticket) { nietGevonden++; continue; }
      for (let p = 1; p <= 2; p++) {
        const resp = await fetch(`https://app.trengo.com/api/v2/tickets/${ticket.id}/messages?page=${p}`, { headers: H });
        if (resp.status === 429) { await new Promise(res => setTimeout(res, 25000)); p--; continue; }
        if (!resp.ok) break;
        const j = await resp.json();
        msgs.push(...(j.data || []));
        if (!j.links?.next) break;
      }
    } catch { continue; }
    n++;
    const t0 = new Date(k.tijd).getTime();
    const inb = msgs.filter(m => m.type === 'INBOUND' && !m.internal_note)
      .map(m => new Date(String(m.created_at).replace(' ', 'T') + 'Z').getTime())
      .filter(t => t > t0);
    if (inb.some(t => t - t0 <= 3 * 864e5)) reageer3++;
    if (inb.some(t => t - t0 <= 7 * 864e5)) reageer7++;
    if (n % 20 === 0) console.log(`  ...${n} gecheckt (3d: ${reageer3}, 7d: ${reageer7})`);
  }
  console.log('\nRESULTAAT NIEUWE TEMPLATES (zelfde methode):');
  console.log(`gecheckt: ${n} klanten (${nietGevonden} geen ticket gevonden)`);
  console.log(`reactie binnen 3 dagen: ${reageer3} = ${(reageer3 / n * 100).toFixed(1)}%`);
  console.log(`reactie binnen 7 dagen: ${reageer7} = ${(reageer7 / n * 100).toFixed(1)}%`);
})();
