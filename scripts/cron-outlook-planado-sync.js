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
// Werkbon-sjabloon "Montage afspraak particulier": 10 rapportvelden (werkplek, foto's
// voor/na, product getest, bediening uitgelegd, ...) — bestond al, was nooit gebruikt.
const MONTAGE_TEMPLATE = '1f11c802-6613-6d00-9d06-7e73cee772e4';
// Outlook-voornaam → Planado-account van het montageteam. Duo-teams delen één
// veld-app-account (zo staan ze in Planado). Dennis, Mick en ZZP 1 hebben (nog) geen
// account: hun montages worden geteld en gemeld, niet gesynct.
// Echte bussen (Daimy 16-08): Marvin+Moa, Kevin+Tygo, Yudi+Nick, Marvin+Bart,
// Frenky+Dennis. Alleen bus Yudi+Nick heeft een kloppend Planado-account; "Kevin
// Gibson + Marvin" klopt niet meer (Kevin rijdt met Tygo) en "Marvin" is ambigu
// (twee bussen). Daarom hier ALLEEN de eenduidige mappings; de rest wacht op
// accounts per bus (beslissing Daimy, kost seats).
const MONTEURS = {
  Yudi: '1f122f37-76db-68b0-9aad-4269fe2bbe9c',   // Bus Yudi + Nick
  Nick: '1f122f37-76db-68b0-9aad-4269fe2bbe9c',
  Kevin: '1f122f72-777f-6e80-8139-6e820cb7b164',  // Bus Kevin + Tygo (hernoemd 16-08)
  Tygo: '1f122f72-777f-6e80-8139-6e820cb7b164',
  Jorren: '1f122da2-8a5b-6c80-9ca9-72f9240343d3',
  Sjoerd: '1f122d19-e43e-6da0-8ffb-661a4ff9bb36',
};
// Montage-sync staat achter een schakelaar: pas als data/montage-sync-aan bestaat
// (of --montage bij een losse run) gaan monteurs-opdrachten echt mee. Zo krijgt de
// 10-min-daemon deze code veilig binnen zonder dat er onaangekondigd ~100 opdrachten
// in de veld-apps van het montageteam verschijnen.
const MONTAGE_AAN = process.argv.includes('--montage') || fs.existsSync(path.join(__dirname, '..', 'data', 'montage-sync-aan'));
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
    return namen.find((n) => INMETERS[n.split(' ')[0]] || (MONTAGE_AAN && MONTEURS[n.split(' ')[0]])) || namen[0] || '';
  };
  // MEENEMEN- en LET OP-blokken zijn herinneringen voor de inmeter, geen klus. Ze
  // hebben geen deelnemers en zouden hier dus al afvallen; dit is de tweede sluiting,
  // zodat een blok mét deelnemer (zoals het voorbeeld voor Daimy) geen spook-opdracht
  // oplevert.
  const NIET_KLUS = /vrij$|later$|vakantie|ziek|verlof|^(MEENEMEN|LET OP|VOORBEELD)\b/i;
  const onbekendTeam = {};

  const extIdVan = (e) => 'ol-' + crypto.createHash('sha1').update(e.Id).digest('hex').slice(0, 20);
  // Alle opgehaalde events, OOK de geannuleerde: nodig om hieronder veilig te kunnen
  // opruimen. Een event dat hier nog in staat maar geannuleerd is, is bewust afgezegd.
  const alleExtIds = new Set(evs.map(extIdVan));
  const geannuleerdeExtIds = new Set(evs.filter((e) => e.IsCancelled || /geannuleerd|canceled|cancelled/i.test(e.Subject || '')).map(extIdVan));

  const items = evs
    .filter((e) => !e.IsCancelled && !/geannuleerd|canceled|cancelled/i.test(e.Subject || '') && !NIET_KLUS.test(e.Subject || ''))
    .map((e) => ({ e, voornaam: wie(e).split(' ')[0] }))
    .filter((x) => {
      if (INMETERS[x.voornaam]) return true;
      if (MONTAGE_AAN && soort(x.e.Subject) === 'montage') {
        if (MONTEURS[x.voornaam]) return true;
        onbekendTeam[x.voornaam || '?'] = (onbekendTeam[x.voornaam || '?'] || 0) + 1;
      }
      return false;
    });
  console.log(`Outlook: ${items.length} afspraken (inmeters${MONTAGE_AAN ? ' + monteurs' : ''}) in het venster`);
  if (MONTAGE_AAN && Object.keys(onbekendTeam).length) {
    console.log('  montages ZONDER Planado-account (niet gesynct): ' + Object.entries(onbekendTeam).map(([k, v]) => `${k}: ${v}`).join(', '));
  }

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
      // gewijzigd in Outlook? Start EN duur vergelijken (11-08: de buffertijden gingen
      // uit in Bookings, maar de sync keek alleen naar de starttijd — ingekorte
      // afspraken bleven in Planado 3 uur staan).
      const duurNu = bestaand.scheduled_duration?.minutes;
      if (Date.parse(bestaand.scheduled_at) !== Date.parse(startISO) || (duurNu && duurNu !== minuten)) {
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
    const werkerUuid = INMETERS[voornaam] || MONTEURS[voornaam];
    if (opStartWie.has(`${Date.parse(startISO)}|${werkerUuid}`)) { overgeslagen++; continue; }

    console.log(`  + ${voornaam} ${startISO.slice(0, 16)} [${soort(e.Subject)}] ${(e.Subject || '').slice(0, 40)}`);
    nieuw++;
    if (EXECUTE) {
      // Voor inmeet-afspraken: Gripp-blok er meteen in (adres eerst, telefoon vangnet).
      let grippBlok = '';
      let klantMatch = null; // ook nodig voor de sheet-koppeling hieronder
      const isMontage = soort(e.Subject) === 'montage';
      if (soort(e.Subject) === 'inmeet' || isMontage) {
        try {
          const match = await zoekKlant(adres, telefoonUit(e.Body));
          klantMatch = match;
          if (match) {
            const regels = productRegels(match.offerte);
            grippBlok = `\n\nGripp: ${match.offerte.number}\n${isMontage ? 'TE MONTEREN' : 'IN TE METEN'}:\n${regels.map((r) => '- ' + r).join('\n') || '- (geen productregels — check offerte)'}`
              + (isMontage ? '' : `\n\nMEETBON (invullen op telefoon):\nhttps://sonty-website.vercel.app/admin/meetbon/${match.offerte.number}`);
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
        assignee: { worker: { uuid: werkerUuid } },
        external_id: extId,
      };
      if (soort(e.Subject) === 'inmeet') body.template = { uuid: INMEET_TEMPLATE };
      // Montage krijgt het werkbon-sjabloon: daarmee ziet de monteur in de veld-app
      // de checklist (werkplek, foto's voor/na, product getest, bediening uitgelegd).
      else if (isMontage) body.template = { uuid: MONTAGE_TEMPLATE };
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
              const blok = (grippBlok.split(/IN TE METEN:|TE MONTEREN:/)[1] || '').split('MEETBON')[0]
                .split('\n').map((x) => x.replace(/^\s*-\s*/, '').trim()).filter(Boolean).join(' · ');
              naPatch.custom_fields = isMontage
                ? [
                  { name: 'Product type', field_type: 'input', value: kortVeld(blok || 'zie omschrijving') },
                  { name: 'Bijzonderheden', field_type: 'input', value: kortVeld('Gripp ' + nr + ' — gesynct uit Outlook') },
                ]
                : [
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

        // SHEET-KOPPELING (Daimy 16-08, V4): een inmeet-afspraak die de planner zelf in
        // Outlook zet moet ook in de offerte-sheet komen: 1tje in de inkoopkolom +
        // inmeetdatum + inmeter (zelfde regel als de automatische boekingen). De 7
        // winkel-akkoorden van de audit 16-08 misten dit allemaal. Rij nog niet
        // gevonden (offerte-rij bestaat soms pas na het sheet-vangnet van 08:15/20:15)
        // → wachtrij; de inmeten-planner probeert die elke run opnieuw.
        if (soort(e.Subject) === 'inmeet') {
          const payload = {
            grippNr: klantMatch?.offerte?.number,
            naam: klantNaamUit(e.Subject),
            telefoon: tel,
            inmeetDatum: new Date(startISO).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
            inmeter: voornaam,
            alleenAlsLeeg: true,
            geenNieuweRij: true,
            sleutel: extId,
          };
          try {
            const { schrijfInplanning } = require('./lib/sheet-inplannen.js');
            const res = await schrijfInplanning(payload);
            if (res.gevonden && !res.overgeslagen) console.log(`    sheet: 1 + ${payload.inmeetDatum} + ${voornaam} → ${res.tab} rij ${res.rij}`);
            else if (res.overgeslagen) console.log(`    sheet: rij gevonden, maar ${res.overgeslagen} — niets overschreven`);
            else { require('./lib/sheet-wachtrij.js').zetInWachtrij(payload); console.log('    sheet: rij nog niet gevonden — in wachtrij gezet'); }
          } catch (fout) {
            try { require('./lib/sheet-wachtrij.js').zetInWachtrij(payload); } catch { /* wachtrij-bestand onbereikbaar */ }
            console.log('    sheet: schrijven faalde (' + (fout.message || fout) + ') — in wachtrij gezet');
          }
        }
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

  // RICHTING TERUG: PLANADO -> OUTLOOK (Daimy 11-08: "als er wat nieuws in Outlook
  // komt of wat nieuws in Planado, dan moet het gelijk met elkaar syncen").
  // Tot nu toe ging alleen Outlook naar Planado vanzelf; een opdracht die direct in
  // Planado werd gezet (of waarvan de agenda-afspraak ooit stil mislukte, zoals bij
  // Franken op 8 aug) kwam nooit in de agenda. Hier de terugweg: elke toekomstige
  // Joey/Sjoerd-opdracht zonder agenda-afspraak krijgt er een. ol-jobs vallen hier
  // bewust buiten: hun bron IS Outlook, en als die weg is ruimt de wezen-logica ze op.
  try {
    const NAAM_VAN_UUID = Object.fromEntries(Object.entries(INMETERS).map(([k, v]) => [v, k]));
    const evStarts = new Set(evs.filter((e) => !e.IsCancelled).map((e) => Date.parse(new Date(e.Start.DateTime + 'Z'))));

    // OUTLOOK-ANNULERING IS LEIDEND (Daimy 18-08, geval Eric van der Meer: iemand
    // verwijderde de afspraak in Outlook en de heler zette hem doodleuk terug).
    // We onthouden per opdracht of we zijn agenda-afspraak ooit gezien hebben:
    //   - ooit gezien en nu weg → ANNULERING: opdracht mee-annuleren (via de motor
    //     als er een boeking is, anders de job direct verwijderen), nooit helen;
    //   - klantnaam staat elders in de agenda → VERPLAATST in Outlook: melden,
    //     niet annuleren en niet helen (mens beslist);
    //   - nooit gezien → HELEN zoals voorheen (opdracht zonder afspraak).
    const GEZIEN_PAD = path.join(__dirname, '..', 'data', 'sync-event-gezien.json');
    let eventGezien = {};
    try { eventGezien = JSON.parse(fs.readFileSync(GEZIEN_PAD, 'utf8')); } catch { /* eerste run */ }
    const normNaam = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const klantVanJobKop = (j) => normNaam(String(j.description || '').split('\n')[0].replace(/^(Inmeten|Montage|Service afspraak)?\s*(Sonty)?\s*[—-]\s*/i, ''));
    const naamElders = (j) => {
      const naam = klantVanJobKop(j);
      const delen = naam.split(' ').filter((d) => d.length >= 4);   // 'van'/'der' tellen niet mee
      if (!delen.length) return false;
      return evs.some((e) => {
        const s = normNaam(e.Subject);
        return delen.filter((d) => s.includes(d)).length >= Math.ceil(delen.length / 2);
      });
    };

    let geheeld = 0;
    if (evs.length > 10) for (const j of toekomstJobs) {
      const naam = NAAM_VAN_UUID[j.assignee?.worker_uuid];
      if (!naam) continue;
      if ((j.external_id || '').startsWith('ol-')) continue;
      // Meeneem-meldingen (cron-meeneem-melding.js) zijn herinneringen voor de inmeter
      // zelf, geen klantafspraak. Zonder deze uitzondering maakt de heal hieronder er
      // een Bookings-afspraak van, mét bevestigingsmail naar een klant die niet bestaat.
      if ((j.external_id || '').startsWith('meeneem-')) continue;
      const van = Date.parse(j.scheduled_at);
      if ([...evStarts].some((sMs) => Math.abs(sMs - van) < 60000)) {
        // afspraak staat er: onthouden dat deze opdracht zijn event heeft (gehad)
        eventGezien[j.uuid] = { op: new Date().toISOString(), klant: klantVanJobKop(j) || null };
        continue;
      }

      // Geen afspraak op dit tijdstip. Eerst: is dit een annulering of verplaatsing?
      if (eventGezien[j.uuid]) {
        if (naamElders(j)) {
          if (EXECUTE) await telegram(`↔️ #${j.serial_no} (${klantVanJobKop(j) || 'klant'}): de agenda-afspraak is in Outlook VERPLAATST maar de Planado-opdracht staat nog op ${new Date(van).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })} — even gelijktrekken (dashboard of motor), ik raak hem niet aan.`);
          console.log(`  ↔️ #${j.serial_no} verplaatst in Outlook — melding gestuurd, niets gedaan`);
          continue;
        }
        // ANNULERING: Outlook is leidend, opdracht gaat mee weg — nooit terug-helen.
        if (!EXECUTE) { console.log(`  zou ANNULEREN: #${j.serial_no} (event was er en is weg)`); continue; }
        let viaMotor = false;
        try {
          const { vindBoeking, muteerBoeking } = require('./lib/inmeet-mutatie.js');
          const alleB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeet-boekingen.json'), 'utf8'));
          const hit = Object.entries(alleB).find(([, b]) => b.planadoJobUuid === j.uuid && b.status === 'geboekt');
          if (hit) { await muteerBoeking(hit[0], 'annuleer', { reden: 'agenda-afspraak in Outlook verwijderd', bron: 'outlook-annulering' }); viaMotor = true; }
        } catch (e) { console.log('  motor-annulering faalde: ' + e.message.slice(0, 60)); }
        if (!viaMotor) {
          const del = await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { method: 'DELETE', headers: PH });
          await telegram(`🛑 #${j.serial_no} (${klantVanJobKop(j) || 'klant'}): agenda-afspraak in Outlook verwijderd → Planado-opdracht ${del.ok ? 'mee-geannuleerd' : 'KON NIET verwijderd worden (HTTP ' + del.status + ')'}. Outlook-annulering is leidend (regel Daimy 18-08).`);
        }
        delete eventGezien[j.uuid];
        console.log(`  🛑 #${j.serial_no} geannuleerd (Outlook-afspraak was verwijderd${viaMotor ? ', via motor' : ''})`);
        await wacht(2600);
        continue;
      }

      if (!EXECUTE) { console.log(`  zou agenda-afspraak maken voor #${j.serial_no} ${j.scheduled_at}`); continue; }
      const det = await (await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json();
      const job = det.job || det;
      // Helen via Bookings mét klantgegevens (15-08: de heal maakte kale afspraken
      // zonder klantmail — Eric en Jeffrey stonden weer "niet toegewezen" en zonder
      // bevestigingsroute). E-mail komt uit onze eigen boekingen-administratie.
      const klant = (job.contacts || [])[0]?.name || String(job.description || '').split('\n')[0].replace(/^Inmeten( Sonty -| —)? /, '') || 'klant';
      const telefoonJ = (job.contacts || [])[0]?.value || '';
      let emailJ = null;
      try {
        const bo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeet-boekingen.json'), 'utf8'));
        const t9 = telefoonJ.replace(/\D/g, '').slice(-9);
        emailJ = Object.values(bo).find((x) => t9 && String(x.telefoon || '').replace(/\D/g, '').slice(-9) === t9)?.email || null;
      } catch { /* geen administratie */ }
      const { boekInmeetAfspraak } = require('./lib/inmeet-boeken.js');
      const ev = (await boekInmeetAfspraak({
        slot: { aankomst: new Date(van), inmeter: naam },
        naam: klant, telefoon: telefoonJ, email: emailJ,
        adres: job.address?.formatted || '', duurMin: job.scheduled_duration?.minutes || 30,
      }).catch(() => ({ id: null }))).id;
      if (ev) { geheeld++; console.log(`  ✓ agenda-afspraak aangemaakt voor #${j.serial_no} (${klant}, ${j.scheduled_at})`); }
      await wacht(2600);
    }
    if (geheeld) await telegram(`🔄 Sync: ${geheeld} Planado-opdracht(en) zonder agenda-afspraak alsnog in Outlook gezet — actie nodig: even controleren of dit klopt.`);
    // gezien-administratie bijhouden; alleen toekomstige opdrachten zijn relevant
    const actueleUuids = new Set(toekomstJobs.map((j) => j.uuid));
    for (const uuid of Object.keys(eventGezien)) if (!actueleUuids.has(uuid)) delete eventGezien[uuid];
    fs.writeFileSync(GEZIEN_PAD, JSON.stringify(eventGezien, null, 1));
  } catch (e) { console.log('  terugweg overgeslagen: ' + e.message.slice(0, 60)); }

  // OPTIE-VEGER (Daimy 11-08: "een optie-blok moet weg zodra iemand geboekt heeft,
  // dan komt die tijd weer vrij voor nieuwe boekingen, ook op het dashboard").
  // Elke 30 minuten: elk OPTIE-blok waarvan de klant geen OPEN aanbod meer heeft
  // (geboekt, gekozen of verlopen) gaat direct uit de agenda. De vervaltijd afwachten
  // hield tijden onnodig een dag bezet.
  try {
    const OHo = { Authorization: fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim() ? 'Bearer ' + fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim() : '' };
    const ro = await fetch('https://sonty-website.vercel.app/api/inmeet-aanbod?actief=1', { headers: { 'x-meet-code': process.env.MEETBON_CODE || '2288' } });
    if (ro.ok) {
      const openNamen = (((await ro.json()).aanbiedingen) || []).filter((a) => a.status === 'open')
        .map((a) => String(a.lead?.naam || '').toLowerCase()).filter(Boolean);
      let geveegd = 0;
      for (const e of evs) {
        if (!/^OPTIE bot/i.test(e.Subject || '')) continue;
        const klant = (e.Subject || '').replace(/^OPTIE bot \w+ — /, '').replace(/\(vervalt.*$/, '').trim().toLowerCase();
        if (openNamen.some((o) => o.includes(klant) || klant.includes(o))) continue;
        if (!EXECUTE) { console.log('  zou optie vegen: ' + e.Subject.slice(0, 60)); continue; }
        const del = await fetch('https://outlook.office.com/api/v2.0/me/events/' + e.Id, { method: 'DELETE', headers: OHo });
        if (del.ok || del.status === 204) geveegd++;
        await wacht(700);
      }
      if (geveegd) console.log(`  ${geveegd} OPTIE-blok(ken) geveegd (geen open aanbod meer)`);
    }
  } catch (e) { console.log('  optie-veger overgeslagen: ' + e.message.slice(0, 60)); }

  // Dashboard verversen zodra de sync iets heeft veranderd (Daimy 11-08): nieuwe of
  // bijgewerkte opdrachten, opgeruimde kopieën of geveegde opties horen direct
  // zichtbaar te zijn, niet pas bij de volgende planner-run.
  if (EXECUTE && (nieuw || bijgewerkt || teVerwijderen.length)) {
    await fetch('https://sonty-website.vercel.app/api/inmeet-mutatie', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': process.env.MEETBON_CODE || '2288' },
      body: JSON.stringify({ type: 'ververs', bron: 'na-sync' }),
    }).catch(() => {});
  }
  console.log(`\nnieuw: ${nieuw} | bijgewerkt: ${bijgewerkt} | al aanwezig: ${overgeslagen} | wees: ${wees.length} | fouten: ${fouten}`);
  if (EXECUTE && (nieuw || bijgewerkt || fouten)) {
    await telegram(`🔄 Outlook→Planado-sync (Joey+Sjoerd): ${nieuw} nieuw, ${bijgewerkt} bijgewerkt, ${overgeslagen} al aanwezig${fouten ? `, ${fouten} FOUTEN` : ''}.`);
  }
}

main().catch(async (e) => { console.error(e.message); await telegram(`⚠️ Outlook→Planado-sync FOUT: ${e.message.slice(0, 150)}`); process.exit(1); });
