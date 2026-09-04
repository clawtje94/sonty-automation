#!/usr/bin/env node
/**
 * MONTAGE-EVENT VOOR KLAVIYO (Daimy 04-09-2026: "een reviewmail stuur je alleen na montage, wtf").
 *
 * Wat er misging: flow "Sonty E | Service en review" stond op segment "5. Klant (akkoord gegeven)".
 * Daardoor kreeg iedereen 14 dagen na zijn AKKOORD (dag van de aanbetalingsfactuur) de vraag om
 * een review, terwijl de montage dan nog weken weg is. 12 klanten zijn zo gemaild (2 t/m 4 sept).
 *
 * Nu: dit script kijkt in Planado welke MONTAGE-opdrachten afgerond zijn en stuurt per klant
 * eenmalig het event "Montage afgerond" naar Klaviyo. De nieuwe flow E triggert op dat event
 * (E1 nazorg na 7 dagen, E2 reviewverzoek na 14 dagen). Geen event = geen mail.
 *
 * Poorten (allemaal hard):
 *  - alleen template "Montage ..." met status finished en een finished_at-tijd
 *  - werkbon "Werk gereed?" = nee → GEEN event (er komt nog een monteur terug)
 *  - e-mail via: Planado-contact (type email) → telefoon-match in rp-export → Gripp offer.number → company.email
 *  - dedupe per job (uuid) én per e-mail (geen tweede event binnen 90 dagen, bv. terugkombezoek)
 *  - eerste run = nulmeting: alles wat vóór vandaag afgerond is wordt gemarkeerd zonder event
 *
 * Gebruik: node scripts/email/montage-events.js [--dry]   (dagelijks via dagelijks.sh, stap 5)
 */
const fs = require('fs');
const path = require('path');
const { KLAVIYO_API_KEY, GRIPP_API_KEY } = require('../secrets.js');
const { planadoFetch } = require('../lib/planado-fetch.js');
const { werkGereed } = require('../lib/werkbon-mail.js');

const ROOT = path.join(__dirname, '..', '..');
const RP = path.join(ROOT, 'data', 'email', 'rp-export.json');
const STAAT = path.join(ROOT, 'data', 'email', 'montage-events.json');
const LOG = path.join(ROOT, 'logs', 'montage-events.log');
const PH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(ROOT, 'scripts', 'planado-api-key.txt'), 'utf8').trim() };
const DRY = process.argv.includes('--dry');
const DEDUPE_DAGEN = 90;

const log = (s) => { const r = `[${new Date().toISOString().slice(0, 16)}] ${s}`; console.log(r); if (!DRY) fs.appendFileSync(LOG, r + '\n'); };
const normTel = (t) => String(t || '').replace(/\D/g, '').replace(/^0031/, '0').replace(/^31(?=\d{9}$)/, '0');
const geldigEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

async function gripp(calls) {
  const r = await fetch('https://api.gripp.com/public/api3.php', { method: 'POST', headers: { Authorization: 'Bearer ' + GRIPP_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(calls) });
  try { return await r.json(); } catch { return [{}]; }
}
async function grippEmail(nr) {
  if (!nr) return null;
  for (const [entiteit, veld] of [['offer', 'offer.number'], ['project', 'project.number']]) {
    const [o] = await gripp([{ method: entiteit + '.get', params: [[{ field: veld, operator: 'equals', value: Number(nr) }], { paging: { firstresult: 0, maxresults: 1 } }], id: 1 }]);
    const rij = o?.result?.rows?.[0];
    const cid = rij?.company?.id || rij?.company;
    if (!cid) continue;
    const [c] = await gripp([{ method: 'company.get', params: [[{ field: 'company.id', operator: 'equals', value: cid }], { paging: { firstresult: 0, maxresults: 1 } }], id: 2 }]);
    const em = c?.result?.rows?.[0]?.email;
    if (geldigEmail(em)) return em.trim().toLowerCase();
  }
  return null;
}

async function alleAfgerondeMontages() {
  let after = null, uit = [];
  for (let n = 0; n < 60; n++) {
    const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const jobs = d.jobs || [];
    if (!jobs.length) break;
    for (const j of jobs) if (j.status === 'finished' && /montage/i.test(j.template_name || '')) uit.push(j);
    after = d.next_page || d.after || jobs.at(-1).uuid;
  }
  return uit;
}

(async () => {
  const rp = JSON.parse(fs.readFileSync(RP, 'utf8'));
  const byTel = {};
  for (const r of rp) { const t = normTel(r.telefoon); if (t && geldigEmail(r.email) && !byTel[t]) byTel[t] = r.email.trim().toLowerCase(); }

  const eersteRun = !fs.existsSync(STAAT);
  const staat = eersteRun ? { perJob: {}, perEmail: {} } : JSON.parse(fs.readFileSync(STAAT, 'utf8'));
  const vandaag = new Date().toISOString().slice(0, 10);

  const jobs = await alleAfgerondeMontages();
  const nieuw = jobs.filter((j) => !staat.perJob[j.uuid]);
  log(`${jobs.length} afgeronde montages in Planado, ${nieuw.length} nog niet verwerkt${eersteRun ? ' (EERSTE RUN = nulmeting voor alles vóór vandaag)' : ''}${DRY ? ' [DRY]' : ''}`);

  let gestuurd = 0;
  for (const j of nieuw) {
    const det = await (await planadoFetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json();
    const x = det.job || det;
    const klaarOp = x.timestamps?.finished_at || null;
    const grippNr = (String(x.description || '').match(/Gripp:\s*(\d+)/i) || [])[1] || null;
    const naam = (String(x.description || '').match(/Montage Sonty - ([^(\n]+)/) || [])[1]?.trim() || x.client?.name || '?';
    const gereed = werkGereed(x.report_fields);
    const kop = `#${x.serial_no} ${naam} (Gripp ${grippNr || '-'}) klaar ${String(klaarOp || '').slice(0, 10)}`;

    if (!klaarOp) { staat.perJob[j.uuid] = { op: vandaag, uitkomst: 'geen finished_at' }; log(`  overslaan ${kop}: geen finished_at`); continue; }
    if (eersteRun && klaarOp.slice(0, 10) < vandaag) { staat.perJob[j.uuid] = 'nulmeting'; continue; }
    if (gereed.status === 'nee') { staat.perJob[j.uuid] = { op: vandaag, uitkomst: 'werk niet gereed → geen event' }; log(`  GEEN event ${kop}: werkbon zegt NIET GEREED`); continue; }

    const contactMail = (x.contacts || []).find((c) => c.type === 'email' && geldigEmail(c.value))?.value?.trim().toLowerCase();
    const tel = (x.contacts || []).map((c) => normTel(c.value)).find(Boolean);
    let bron = 'planado';
    let email = contactMail;
    if (!email && tel && byTel[tel]) { email = byTel[tel]; bron = 'telefoon→rp'; }
    if (!email) { email = await grippEmail(grippNr); bron = 'gripp'; }
    if (!email) { staat.perJob[j.uuid] = { op: vandaag, uitkomst: 'geen e-mail gevonden' }; log(`  GEEN e-mail ${kop} (tel ${tel || '-'}) — handmatig`); continue; }

    const eerder = staat.perEmail[email];
    if (eerder && (Date.parse(klaarOp) - Date.parse(eerder)) < DEDUPE_DAGEN * 864e5) {
      staat.perJob[j.uuid] = { op: vandaag, uitkomst: `dubbel binnen ${DEDUPE_DAGEN} dagen (${email}, eerder ${eerder})` };
      log(`  overslaan ${kop}: ${email} had al een montage-event op ${eerder}`); continue;
    }

    if (DRY) { log(`  DRY zou sturen: ${kop} → ${email} [${bron}] gereed=${gereed.status}`); continue; }
    const res = await fetch('https://a.klaviyo.com/api/events/', {
      method: 'POST',
      headers: { Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`, revision: '2024-10-15', 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ data: { type: 'event', attributes: {
        metric: { data: { type: 'metric', attributes: { name: 'Montage afgerond' } } },
        profile: { data: { type: 'profile', attributes: { email } } },
        time: klaarOp,
        properties: { gripp: grippNr, planado_serial: x.serial_no, werk_gereed: gereed.status, bron_email: bron },
        unique_id: 'montage-' + j.uuid,
      } } }),
    });
    if (res.ok || res.status === 202) {
      staat.perJob[j.uuid] = { op: vandaag, uitkomst: `event → ${email} [${bron}]` };
      staat.perEmail[email] = klaarOp;
      gestuurd++;
      log(`  event: ${kop} → ${email} [${bron}]`);
    } else log(`  FOUT ${kop}: ${res.status} ${(await res.text()).slice(0, 120)}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!DRY) fs.writeFileSync(STAAT, JSON.stringify(staat, null, 1));
  log(`Klaar: ${gestuurd} event(s) gestuurd.`);
})().catch((e) => { log('FOUT: ' + e.message); process.exit(1); });
