// V9-WAARBORG (Daimy 16-08, akkoord als harde eis): bepaalt of een klant benaderd mag
// worden voor een tekenbonus- of opvolgmail. Uitsluiten gebeurt op KLANT-niveau (e-mail,
// telefoon laatste-9 en adres), nooit alleen op de ene offerte. Fail-closed: elke twijfel
// of onbereikbaar systeem betekent NIET sturen.
//
// De zes lagen:
//  1. dossierstatus: OOK MAAR EEN dossier van de klant op/voorbij Inmeten inplannen,
//     Gripp invullen of Afgerond → nee (ook zonder getekende offerte — casus Victor/Kirsten)
//  2. getekende offerte ergens (ACCEPTED/SIGNED) → nee
//  3. boeking of lopend aanbod in de inmeet-flow → nee
//  4. open Trengo-gesprek → nee (er loopt al contact)
//  5. opt-out: RP-status "geen herinnering meer" via de e-mail-export (magMail=false) → nee
//  6. eenmaligheid: al eerder een tekenbonus gehad → nee
const fs = require('fs');
const path = require('path');
const CFG = require('../ai-ks/config.js');

const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY };
const STOP_STATUSSEN = new Set([
  '2e9819bd-26f0-4082-8f18-32bb48f87f54', // Inmeten inplannen
  'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846', // Gripp invullen
  '2082ad8a-517c-4e24-8c0f-a5be69b1588a', // Afgerond
]);
const BONUS_LOG = path.join(__dirname, '..', '..', 'data', 'tekenbonus-log.json');
const laatste9 = (t) => String(t || '').replace(/\D/g, '').slice(-9);
const normMail = (m) => String(m || '').trim().toLowerCase();
const normAdres = (a) => String(a || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function klantIdentiteit(item) {
  const desc = item.description || '';
  const ff = Object.fromEntries((item.free_fields || []).map((f) => [f.label, f.value]));
  return {
    email: normMail(ff.email || (desc.match(/E-mailadres:\s*(\S+)/) || [])[1]),
    tel: laatste9(ff.phone || (desc.match(/Telefoonnummer:\s*(\S+)/) || [])[1]),
    adres: normAdres(ff.address || ''),
    naam: item.summary || '',
  };
}

/**
 * items: de volledige backlog-itemlijst (één keer opgehaald door de aanroeper).
 * kandidaatItem: het item waarvoor we willen mailen.
 * Geeft { mag: bool, reden } terug.
 */
async function magBenaderd(kandidaatItem, items, opties = {}) {
  const wie = klantIdentiteit(kandidaatItem);
  if (!wie.email && !wie.tel) return { mag: false, reden: 'geen e-mail of telefoon bekend (fail-closed)' };

  // alle dossiers van deze klant
  const vanKlant = items.filter((i) => {
    const k = klantIdentiteit(i);
    return (wie.email && k.email === wie.email) || (wie.tel && k.tel === wie.tel) || (wie.adres && wie.adres.length > 10 && k.adres === wie.adres);
  });

  // laag 1: dossierstatus
  for (const d of vanKlant) {
    if (STOP_STATUSSEN.has(d.status_id)) return { mag: false, reden: `dossier ${d.id.slice(0, 8)} staat op een stop-status` };
  }

  // laag 2: ergens getekend
  for (const d of vanKlant) {
    const lcId = d.item_subject?.id;
    if (!lcId) continue;
    let q;
    try {
      q = await (await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${lcId}`, { headers: H })).json();
    } catch { return { mag: false, reden: 'RP-documenten niet bereikbaar (fail-closed)' }; }
    if ((q?.quotationDatas || []).some((x) => /ACCEPTED|SIGNED/i.test(String(x.quotationStatus || '')))) {
      return { mag: false, reden: 'klant heeft al een getekende offerte' };
    }
  }

  // laag 3: inmeet-flow (boeking of aanbod)
  try {
    const boek = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'inmeet-boekingen.json'), 'utf8'));
    for (const [itemId, b] of Object.entries(boek)) {
      if (vanKlant.some((d) => d.id === itemId) || (wie.tel && laatste9(b.telefoon) === wie.tel) || (wie.email && normMail(b.email) === wie.email)) {
        return { mag: false, reden: 'zit al in de inmeet-flow (boeking/aanbod)' };
      }
    }
  } catch { return { mag: false, reden: 'boekingen-administratie niet leesbaar (fail-closed)' }; }

  // laag 4: open Trengo-gesprek
  if (!opties.zonderTrengo) {
    try {
      const { getToken } = require('../trengo-api.js');
      const jwt = await getToken();
      const TH = { Authorization: 'Bearer ' + jwt };
      const zoek = wie.tel ? '31' + wie.tel : wie.email;
      const res = await fetch('https://app.trengo.com/api/v2/contacts?term=' + encodeURIComponent(zoek), { headers: TH });
      if (!res.ok) return { mag: false, reden: 'Trengo niet bereikbaar (fail-closed)' };
      for (const c of ((await res.json()).data || [])) {
        const tr = await fetch(`https://app.trengo.com/api/v2/tickets?contact_id=${c.id}`, { headers: TH });
        if (!tr.ok) return { mag: false, reden: 'Trengo-tickets niet bereikbaar (fail-closed)' };
        for (const t of ((await tr.json()).data || [])) {
          if (t.contact && t.contact.id !== c.id) continue;
          if (String(t.status).toUpperCase() === 'OPEN') return { mag: false, reden: `open Trengo-gesprek (ticket ${t.id})` };
        }
      }
    } catch { return { mag: false, reden: 'Trengo-check faalde (fail-closed)' }; }
  }

  // laag 5: opt-out via de e-mail-export
  try {
    const rijen = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'email', 'rp-export.json'), 'utf8'));
    const rij = rijen.find((r) => (wie.email && normMail(r.email) === wie.email) || (wie.tel && laatste9(r.telefoon) === wie.tel));
    if (rij && rij.magMail === false) return { mag: false, reden: 'opt-out (geen herinnering meer)' };
    if (!rij && !wie.email) return { mag: false, reden: 'niet in mail-export en geen e-mail (fail-closed)' };
  } catch { return { mag: false, reden: 'mail-export niet leesbaar (fail-closed)' }; }

  // laag 6: eenmaligheid
  try {
    const log = fs.existsSync(BONUS_LOG) ? JSON.parse(fs.readFileSync(BONUS_LOG, 'utf8')) : {};
    for (const e of Object.values(log)) {
      if ((wie.email && normMail(e.email) === wie.email) || (wie.tel && laatste9(e.telefoon) === wie.tel)) {
        return { mag: false, reden: 'heeft al eerder een tekenbonus gehad' };
      }
    }
  } catch { return { mag: false, reden: 'tekenbonus-log niet leesbaar (fail-closed)' }; }

  return { mag: true, reden: 'alle zes lagen groen' };
}

module.exports = { magBenaderd, klantIdentiteit, STOP_STATUSSEN, BONUS_LOG };
