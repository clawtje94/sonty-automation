const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// SMTP config — fill in credentials
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.office365.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || 'daimy@sonty.nl';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM = process.env.FROM || '"Sonty" <daimy@sonty.nl>';
const TO = process.env.TO || 'daimy@sonty.nl';

// Test personalization
const vars = {
  '{{voornaam}}': 'Daimy',
  '{{product}}': 'Screens',
  '{{prijsindicatie}}': '€ 1.850',
  '{{configurator_link}}': 'https://sonty.nl/configurator/demo',
  '{{datum}}': 'Donderdag 13 maart 2026',
  '{{tijdslot}}': '10:00 - 12:00',
  '{{adres}}': 'Keizersgracht 123, 1015 Amsterdam',
  '{{offertebedrag}}': '€ 2.450',
  '{{offerte_link}}': 'https://sonty.nl/offerte/demo',
  '{{geldig_tot}}': '27 maart 2026',
  '{{aanbetalingsbedrag}}': '€ 1.225',
  '{{factuur_link}}': 'https://sonty.nl/factuur/demo',
  '{{betaal_link}}': 'https://sonty.nl/betaal/demo',
  '{{levertijd}}': '2-3 weken',
  '{{google_review_link}}': 'https://g.page/r/sonty/review',
};

const emailMeta = [
  { file: '01-prijsindicatie.html', subject: '1/9 — Jouw prijsindicatie voor Screens — Sonty' },
  { file: '02-opmeting-bevestiging.html', subject: '2/9 — Je opmeting is ingepland! — Sonty' },
  { file: '03-definitieve-offerte.html', subject: '3/9 — Je definitieve offerte van Sonty' },
  { file: '04-offerte-herinnering.html', subject: '4/9 — Nog even over je offerte — Sonty' },
  { file: '05-aanbetaling-factuur.html', subject: '5/9 — Aanbetalingsfactuur — Sonty' },
  { file: '06-aanbetaling-ontvangen.html', subject: '6/9 — Betaling ontvangen, bestelling geplaatst! — Sonty' },
  { file: '07-installatie-bevestiging.html', subject: '7/9 — Je installatie is ingepland! — Sonty' },
  { file: '08-installatie-afgerond.html', subject: '8/9 — Installatie afgerond — Sonty' },
  { file: '09-review-verzoek.html', subject: '9/9 — Hoe bevalt je nieuwe Screens? — Sonty' },
];

function replaceVars(html) {
  let result = html;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val);
  }
  return result;
}

async function main() {
  if (!SMTP_PASS) {
    console.error('SMTP_PASS is required. Run with: SMTP_PASS="xxx" node scripts/send-test-emails.js');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { ciphers: 'SSLv3' }
  });

  console.log(`Sending ${emailMeta.length} test emails to ${TO}...\n`);

  for (const [i, meta] of emailMeta.entries()) {
    const templatePath = path.join(__dirname, '..', 'templates', 'emails', meta.file);
    const raw = fs.readFileSync(templatePath, 'utf8');
    // Strip HTML comments
    const html = replaceVars(raw.replace(/<!--[\s\S]*?-->/g, ''));

    try {
      await transporter.sendMail({
        from: FROM,
        to: TO,
        subject: meta.subject,
        html,
      });
      console.log(`  ✅ ${i + 1}/9 — ${meta.subject}`);
    } catch (err) {
      console.log(`  ❌ ${i + 1}/9 — ${meta.subject}: ${err.message}`);
    }

    // 2 sec delay between emails to avoid rate limiting
    if (i < emailMeta.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\nKlaar!');
}

main();
