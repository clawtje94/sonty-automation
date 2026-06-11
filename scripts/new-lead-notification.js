// Speed-to-Lead: Send Telegram notification when a new deal is created
// This can be triggered by a Zapier webhook or HubSpot workflow
// Usage: node new-lead-notification.js "<naam>" "<product>" "<dealId>"

const args = process.argv.slice(2);
const naam = args[0] || 'Onbekend';
const product = args[1] || 'Onbekend';
const dealId = args[2] || '';

const BOT_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const CHAT_ID = 1700128390;

const message = `🚨 NIEUWE LEAD!\n\nNaam: ${naam}\nProduct: ${product}\nDeal ID: ${dealId}\n\n⏰ BEL BINNEN 5 MINUTEN!\n(78% kiest het eerste bedrijf dat reageert)\n\nHubSpot: https://app-eu1.hubspot.com/contacts/147970649/deal/${dealId}`;

(async () => {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: message })
  });
  const data = await res.json();
  if (data.ok) {
    console.log('Notificatie verstuurd!');
  } else {
    console.error('Fout:', data.description);
  }
})();
