// Telegram-routering voor de planning (Daimy 07-08 en 09-08).
//
// TWEE BESTEMMINGEN, bewust gescheiden:
//  - BOEKINGEN → de groep "Planning bot groep" (@PlanningSontyBOT). Daar wil Daimy
//    ALLEEN zien wie er is ingepland, verder niets: het is de werklijst van het
//    team, geen storingskanaal.
//  - AL HET ANDERE → de data-bot (@Sontydatabot): waarschuwingen, sync-meldingen,
//    verlopen aanbiedingen, klantreacties, mislukte stappen.
//
// Standaard gaat een bericht naar de data-bot; alleen `planningTelegram(tekst,
// { boeking: true })` landt in de groep. Zo kan er nooit per ongeluk ruis in de
// groep komen doordat iemand ergens een melding toevoegt.
const fs = require('fs');
const path = require('path');

const CONFIG_PAD = path.join(__dirname, '..', '..', 'data', 'telegram-planning.json');
const DATABOT_CHAT_PAD = path.join(__dirname, '..', '..', '.sonty-data-chat.json');
const DATABOT_TOKEN = '7775843600:AAHsz7X9ypMXxzQLquoMW1bVf037-WRsEeU';
const HOOFD_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const HOOFD_CHAT = 1700128390;

/** Bestemming voor boekingen: de planning-groep. */
function config() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PAD, 'utf8'));
    if (c.token && c.chatId) return { token: c.token, chatId: c.chatId, bron: 'planning-groep' };
  } catch { /* nog niet ingericht */ }
  return { token: HOOFD_TOKEN, chatId: HOOFD_CHAT, bron: 'hoofdbot (planning-groep nog niet ingericht)' };
}

/** Bestemming voor al het overige: de data-bot. */
function databotConfig() {
  try {
    const chats = JSON.parse(fs.readFileSync(DATABOT_CHAT_PAD, 'utf8')).chats || [];
    const id = chats[0]?.id || chats[0]?.chat_id;
    if (id) return { token: DATABOT_TOKEN, chatId: id, bron: 'data-bot' };
  } catch { /* data-bot nog niet gestart */ }
  return { token: HOOFD_TOKEN, chatId: HOOFD_CHAT, bron: 'hoofdbot (data-bot onbekend)' };
}

const huidige = config();
const PLANNING_TG_TOKEN = huidige.token;
const PLANNING_TG_CHAT = huidige.chatId;

/**
 * Stuur een planningsbericht.
 * @param {string} tekst
 * @param {{boeking?: boolean}} [opties] boeking:true → planning-groep, anders data-bot.
 * Config wordt per aanroep gelezen, dus een nieuw token of chat-id werkt zonder herstart.
 */
async function planningTelegram(tekst, opties = {}) {
  const { token, chatId } = opties.boeking ? config() : databotConfig();
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: String(tekst).slice(0, 3900) }),
  }).catch(() => {});
}

module.exports = { planningTelegram, PLANNING_TG_TOKEN, PLANNING_TG_CHAT, config, databotConfig };
