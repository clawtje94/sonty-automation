// AI-Klantenservice — centrale configuratie
// MODE bepaalt wat de daemon mag:
//   'shadow' — AI schrijft concept-antwoorden als INTERNE NOTITIE in Trengo + log. Klant ziet NIETS.
//   'live'   — AI verstuurt zelf antwoorden. Mag ALLEEN door Daimy expliciet aangezet worden
//              door het bestand scripts/ai-ks/.live-enabled aan te maken met de tekst 'JA ECHT'.
const fs = require('fs');
const path = require('path');

function resolveMode() {
  try {
    if (fs.readFileSync(path.join(__dirname, '.live-enabled'), 'utf8').trim() === 'JA ECHT') return 'live';
  } catch {}
  return 'shadow';
}

// Huidige tijd in Europe/Amsterdam (Mac kan in andere tz staan)
function amsterdamNu() {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }); // "2026-07-16 14:23:45"
  return { datum: s.slice(0, 10), dag: new Date(s.slice(0, 10) + 'T12:00:00').getDay(), hhmm: s.slice(11, 16) };
}

module.exports = {
  get MODE() { return resolveMode(); },
  MODEL: 'claude-opus-4-8',
  MAX_TOKENS: 4096,

  // Openingstijden showroom/team (bron: sonty.nl/showroom). zo=0 ... za=6; null = hele dag dicht.
  OPENINGSTIJDEN: { 0: null, 1: null, 2: ['09:30', '17:00'], 3: ['09:30', '17:00'], 4: ['09:30', '17:00'], 5: ['09:30', '17:00'], 6: ['09:30', '16:00'] },

  // SONNY — de AI-medewerker die zich eerlijk als AI voorstelt en buiten openingstijden
  // ALLE WhatsApp-klanten live helpt, met volledige tools (opdracht Daimy 2026-07-16:
  // "volledig helpen, ook offertes aanpassen, dat gaan we juist checken").
  // Aanzetten kan ALLEEN Daimy: bestand scripts/ai-ks/.sonny-enabled met inhoud 'JA ECHT'.
  SONNY: {
    get enabled() {
      try { return fs.readFileSync(path.join(__dirname, '.sonny-enabled'), 'utf8').trim() === 'JA ECHT'; } catch { return false; }
    },
    MAX_GESPREKKEN_PER_DAG: 10, // nieuwe gesprekken per kalenderdag (testfase); lopende gesprekken tellen niet opnieuw
    STATE_FILE: path.join(__dirname, '..', '..', 'data', 'ai-ks', 'sonny-state.json'),
    // Rustig, menselijk reactietempo (±1-3 min) zodat snelle vervolgberichten gebundeld worden
    DELAY: { baseSec: 60, perCharSec: 1 / 15, minSec: 45, maxSec: 180 },
    INTRO: 'Hoi, Sonny hier, de digitale medewerker van Sonty. Buiten openingstijden help ik je alvast op weg. Kom ik er niet uit, dan pakt een collega het morgen voor je op.',
  },

  amsterdamNu,
  isBuitenOpeningstijden(nu = amsterdamNu()) {
    const venster = module.exports.OPENINGSTIJDEN[nu.dag];
    if (!venster) return true;
    return nu.hhmm < venster[0] || nu.hhmm >= venster[1];
  },

  // LIVE-TEST WHITELIST: uitsluitend deze nummers krijgen een écht antwoord,
  // ook in schaduwmodus. Genormaliseerd formaat: 31xxxxxxxxx (geen +, geen 06).
  // Toegevoegd op verzoek van Daimy (2026-07-03): eigen testnummer + tweede tester.
  TEST_LIVE_PHONES: [
    '31683500506', '31636516410', '31628209480',
    '31625503274', // klant Hany (ticket 966213493) — Sonny-pilot op expliciet verzoek Daimy 2026-07-16
  ],

  // FEEDBACK-KANAAL: alleen deze nummers mogen "feedback: ..." leerpunten appen
  // (Daimy 2026-07-16: "mag alleen van Joey en mijn nummer" — Jarne dus niet).
  FEEDBACK_PHONES: ['31683500506', '31628209480'],

  // Menselijke antwoord-vertraging (instructie Daimy: "straks iets meer tijd nemen").
  // Uit tijdens de test; bij livegang aanzetten. Vertraging schaalt met de lengte
  // van het antwoord: basis + ~1s per 15 tekens, begrensd tussen min en max.
  REPLY_DELAY: { enabled: false, baseSec: 25, perCharSec: 1 / 15, minSec: 20, maxSec: 180 },

  // Kanalen die de AI behandelt (Trengo channel_ids)
  WA_CHANNEL_ID: 1359857,          // WhatsApp Business +31 85 006 9681
  EMAIL_CHANNEL_NAMES: ['Aanvragen', 'Klantenservice'],

  // Poll-instellingen
  POLL_STATE_FILE: path.join(__dirname, '..', '..', 'data', 'ai-ks', 'poll-state.json'),
  LOG_FILE: path.join(__dirname, '..', '..', 'data', 'ai-ks', 'log.jsonl'),

  // Telegram (alleen voor escalaties + dagelijkse samenvatting)
  TG_TOKEN: '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40',
  TG_CHAT: 1700128390,

  // Reuzenpanda
  RP_API_KEY: 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado',
  RP_PID: '731483fa-ef6b-4aae-afcf-883ec09219dd',
  RP_BOARD: 'edb9b0b7-b70e-4064-95b5-ec0d03357c0a',
  RP_BACKLOG: 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7',
  RP_STATUS_INMETEN_INPLANNEN: '2e9819bd-26f0-4082-8f18-32bb48f87f54', // klant akkoord → planning belt binnen 3 werkdagen
  RP_STATUS_AI_OFFERTE_VERSTUURD: 'dc0efe4f-2cd6-45d8-aeff-7f1c817a0fb2', // AI heeft offerte gemaakt/aangepast en link geappt

  BOOKINGS_URL: 'https://bookings.cloud.microsoft/book/SontyMontage1@sontymontage.nl/s/lAKws2wHtEOFjHYzLwjXdQ2?ismsaljsauthenabled=true',
};
