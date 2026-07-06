// Duo-offerte mail via Trengo (kanaal "Aanvragen" = aanvragen@sonty.nl, keuze Daimy 2026-07-06):
// stuurt de klant zijn Sunmaster-hoofdofferte en het ROMA-alternatief naast elkaar.
// Test: node scripts/duo-mail.js --test  → stuurt naar daimy@sonty.nl met de test-offerte.
const fs = require('fs');
const path = require('path');

const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const AANVRAGEN_CHANNEL = 1363384; // EMAIL "Aanvragen" (aanvragen@sonty.nl)
const TH = { Authorization: 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' };

// Zelfde huisstijl als templates/emails/*.html (logo-header, oranje knoppen, je-vorm)
function mailTekst({ voornaam, product, hoofdNummer, hoofdLink, romaNummer, romaLink }) {
  const knop = (link, tekst) => `<div style="text-align: center; margin: 16px 0;"><a href="${link}" style="display: inline-block; background: #FF6B00; color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">${tekst}</a></div>`;
  return `<div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">

  <div style="background: #0a0a0a; padding: 24px 32px; text-align: center;">
    <img src="https://cdn.prod.website-files.com/666ab30f0f595f63bc4b0971/666ab58ba2dd970e144ccb1c_logo-sonty.webp" alt="Sonty" style="height: 40px;" />
  </div>

  <div style="padding: 32px;">
    <p>Hoi ${voornaam || 'daar'},</p>

    <p>Je ontving van ons een offerte voor je <strong>${product || 'zonwering'}</strong>. Omdat wij met twee A-merken werken, sturen we je hierbij ook het alternatief van het Duitse premiummerk <strong>ROMA</strong>. Zo kun je beide rustig naast elkaar leggen.</p>

    <div style="background: #f8f8f8; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 4px; font-weight: 600;">Je Sunmaster-offerte</p>
      <p style="margin: 0; color: #555; font-size: 14px;">Offertenummer ${hoofdNummer}</p>
      ${knop(hoofdLink, 'Bekijk je Sunmaster-offerte')}
    </div>

    <div style="background: #f8f8f8; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 4px; font-weight: 600;">Je ROMA-offerte</p>
      <p style="margin: 0; color: #555; font-size: 14px;">Offertenummer ${romaNummer}</p>
      ${knop(romaLink, 'Bekijk je ROMA-offerte')}
    </div>

    <div style="background: #0a0a0a; border-radius: 12px; padding: 20px; margin: 24px 0; color: #fff;">
      <p style="margin: 0 0 12px; font-weight: 600; color: #FF6B00;">Waarom twee merken?</p>
      <p style="margin: 0; color: #ccc; font-size: 13px;">Beide zijn topkwaliteit. ROMA is de keuze als je n&eacute;t dat beetje extra wilt: dikker ge&euml;xtrudeerd aluminium, hogere windweerstandsklasse, poedercoating en 209 kleuren zonder meerprijs. In beide offertes staat wat je krijgt, zodat je eerlijk kunt vergelijken.</p>
    </div>

    <p>Vragen, of een van de twee laten aanpassen? Reageer gerust op deze mail of app ons, we denken graag mee.</p>

    <p>Groet,<br>
    <strong>Het Sonty team</strong></p>
  </div>

  <div style="text-align: center; margin: 24px 0 0;">
    <a href="https://wa.me/31850069681" style="display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">WhatsApp ons direct</a>
  </div>

  <div style="background: #f5f5f5; padding: 16px 32px; text-align: center; font-size: 12px; color: #999;">
    Sonty &mdash; Zonwering &amp; Raamdecoratie<br>
    <a href="https://sonty.nl" style="color: #FF6B00;">sonty.nl</a>
  </div>

</div>`;
}

async function trengoContact(email, naam) {
  const r = await fetch(`https://app.trengo.com/api/v2/channels/${AANVRAGEN_CHANNEL}/contacts`, {
    method: 'POST', headers: TH,
    body: JSON.stringify({ identifier: email, name: naam || email }),
  });
  if (!r.ok) throw new Error('contact aanmaken mislukt: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return (await r.json()).id;
}

/**
 * Stuurt de duo-mail. Gooit bij fouten; geeft {ticketId} terug bij succes.
 */
async function stuurDuoMail({ email, naam, voornaam, product, hoofdNummer, hoofdLink, romaNummer, romaLink }) {
  const contactId = await trengoContact(email, naam);
  const tr = await fetch('https://app.trengo.com/api/v2/tickets', {
    method: 'POST', headers: TH,
    body: JSON.stringify({ contact_id: contactId, channel_id: AANVRAGEN_CHANNEL, subject: 'Uw offertes van Sonty: Sunmaster en ROMA naast elkaar' }),
  });
  if (!tr.ok) throw new Error('ticket aanmaken mislukt: HTTP ' + tr.status + ' ' + (await tr.text()).slice(0, 120));
  const ticketId = (await tr.json()).id;
  const mr = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages`, {
    method: 'POST', headers: TH,
    body: JSON.stringify({
      email: { subject: 'Uw offertes van Sonty: Sunmaster en ROMA naast elkaar' },
      message: mailTekst({ voornaam, product, hoofdNummer, hoofdLink, romaNummer, romaLink }),
    }),
  });
  if (!mr.ok) throw new Error('mail versturen mislukt: HTTP ' + mr.status + ' ' + (await mr.text()).slice(0, 200));
  // Ticket sluiten zodat het niet als open klantenservicevraag blijft hangen
  await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/close`, { method: 'POST', headers: TH }).catch(() => {});
  return { ticketId };
}

module.exports = { stuurDuoMail, mailTekst };

if (require.main === module && process.argv.includes('--test')) {
  (async () => {
    const CFG = require('./ai-ks/config.js');
    const duo = Object.values(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'roma-duo-gemaakt.json'), 'utf8')));
    const test = duo.find(d => /Daimy Boot \(test\)/.test(d.klant));
    if (!test) { console.log('geen test-duo gevonden'); process.exit(1); }
    // Link van de bron-offerte opzoeken via het duo-document (zelfde lead)
    const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY };
    const RP = 'https://backend.reuzenpanda.nl';
    const duoDoc = (await (await fetch(`${RP}/document-service/v1/${CFG.RP_PID}/quotations/${test.romaDocumentId}`, { headers: H })).json()).quotationData;
    const qs = (await (await fetch(`${RP}/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${duoDoc.subjects.leadConfiguration}`, { headers: H })).json()).quotationDatas || [];
    const bron = qs.find(q => String(q.quotationNumber) === String(test.bron));
    const res = await stuurDuoMail({
      email: 'daimy@sonty.nl', naam: 'Daimy Boot (test)', voornaam: 'Daimy', product: 'rolluiken',
      hoofdNummer: test.bron, hoofdLink: `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${bron.documentId}/latest`,
      romaNummer: test.romaNummer, romaLink: `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${test.romaDocumentId}/latest`,
    });
    console.log('Testmail verstuurd naar daimy@sonty.nl, ticket', res.ticketId);
  })().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
}
