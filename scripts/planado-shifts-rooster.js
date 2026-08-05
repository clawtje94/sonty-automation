#!/usr/bin/env node
// Beschikbaarheid van de inmeters in Planado zetten vanuit het echte rooster
// (data/inmeters-rooster.json) + vakanties/verlof uit Outlook (Daimy 2026-08-05).
//
// Per dag: rooster zegt werken en geen vakantie → werkblok (bv. 09:00-15:00);
// anders hele dag niet-werkend. Schrijft per week vooruit t/m +10 weken.
// Standaard DRY-RUN; --execute schrijft echt.
const fs = require('fs');
const path = require('path');

const KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const H = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const ROOSTER = require('../data/inmeters-rooster.json').inmeters;
const EXECUTE = process.argv.includes('--execute');
const WEKEN = 10;
const DAGCODE = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const VAKANTIE = /vakantie|verlof|vrij\b|ziek/i;

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const dagStr = (d) => d.toISOString().slice(0, 10);

// Vakantiedagen per inmeter uit Outlook (agenda "Sonty Montage").
async function vakantiedagen() {
  const token = fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim();
  const OH = { Authorization: 'Bearer ' + token };
  const cal = (((await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value) || [])
    .find((c) => c.Name === 'Sonty Montage');
  const van = new Date();
  const tot = new Date(); tot.setDate(tot.getDate() + WEKEN * 7);
  let url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView`
    + `?$top=500&$select=Subject,Start,End,IsCancelled,Attendees&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
  const evs = [];
  while (url) {
    const j = await (await fetch(url, { headers: OH })).json();
    evs.push(...(j.value || []));
    url = j['@odata.nextLink'] || null;
  }
  const perInmeter = {};
  for (const e of evs) {
    if (e.IsCancelled || !VAKANTIE.test(e.Subject || '')) continue;
    const wie = (e.Attendees || []).map((a) => (a.EmailAddress?.Name || '').split(' ')[0]).find((n) => ROOSTER[n]);
    if (!wie) continue;
    // elke kalenderdag die het event raakt
    for (let d = new Date(e.Start.DateTime + 'Z'); d < new Date(e.End.DateTime + 'Z'); d.setDate(d.getDate() + 1)) {
      (perInmeter[wie] = perInmeter[wie] || new Set()).add(dagStr(d));
    }
  }
  return perInmeter;
}

async function main() {
  console.log(EXECUTE ? '=== SHIFTS ZETTEN (echt) ===' : '=== DRY-RUN (--execute om echt te schrijven) ===');
  const vakantie = await vakantiedagen().catch((e) => { console.log('vakanties niet leesbaar:', e.message.slice(0, 80)); return {}; });
  for (const [naam, dagen] of Object.entries(vakantie)) console.log(`vakantie ${naam}: ${[...dagen].join(', ') || '-'}`);

  for (const [naam, r] of Object.entries(ROOSTER)) {
    if (!r.uuidPlanado || !r.dagen) continue;
    console.log(`\n${naam}:`);
    // per week batchen, vanaf morgen
    const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(0, 0, 0, 0);
    for (let w = 0; w < WEKEN; w++) {
      const shifts = [];
      for (let i = 0; i < 7; i++) {
        const dag = new Date(+start + (w * 7 + i) * 86400000);
        const code = DAGCODE[dag.getDay()];
        const rooster = r.dagen[code];
        const vak = vakantie[naam]?.has(dagStr(dag));
        const D = dagStr(dag);
        if (rooster && !vak) {
          shifts.push({ time_from: `${D}T00:00:00+02:00`, time_to: `${D}T${rooster.van}:00+02:00`, working: false });
          shifts.push({ time_from: `${D}T${rooster.van}:00+02:00`, time_to: `${D}T${rooster.tot}:00+02:00`, working: true });
          shifts.push({ time_from: `${D}T${rooster.tot}:00+02:00`, time_to: `${dagStr(new Date(+dag + 86400000))}T00:00:00+02:00`, working: false });
        } else {
          shifts.push({ time_from: `${D}T00:00:00+02:00`, time_to: `${dagStr(new Date(+dag + 86400000))}T00:00:00+02:00`, working: false });
        }
      }
      const weekVan = dagStr(new Date(+start + w * 7 * 86400000));
      const werkdagen = shifts.filter((s) => s.working).length;
      console.log(`  week v.a. ${weekVan}: ${werkdagen} werkdagen${EXECUTE ? '' : ' (dry)'}`);
      if (EXECUTE) {
        const resp = await fetch(`https://api.planadoapp.com/v2/users/${r.uuidPlanado}/shifts`, {
          method: 'PATCH', headers: H, body: JSON.stringify({ shifts }),
        });
        if (!resp.ok) console.log(`    FOUT ${resp.status}: ${(await resp.text()).slice(0, 140)}`);
        await wacht(2700);
      }
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
