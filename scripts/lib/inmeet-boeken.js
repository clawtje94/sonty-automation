// DE ENE MANIER OM EEN INMEETAFSPRAAK IN DE AGENDA TE ZETTEN (Daimy 13-08: "zorg dat
// dit allemaal gewoon goed gaat en blijft gaan").
//
// Geschiedenis van vandaag: de planner maakte kale agenda-afspraken. Gevolg: geen
// bevestigingsmail naar de klant (die loopt via Bookings), geen medewerker-koppeling
// (alles onder "geen medewerker" als Bezet-blok), geen adres in het locatieveld.
// 43 afspraken zijn met de hand gemigreerd. Vanaf nu boekt ALLES hierlangs:
//
//   1. Echte Bookings-afspraak: dienst "Inmeten Sonty", medewerker gekoppeld,
//      klant + mailadres + telefoon + adres erin. Bookings stuurt de klant zelf de
//      bevestigingsmail en de agenda-afspraak verschijnt in het vertrouwde formaat.
//   2. Lukt Bookings niet (auth stuk, API-storing), dan de oude kale afspraak als
//      vangnet MET een alarm — een afspraak zonder bevestiging is een bekende fout.
const b = require('../bookings-api.js');
const fs = require('fs');
const path = require('path');

const BIZ = 'SontyMontage1@sontymontage.nl';

// Vangnet (Astrid Verkaaik 26-08): de lead kwam zonder mailadres binnen terwijl het
// aanbod-systeem haar mail allang kende (er was zelfs al een mailticket). Bij een
// ontbrekend mailadres eerst in de planner-state kijken vóór we terugvallen op een
// kale afspraak zonder bevestiging.
function emailUitState(naam, telefoon) {
  try {
    const st = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'inmeten-planner-state.json'), 'utf8'));
    const tel = String(telefoon || '').replace(/\D/g, '').slice(-9);
    for (const t of Object.values(st.aanbodTickets || {})) {
      const tTel = String(t.telefoon || '').replace(/\D/g, '').slice(-9);
      const match = (tel && tTel && tTel === tel) || (naam && t.naam && t.naam.toLowerCase() === String(naam).toLowerCase());
      if (match && t.email && /@/.test(t.email)) return t.email;
    }
  } catch { /* geen state = geen fallback */ }
  return null;
}
const DIENST_INMETEN = 'fd1a8a20-57f6-42f1-8d4d-c18bc3c5ddce';
const STAFF = {
  Joey: '445fbea9-68c9-46f4-b72a-efa451762ac3',
  Sjoerd: '60ebce1b-d133-4731-830f-5e5906c02c63',
};

/**
 * @returns {Promise<{via: 'bookings'|'kale-afspraak', id: string}>}
 */
async function boekInmeetAfspraak({ slot, naam, telefoon, adres, duurMin, email }) {
  if (!email || !/@/.test(email)) {
    const gevonden = emailUitState(naam, telefoon);
    if (gevonden) { console.log(`  mailadres uit planner-state gehaald voor ${naam}`); email = gevonden; }
  }
  const staffId = STAFF[slot.inmeter];
  if (staffId && email && /@/.test(email)) {
    try {
      // Thuisblijf-venster in de notitie (Daimy 18-08): dan staat het ook in de
      // bevestigingsmail die Bookings zelf stuurt — klant weet dat hij er van een
      // uur vóór tot een uur ná het blok moet zijn.
      const dAan = new Date(slot.aankomst);
      const fmt = (ms) => new Date(ms).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
      const venster = `We rijden die dag een route, dus fijn als u tussen ${fmt(+dAan - 60 * 60000)} en ${fmt(+dAan + (duurMin + 60) * 60000)} thuis bent.`;
      const r = await b.boek(BIZ, {
        serviceId: DIENST_INMETEN,
        start: new Date(slot.aankomst).toISOString(),
        minuten: duurMin, tijdzone: 'UTC',
        klantNaam: naam, klantMail: email, klantTel: telefoon || '',
        notitie: `Adres: ${adres || '-'}. ${venster}`,
        locatie: adres || undefined,
        staffIds: [staffId],
      });
      return { via: 'bookings', id: r.id };
    } catch (e) {
      console.log(`  Bookings-boeking mislukt (${e.message.slice(0, 60)}) — kale afspraak als vangnet`);
    }
  } else if (!email || !/@/.test(email)) {
    console.log('  geen mailadres bekend — kale afspraak als vangnet (klant krijgt GEEN bevestigingsmail)');
  }
  const { maakDefinitief } = require('./outlook-opties.js');
  const id = await maakDefinitief({ slot, naam, telefoon, adres, duurMin, email });
  try {
    const { planningTelegram } = require('./telegram-planning.js');
    await planningTelegram(`⚠️ Inmeetafspraak voor ${naam} kon NIET via Bookings (${!STAFF[slot.inmeter] ? 'onbekende inmeter ' + slot.inmeter : !email ? 'geen mailadres' : 'API-storing'}). Kale agenda-afspraak gezet als vangnet — klant heeft GEEN automatische bevestiging gehad, actie nodig.`);
  } catch { /* melding is extra */ }
  return { via: 'kale-afspraak', id };
}

module.exports = { boekInmeetAfspraak, STAFF, DIENST_INMETEN, BIZ };
