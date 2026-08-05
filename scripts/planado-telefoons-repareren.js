#!/usr/bin/env node
// Eenmalige reparatie (Daimy 2026-08-05): zet bij elke toekomstige Planado-opdracht
// van Joey/Sjoerd het telefoonnummer van de klant in het contactveld, gehaald uit het
// opmerkingenveld (Body) van de bijbehorende Outlook-afspraak.
// Match: eigen sync-id (ol-…) of anders starttijd+inmeter. Bestaande contacten
// blijven staan; alleen lege worden gevuld. Standaard DRY-RUN; --execute schrijft.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const EXECUTE = process.argv.includes('--execute');
const INMETERS = {
  '1f122cfa-17a2-6580-8257-7e80f004db9c': 'Joey',
  '1f122d19-e43e-6da0-8ffb-661a4ff9bb36': 'Sjoerd',
};
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

function telefoonUit(bodyContent) {
  const tekst = String(bodyContent || '').replace(/<[^>]+>/g, ' ');
  const m = tekst.match(/(?:\+31|0031|0)[\s-]?[1-9](?:[\s-]?\d){8}/);
  if (!m) return null;
  let cijfers = m[0].replace(/[^\d+]/g, '');
  if (cijfers.startsWith('0031')) cijfers = '+31' + cijfers.slice(4);
  else if (cijfers.startsWith('0')) cijfers = '+31' + cijfers.slice(1);
  return cijfers;
}
const klantNaamUit = (subject) => (String(subject || '').split(/ - (.+)/)[1] || '').trim() || 'klant';

async function main() {
  console.log(EXECUTE ? '=== REPAREREN (echt) ===' : '=== DRY-RUN (--execute om echt te schrijven) ===');

  // Outlook-afspraken met Body ophalen
  const token = fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim();
  const OH = { Authorization: 'Bearer ' + token };
  const cal = (((await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value) || [])
    .find((c) => c.Name === 'Sonty Montage');
  const van = new Date();
  const tot = new Date(); tot.setDate(tot.getDate() + 42);
  let url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView`
    + `?$top=500&$select=Subject,Start,IsCancelled,Attendees,Body&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
  const evs = [];
  while (url) {
    const j = await (await fetch(url, { headers: OH })).json();
    evs.push(...(j.value || []));
    url = j['@odata.nextLink'] || null;
  }

  // Indexen: op sync-id en op starttijd
  const opExtId = new Map();
  // Sleutel = starttijd + VOORNAAM van de inmeter. Alleen op tijd matchen ging fout:
  // twee inmeters om 09:00 gaf het nummer van de verkeerde klant (dry-run 05-08:
  // Rinette Hoogwerf kreeg het nummer van Wilco Vendrig).
  const opStartWie = new Map();
  for (const e of evs) {
    if (e.IsCancelled) continue;
    const extId = 'ol-' + crypto.createHash('sha1').update(e.Id).digest('hex').slice(0, 20);
    opExtId.set(extId, e);
    const voornaam = (e.Attendees || []).map((a) => (a.EmailAddress?.Name || '').split(' ')[0]).find((n) => ['Joey', 'Sjoerd'].includes(n));
    if (voornaam) opStartWie.set(`${Date.parse(e.Start.DateTime + 'Z')}|${voornaam}`, e);
  }

  // Alle toekomstige jobs van Joey/Sjoerd
  const jobs = [];
  let after = null;
  for (let i = 0; i < 30; i++) {
    const d = await (await fetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || [];
    if (!l.length) break;
    jobs.push(...l);
    after = l[l.length - 1].uuid;
    await wacht(2600);
  }
  const nu = Date.now();
  const doel = jobs.filter((j) => j.scheduled_at && Date.parse(j.scheduled_at) > nu && INMETERS[j.assignee?.worker_uuid]);
  console.log(`${doel.length} toekomstige opdrachten van Joey/Sjoerd`);

  let gevuld = 0, alGoed = 0, geenNummer = 0, fouten = 0;
  for (const j of doel) {
    const det = await (await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json();
    const job = det.job || det;
    await wacht(2600);
    const heeftTel = (job.contacts || []).some((c) => c.type === 'phone' && c.value && c.value !== '-');
    if (heeftTel) { alGoed++; continue; }

    const ev = opExtId.get(j.external_id) || opStartWie.get(`${Date.parse(j.scheduled_at)}|${INMETERS[j.assignee?.worker_uuid]}`);
    const tel = ev ? telefoonUit(ev.Body?.Content) : null;
    if (!tel) { geenNummer++; continue; }

    const naam = ev ? klantNaamUit(ev.Subject) : 'klant';
    console.log(`  + #${job.serial_no} ${(job.description || '').split('\n')[0].slice(0, 36)} -> ${tel} (${naam})`);
    gevuld++;
    if (EXECUTE) {
      const bestaande = (job.contacts || []).filter((c) => !(c.type === 'phone' && (!c.value || c.value === '-')));
      const r = await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, {
        method: 'PATCH', headers: PH,
        body: JSON.stringify({ version: job.version, contacts: [...bestaande, { type: 'phone', name: naam, value: tel }] }),
      });
      if (!r.ok) { fouten++; console.log(`    FOUT ${r.status}`); }
      await wacht(2600);
    }
  }
  console.log(`\ntelefoon gevuld: ${gevuld} | had al nummer: ${alGoed} | geen nummer in Outlook: ${geenNummer} | fouten: ${fouten}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
