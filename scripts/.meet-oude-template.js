// Meet de ECHTE response rate van de oude offerte-template (29 juni t/m 26 juli),
// met dezelfde definitie als ab-test-rapport.js: INBOUND-bericht na het verstuurmoment.
// Steekproef n=120 (vaste seed), vensters 3 en 7 dagen. Rustig tempo + 429-backoff.
const fs = require('fs');
const KS = require('./ai-ks/config.js');
const { getToken } = require('./trengo-api.js');

function rng(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; }

(async () => {
  const wa = JSON.parse(fs.readFileSync(__dirname + '/.wa-offerte-sent.json', 'utf8'));
  const items = (await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${KS.RP_PID}/backlogs/${KS.RP_BACKLOG}/items`, {
    headers: { Authorization: 'Bearer ' + KS.RP_API_KEY } })).json()).items || [];
  const telVanItem = new Map(items.map(i => [i.id, String(i.fields?.phone || '')]));

  // oude-template-verzendingen: vóór 27 juli, met telefoonnummer
  const oud = Object.entries(wa)
    .filter(([, t]) => t < '2026-07-27')
    .map(([id, t]) => ({ tel: telVanItem.get(id), tijd: t }))
    .filter(x => x.tel && x.tel.replace(/\D/g, '').length >= 10);
  console.log('oude-template-verzendingen met telefoon:', oud.length);

  const r = rng(42);
  const steekproef = [...oud].sort(() => r() - 0.5).slice(0, 120);
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
  console.log('\nRESULTAAT OUDE TEMPLATE (steekproef):');
  console.log(`gecheckt: ${n} klanten (${nietGevonden} geen ticket gevonden)`);
  console.log(`reactie binnen 3 dagen: ${reageer3} = ${(reageer3 / n * 100).toFixed(1)}%`);
  console.log(`reactie binnen 7 dagen: ${reageer7} = ${(reageer7 / n * 100).toFixed(1)}%`);
})();
