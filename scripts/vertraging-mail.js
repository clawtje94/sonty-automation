// Vertragingsmail via Trengo (kanaal "Aanvragen" = aanvragen@sonty.nl).
// Tekst: docs/concept-vertragingsmail.md (v3, akkoord-traject Daimy 2026-07-09).
// LET OP: dit script heeft BEWUST alleen een testmodus. Bulk naar de Vertraging-tab
// wordt pas gebouwd/gedraaid als Daimy er expliciet om vraagt.
// Test: node scripts/vertraging-mail.js --test  → stuurt naar daimy@sonty.nl.
const fs = require('fs');
const path = require('path');

const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const AANVRAGEN_CHANNEL = 1363384; // EMAIL "Aanvragen" (aanvragen@sonty.nl)
const TH = { Authorization: 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' };

const ONDERWERP = 'Update over je bestelling bij Sonty'; // titel-keuze 2, Daimy 2026-07-09

// Zelfde huisstijl-aanpak als duo-mail.js: alleen tables + bgcolor + td-padding
// zodat Outlook (Word-engine) alles goed rendert.
const FONT = 'font-family: Arial, Helvetica, sans-serif;';

function mailTekst({ voornaam }) {
  const aanhef = voornaam ? `Hi ${voornaam},` : 'Hi,';
  const alinea = (inhoud) => `<tr><td style="${FONT} font-size: 15px; color: #333333; line-height: 24px; padding-bottom: 16px;">${inhoud}</td></tr>`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f4">
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
              ${alinea(aanhef)}
              ${alinea('Je hoort van ons omdat je een bestelling bij Sonty hebt lopen. Eerlijk is eerlijk: de levering duurt langer dan de bedoeling was, en daar balen wij minstens zo hard van als jij. Daarom leggen we je graag uit wat er speelt.')}
              ${alinea('Sonty is het afgelopen jaar harder gegroeid dan we hadden durven dromen. Meer mensen dan ooit kozen voor onze zonwering, en dat merken we op twee plekken. Onze leverancier heeft door de drukte langere levertijden nodig, en ook onze eigen montageplanning kon de vraag even niet bijbenen. Dat laatste hebben we inmiddels opgelost, en we zijn de achterstand nu volop aan het inlopen. We hopen die over 3 tot 4 weken te hebben ingehaald.')}
              <tr>
                <td bgcolor="#0a0a0a" style="padding: 20px; border-radius: 12px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="${FONT} font-size: 15px; font-weight: bold; color: #FF6B00; padding-bottom: 10px;">Goed om te weten</td></tr>
                    <tr><td style="${FONT} font-size: 13px; color: #cccccc; line-height: 21px;">We behandelen alle bestellingen strikt op volgorde van binnenkomst. De oudste bestelling is dus als eerste aan de beurt, en daar maken we voor niemand een uitzondering op. Zo komt iedereen zo snel en eerlijk mogelijk aan de beurt, en zo zorgen we er ook voor dat we de service en kwaliteit kunnen blijven leveren die je van Sonty gewend bent. Want liever iets meer geduld vragen dan haastwerk afleveren. Bellen of mailen maakt je levering daarom helaas niet sneller, hoe graag we je ook aan de telefoon te woord staan. Een precieze indicatie van de wachttijd tot montage kunnen we op dit moment ook nog niet geven.</td></tr>
                  </table>
                </td>
              </tr>
              <tr><td height="16" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>
              ${alinea('<strong>Wat je van ons mag verwachten:</strong> zodra jouw producten bij ons binnen zijn, nemen wij direct contact met je op om de montageafspraak in te plannen. Je hoeft daar zelf niets voor te doen, wij houden jouw bestelling in de gaten.')}
              ${alinea('Zeker nu het warmere weer voor de deur staat, snappen we de frustratie van het wachten maar al te goed: je wilt gewoon van je zonwering genieten. Toch vragen we je om nog even geduld. Dat is geen leuke boodschap om te sturen, maar we vertellen je liever eerlijk hoe het zit. Zijn je contactgegevens veranderd? Geef het dan wel even door via een reactie op deze mail, zodat we je straks direct kunnen bereiken.')}
              ${alinea('Nogmaals sorry voor het wachten, en bedankt voor je vertrouwen in Sonty.')}
              ${alinea('Met zonnige groet,<br /><strong>Joey</strong><br />Sonty B.V.')}
            </table>
          </td>
        </tr>
        <tr>
          <td bgcolor="#0a0a0a" align="center" style="padding: 16px 32px;">
            <span style="${FONT} font-size: 12px; color: #888888;">Sonty B.V. &middot; Frijdastraat 8F, Rijswijk &middot; info@sonty.nl</span>
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

async function stuurVertragingsMail({ email, naam, voornaam }) {
  const contactId = await trengoContact(email, naam);
  const tr = await fetch('https://app.trengo.com/api/v2/tickets', {
    method: 'POST', headers: TH,
    body: JSON.stringify({ contact_id: contactId, channel_id: AANVRAGEN_CHANNEL, subject: ONDERWERP }),
  });
  if (!tr.ok) throw new Error('ticket aanmaken mislukt: HTTP ' + tr.status + ' ' + (await tr.text()).slice(0, 120));
  const ticketId = (await tr.json()).id;
  const mr = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages`, {
    method: 'POST', headers: TH,
    body: JSON.stringify({
      email: { subject: ONDERWERP },
      message: mailTekst({ voornaam }),
    }),
  });
  if (!mr.ok) throw new Error('mail versturen mislukt: HTTP ' + mr.status + ' ' + (await mr.text()).slice(0, 200));
  await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/close`, { method: 'POST', headers: TH }).catch(() => {});
  return { ticketId };
}

module.exports = { stuurVertragingsMail, mailTekst, ONDERWERP };

if (require.main === module) {
  if (!process.argv.includes('--test')) {
    console.log('Alleen testmodus beschikbaar: node scripts/vertraging-mail.js --test (bulk komt pas na expliciet akkoord Daimy)');
    process.exit(1);
  }
  (async () => {
    const res = await stuurVertragingsMail({ email: 'daimy@sonty.nl', naam: 'Daimy Boot (test)', voornaam: 'Daimy' });
    console.log('Testmail verstuurd naar daimy@sonty.nl, ticket', res.ticketId);
  })().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
}
