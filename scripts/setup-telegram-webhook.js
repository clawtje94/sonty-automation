// Sets up a Telegram webhook using a free webhook.site URL
// This captures all messages even when the Mac is sleeping
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const WEBHOOK_TOKENS_FILE = path.join(__dirname, 'webhook-token.txt');

async function setup() {
  // Step 1: Create a webhook.site token
  const createRes = await fetch('https://webhook.site/token', { method: 'POST' });
  const tokenData = await createRes.json();
  const uuid = tokenData.uuid;
  const webhookUrl = `https://webhook.site/${uuid}`;

  console.log(`Webhook URL: ${webhookUrl}`);
  fs.writeFileSync(WEBHOOK_TOKENS_FILE, uuid);

  // Step 2: Remove any existing getUpdates connection
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);

  // Step 3: Set the webhook
  const setRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl })
  });
  const setData = await setRes.json();
  console.log('setWebhook result:', JSON.stringify(setData));

  if (setData.ok) {
    console.log('\n✅ Webhook actief! Berichten worden nu opgeslagen op webhook.site');
    console.log(`Bekijk berichten: https://webhook.site/#!/view/${uuid}`);
    console.log(`\nRun 'node scripts/read-telegram-webhook.js' om berichten te lezen.`);
  } else {
    console.log('\n❌ Webhook instellen mislukt:', setData.description);
  }
}

setup();
