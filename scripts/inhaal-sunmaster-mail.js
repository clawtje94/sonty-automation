// Inhaalmail Sunmaster-offerte: voor de 47 klanten die per ongeluk ALLEEN de Roma
// duo-offerte kregen (bron-Sunmaster bleef DRAFT, zie data/duo-verzendstatus-2026-07-10.json).
// Stuurt via Trengo "Aanvragen" (zelfde route als duo-mail.js) een mail met beide offertes
// naast elkaar, Sunmaster voorop.
//
// Gebruik:
//   node scripts/inhaal-sunmaster-mail.js            → dry-run: lijst + preview HTML, verstuurt NIETS
//   node scripts/inhaal-sunmaster-mail.js --test     → stuurt 1 voorbeeldmail naar daimy@sonty.nl
//   node scripts/inhaal-sunmaster-mail.js --send     → stuurt echt naar alle klanten (alleen na akkoord Daimy)
//
// Dedupe: data/inhaal-sunmaster-verstuurd.json — nooit twee keer naar dezelfde klant.
const fs = require('fs');
const path = require('path');

const CFG = require('./ai-ks/config.js');
const RP = 'https://backend.reuzenpanda.nl';
const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY };

const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const AANVRAGEN_CHANNEL = 1363384; // EMAIL "Aanvragen" (aanvragen@sonty.nl)
const TH = { Authorization: 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' };

const STATUS_FILE = path.join(__dirname, '..', 'data', 'duo-verzendstatus-2026-07-10.json');
const DUO_LOG = path.join(__dirname, '..', 'data', 'roma-duo-gemaakt.json');
const VERSTUURD_LOG = path.join(__dirname, '..', 'data', 'inhaal-sunmaster-verstuurd.json');

const FONT = "font-family: Arial, Helvetica, sans-serif;";
const ONDERWERP = 'Uw Sunmaster-offerte van Sonty (aanvulling op uw ROMA-offerte)';

// Zelfde tabel-layout als duo-mail.js (Outlook-proof), maar omgekeerd verhaal:
// de klant HEEFT de Roma al, de Sunmaster komt er nu bij.
function mailTekst({ voornaam, product, sunmasterNummer, sunmasterLink, romaNummer, romaLink }) {
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
              ${tekstcel(`Je ontving onlangs van ons de offerte van het Duitse premiummerk <strong>ROMA</strong> voor je <strong>${product || 'zonwering'}</strong>. Omdat wij met twee A-merken werken, hoort daar ook onze <strong>Sunmaster</strong>-offerte bij. Die was nog niet naar je verstuurd en ontvang je hierbij alsnog, zodat je beide rustig naast elkaar kunt leggen.`, 'padding-bottom: 24px;')}
              ${offerteBlok('Je Sunmaster-offerte', sunmasterNummer, sunmasterLink, 'Bekijk je Sunmaster-offerte')}
              ${offerteBlok('Je ROMA-offerte (eerder ontvangen)', romaNummer, romaLink, 'Bekijk je ROMA-offerte')}
              <tr>
                <td bgcolor="#0a0a0a" style="padding: 20px; border-radius: 12px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="${FONT} font-size: 15px; font-weight: bold; color: #FF6B00; padding-bottom: 10px;">Waarom twee merken?</td></tr>
                    <tr><td style="${FONT} font-size: 13px; color: #cccccc; line-height: 21px;">Beide zijn topkwaliteit en worden door ons eigen montageteam geplaatst. Sunmaster is ons scherp geprijsde A-merk. ROMA is de keuze als je n&eacute;t dat beetje extra wilt: dikker ge&euml;xtrudeerd aluminium, hogere windweerstandsklasse, poedercoating en 209 kleuren zonder meerprijs. In beide offertes staat precies wat je krijgt, zodat je eerlijk kunt vergelijken.</td></tr>
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

// Productnaam voor in de mailtekst, uit de eerste productregel van de bron-offerte
function productUitLines(lines) {
  for (const l of lines || []) {
    const t = (l.description || '').split('\n')[0].replace(/\*\*/g, '').trim().toLowerCase();
    if (/inmeten|montage|korting|actie|waarom/.test(t)) continue;
    if (/rolluik/.test(t)) return 'rolluiken';
    if (/zip|screen/.test(t)) return 'screens';
  }
  return 'zonwering';
}

async function contactVoorDoc(qd) {
  const cpId = qd.subjects?.contactPerson;
  if (!cpId) return null;
  const r = await fetch(`${RP}/contact-service/${CFG.RP_PID}/contact-persons/${cpId}`, { headers: H });
  if (!r.ok) return null;
  const cp = (await r.json()).contact_person;
  const ff = Object.fromEntries((cp?.free_fields || []).map(f => [f.label, f.value]));
  const naam = (ff.name || cp?.display_name || '').replace(/\s+/g, ' ').trim();
  return { email: (ff.email || '').trim(), naam, voornaam: naam.split(' ')[0] || '' };
}

async function verzamelKlanten() {
  const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  const duoLog = JSON.parse(fs.readFileSync(DUO_LOG, 'utf8'));
  const klanten = [];
  const problemen = [];

  for (const tag of status.alleenRoma) {
    const bronNummer = tag.match(/bron (\d+)=/)[1];
    const entry = Object.entries(duoLog).find(([, v]) => String(v.bron) === bronNummer);
    if (!entry) { problemen.push(bronNummer + ': niet in roma-duo-gemaakt.json'); continue; }
    const [bronDocId, e] = entry;

    const bron = (await (await fetch(`${RP}/document-service/v1/${CFG.RP_PID}/quotations/${bronDocId}`, { headers: H })).json()).quotationData;
    if (!bron) { problemen.push(bronNummer + ' (' + e.klant + '): bron-document niet gevonden'); continue; }
    // Veiligheidscheck: alleen mailen zolang de Sunmaster nog steeds niet verstuurd is
    if (bron.documentStatus === 'SENT') { problemen.push(bronNummer + ' (' + e.klant + '): inmiddels al SENT, overslaan'); continue; }

    const contact = await contactVoorDoc(bron);
    if (!contact || !contact.email || !/@/.test(contact.email)) {
      problemen.push(bronNummer + ' (' + e.klant + '): geen e-mailadres gevonden');
      continue;
    }
    klanten.push({
      bronNummer, bronDocId, romaNummer: e.romaNummer, romaDocId: e.romaDocumentId,
      klant: e.klant, ...contact,
      product: productUitLines(bron.segments?.defaultTemplatePriceLineGroup?.data?.lines),
      sunmasterLink: `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${bronDocId}/latest`,
      romaLink: `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${e.romaDocumentId}/latest`,
    });
  }
  return { klanten, problemen };
}

async function trengoContact(email, naam) {
  const r = await fetch(`https://app.trengo.com/api/v2/channels/${AANVRAGEN_CHANNEL}/contacts`, {
    method: 'POST', headers: TH,
    body: JSON.stringify({ identifier: email, name: naam || email }),
  });
  if (!r.ok) throw new Error('contact aanmaken mislukt: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return (await r.json()).id;
}

async function stuurMail(k, naarEmail) {
  const contactId = await trengoContact(naarEmail, k.naam);
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
      message: mailTekst({ voornaam: k.voornaam, product: k.product, sunmasterNummer: k.bronNummer, sunmasterLink: k.sunmasterLink, romaNummer: k.romaNummer, romaLink: k.romaLink }),
    }),
  });
  if (!mr.ok) throw new Error('mail versturen mislukt: HTTP ' + mr.status + ' ' + (await mr.text()).slice(0, 200));
  await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/close`, { method: 'POST', headers: TH }).catch(() => {});
  return { ticketId };
}

(async () => {
  const mode = process.argv.includes('--send') ? 'send' : process.argv.includes('--test') ? 'test' : 'dry-run';
  console.log('Modus:', mode);

  const { klanten, problemen } = await verzamelKlanten();
  console.log('\nKlanten met complete gegevens: ' + klanten.length);
  for (const k of klanten) console.log(`  ${k.klant} <${k.email}> | Sunmaster ${k.bronNummer} + Roma ${k.romaNummer} | ${k.product}`);
  if (problemen.length) { console.log('\nNIET mailbaar (' + problemen.length + '):'); problemen.forEach(p => console.log('  ' + p)); }

  if (mode === 'dry-run') {
    const voorbeeld = klanten[0];
    if (voorbeeld) {
      const html = mailTekst({ voornaam: voorbeeld.voornaam, product: voorbeeld.product, sunmasterNummer: voorbeeld.bronNummer, sunmasterLink: voorbeeld.sunmasterLink, romaNummer: voorbeeld.romaNummer, romaLink: voorbeeld.romaLink });
      const out = path.join(__dirname, '..', 'data', 'inhaal-sunmaster-preview.html');
      fs.writeFileSync(out, html);
      console.log('\nPreview HTML: ' + out);
    }
    console.log('Dry-run: er is NIETS verstuurd.');
    return;
  }

  if (mode === 'test') {
    const k = klanten[0];
    if (!k) { console.log('geen klant om mee te testen'); process.exit(1); }
    const res = await stuurMail({ ...k, naam: 'Daimy Boot (test)', voornaam: 'Daimy' }, 'daimy@sonty.nl');
    console.log('Testmail (gegevens van ' + k.klant + ') verstuurd naar daimy@sonty.nl, ticket ' + res.ticketId);
    return;
  }

  // --send: echt versturen, met dedupe-log
  const verstuurd = fs.existsSync(VERSTUURD_LOG) ? JSON.parse(fs.readFileSync(VERSTUURD_LOG, 'utf8')) : {};
  let ok = 0, fout = 0;
  for (const k of klanten) {
    if (verstuurd[k.bronNummer]) { console.log('  al gehad: ' + k.klant); continue; }
    try {
      const res = await stuurMail(k, k.email);
      verstuurd[k.bronNummer] = { klant: k.klant, email: k.email, ticketId: res.ticketId, tijd: new Date().toISOString() };
      fs.writeFileSync(VERSTUURD_LOG, JSON.stringify(verstuurd, null, 1));
      console.log('  OK: ' + k.klant + ' <' + k.email + '> ticket ' + res.ticketId);
      ok++;
      await new Promise(r => setTimeout(r, 1500)); // Trengo niet bestoken
    } catch (err) {
      console.log('  FOUT bij ' + k.klant + ': ' + err.message);
      fout++;
    }
  }
  console.log('\nKlaar: ' + ok + ' verstuurd, ' + fout + ' fouten.');
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
