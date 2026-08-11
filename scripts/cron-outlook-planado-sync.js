#!/usr/bin/env node
// Outlook → Planado-sync voor de inmeters (Daimy 2026-08-05: "planning van Joey en
// Sjoerd in Planado bijwerken met wat nu in Outlook staat en bijhouden, zodat we
// straks over kunnen voor hun").
//
// Wat hij doet, elke run:
// - leest de agenda "Sonty Montage" (nu t/m +100 dagen) voor Joey en Sjoerd
// - maakt voor elke afspraak een Planado-opdracht bij de juiste inmeter
//   (type Inmeting/Montage/afspraak op basis van het onderwerp)
// - dedupliceert dubbel: op eigen sync-id ÉN op zelfde starttijd+inmeter, zodat de
//   79 eerder gesynchroniseerde jobs (external_id bookings-…) niet dubbel komen
// - gewijzigde tijd/adres in Outlook → PATCH in Planado
// - verdwenen uit Outlook → Telegram-melding (bewust GEEN automatisch verwijderen)
//
// Standaard DRY-RUN; pas --execute schrijft echt.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const { planningTelegram } = require('./lib/telegram-planning.js');
const EXECUTE = process.argv.includes('--execute');

const INMETERS = {
  Joey: '1f122cfa-17a2-6580-8257-7e80f004db9c',
  Sjoerd: '1f122d19-e43e-6da0-8ffb-661a4ff9bb36',
};
const TYPES = {
  inmeet: '1f11c802-6340-6680-9d06-7e73cee772e4',
  montage: '1f11c802-634b-6ef0-9d06-7e73cee772e4',
  winkel: '1f11c89f-35be-6820-831b-1d2c28c9b53e',
  default: '1f11c802-6337-6970-9d06-7e73cee772e4',
};
const INMEET_TEMPLATE = '1f11c802-65cd-6aa0-9d06-7e73cee772e4';
const { zoekKlant, productRegels } = require('./planado-gripp-verrijken.js');

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const { kortVeld } = require('./planado-gripp-verrijken.js');
async function telegram(tekst) {
  await planningTelegram(tekst);
}

// ── Outlook (gedeeld OWA-token van de planning-mail-daemon) ──
async function outlookEvents() {
  const token = fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim();
  const H = { Authorization: 'Bearer ' + token };
  const test = await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: H });
  if (!test.ok) throw new Error(`OWA-token ongeldig (${test.status}) — planning-mail-daemon ververst hem elke 30 min`);
  const cal = ((await test.json()).value || []).find((c) => c.Name === 'Sonty Montage');
  if (!cal) throw new Error('agenda "Sonty Montage" niet gevonden');

  const van = new Date();
  const tot = new Date(); tot.setDate(tot.getDate() + 100); // was 42: afspraken >6 weken vooruit (Kampherbeek 21 sep) werden nooit gesynct en waren onzichtbaar voor de planner (08-08)
  let url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView`
    + `?$top=500&$select=Subject,Start,End,IsCancelled,Location,Attendees,Body`
    + `&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
  const evs = [];
  while (url) {
    const j = await (await fetch(url, { headers: H })).json();
    evs.push(...(j.value || []));
    url = j['@odata.nextLink'] || null;
  }
  return evs;
}

// Telefoonnummer uit het Outlook-opmerkingenveld (Body). Nederlandse nummers:
// 06..., +31 6..., 010-..., met spaties/streepjes ertussen.
function telefoonUit(body) {
  const tekst = String(body?.Content || '').replace(/<[^>]+>/g, ' ');
  const m = tekst.match(/(?:\+31|0031|0)[\s-]?[1-9](?:[\s-]?\d){8}/);
  if (!m) return null;
  let cijfers = m[0].replace(/[^\d+]/g, '');
  if (cijfers.startsWith('0031')) cijfers = '+31' + cijfers.slice(4);
  else if (cijfers.startsWith('0')) cijfers = '+31' + cijfers.slice(1);
  return cijfers;
}

function klantNaamUit(subject) {
  return (String(subject || '').split(/ - (.+)/)[1] || '').trim() || 'klant';
}

function soort(subject) {
  const s = (subject || '').toLowerCase();
  if (/inmeet|inmeten/.test(s)) return 'inmeet';
  if (/montage/.test(s)) return 'montage';
  if (/winkel|showroom|telefonisch/.test(s)) return 'winkel';
  return 'default';
}

// ── Planado ──
const PH = { Authorization: 'Bearer ' + PLANADO_KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
async function planadoJobs() {
  const alles = [];
  let after = null;
  for (let i = 0; i < 30; i++) {
    const u = 'https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : '');
    const d = await (await fetch(u, { headers: PH })).json();
    const l = d.jobs || [];
    if (!l.length) break;
    alles.push(...l);
    after = l[l.length - 1].uuid;
    await wacht(2600);
  }
  return alles;
}

async function main() {
  console.log(EXECUTE ? '=== SYNC (schrijft echt) ===' : '=== DRY-RUN (schrijft niets; --execute om echt te schrijven) ===');

  const evs = await outlookEvents();
  // Voorkeur voor een deelnemer die inmeter is, op WELKE positie ook (05-08: Joey
  // stond 2e in een showroomafspraak en werd gemist); anders de eerste niet-Sonty.
  const wie = (e) => {
    const namen = (e.Attendees || []).map((a) => a.EmailAddress?.Name || '').filter((n) => n && !/^sonty$/i.test(n));
    return namen.find((n) => INMETERS[n.split(' ')[0]]) || namen[0] || '';
  };
  const NIET_KLUS = /vrij$|later$|vakantie|ziek|verlof/i;

  const extIdVan = (e) => 'ol-' + crypto.createHash('sha1').update(e.Id).digest('hex').slice(0, 20);
  // Alle opgehaalde events, OOK de geannuleerde: nodig om hieronder veilig te kunnen
  // opruimen. Een event dat hier nog in staat maar geannuleerd is, is bewust afgezegd.
  const alleExtIds = new Set(evs.map(extIdVan));
  const geannuleerdeExtIds = new Set(evs.filter((e) => e.IsCancelled || /geannuleerd|canceled|cancelled/i.test(e.Subject || '')).map(extIdVan));

  const items = evs
    .filter((e) => !e.IsCancelled && !/geannuleerd|canceled|cancelled/i.test(e.Subject || '') && !NIET_KLUS.test(e.Subject || ''))
    .map((e) => ({ e, voornaam: wie(e).split(' ')[0] }))
    .filter((x) => INMETERS[x.voornaam]);
  console.log(`Outlook: ${items.length} afspraken van Joey/Sjoerd in de komende 6 weken`);

  const jobs = await planadoJobs();
  const nu = new Date();
  const toekomstJobs = jobs.filter((j) => j.scheduled_at && new Date(j.scheduled_at) > nu);
  // Dedup op ÁLLE jobs, niet alleen toekomstige (Koeleman 06-08: afspraak van eerder
  // vandaag werd in Outlook naar volgende week verplaatst; de oude job was inmiddels
  // "verleden" en viel uit de dedup → create-botsing op het external_id).
  const opExtId = new Map(jobs.map((j) => [j.external_id, j]));
  // Tweede dedup-sleutel: starttijd+inmeter — vangt de eerder gesynchroniseerde
  // bookings-… jobs en de door de planner zelf geboekte opdrachten af.
  // ALLEEN voor niet-ol-jobs (Ed Pannebakker, 11-08): staan er in Outlook ECHT twee
  // afspraken op dezelfde tijd bij dezelfde inmeter (dubbelboeking), dan moeten die
  // allebei in Planado komen — anders verzwijgt Planado de dubbelboeking en ziet
  // niemand hem. Twee ol-jobs botsen nooit per ongeluk: het event-id ontdubbelt al.
  // Numeriek vergelijken: Planado geeft tijden zonder milliseconden, toISOString mét.
  const opStartWie = new Set(toekomstJobs
    .filter((j) => !(j.external_id || '').startsWith('ol-'))
    .map((j) => `${Date.parse(j.scheduled_at)}|${j.assignee?.worker_uuid}`));

  let nieuw = 0, bijgewerkt = 0, overgeslagen = 0, fouten = 0;
  const actieveExtIds = new Set();

  for (const { e, voornaam } of items) {
    const startISO = new Date(e.Start.DateTime + 'Z').toISOString();
    const eindISO = new Date(e.End.DateTime + 'Z').toISOString();
    const minuten = Math.max(15, Math.round((Date.parse(eindISO) - Date.parse(startISO)) / 60000));
    const extId = 'ol-' + crypto.createHash('sha1').update(e.Id).digest('hex').slice(0, 20);
    actieveExtIds.add(extId);
    const adres = (e.Location?.DisplayName || '').trim();
    const bestaand = opExtId.get(extId);

    if (bestaand) {
      // gewijzigd in Outlook? Alleen tijd is betrouwbaar te vergelijken op de lijst.
      if (Date.parse(bestaand.scheduled_at) !== Date.parse(startISO)) {
        console.log(`  ~ ${voornaam} ${startISO.slice(0, 16)} ${e.Subject?.slice(0, 30)} (tijd gewijzigd)`);
        if (EXECUTE) {
          const det = await (await fetch(`https://api.planadoapp.com/v2/jobs/${bestaand.uuid}`, { headers: PH })).json();
          const r = await fetch(`https://api.planadoapp.com/v2/jobs/${bestaand.uuid}`, {
            method: 'PATCH', headers: PH,
            body: JSON.stringify({ version: (det.job || det).version, scheduled_at: startISO, scheduled_duration: { minutes: minuten } }),
          });
          r.ok ? bijgewerkt++ : fouten++;
          await wacht(2600);
        } else bijgewerkt++;
      } else overgeslagen++;
      continue;
    }
    if (opStartWie.has(`${Date.parse(startISO)}|${INMETERS[voornaam]}`)) { overgeslagen++; continue; }

    console.log(`  + ${voornaam} ${startISO.slice(0, 16)} [${soort(e.Subject)}] ${(e.Subject || '').slice(0, 40)}`);
    nieuw++;
    if (EXECUTE) {
      // Voor inmeet-afspraken: Gripp-blok er meteen in (adres eerst, telefoon vangnet).
      let grippBlok = '';
      if (soort(e.Subject) === 'inmeet') {
        try {
          const match = await zoekKlant(adres, telefoonUit(e.Body));
          if (match) {
            const regels = productRegels(match.offerte);
            grippBlok = `\n\nGripp: ${match.offerte.number}\nIN TE METEN:\n${regels.map((r) => '- ' + r).join('\n') || '- (geen productregels — check offerte)'}\n\nMEETBON (invullen op telefoon):\nhttps://sonty-website.vercel.app/admin/meetbon/${match.offerte.number}`;
          }
        } catch { /* Gripp niet bereikbaar: opdracht komt zonder blok, verrijker haalt hem later op */ }
      }
      const body = {
        // Planado accepteert type/template alleen als OBJECT bij POST; de platte
        // *_uuid-velden worden stil genegeerd en de app toont dan "Opdracht"
        // (bewezen 06-08 tegen API-docs + testjob; PATCH achteraf werkt NIET).
        job_type: { uuid: TYPES[soort(e.Subject)] },
        description: `${e.Subject || 'Afspraak'}\n(gesynct uit Outlook)${grippBlok}`,
        scheduled_at: startISO,
        scheduled_duration: { minutes: minuten },
        assignee: { worker: { uuid: INMETERS[voornaam] } },
        external_id: extId,
      };
      if (soort(e.Subject) === 'inmeet') body.template = { uuid: INMEET_TEMPLATE };
      const tel = telefoonUit(e.Body);
      if (tel) body.contacts = [{ type: 'phone', name: klantNaamUit(e.Subject), value: tel }];
      if (adres && adres.length > 8 && /\d/.test(adres)) body.address = { formatted: adres };
      const r = await fetch('https://api.planadoapp.com/v2/jobs', { method: 'POST', headers: PH, body: JSON.stringify(body) });
      if (!r.ok) { fouten++; console.log(`    FOUT ${r.status}: ${(await r.text()).slice(0, 120)}`); }
      else {
        // Na-PATCH is alleen nog voor de meetbon-velden; type/template zitten nu
        // correct in de POST zelf (als object).
        try {
          const created = await r.json();
          const uuid = created.job_uuid || created.uuid;
          if (uuid) {
            await wacht(2600);
            const det = await (await fetch(`https://api.planadoapp.com/v2/jobs/${uuid}`, { headers: PH })).json();
            const huidig = det.job || det;
            const naPatch = { version: huidig.version };
            // Meetbon als tikbaar linkveld in de details (Daimy 05-08)
            const nr = (grippBlok.match(/Gripp: (\d+)/) || [])[1];
            if (nr) {
              const blok = (grippBlok.split('IN TE METEN:')[1] || '').split('MEETBON')[0]
                .split('\n').map((x) => x.replace(/^\s*-\s*/, '').trim()).filter(Boolean).join(' · ');
              naPatch.custom_fields = [
                { name: 'In te meten', field_type: 'input', value: kortVeld(blok || 'zie omschrijving') },
                { name: 'Meetbon', field_type: 'link', value: `https://sonty-website.vercel.app/admin/meetbon/${nr}` },
              ];
            }
            if (Object.keys(naPatch).length > 1) {
              await fetch(`https://api.planadoapp.com/v2/jobs/${uuid}`, {
                method: 'PATCH', headers: PH, body: JSON.stringify(naPatch),
              });
            }
          }
        } catch { /* type blijft dan default; wekelijkse verrijker repareert */ }
      }
      await wacht(2600);
    }
  }

  // IN PLANADO MAAR NIET MEER IN OUTLOOK (Daimy 11-08: opdracht 328 stond nog in
  // Planado terwijl de Outlook-afspraak was geannuleerd — "hoe zorgen we dat dit niet
  // meer gebeurt"). Outlook is de bron van deze ol-jobs, dus als de bron weg of
  // geannuleerd is gaat de kopie er nu automatisch uit. Harde remmen:
  //   - alleen onze eigen ol-jobs (nooit rp-boekingen of handwerk),
  //   - alleen als de bron ECHT weg is (niet in de hele fetch) of expliciet geannuleerd,
  //   - alleen binnen het fetch-venster van 100 dagen,
  //   - en alleen als de Outlook-fetch echt events teruggaf — een lege agenda is een
  //     storing, geen massa-annulering.
  const fetchGrens = Date.now() + 99 * 86400000;
  const wees = toekomstJobs.filter((j) => (j.external_id || '').startsWith('ol-') && !actieveExtIds.has(j.external_id));
  const teVerwijderen = evs.length > 10 ? wees.filter((j) =>
    Date.parse(j.scheduled_at) < fetchGrens
    && (!alleExtIds.has(j.external_id) || geannuleerdeExtIds.has(j.external_id))) : [];
  for (const j of teVerwijderen) {
    if (!EXECUTE) { console.log(`  zou verwijderen: #${j.serial_no} ${j.scheduled_at} (bron weg/geannuleerd)`); continue; }
    const del = await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { method: 'DELETE', headers: PH });
    console.log(`  ${del.ok ? '✓' : '⚠️'} #${j.serial_no} ${j.scheduled_at} ${del.ok ? 'verwijderd (Outlook-bron weg/geannuleerd)' : 'verwijderen mislukt ' + del.status}`);
    await wacht(2600);
  }
  if (teVerwijderen.length && EXECUTE) {
    await telegram(`🔄 Sync: ${teVerwijderen.length} Planado-opdracht(en) verwijderd omdat de Outlook-afspraak is geannuleerd of weggehaald: ${teVerwijderen.map((j) => '#' + j.serial_no + ' ' + new Date(j.scheduled_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })).join(', ')}.`);
  }
  // Wezen maar ÉÉN keer melden (Daimy 06-08 "best veel meldingen"): dezelfde 4 wezen
  // kwamen elke 30 minuten opnieuw op Telegram. Dedup per job-uuid, mét naam erbij
  // zodat de melding ook bruikbaar is.
  const WEES_PAD = path.join(__dirname, '..', 'data', 'sync-wees-gemeld.json');
  let weesGemeld = {};
  try { weesGemeld = JSON.parse(fs.readFileSync(WEES_PAD, 'utf8')); } catch {}
  const verseWezen = wees.filter((j) => !weesGemeld[j.uuid]);
  if (verseWezen.length && EXECUTE) {
    for (const j of verseWezen) weesGemeld[j.uuid] = new Date().toISOString();
    fs.writeFileSync(WEES_PAD, JSON.stringify(weesGemeld, null, 1));
    const namen = verseWezen.map((j) => `#${j.serial_no} ${new Date(j.scheduled_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}`).join(', ');
    await telegram(`🔄 Outlook→Planado-sync: ${verseWezen.length} opdracht(en) staan nog in Planado maar niet meer in Outlook (geannuleerd/verplaatst?): ${namen}. Even nakijken; ik verwijder niet automatisch. (Deze melding komt per opdracht maar één keer.)`);
  }

  console.log(`\nnieuw: ${nieuw} | bijgewerkt: ${bijgewerkt} | al aanwezig: ${overgeslagen} | wees: ${wees.length} | fouten: ${fouten}`);
  if (EXECUTE && (nieuw || bijgewerkt || fouten)) {
    await telegram(`🔄 Outlook→Planado-sync (Joey+Sjoerd): ${nieuw} nieuw, ${bijgewerkt} bijgewerkt, ${overgeslagen} al aanwezig${fouten ? `, ${fouten} FOUTEN` : ''}.`);
  }
}

main().catch(async (e) => { console.error(e.message); await telegram(`⚠️ Outlook→Planado-sync FOUT: ${e.message.slice(0, 150)}`); process.exit(1); });
