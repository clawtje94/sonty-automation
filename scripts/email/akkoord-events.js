#!/usr/bin/env node
/**
 * CONVERSIE-EVENT VOOR KLAVIYO (Daimy 16-08: "hoe gaan we conversietracking doen").
 *
 * Sonty is lead-gen: de conversie is een AKKOORD op de offerte, niet een webshop-order.
 * Dit script stuurt bij elke offerte die op ACCEPTED komt eenmalig het event
 * "Offerte Akkoord" naar Klaviyo (met het offertebedrag als waarde). Daarmee kan de
 * reporting-API per flow en per campagne conversies en toegerekende omzet tellen,
 * precies zoals een webshop dat met Placed Order doet. VERSTUURT GEEN MAILS: een metric-
 * event is passief en triggert niets (geen enkele flow gebruikt deze metric als trigger).
 *
 * Dedupe: data/email/akkoord-events.json onthoudt welke offertenummers al gemeld zijn.
 * Eerste run = nulmeting: bestaande ACCEPTED worden gemarkeerd zonder events te sturen,
 * anders lijkt het alsof 960 oude akkoorden vandaag gebeurden en klopt geen enkele
 * attributie. Draait dagelijks via dagelijks.sh, na de profielsync.
 *
 * Gebruik: node scripts/email/akkoord-events.js [--dry]
 */
const fs = require('fs');
const path = require('path');
const { KLAVIYO_API_KEY } = require('../secrets.js');

const BRON = path.join(__dirname, '..', '..', 'data', 'email', 'rp-export.json');
const STAAT = path.join(__dirname, '..', '..', 'data', 'email', 'akkoord-events.json');
const DRY = process.argv.includes('--dry');

(async () => {
  const rijen = JSON.parse(fs.readFileSync(BRON, 'utf8'));
  const accepted = rijen.filter((r) => r.offerteStatus === 'ACCEPTED' && r.email && r.offerteNummer);

  const eersteRun = !fs.existsSync(STAAT);
  const gemeld = eersteRun ? {} : JSON.parse(fs.readFileSync(STAAT, 'utf8'));

  if (eersteRun) {
    for (const r of accepted) gemeld[r.offerteNummer] = 'nulmeting';
    if (!DRY) fs.writeFileSync(STAAT, JSON.stringify(gemeld, null, 1));
    console.log(`Nulmeting: ${accepted.length} bestaande akkoorden gemarkeerd, 0 events gestuurd.`);
    return;
  }

  const nieuw = accepted.filter((r) => !gemeld[r.offerteNummer]);
  console.log(`${nieuw.length} nieuw(e) akkoord(en) om als event te melden.`);
  for (const r of nieuw) {
    if (DRY) { console.log(`  DRY: ${r.offerteNummer} €${r.offerteBedrag}`); continue; }
    const res = await fetch('https://a.klaviyo.com/api/events/', {
      method: 'POST',
      headers: { Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`, revision: '2024-10-15', 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        data: {
          type: 'event',
          attributes: {
            metric: { data: { type: 'metric', attributes: { name: 'Offerte Akkoord' } } },
            profile: { data: { type: 'profile', attributes: { email: r.email } } },
            value: typeof r.offerteBedrag === 'number' ? r.offerteBedrag : 0,
            properties: { offertenummer: r.offerteNummer, product: r.product || null },
            unique_id: 'akkoord-' + r.offerteNummer,
          },
        },
      }),
    });
    if (res.ok || res.status === 202) { gemeld[r.offerteNummer] = new Date().toISOString().slice(0, 10); console.log(`  gemeld: ${r.offerteNummer} €${r.offerteBedrag}`); }
    else console.error(`  FOUT ${r.offerteNummer}: ${res.status} ${(await res.text()).slice(0, 120)}`);
    await new Promise((x) => setTimeout(x, 400));
  }
  if (!DRY) fs.writeFileSync(STAAT, JSON.stringify(gemeld, null, 1));
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
