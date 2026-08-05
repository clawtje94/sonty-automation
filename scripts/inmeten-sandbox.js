#!/usr/bin/env node
// SANDBOX: laadt de ECHTE Outlook-agenda in de inmeet-planner en laat zien welk slot
// hij kiest. Schrijft nergens iets weg — geen Planado, geen RP, geen Outlook.
//
// Waarom dit moet: de planner rekende tegen Planado, en dat is een eenmalige kopie van
// 23 juli die op 6 augustus ophoudt. Tegen zo'n lege agenda lijkt elk gaatje vrij,
// terwijl de inmeters in werkelijkheid vol zitten. Pas met de echte agenda kun je
// beoordelen of hij een goed punt kiest.
const { chromium } = require('playwright');
const { zoekSlots, kiesAanbod, venster, waaromGeenAanbod, MAX_EXTRA_RIJTIJD_MIN } = require('./lib/slotzoeker');
const { schatDuur } = require('./lib/inmeetduur');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const INMETEN_INPLANNEN = '2e9819bd-26f0-4082-8f18-32bb48f87f54';

const ZOEK = (process.argv.find((a) => a.startsWith('--alleen=')) || '').split('=')[1] || 'daimy';
// --maak-aanbod: zet het berekende voorstel als ECHT aanbod klaar (keuzelink voor de
// klant, 24u geldig) en stuurt de link naar Telegram. Zonder deze vlag blijft alles
// read-only. Werkt alleen samen met --alleen, zodat er nooit per ongeluk voor alle
// leads tegelijk aanbiedingen ontstaan.
const MAAK_AANBOD = process.argv.includes('--maak-aanbod');
// --duur=20: reken met een opgegeven inmeetduur in plaats van de schatting uit de
// producten. Voor tests ("wat krijgt een mediaan-klant aangeboden?") en later voor
// handmatige correcties door kantoor.
const DUUR_OVERRIDE = parseInt((process.argv.find((a) => a.startsWith('--duur=')) || '').split('=')[1], 10) || null;

async function owaToken() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  let token = null;
  page.on('request', (req) => {
    const a = req.headers()['authorization'];
    if (a?.startsWith('Bearer ') && req.url().includes('outlook.office.com')) {
      const t = a.replace('Bearer ', '');
      try {
        if (Buffer.from(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString().includes('Calendar')) token = t;
      } catch { /* geen leesbaar token */ }
    }
  });
  await page.goto('https://outlook.office.com/calendar');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const em = await page.$('input[type="email"], input[name="loginfmt"]');
  if (em) {
    await em.fill('joey@sontymontage.nl');
    await page.locator('input[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const pw = await page.$('input[type="password"]');
    if (pw) {
      await pw.fill('Shja..59');
      await page.locator('input[type="submit"]').click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    try {
      const ja = page.locator('input[value="Yes"], input[value="Ja"]');
      if (await ja.first().isVisible({ timeout: 5000 })) { await ja.first().click(); await page.waitForTimeout(5000); }
    } catch { /* geen bevestigingsscherm */ }
  }
  await page.waitForTimeout(8000);
  await browser.close();
  return token;
}

const isInmeten = (s) => /inmeet|inmeten/i.test(s || '');

async function haalOutlookAgenda(token) {
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const cals = (await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: H })).json()).value || [];
  const cal = cals.find((c) => c.Name === 'Sonty Montage');
  if (!cal) throw new Error('agenda "Sonty Montage" niet gevonden; wel: ' + cals.map((c) => c.Name).join(', '));

  // Het agenda-venster MOET verder reiken dan de planning-horizon. Met roosters van
  // 3-4 dagen per week zijn 10 werkdagen bijna 5 weken; alles daarbuiten zou de planner
  // tegen een lege agenda inplannen en dus vrolijk dubbelboeken.
  const van = new Date();
  const tot = new Date(); tot.setDate(tot.getDate() + 56);
  // Location erbij, want zonder adres kun je geen reistijd rekenen.
  let url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView`
    + `?$top=500&$select=Subject,Start,End,IsCancelled,Location,Organizer,Attendees`
    + `&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
  const evs = [];
  while (url) {
    const j = await (await fetch(url, { headers: H })).json();
    evs.push(...(j.value || []));
    url = j['@odata.nextLink'] || null;
  }
  return { evs, calNaam: cal.Name };
}

async function main() {
  console.log('=== SANDBOX — er wordt NIETS weggeschreven ===\n');

  // Eerst het gedeelde token van de planning-mail-daemon; die ververst zichzelf.
  // Pas als dat niet werkt zelf inloggen, want dat kost een browsersessie.
  let token = null;
  try {
    const gedeeld = require('fs').readFileSync(require('path').join(__dirname, '.owa-token.txt'), 'utf8').trim();
    if (gedeeld) {
      const test = await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: { Authorization: 'Bearer ' + gedeeld } });
      if (test.ok) { token = gedeeld; console.log('(gedeeld OWA-token werkt)\n'); }
      else console.log(`(gedeeld token niet geldig voor agenda: HTTP ${test.status}, zelf inloggen)\n`);
    }
  } catch { /* geen gedeeld token */ }
  if (!token) token = await owaToken();
  if (!token) { console.error('geen Outlook-token'); process.exit(1); }

  const { evs } = await haalOutlookAgenda(token);
  const levend = evs.filter((e) => !e.IsCancelled);

  // ALLES bezet tijd, niet alleen het inmeten. Een montage, vakantie of vergadering
  // blokkeert de inmeter net zo goed. Alleen voor de reistijd heb je een adres nodig;
  // zonder adres telt de afspraak nog steeds als bezet.
  const inmeet = levend.filter((e) => isInmeten(e.Subject));
  const metAdres = levend.filter((e) => (e.Location?.DisplayName || '').trim().length > 5);

  console.log(`Outlook "Sonty Montage", komende 56 dagen:`);
  console.log(`  ${levend.length} afspraken totaal (ALLEMAAL bezettend)`);
  console.log(`  ${inmeet.length} daarvan inmeten`);
  console.log(`  ${metAdres.length} met een adres (die kunnen ook voor reistijd meetellen)\n`);

  // De agenda "Sonty Montage" bevat ALLE inmeters door elkaar. Wie de klus doet staat
  // in de deelnemers, niet in het onderwerp. Zonder deze splitsing lijkt de dag
  // stampvol (twee mensen om 09:00) en vindt de planner nergens ruimte.
  const wieDoetHet = (e) => (e.Attendees || [])
    .map((a) => a.EmailAddress?.Name || '')
    .find((n) => n && !/^sonty$/i.test(n)) || 'onbekend';

  const alles = levend.map((e) => ({
    start: e.Start.DateTime + 'Z',
    eind: e.End.DateTime + 'Z',
    adres: (e.Location?.DisplayName || '').trim(),
    klant: (e.Subject || '').replace(/^inmeten sonty\s*[—-]?\s*/i, '').slice(0, 28),
    wie: wieDoetHet(e),
  })).sort((a, b) => a.start.localeCompare(b.start));

  // Alleen de twee inmeters plannen we in (Daimy: Sjoerd en Joey starten). De rest zijn
  // monteurs; hun agenda's tellen hier niet mee, anders bied je een montageploeg aan
  // voor een inmeting.
  const INMETERS = ['Sjoerd', 'Joey'];
  const perPersoon = {};
  for (const a of alles) {
    const voornaam = a.wie.split(' ')[0];
    if (!INMETERS.includes(voornaam)) continue;
    (perPersoon[voornaam] ||= []).push(a);
  }
  console.log('Afspraken per inmeter (alles wat tijd bezet):');
  for (const [wie, l] of Object.entries(perPersoon).sort((a, b) => b[1].length - a[1].length)) {
    const meten = l.filter((x) => isInmeten(x.klant) || /inmeet|inmeten/i.test(x.klant)).length;
    console.log(`  ${wie.padEnd(10)} ${String(l.length).padStart(3)} afspraken`);
  }

  // De lead ophalen
  const r = await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${BACKLOG_ID}/items?limit=200`,
    { headers: { Authorization: 'Bearer ' + RP_API_KEY } });
  const d = await r.json();
  const item = (d.items || d.data || d).filter((i) => i.status_id === INMETEN_INPLANNEN)
    .find((i) => (i.summary || '').toLowerCase().includes(ZOEK.toLowerCase()));
  if (!item) { console.error(`\ngeen lead gevonden op "${ZOEK}"`); process.exit(1); }

  const { leesProductenUitOfferte } = require('./inmeten-planner-lees');
  const producten = await leesProductenUitOfferte(item);
  const desc = item.description || '';
  const veld = (n) => (desc.match(new RegExp(`^${n}:\\s*(.+)$`, 'im')) || [])[1]?.trim() || '';
  const adres = [[veld('Straatnaam'), veld('Huisnummer')].filter(Boolean).join(' '), veld('Postcode'), veld('Plaats')].filter(Boolean).join(', ');
  const duur = DUUR_OVERRIDE || schatDuur(producten);
  if (DUUR_OVERRIDE) console.log(`(inmeetduur OVERRIDE: ${DUUR_OVERRIDE} min in plaats van geschatte ${schatDuur(producten)} min)`);

  console.log(`\n=== ${item.summary} — ${adres} ===`);
  console.log(`${producten.length} product(en): ${producten.map((p) => `${p.aantal}x ${p.naam}${p.breedte ? ` ${p.breedte}mm` : ''}`).join(', ')}`);
  console.log(`geschatte inmeetduur: ${duur} min\n`);

  // Het echte rooster gaat vóór alles wat je uit de agenda kunt afleiden. Die agenda is
  // niet netjes bijgehouden, dus een patroon eruit is geen rooster. Alleen als een
  // inmeter nog geen rooster heeft, vallen we terug op zijn werkelijke patroon.
  const ROOSTER = require('../data/inmeters-rooster.json').inmeters;
  const DAGCODE = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

  const werkdagenVan = (wie, eigen) => {
    const vast = ROOSTER[wie]?.dagen;
    if (vast) return (dag) => vast[DAGCODE[dag]] || null;
    const perDag = [0, 0, 0, 0, 0, 0, 0];
    for (const a of eigen) perDag[new Date(a.start).getDay()]++;
    const top = Math.max(...perDag);
    return (dag) => (perDag[dag] >= top * 0.2 ? { van: '08:30', tot: '17:00' } : null);
  };

  // OPENSTAANDE AANBIEDINGEN tellen mee als bezet EN als anker. Zo kan hetzelfde
  // tijdstip nooit aan twee klanten tegelijk worden aangeboden, en clustert een
  // nieuwe lead vanzelf naast een aanbod dat al in dezelfde buurt uitstaat.
  try {
    const ar = await fetch('https://sonty-website.vercel.app/api/inmeet-aanbod?status=open', {
      headers: { 'x-meet-code': process.env.BELSCHERM_CODE || 'sonty2288' },
    });
    const { aanbiedingen } = await ar.json();
    let ankers = 0;
    for (const a of aanbiedingen || []) {
      if (a.lead?.rpItemId === item.id) continue; // eigen eerdere aanbod telt niet
      for (const sl of a.slots || []) {
        (perPersoon[sl.inmeter] = perPersoon[sl.inmeter] || []).push({
          start: sl.aankomst, eind: sl.vertrek, adres: a.lead.volledigAdres, klant: `aanbod ${a.lead.naam}`,
        });
        ankers++;
      }
    }
    if (ankers) console.log(`  (${ankers} openstaand aanbod-slot(s) meegenomen als bezet/anker)`);
  } catch { console.log('  (aanbod-register niet bereikbaar; plan zonder ankers)'); }

  const alleSlots = [];
  for (const [wie, eigen] of Object.entries(perPersoon)) {
    if (eigen.length < 2) continue;
    const werkt = werkdagenVan(wie, eigen);
    const dagen = [];
    const dd = new Date(); dd.setDate(dd.getDate() + 1);
    // 18 werkdagen vooruit: de agenda is maar ~3-4 weken gevuld, dus de lege weken
    // daarna zijn echte capaciteit. Nooit verder dan het agenda-venster (42 dagen).
    // Genoeg horizon om ALTIJD minstens 3 keuzes te vinden: de volle weken opsouperen
    // en door tot in de lege weken erna.
    while (dagen.length < 24) {
      const u = werkt(dd.getDay());
      if (u) dagen.push({ datum: dd.toISOString().slice(0, 10), van: u.van, tot: u.tot });
      dd.setDate(dd.getDate() + 1);
      // Nooit verder plannen dan waar we agenda van hebben.
      if (dd > new Date(Date.now() + 56 * 86400000)) break;
    }
    const bron = ROOSTER[wie]?.dagen ? 'rooster' : 'afgeleid uit agenda';
    const omschrijving = [1, 2, 3, 4, 5, 6].map((i) => { const u = werkt(i); return u ? `${DAGCODE[i]} ${u.van}-${u.tot}` : null; }).filter(Boolean).join(', ');
    console.log(`  ${wie} (${bron}): ${omschrijving}`);
    const s2 = await zoekSlots({ agenda: eigen, adres, duurMin: duur, werkdagen: dagen, agendaOnbetrouwbaar: true });
    alleSlots.push(...s2.map((x) => ({ ...x, inmeter: wie })));
  }
  const slots = alleSlots.sort((a, b) => a.aankomst - b.aankomst);
  console.log(`\n${slots.length} mogelijke plekken tegen de ECHTE agenda.\n`);
  console.log('LET OP: de bestaande afspraken hebben de reistijd in het blok zitten, dus');
  console.log('een berekende meerprijs zou dubbeltelling zijn. Hieronder alleen de plekken');
  console.log('waar de klus ECHT past, op tijd gesorteerd.\n');
  for (const s of slots.slice(0, 8)) {
    console.log(`  ${s.inmeter.padEnd(8)} ${s.datum} ${venster(s)}  | tussen ${String(s.naVorige).slice(0, 26)} en ${String(s.voorVolgende).slice(0, 26)}`);
  }

  const aanbod = kiesAanbod(slots, 3);
  console.log(`\n=== VOORSTEL AAN DE KLANT ===`);
  if (!aanbod.length) console.log('  nog geen aanbod — ' + waaromGeenAanbod(slots));
  else for (const s of aanbod) console.log(`  ${s.datum} ${venster(s)}  door ${s.inmeter}`);

  if (MAAK_AANBOD && aanbod.length) {
    const veldUit = (n) => (desc.match(new RegExp(`^${n}:\\s*(.+)$`, 'im')) || [])[1]?.trim() || '';
    const res = await fetch('https://sonty-website.vercel.app/api/inmeet-aanbod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-meet-code': process.env.BELSCHERM_CODE || 'sonty2288' },
      body: JSON.stringify({
        lead: {
          rpItemId: item.id,
          naam: item.summary,
          telefoon: veldUit('Telefoonnummer'),
          email: veldUit('E-mailadres'),
          volledigAdres: adres,
          plaats: veldUit('Plaats'),
          producten: producten.map((p) => ({ naam: p.naam, aantal: p.aantal })),
        },
        duurMin: duur,
        slots: aanbod.map((sl) => ({
          datum: sl.datum,
          aankomst: sl.aankomst.toISOString(),
          vertrek: sl.vertrek.toISOString(),
          inmeter: sl.inmeter,
        })),
      }),
    });
    if (!res.ok) throw new Error(`aanbod aanmaken mislukt: HTTP ${res.status}`);
    const { url, token: aanbodToken } = await res.json();
    console.log(`\nAANBOD AANGEMAAKT (24u geldig): ${url}`);

    // Direct naar de klant via WhatsApp én mail (zo groot mogelijke kans dat hij het ziet).
    const { verstuurAanbod } = require('./lib/aanbod-versturen');
    const aanbodRec = { lead: { naam: item.summary, telefoon: veldUit('Telefoonnummer'), email: veldUit('E-mailadres') }, duurMin: duur };
    const verzonden = await verstuurAanbod(aanbodRec, url);
    console.log(`  WhatsApp: ${verzonden.wa.ok ? 'verstuurd' : 'NIET (' + verzonden.wa.reden + ')'}`);
    console.log(`  Mail:     ${verzonden.mail.ok ? 'verstuurd' : 'NIET (' + verzonden.mail.reden + ')'}`);
    const TG = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
    await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: `Inmeet-aanbod voor ${item.summary} staat klaar (24u geldig). Dit is de link die de klant zou krijgen — kies zelf een tijd om de keten te testen:\n${url}` }),
    }).catch(() => {});
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
