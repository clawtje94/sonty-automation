// Pure besluitlogica van de escalatie-wachter (los getest in tests/escalatie-watch-regressie.js).
// REGEL Daimy 02-09-2026: "ik hoef pas een herinnering als dingen na 4 dagen niet zijn gedaan, en als ze
// dan nergens zijn geholpen en ook geen interne opmerking hebben, anders NIET."
//  - 4 DAGEN (kalender) na de eerste escalatie, niet 4 werkuren.
//  - "nergens geholpen": op GEEN ENKEL ticket van deze klant (contact) heeft een mens (niet Sunny) sindsdien
//    iets naar de klant gestuurd, en geen van die tickets is gesloten.
//  - "interne opmerking": geen NOTE van een mens (niet Sunny) op één van die tickets sindsdien.
const SUNNY_USER_ID = 747786;
const DAGEN_GRENS = 4;
const HERHAAL_UUR = 24;

function tijd(m) { return Date.parse(String(m.created_at || '').replace(' ', 'T') + (/Z$/.test(String(m.created_at || '')) ? '' : 'Z')); }
function isNote(m) { return !!m.internal_note || String(m.type || '').toUpperCase() === 'NOTE'; }
function vanMens(m) { return !!m.user_id && Number(m.user_id) !== SUNNY_USER_ID; }

/**
 * @param {{ escalatieT:number, tickets:Array<{id:any,status:string,messages:Array}>, nu?:number, laatsteAlarm?:number }} p
 * @returns {{ alarm:boolean, reden:string, dagen:number, geholpen?:string, notitie?:string }}
 */
function beoordeel({ escalatieT, tickets, nu = Date.now(), laatsteAlarm = 0 }) {
  const marge = escalatieT - 60e3;
  const dagen = Math.floor((nu - escalatieT) / 864e5);
  const lijst = Array.isArray(tickets) ? tickets.filter(Boolean) : [];
  // Gesloten telt als 'geholpen' voor het escalatie-ticket zelf altijd; voor een ANDER ticket van de klant alleen
  // als het ná de escalatie is gesloten (een oud, allang dicht ticket is geen hulp).
  const gesloten = lijst.find((t) => String(t.status || '').toUpperCase() === 'CLOSED' && (t.zelf || (t.closed_at && Date.parse(String(t.closed_at).replace(' ', 'T') + (/Z$/.test(String(t.closed_at)) ? '' : 'Z')) > marge)));
  if (gesloten) return { alarm: false, reden: `ticket ${gesloten.id} is gesloten`, dagen, geholpen: String(gesloten.id) };
  for (const t of lijst) {
    for (const m of t.messages || []) {
      if (!(tijd(m) > marge) || !vanMens(m)) continue;
      if (isNote(m)) return { alarm: false, reden: `interne notitie van collega op ticket ${t.id}`, dagen, notitie: String(t.id) };
      if (String(m.type || '').toUpperCase() === 'OUTBOUND') return { alarm: false, reden: `collega antwoordde op ticket ${t.id}`, dagen, geholpen: String(t.id) };
    }
  }
  if (nu - escalatieT < DAGEN_GRENS * 864e5) return { alarm: false, reden: `nog geen ${DAGEN_GRENS} dagen (${dagen})`, dagen };
  if (laatsteAlarm && nu - laatsteAlarm < HERHAAL_UUR * 36e5) return { alarm: false, reden: 'vandaag al gemeld', dagen, open: true };
  return { alarm: true, reden: `${dagen} dagen niets gedaan, nergens geholpen, geen notitie`, dagen, open: true };
}
module.exports = { beoordeel, SUNNY_USER_ID, DAGEN_GRENS, HERHAAL_UUR };
