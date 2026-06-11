#!/usr/bin/env node
/**
 * Stuur prijsindicatie WhatsApp via Trengo
 * Triggert wanneer RP offerte status → SENT
 *
 * Gebruik:
 *   node scripts/send-wa-offerte.js <phone> <klantnaam> <verkoper> <offerte_samenvatting>
 *
 * Of als module:
 *   const { sendOfferteWA } = require('./send-wa-offerte');
 *   await sendOfferteWA(page, '+31612345678', 'Jan', 'Jaimy', 'Suneye 5000x3000 - €3.665');
 */

const WA_TEMPLATE_ID = 235141;
const WA_CHANNEL_ID = 1359857;

async function loginTrengo(page) {
  await page.goto('https://app.trengo.com/login', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.fill('#email-input', 'daimy@sonty.nl');
  await page.fill('#password-input', 'CZ%bWD64XVs6Kf');
  await page.click('button:has-text("Log in")');
  await page.waitForTimeout(8000);
}

async function sendOfferteWA(page, phone, klantNaam, verkoper, offerteSamenvatting) {
  // Normalize phone number
  let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  if (cleanPhone.startsWith('06')) cleanPhone = '+31' + cleanPhone.substring(1);
  if (cleanPhone.startsWith('31')) cleanPhone = '+' + cleanPhone;
  if (!cleanPhone.startsWith('+')) cleanPhone = '+31' + cleanPhone;

  const result = await page.evaluate(async ({ phone, templateId, channelId, params }) => {
    const res = await fetch('/api/v2/wa_sessions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_phone_number: phone,
        hsm_id: templateId,
        channel_id: channelId,
        params: params,
      })
    });
    const body = await res.json();
    return { status: res.status, ticketId: body.message?.ticket_id, messageId: body.message?.id, error: body.message?.error || body.error };
  }, {
    phone: cleanPhone,
    templateId: WA_TEMPLATE_ID,
    channelId: WA_CHANNEL_ID,
    params: [
      { type: 'body', key: '{{1}}', value: klantNaam },
      { type: 'body', key: '{{2}}', value: verkoper },
      { type: 'body', key: '{{3}}', value: offerteSamenvatting },
    ]
  });

  if (result.status === 200 && result.ticketId) {
    console.log('✅ WhatsApp verstuurd naar ' + cleanPhone + ' (ticket #' + result.ticketId + ')');
    return true;
  } else {
    console.log('❌ WhatsApp fout naar ' + cleanPhone + ': ' + JSON.stringify(result));
    return false;
  }
}

// CLI mode
if (require.main === module) {
  const { chromium } = require('playwright');
  const [,, phone, klantNaam, verkoper, ...offerteParts] = process.argv;

  if (!phone || !klantNaam) {
    console.log('Gebruik: node scripts/send-wa-offerte.js <phone> <klantnaam> <verkoper> <offerte>');
    console.log('Voorbeeld: node scripts/send-wa-offerte.js +31612345678 "Jan Jansen" "Jaimy" "Suneye 5000x3000 - €3.665"');
    process.exit(1);
  }

  (async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await loginTrengo(page);
      await sendOfferteWA(page, phone, klantNaam, verkoper || 'Sonty', offerteParts.join(' ') || 'Uw prijsindicatie');
    } finally {
      await browser.close().catch(() => {});
    }
  })().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { sendOfferteWA, loginTrengo, WA_TEMPLATE_ID, WA_CHANNEL_ID };
