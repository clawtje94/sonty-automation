// Microsoft Bookings via de ECHTE Graph-API (geen browser meer nodig).
// Eigen Azure-app "Sonty AI Bookings" (17 juli 2026 geregistreerd, delegated Bookings-scopes,
// self-consent door joey — Bookings-permissies vereisen geen admin). Auth = ROPC met joey's
// wachtwoord, met refresh-token als snelpad. Zowel LEZEN als BOEKEN mogelijk.
//
// Gebruik als module:  const b = require('./bookings-api.js');
//   await b.businesses()                          → lijst boekingskalenders
//   await b.afspraken(businessId, {start, end})   → afspraken (default: komende 90 dagen)
//   await b.services(businessId)                  → boekbare diensten (id's + duur)
//   await b.staff(businessId)                     → medewerkers (id's)
//   await b.boek(businessId, {...})               → nieuwe afspraak aanmaken
// CLI:  node scripts/bookings-api.js afspraken [businessId]
const fs = require('fs');
const path = require('path');

const TENANT = '4422b222-2a49-43c9-992c-f1240d8e3bbc';
const CLIENT_ID = 'f98569ca-d983-4838-9e02-0a8af70acb44';
const SCOPE = 'https://graph.microsoft.com/BookingsAppointment.ReadWrite.All https://graph.microsoft.com/Bookings.ReadWrite.All offline_access';
const SHOWROOM = 'AfspraakshowroomSonty@sonty.nl'; // standaard showroom-kalender
const REFRESH_FILE = path.join(__dirname, '.bookings-refresh-token.txt');
const PASS_FILE = path.join(__dirname, '.outlook-joey-pass.txt');

let _token = null, _exp = 0;

async function tokenAanvragen(body) {
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE, ...body }),
  });
  return r.json();
}

async function getToken() {
  if (_token && Date.now() < _exp - 60000) return _token;
  let d = null;
  // 1. Snelpad: refresh-token
  try {
    const rt = fs.readFileSync(REFRESH_FILE, 'utf8').trim();
    d = await tokenAanvragen({ grant_type: 'refresh_token', refresh_token: rt });
  } catch { /* geen/ongeldig refresh-token → val terug op wachtwoord */ }
  // 2. Terugval: wachtwoord (ROPC)
  if (!d || !d.access_token) {
    d = await tokenAanvragen({
      grant_type: 'password', username: 'joey@sontymontage.nl',
      password: fs.readFileSync(PASS_FILE, 'utf8').trim(),
    });
  }
  if (!d.access_token) throw new Error('Bookings-auth mislukt: ' + (d.error_description || d.error || 'onbekend'));
  if (d.refresh_token) fs.writeFileSync(REFRESH_FILE, d.refresh_token);
  _token = d.access_token;
  _exp = Date.now() + (d.expires_in || 3600) * 1000;
  return _token;
}

async function graph(method, ep, body) {
  const tok = await getToken();
  const r = await fetch('https://graph.microsoft.com/v1.0' + ep, {
    method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j; try { j = t ? JSON.parse(t) : {}; } catch { j = t; }
  if (!r.ok) throw new Error(`${method} ${ep} → ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

const businesses = () => graph('GET', '/solutions/bookingBusinesses').then(d => d.value.map(b => ({ id: b.id, naam: b.displayName })));

const services = (biz = SHOWROOM) =>
  graph('GET', `/solutions/bookingBusinesses/${encodeURIComponent(biz)}/services`)
    .then(d => d.value.map(s => ({ id: s.id, naam: s.displayName, duur: s.defaultDuration })));

const staff = (biz = SHOWROOM) =>
  graph('GET', `/solutions/bookingBusinesses/${encodeURIComponent(biz)}/staffMembers`)
    .then(d => d.value.map(s => ({ id: s.id, naam: s.displayName, mail: s.emailAddress })));

// Afspraken; standaard komende 90 dagen. Graph filtert appointments via calendarView met begin/eind.
async function afspraken(biz = SHOWROOM, { start, end } = {}) {
  const s = start || new Date(Date.now() - 7 * 86400000).toISOString();
  const e = end || new Date(Date.now() + 90 * 86400000).toISOString();
  const d = await graph('GET', `/solutions/bookingBusinesses/${encodeURIComponent(biz)}/calendarView?start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}&$top=200`);
  return d.value.map(a => ({
    id: a.id,
    start: a.startDateTime?.dateTime,
    eind: a.endDateTime?.dateTime,
    dienst: a.serviceName,
    serviceId: a.serviceId,
    staffIds: a.staffMemberIds || [],
    klant: (a.customers?.[0]?.name) || a.customerName || null,
    mail: (a.customers?.[0]?.emailAddress) || a.customerEmailAddress || null,
    tel: (a.customers?.[0]?.phone) || a.customerPhone || null,
    locatie: a.serviceLocation?.displayName || null,
  }));
}

// Klant opzoeken in de klantenlijst van de kalender, of aanmaken als hij er nog niet staat.
// Zonder echte klantkaart maakt Graph een synthetisch customerId aan: de afspraak oogt dan
// "blanco" in de Bookings-UI en de klant is niet terugvindbaar (ontdekt 21 juli, test Daimy).
async function vindOfMaakKlant(biz, { naam, mail, tel }) {
  let ep = `/solutions/bookingBusinesses/${encodeURIComponent(biz)}/customers`;
  for (let p = 0; p < 25 && ep; p++) {
    const d = await graph('GET', ep);
    const hit = (d.value || []).find(c => (c.emailAddress || '').toLowerCase() === mail.toLowerCase());
    if (hit) return hit.id;
    ep = d['@odata.nextLink'] ? d['@odata.nextLink'].replace('https://graph.microsoft.com/v1.0', '') : null;
  }
  const nieuw = await graph('POST', `/solutions/bookingBusinesses/${encodeURIComponent(biz)}/customers`, {
    '@odata.type': '#microsoft.graph.bookingCustomer', displayName: naam, emailAddress: mail,
    ...(tel ? { phones: [{ number: tel, type: 'mobile' }] } : {}),
  });
  return nieuw.id;
}

// Nieuwe afspraak boeken. Verplicht: serviceId, start (ISO), klantNaam, klantMail.
// notitie → serviceNotes (interne notitie die het team bij de afspraak ziet);
// vragen → customQuestionAnswers van de service (bv. de verplichte vraag "Telefoonnummer").
async function boek(biz = SHOWROOM, { serviceId, start, minuten = 30, klantNaam, klantMail, klantTel, notitie, vragen, staffIds, tijdzone = 'W. Europe Standard Time' }) {
  if (!serviceId || !start || !klantNaam || !klantMail) throw new Error('boek(): serviceId, start, klantNaam en klantMail zijn verplicht');
  const customerId = await vindOfMaakKlant(biz, { naam: klantNaam, mail: klantMail, tel: klantTel });
  const eind = new Date(new Date(start).getTime() + minuten * 60000).toISOString();
  return graph('POST', `/solutions/bookingBusinesses/${encodeURIComponent(biz)}/appointments`, {
    serviceId,
    startDateTime: { dateTime: start, timeZone: tijdzone },
    endDateTime: { dateTime: eind, timeZone: tijdzone },
    serviceNotes: notitie || '',
    // Zonder customerTimeZone rendert de bevestigingsmail de tijd in UTC (klant zag 12:30
    // i.p.v. 14:30 — test Daimy 21 juli).
    customerTimeZone: 'Europe/Amsterdam',
    ...(staffIds && staffIds.length ? { staffMemberIds: staffIds } : {}),
    customers: [{
      '@odata.type': '#microsoft.graph.bookingCustomerInformation',
      customerId, name: klantNaam, emailAddress: klantMail, phone: klantTel || '',
      notes: notitie || '',
      ...(vragen ? { customQuestionAnswers: vragen } : {}),
    }],
  });
}

// Afspraak annuleren (stuurt de klant een annuleringsmail via Bookings).
const annuleer = (biz = SHOWROOM, id, bericht = 'Deze afspraak is geannuleerd.') =>
  graph('POST', `/solutions/bookingBusinesses/${encodeURIComponent(biz)}/appointments/${encodeURIComponent(id)}/cancel`, { cancellationMessage: bericht });

module.exports = { businesses, services, staff, afspraken, boek, annuleer, SHOWROOM };

// ── CLI ──
if (require.main === module) {
  (async () => {
    const cmd = process.argv[2] || 'afspraken';
    const biz = process.argv[3] || SHOWROOM;
    if (cmd === 'businesses') console.table(await businesses());
    else if (cmd === 'services') console.table(await services(biz));
    else if (cmd === 'staff') console.table(await staff(biz));
    else if (cmd === 'afspraken') {
      const a = await afspraken(biz);
      console.log(`${a.length} afspraken (komende 90 dagen) in ${biz}:`);
      for (const x of a.sort((p, q) => String(p.start).localeCompare(q.start)))
        console.log('-', (x.start || '?').slice(0, 16).replace('T', ' '), '|', x.klant || '?', '|', x.dienst || '', '|', x.tel || '');
    } else console.log('Onbekend commando. Gebruik: businesses | services | staff | afspraken [businessId]');
  })().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
}
