// Planning-Telegram (@PlanningSontyBOT, Daimy 07-08: "alle planning gerelateerde
// dingen met de nieuwe telegram koppelen"). Alle planning-/inmeet-meldingen gaan via
// deze lib. Zolang data/telegram-planning.json ({"token":"...","chatId":123}) nog
// niet bestaat, valt alles terug op de hoofdbot — er mag nooit een melding stilvallen
// omdat de nieuwe bot nog niet is ingericht.
const fs = require('fs');
const path = require('path');

const CONFIG_PAD = path.join(__dirname, '..', '..', 'data', 'telegram-planning.json');
const HOOFD_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const HOOFD_CHAT = 1700128390;

function config() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PAD, 'utf8'));
    if (c.token && c.chatId) return { token: c.token, chatId: c.chatId, bron: 'planning-bot' };
  } catch { /* nog niet ingericht */ }
  return { token: HOOFD_TOKEN, chatId: HOOFD_CHAT, bron: 'hoofdbot (planning-bot nog niet ingericht)' };
}

const huidige = config();
const PLANNING_TG_TOKEN = huidige.token;
const PLANNING_TG_CHAT = huidige.chatId;

/** Stuur een planning-melding. Leest de config per call, dus een nieuw token werkt
 *  zonder daemon-herstart. */
async function planningTelegram(tekst) {
  const { token, chatId } = config();
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: tekst }),
  }).catch(() => {});
}

module.exports = { planningTelegram, PLANNING_TG_TOKEN, PLANNING_TG_CHAT, config };
