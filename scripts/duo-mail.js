// Duo-offerte mail via Trengo (kanaal "Aanvragen" = aanvragen@sonty.nl, keuze Daimy 2026-07-06):
// stuurt de klant zijn Sunmaster-hoofdofferte en het ROMA-alternatief naast elkaar.
// Test: node scripts/duo-mail.js --test  → stuurt naar daimy@sonty.nl met de test-offerte.
const fs = require('fs');
const path = require('path');

const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const AANVRAGEN_CHANNEL = 1363384; // EMAIL "Aanvragen" (aanvragen@sonty.nl)
const TH = { Authorization: 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' };

// Huisstijl van templates/emails/*.html, maar als tabel-layout: Outlook (Word-engine)
// negeert max-width/margin/div-padding, dus alleen tables + bgcolor + td-padding
// renderen overal goed. Knoppen als "bulletproof button" (bgcolor op de td).
const FONT = "font-family: Arial, Helvetica, sans-serif;";

function mailTekst({ voornaam, product, hoofdNummer, hoofdLink, romaNummer, romaLink }) {
  const knop = (link, tekst, kleur) => `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
        <tr>
          <td align="center" bgcolor="${kleur}" style="border-radius: 8px;">
            <a href="${link}" style="display: inline-block; padding: 14px 36px; ${FONT} font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">${tekst}</a>
          </td>
        </tr>
      </table>`;

  const offerteBlok = (kop, nummer, link, knopTekst) => `
    <tr>
      <td bgcolor="#f4f4f4" style="padding: 20px; border-radius: 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="${FONT} font-size: 16px; font-weight: bold; color: #333333; padding-bottom: 4px;">${kop}</td></tr>
          <tr><td align="center" style="${FONT} font-size: 14px; color: #555555; padding-bottom: 16px;">Offertenummer ${nummer}</td></tr>
          <tr><td align="center">${knop(link, knopTekst, '#FF6B00')}</td></tr>
        </table>
      </td>
    </tr>
    <tr><td height="16" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>`;

  const tekstcel = (inhoud, extra) => `<tr><td style="${FONT} font-size: 15px; color: #333333; line-height: 24px; ${extra || ''}">${inhoud}</td></tr>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ebebeb">
  <tr>
    <td align="center" style="padding: 24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 600px;">

        <tr>
          <td align="center" bgcolor="#0a0a0a" style="padding: 24px 32px;">
            <img src="https://cdn.prod.website-files.com/666ab30f0f595f63bc4b0971/666ab58ba2dd970e144ccb1c_logo-sonty.webp" alt="Sonty" width="120" style="display: block; height: auto;" />
          </td>
        </tr>

        <tr>
          <td bgcolor="#ffffff" style="padding: 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${tekstcel(`Hoi ${voornaam || 'daar'},`, 'padding-bottom: 16px;')}
              ${tekstcel(`Je ontving van ons een offerte voor je <strong>${product || 'zonwering'}</strong>. Omdat wij met twee A-merken werken, sturen we je hierbij ook het alternatief van het Duitse premiummerk <strong>ROMA</strong>. Zo kun je beide rustig naast elkaar leggen.`, 'padding-bottom: 24px;')}
              ${offerteBlok('Je Sunmaster-offerte', hoofdNummer, hoofdLink, 'Bekijk je Sunmaster-offerte')}
              ${offerteBlok('Je ROMA-offerte', romaNummer, romaLink, 'Bekijk je ROMA-offerte')}
              <tr>
                <td bgcolor="#0a0a0a" style="padding: 20px; border-radius: 12px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="${FONT} font-size: 15px; font-weight: bold; color: #FF6B00; padding-bottom: 10px;">Waarom twee merken?</td></tr>
                    <tr><td style="${FONT} font-size: 13px; color: #cccccc; line-height: 21px;">Beide zijn topkwaliteit. ROMA is de keuze als je n&eacute;t dat beetje extra wilt: dikker ge&euml;xtrudeerd aluminium, hogere windweerstandsklasse, poedercoating en 209 kleuren zonder meerprijs. In beide offertes staat wat je krijgt, zodat je eerlijk kunt vergelijken.</td></tr>
                  </table>
                </td>
              </tr>
              <tr><td height="24" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>
              ${tekstcel('Vragen, of een van de twee laten aanpassen? Reageer gerust op deze mail of app ons, we denken graag mee.', 'padding-bottom: 16px;')}
              ${tekstcel('Groet,<br /><strong>Het Sonty team</strong>')}
              <tr><td height="24" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>
              <tr><td align="center">${knop('https://wa.me/31850069681', 'WhatsApp ons direct', '#25D366')}</td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" bgcolor="#f5f5f5" style="padding: 16px 32px; ${FONT} font-size: 12px; color: #999999; line-height: 18px;">
            Sonty &mdash; Zonwering &amp; Raamdecoratie<br />
            <a href="https://sonty.nl" style="color: #FF6B00; text-decoration: none;">sonty.nl</a> &nbsp;&middot;&nbsp; Frijdastraat 8F, Rijswijk &nbsp;&middot;&nbsp; 085 006 9681
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
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
