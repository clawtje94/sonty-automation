/**
 * Trengo Setup — WhatsApp templates, quick replies, auto-replies, team config
 *
 * Uses Stytch B2B password auth to get session JWT
 */

const fs = require('fs');

const TRENGO_API = 'https://app.trengo.com/api/v2';

async function getTrengoToken() {
  // Stytch B2B password auth
  const SDK_CLIENT = Buffer.from(JSON.stringify({
    sdk: { identifier: 'stytch-js', version: '6.3.0' },
    app: { identifier: 'trengo' }
  })).toString('base64');

  const authHeader = 'Basic ' + Buffer.from(
    'public-token-live-5dda5d15-f149-4631-a28c-dea06989205d:public-token-live-5dda5d15-f149-4631-a28c-dea06989205d'
  ).toString('base64');

  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://app.trengo.com',
    'Referer': 'https://app.trengo.com/',
    'X-SDK-Client': SDK_CLIENT,
    'X-SDK-Parent-Host': 'https://app.trengo.com',
    'Authorization': authHeader,
  };

  // Step 1: Password auth
  const authRes = await fetch('https://api.stytch.com/sdk/v1/b2b/passwords/authenticate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email_address: 'daimy@sonty.nl',
      password: 'CZ%bWD64XVs6Kf',
      organization_id: 'organization-live-adb9d87b-579e-4155-8afa-7b72b0d4760e',
      session_duration_minutes: 60,
    }),
  });

  const authData = await authRes.json();
  const data = authData.data || authData;

  if (!data.session_jwt) {
    console.error('Auth failed:', JSON.stringify(data).substring(0, 200));
    return null;
  }

  return data.session_jwt;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function trengoGet(token, endpoint) {
  const res = await fetch(`${TRENGO_API}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  });
  return res.json();
}

async function trengoPost(token, endpoint, data) {
  await sleep(500);
  const res = await fetch(`${TRENGO_API}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch (e) { return { status: res.status, data: text }; }
}

async function tregoPatch(token, endpoint, data) {
  await sleep(500);
  const res = await fetch(`${TRENGO_API}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch (e) { return { status: res.status, data: text }; }
}

async function main() {
  console.log('=== Trengo Setup ===\n');

  const token = await getTrengoToken();
  if (!token) { console.error('Could not get token'); return; }
  console.log('Logged in to Trengo\n');

  // ── 1. Quick Replies ──
  console.log('1. Quick Replies...');
  const existingQR = await trengoGet(token, '/quick_replies');
  console.log(`   Existing: ${(existingQR.data || existingQR || []).length} quick replies`);

  const quickReplies = [
    {
      title: 'Welkom - Eerste contact',
      message: 'Goedendag! Bedankt voor uw interesse in Sonty. Ik ben [agent.first_name] en help u graag verder. Waarmee kan ik u van dienst zijn?',
    },
    {
      title: 'Prijsindicatie verstuurd',
      message: 'Goedendag! Ik heb zojuist een prijsindicatie naar u gemaild. Heeft u hier vragen over? Ik help u graag verder!',
    },
    {
      title: 'Opmeting bevestiging',
      message: 'Goedendag! Uw inmeetafspraak is ingepland. U ontvangt een bevestigingsmail met de details. Tot dan!',
    },
    {
      title: 'Montage bevestiging',
      message: 'Goedendag! Uw montageafspraak is ingepland. Onze monteur komt op de afgesproken datum. U ontvangt een bevestigingsmail.',
    },
    {
      title: 'Offerte follow-up',
      message: 'Goedendag! Ik wilde even informeren of u de offerte heeft ontvangen en of u nog vragen heeft. Ik help u graag!',
    },
    {
      title: 'Betaling herinnering',
      message: 'Goedendag! Ik wilde u vriendelijk herinneren aan de openstaande factuur. Mocht u vragen hebben, neem gerust contact op.',
    },
    {
      title: 'Review verzoek',
      message: 'Goedendag! Wij hopen dat u tevreden bent met het resultaat. Zou u een review voor ons willen achterlaten op Google? Dat helpt ons enorm! https://g.page/r/sonty/review',
    },
    {
      title: 'Showroom uitnodiging',
      message: 'Goedendag! Wilt u onze producten in het echt zien? Kom gerust langs in onze showroom aan de Frijdastraat 8F in Rijswijk. We zijn ma-vr 8:30-18:00 en za 9:00-13:00 open.',
    },
    {
      title: 'Niet bereikbaar',
      message: 'Helaas hebben we u niet kunnen bereiken. Wilt u ons terugbellen op 085 006 9681 of een bericht sturen? Dan helpen we u graag verder!',
    },
    {
      title: 'Bestelling update',
      message: 'Goedendag! Uw bestelling is geplaatst bij de leverancier. Zodra we de levertijd weten, plannen we de montage in. We houden u op de hoogte!',
    },
  ];

  for (const qr of quickReplies) {
    const result = await trengoPost(token, '/quick_replies', qr);
    if (result.status >= 200 && result.status < 300) {
      console.log(`   ✅ ${qr.title}`);
    } else {
      console.log(`   ❌ ${qr.title}: ${JSON.stringify(result.data).substring(0, 80)}`);
    }
  }

  // ── 2. Check existing channels for auto-reply config ──
  console.log('\n2. Checking channels...');
  const channels = await trengoGet(token, '/channels');
  for (const ch of channels.data || channels || []) {
    console.log(`   Channel: ${ch.title} (${ch.type}) — ID: ${ch.id}`);
  }

  // ── 3. Update email channel signatures (Sonty branding) ──
  console.log('\n3. Updating email signatures...');
  const sontySignature = `<p>Met vriendelijke groet,<br/><br/>[agent.first_name] [agent.last_name]<br/><strong>Sonty</strong> | De specialist in zonwering en woninginrichting<br/>📞 085 006 9681<br/>📧 info@sonty.nl<br/>📍 Frijdastraat 8F, 2288 EX Rijswijk<br/><a href="https://sonty.nl">sonty.nl</a></p>`;

  for (const ch of channels.data || channels || []) {
    if (ch.type === 'EMAIL') {
      const result = await tregoPatch(token, `/channels/${ch.id}`, {
        emailChannel: {
          signature: sontySignature,
          sender_name: 'Sonty',
          sender_name_personal: '[agent.first_name] | Sonty',
        }
      });
      if (result.status >= 200 && result.status < 300) {
        console.log(`   ✅ Signature updated: ${ch.title}`);
      } else {
        console.log(`   ❌ ${ch.title}: ${JSON.stringify(result.data).substring(0, 80)}`);
      }
    }
  }

  // ── 4. Check/list teams ──
  console.log('\n4. Teams...');
  const teams = await trengoGet(token, '/teams');
  for (const t of teams.data || teams || []) {
    console.log(`   Team: ${t.name} (ID: ${t.id})`);
  }

  // ── 5. List labels ──
  console.log('\n5. Labels...');
  const labels = await trengoGet(token, '/labels');
  const existingLabels = labels.data || labels || [];
  console.log(`   Existing: ${existingLabels.length} labels`);

  const newLabels = [
    { name: 'Nieuwe Lead', color: '#FF6B00' },
    { name: 'Prijsindicatie', color: '#FFC107' },
    { name: 'Opmeting Ingepland', color: '#2196F3' },
    { name: 'Offerte Verstuurd', color: '#9C27B0' },
    { name: 'Montage Ingepland', color: '#4CAF50' },
    { name: 'Review Gevraagd', color: '#00BCD4' },
    { name: 'Urgent', color: '#F44336' },
  ];

  for (const label of newLabels) {
    // Skip if exists
    if (existingLabels.find(l => l.name === label.name)) {
      console.log(`   ⏭ ${label.name} (exists)`);
      continue;
    }
    const result = await trengoPost(token, '/labels', label);
    if (result.status >= 200 && result.status < 300) {
      console.log(`   ✅ ${label.name}`);
    } else {
      console.log(`   ❌ ${label.name}: ${JSON.stringify(result.data).substring(0, 80)}`);
    }
  }

  // ── 6. Check contacts/profiles ──
  console.log('\n6. Contacts check...');
  const contacts = await trengoGet(token, '/contacts?page=1&term=');
  const contactData = contacts.data || contacts;
  console.log(`   Total contacts: ${contactData.total || contactData.length || 'unknown'}`);

  console.log('\n=== Trengo Setup Complete ===');
}

main().catch(console.error);
