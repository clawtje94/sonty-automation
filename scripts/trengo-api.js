#!/usr/bin/env node
/**
 * Trengo API client — puur HTTP, geen browser nodig
 * Authenticatie via Stytch B2B password → JWT
 */

const fs = require('fs');
const path = require('path');

const TRENGO_EMAIL = 'daimy@sonty.nl';
const TRENGO_PASSWORD = 'CZ%bWD64XVs6Kf';
const STYTCH_ORG_ID = 'organization-live-adb9d87b-579e-4155-8afa-7b72b0d4760e';
const STYTCH_PUBLIC_TOKEN = 'public-token-live-5dda5d15-f149-4631-a28c-dea06989205d';
const STYTCH_AUTH = Buffer.from(STYTCH_PUBLIC_TOKEN + ':' + STYTCH_PUBLIC_TOKEN).toString('base64');
const TOKEN_FILE = path.join(__dirname, '.trengo-jwt.txt');

const WA_TEMPLATE_ID = 235141;
const WA_CHANNEL_ID = 1359857;

async function getToken() {
  // Check cached token
  try {
    const cached = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    if (cached.expires_at && new Date(cached.expires_at) > new Date(Date.now() + 300000)) {
      // Test if still valid
      const test = await fetch('https://app.trengo.com/api/v2/channels', {
        headers: { 'Authorization': 'Bearer ' + cached.jwt }
      });
      if (test.ok) return cached.jwt;
    }
  } catch {}

  // Get fresh token via Stytch
  console.log('[Trengo] Refreshing JWT...');
  const res = await fetch('https://api.stytch.com/sdk/v1/b2b/passwords/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + STYTCH_AUTH,
      'x-sdk-client': Buffer.from(JSON.stringify({
        event_id: 'event-id-' + crypto.randomUUID(),
        app_session_id: 'app-session-id-' + crypto.randomUUID(),
        persistent_id: 'persistent-id-' + crypto.randomUUID(),
        client_sent_at: new Date().toISOString(),
        timezone: 'Europe/Amsterdam',
        app: { identifier: 'app.trengo.com' },
        sdk: { identifier: 'Stytch.js Javascript SDK', version: '0.0.0' }
      })).toString('base64'),
      'x-sdk-parent-host': 'https://app.trengo.com',
      'origin': 'https://app.trengo.com',
      'referer': 'https://app.trengo.com/',
    },
    body: JSON.stringify({
      email_address: TRENGO_EMAIL,
      password: TRENGO_PASSWORD,
      organization_id: STYTCH_ORG_ID,
      session_duration_minutes: 10080,
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('Stytch auth failed: ' + res.status + ' ' + err.substring(0, 200));
  }

  const raw = await res.json();
  const data = raw.data || raw;
  if (!data.session_jwt) throw new Error('No JWT in response');

  // Cache token
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({
    jwt: data.session_jwt,
    expires_at: data.member_session?.expires_at || new Date(Date.now() + 604800000).toISOString(),
  }));

  console.log('[Trengo] JWT refreshed, expires:', data.session?.expires_at);
  return data.session_jwt;
}

async function sendWhatsApp(phone, klantNaam, verkoper, offerteSamenvatting) {
  const token = await getToken();

  // Normalize phone
  let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  if (cleanPhone.startsWith('06')) cleanPhone = '+31' + cleanPhone.substring(1);
  if (cleanPhone.startsWith('31') && !cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
  if (!cleanPhone.startsWith('+')) cleanPhone = '+31' + cleanPhone;

  const res = await fetch('https://app.trengo.com/api/v2/wa_sessions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      recipient_phone_number: cleanPhone,
      hsm_id: WA_TEMPLATE_ID,
      channel_id: WA_CHANNEL_ID,
      params: [
        { type: 'body', key: '{{1}}', value: klantNaam },
        { type: 'body', key: '{{2}}', value: verkoper || 'Jaimy' },
        { type: 'body', key: '{{3}}', value: offerteSamenvatting || 'Uw prijsindicatie' },
      ]
    })
  });

  const body = await res.json();
  if (res.ok && body.message?.ticket_id) {
    console.log('✅ WhatsApp verstuurd naar ' + cleanPhone + ' (ticket #' + body.message.ticket_id + ')');
    return { ok: true, ticketId: body.message.ticket_id };
  } else {
    console.log('❌ WhatsApp fout:', res.status, JSON.stringify(body).substring(0, 200));
    return { ok: false, error: body };
  }
}

// CLI mode
if (require.main === module) {
  const [,, cmd, ...args] = process.argv;

  if (cmd === 'test') {
    getToken().then(t => console.log('Token OK, length:', t.length)).catch(console.error);
  } else if (cmd === 'send') {
    const [phone, naam, verkoper, ...offerte] = args;
    if (!phone) { console.log('Gebruik: node trengo-api.js send <phone> <naam> <verkoper> <offerte>'); process.exit(1); }
    sendWhatsApp(phone, naam, verkoper, offerte.join(' ')).catch(console.error);
  } else {
    console.log('Trengo API client');
    console.log('  node trengo-api.js test              — test JWT auth');
    console.log('  node trengo-api.js send <phone> ...  — stuur WhatsApp');
  }
}

module.exports = { getToken, sendWhatsApp, WA_TEMPLATE_ID, WA_CHANNEL_ID };
