// Showroomafspraken voor de AI-klantenservice via MS Bookings (kalender SontyMontage1).
// Regels: showroom is ALLEEN op afspraak en alleen op WOENSDAG/VRIJDAG/ZATERDAG (Daimy 17 juli).
// Slots: 45 min op uur-interval binnen de service-uren, minimaal 8 uur vooruit
// (schedulingPolicy van de Bookings-service: timeSlotInterval PT1H, minimumLeadTime PT8H).
// Beschikbaarheid = service-uren minus bestaande showroomafspraken (capaciteit 1 tegelijk;
// getStaffAvailability accepteert geen delegated token, dus we rekenen zelf).
const b = require('../bookings-api.js');

const BIZ = 'SontyMontage1@sontymontage.nl';
const SERVICE_ID = 'b3b00294-076c-43b4-858c-76332f08d775'; // "Afspraak showroom Frijdastraat 8F, Rijswijk"
const DUUR_MIN = 45;
const ADRES = 'Frijdastraat 8F, 2288 EX Rijswijk';
const DAGEN = [3, 5, 6]; // wo / vr / za
const DAGNAAM = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
// Laatste starttijd zo dat de afspraak binnen de service-uren past (di-vr tot 17:00, za tot 16:00)
const UREN = { 3: ['09:30', '16:15'], 5: ['09:30', '16:15'], 6: ['09:30', '15:15'] };
const MIN_VOORUIT_MS = 8 * 3600 * 1000;
// Showroom-medewerkers van de service, in toewijs-voorkeursvolgorde (eerste vrije wordt
// toegewezen; volgorde aanpasbaar na feedback Daimy): Nanny (binnenhuis), Jaimy, Joey.
const MEDEWERKERS = [
  { id: '2af56e85-3e58-41c3-b050-3c8ede266498', naam: 'Nanny' },
  { id: 'bf3e490b-8add-4ef8-a590-dd837b11e378', naam: 'Jaimy' },
  { id: '445fbea9-68c9-46f4-b72a-efa451762ac3', naam: 'Joey' },
];

// Eerste medewerker die in de Bookings-agenda geen overlappende afspraak heeft.
function kiesMedewerker(afsprakenDag, startMs, eindMs) {
  const bezig = new Set();
  for (const a of afsprakenDag) {
    const s = parseUtc(a.start), e = parseUtc(a.eind);
    if (!isNaN(s) && !isNaN(e) && s < eindMs && startMs < e) (a.staffIds || []).forEach(id => bezig.add(id));
  }
  return MEDEWERKERS.find(m => !bezig.has(m.id)) || null;
}

// ── Amsterdamse tijd ↔ UTC ──
function nlDelen(dt) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(dt).map(x => [x.type, x.value]));
  const weekdag = { zo: 0, ma: 1, di: 2, wo: 3, do: 4, vr: 5, za: 6 }[p.weekday.slice(0, 2)];
  return { datum: `${p.year}-${p.month}-${p.day}`, tijd: `${p.hour}:${p.minute}`, weekdag };
}

function offsetMin(dt) {
  const p = nlDelen(dt);
  const alsUtc = Date.parse(`${p.datum}T${p.tijd}:00Z`);
  return Math.round((alsUtc - dt.getTime()) / 60000);
}

function amsterdamNaarUtc(datum, tijd) {
  const gok = new Date(`${datum}T${tijd}:00Z`);
  return new Date(gok.getTime() - offsetMin(gok) * 60000);
}

const parseMin = (t) => { const [u, m] = t.split(':').map(Number); return u * 60 + m; };
const fmtMin = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
const parseUtc = (s) => Date.parse(String(s).replace(/\.\d+Z?$/, 'Z').replace(/([^Z])$/, '$1Z'));

// ── Vrije slots komende `dagenVooruit` dagen ──
async function vrijeSlots({ dagenVooruit = 14 } = {}) {
  const nu = Date.now();
  const alles = await b.afspraken(BIZ, {
    start: new Date(nu).toISOString(),
    end: new Date(nu + (dagenVooruit + 1) * 86400000).toISOString(),
  });
  const bezet = alles.filter(a => a.serviceId === SERVICE_ID)
    .map(a => [parseUtc(a.start), parseUtc(a.eind)])
    .filter(([s, e]) => !isNaN(s) && !isNaN(e));
  const slots = [];
  for (let d = 0; d <= dagenVooruit; d++) {
    const dag = nlDelen(new Date(nu + d * 86400000));
    if (!DAGEN.includes(dag.weekdag)) continue;
    const [eerste, laatste] = UREN[dag.weekdag];
    for (let t = parseMin(eerste); t <= parseMin(laatste); t += 60) {
      const start = amsterdamNaarUtc(dag.datum, fmtMin(t));
      if (start.getTime() - nu < MIN_VOORUIT_MS) continue;
      const eind = start.getTime() + DUUR_MIN * 60000;
      if (bezet.some(([s, e]) => s < eind && start.getTime() < e)) continue;
      slots.push({ start: start.toISOString(), omschrijving: `${DAGNAAM[dag.weekdag]} ${dag.datum} om ${fmtMin(t)}` });
    }
  }
  return slots;
}

// ── Boeken (alleen op een vrij slot) ──
async function boekShowroom({ start, klantNaam, klantMail, klantTel, notitie }) {
  if (!start || !klantNaam || !klantMail) return { error: 'start, klantNaam en klantMail zijn verplicht' };
  const slots = await vrijeSlots({ dagenVooruit: 60 });
  const slot = slots.find(s => parseUtc(s.start) === parseUtc(start));
  if (!slot) return { error: 'Dit tijdstip is geen vrij slot (bezet, buiten wo/vr/za-uren of korter dan 8 uur vooruit). Vraag showroom_beschikbaarheid opnieuw op en kies een slot daaruit.' };
  const startMs = parseUtc(slot.start), eindMs = startMs + DUUR_MIN * 60000;
  const dagAfspraken = await b.afspraken(BIZ, {
    start: new Date(startMs - 12 * 3600000).toISOString(), end: new Date(eindMs + 12 * 3600000).toISOString(),
  });
  const medewerker = kiesMedewerker(dagAfspraken, startMs, eindMs);
  const res = await b.boek(BIZ, {
    ...(medewerker ? { staffIds: [medewerker.id] } : {}),
    serviceId: SERVICE_ID, start: slot.start, minuten: DUUR_MIN,
    klantNaam, klantMail, klantTel, notitie, tijdzone: 'UTC',
    // Verplichte custom vraag van de showroom-service (zichtbaar bij de afspraak in de UI)
    vragen: klantTel ? [{
      questionId: '14affa07-0ce8-4ec3-a573-3646acb0dc5d', question: 'Telefoonnummer',
      answer: klantTel, answerInputType: 'text', isRequired: true,
    }] : undefined,
  });
  return { geboekt: slot.omschrijving, afspraakId: res.id, adres: ADRES, medewerker: medewerker ? medewerker.naam : 'nog niet toegewezen (team wijst toe)' };
}

module.exports = { vrijeSlots, boekShowroom, ADRES, BIZ, SERVICE_ID };

// ── CLI: node scripts/ai-ks/showroom-booking.js [dagen] ──
if (require.main === module) {
  vrijeSlots({ dagenVooruit: Number(process.argv[2]) || 14 })
    .then(s => { console.log(`${s.length} vrije slots:`); s.forEach(x => console.log('-', x.omschrijving, '|', x.start)); })
    .catch(e => { console.error('FOUT:', e.message); process.exit(1); });
}
