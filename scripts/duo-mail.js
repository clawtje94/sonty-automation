// Duo-offerte mail via Trengo (kanaal "Aanvragen" = aanvragen@sonty.nl, keuze Daimy 2026-07-06):
// stuurt de klant zijn Sunmaster-hoofdofferte en het ROMA-alternatief naast elkaar.
// Test: node scripts/duo-mail.js --test  → stuurt naar daimy@sonty.nl met de test-offerte.
const fs = require('fs');
const path = require('path');

const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const AANVRAGEN_CHANNEL = 1363384; // EMAIL "Aanvragen" (aanvragen@sonty.nl)
const TH = { Authorization: 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' };

function mailTekst({ voornaam, product, hoofdNummer, hoofdLink, romaNummer, romaLink }) {
  return [
    `Beste ${voornaam || 'klant'},`,
    '',
    `U ontving van ons een offerte voor uw ${product || 'zonwering'}. Omdat wij met twee A-merken werken, ontvangt u hierbij ook het alternatief van het Duitse premiummerk ROMA. Zo kunt u beide rustig naast elkaar leggen.`,
    '',
    `Uw Sunmaster-offerte (nr ${hoofdNummer}):`,
    hoofdLink,
    '',
    `Uw ROMA-offerte (nr ${romaNummer}):`,
    romaLink,
    '',
    'Vragen, of een van de twee laten aanpassen? Reageer gerust op deze mail of app ons.',
    '',
    'Met zonnige groet,',
    'Team Sonty',
  ].join('\n');
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
