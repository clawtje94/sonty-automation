// INTERNE NOTITIE IN TRENGO (Daimy 10-08: "@tanya is weer getagd terwijl ze op vakantie is").
//
// Er bestond al één plek die bijhoudt wie er is — scripts/ai-ks/team-tags.js met
// data/ai-ks/afwezig.json — maar die werd alleen door de klantenservice-bot gebruikt.
// Zet je een notitie vanuit een ander script of met de hand, dan typte je de tags zelf,
// en dan tag je iemand die op vakantie is. Precies wat er gebeurde.
//
// Daarom loopt élke interne notitie nu hierlangs. Wil je het team erbij, dan zet je
// {tag: true} en kiest deze module wie er vandaag écht is.
const fs = require('fs');
const path = require('path');
const { teamTags } = require('../ai-ks/team-tags.js');

const TOKEN = fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim();

/**
 * @param {number|string} ticketId
 * @param {string} tekst
 * @param {{tag?: boolean}} opties  tag: true zet de beschikbare collega's ervoor
 */
async function notitie(ticketId, tekst, { tag = false } = {}) {
  const body = tag ? `${teamTags()} ${tekst}` : tekst;
  const r = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: body, internal_note: true }),
  });
  if (!r.ok) throw new Error(`notitie mislukt (${r.status}) op ticket ${ticketId}`);
  return r.json();
}

module.exports = { notitie };
