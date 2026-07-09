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
              ${alinea('Je hoort van ons omdat je een bestelling bij Sonty hebt lopen. Eerlijk is eerlijk: de levering duurt langer dan de bedoeling was, en daar balen wij minstens net zo hard van als jij. Daarom leggen we je graag uit wat er speelt.')}
              ${alinea('Sonty is het afgelopen jaar harder gegroeid dan we hadden durven dromen. Meer mensen dan ooit kozen voor onze zonwering, en dat merken we op twee plekken. Onze leverancier heeft door de drukte langere levertijden nodig, en ook onze eigen montageplanning kon de vraag even niet bijbenen. Dat laatste hebben we inmiddels opgelost, en we zijn de achterstand nu volop aan het inlopen. We hopen die over 3 tot 4 weken te hebben ingehaald.')}
              <tr>
                <td bgcolor="#0a0a0a" style="padding: 20px; border-radius: 12px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="${FONT} font-size: 15px; font-weight: bold; color: #FF6B00; padding-bottom: 10px;">Goed om te weten</td></tr>
                    <tr><td style="${FONT} font-size: 13px; color: #cccccc; line-height: 21px;">We behandelen alle bestellingen strikt op volgorde van binnenkomst. De oudste bestelling is dus als eerste aan de beurt, en daar maken we voor niemand een uitzondering op. Zo zorgen we ervoor dat we de service en kwaliteit kunnen blijven leveren die je van Sonty gewend bent. Want liever iets meer geduld vragen dan haastwerk afleveren. Bellen of mailen maakt je levering daarom helaas niet sneller, hoe graag we je ook aan de telefoon te woord staan. Een precieze indicatie van de wachttijd tot montage kunnen we op dit moment niet geven.</td></tr>
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

// Trengo rate-limit (429): wachten en opnieuw, max 5 pogingen
async function trengoFetch(url, opties, label) {
  for (let poging = 1; poging <= 5; poging++) {
    const r = await fetch(url, opties);
    if (r.status === 429) {
      console.log('     … rate-limit bij ' + label + ', ' + (poging < 5 ? 'wacht 65s en probeer opnieuw' : 'opgegeven'));
      if (poging === 5) throw new Error(label + ' mislukt: HTTP 429 na 5 pogingen');
      await new Promise(res => setTimeout(res, 65000));
      continue;
    }
    if (!r.ok) throw new Error(label + ' mislukt: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
    return r;
  }
}

async function trengoContact(email, naam) {
  const r = await trengoFetch(`https://app.trengo.com/api/v2/channels/${AANVRAGEN_CHANNEL}/contacts`, {
    method: 'POST', headers: TH,
    body: JSON.stringify({ identifier: email, name: naam || email }),
  }, 'contact aanmaken');
  return (await r.json()).id;
}

async function stuurVertragingsMail({ email, naam, voornaam }) {
  const contactId = await trengoContact(email, naam);
  const tr = await trengoFetch('https://app.trengo.com/api/v2/tickets', {
    method: 'POST', headers: TH,
    body: JSON.stringify({ contact_id: contactId, channel_id: AANVRAGEN_CHANNEL, subject: ONDERWERP }),
  }, 'ticket aanmaken');
  const ticketId = (await tr.json()).id;
  await trengoFetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages`, {
    method: 'POST', headers: TH,
    body: JSON.stringify({
      email: { subject: ONDERWERP },
      message: mailTekst({ voornaam }),
    }),
  }, 'mail versturen');
  await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/close`, { method: 'POST', headers: TH }).catch(() => {});
  return { ticketId };
}

module.exports = { stuurVertragingsMail, mailTekst, ONDERWERP };

// Aanhef-regel: geen rare voornamen in de mail. Initialen ("F.a"), 1-2 letters
// of "Fam" → mail zonder naam ("Hi,").
function netteVoornaam(v) {
  const s = (v || '').trim();
  if (!s || s.length <= 2 || s.includes('.') || /^fam$/i.test(s)) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const VERSTUURD_LOG = path.join(__dirname, '..', 'data', 'vertraging-mail-verstuurd.json');
const leesLog = () => { try { return JSON.parse(fs.readFileSync(VERSTUURD_LOG, 'utf8')); } catch { return {}; } };

async function bulk(echt) {
  const { lijst } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'vertraging-maillijst.json'), 'utf8'));
  const log = leesLog();
  let nr = 0, verstuurd = 0, overgeslagen = 0;
  for (const k of lijst) {
    nr++;
    const voornaam = netteVoornaam(k.voornaam);
    if (log[k.email]) { overgeslagen++; console.log(String(nr).padStart(2) + '. SKIP (al verstuurd ' + log[k.email] + '): ' + k.email); continue; }
    console.log(String(nr).padStart(2) + '. ' + (echt ? 'VERSTUUR' : 'DRY') + '  "Hi ' + (voornaam || '(zonder naam)') + ',"  → ' + k.email + '  (' + k.naam + ')');
    if (echt) {
      const res = await stuurVertragingsMail({ email: k.email, naam: k.grippNaam || k.naam, voornaam });
      log[k.email] = new Date().toISOString();
      fs.writeFileSync(VERSTUURD_LOG, JSON.stringify(log, null, 2));
      verstuurd++;
      console.log('     ✓ ticket ' + res.ticketId);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  console.log('\nKlaar: ' + (echt ? verstuurd + ' verstuurd, ' : lijst.length - overgeslagen + ' te versturen (dry-run), ') + overgeslagen + ' overgeslagen (al gehad).');
}

if (require.main === module) {
  (async () => {
    if (process.argv.includes('--test')) {
      const res = await stuurVertragingsMail({ email: 'daimy@sonty.nl', naam: 'Daimy Boot (test)', voornaam: 'Daimy' });
      console.log('Testmail verstuurd naar daimy@sonty.nl, ticket', res.ticketId);
    } else if (process.argv.includes('--bulk-dry')) {
      await bulk(false);
    } else if (process.argv.includes('--bulk-echt')) {
      // HARDE REGEL: alleen draaien na expliciet startsein van Daimy.
      if (!process.argv.includes('--ja-daimy-heeft-akkoord-gegeven')) {
        console.log('GEBLOKKEERD: --bulk-echt vereist ook --ja-daimy-heeft-akkoord-gegeven (expliciet startsein Daimy).');
        process.exit(1);
      }
      await bulk(true);
    } else {
      console.log('Gebruik: --test | --bulk-dry | --bulk-echt --ja-daimy-heeft-akkoord-gegeven');
      process.exit(1);
    }
  })().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
}
