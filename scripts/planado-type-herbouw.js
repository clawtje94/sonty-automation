#!/usr/bin/env node
// Types in Planado goedzetten (Daimy: "er staat 'opdracht' maar daar moet inmeting
// komen te staan"). Type/sjabloon kunnen ALLEEN bij aanmaken gezet worden — de
// publieke API negeert type_uuid op POST én PATCH stil, en de bewerk-modal heeft
// geen typeveld. Enige route: het interne web-endpoint (cookie-login) waarmee de
// app zelf aanmaakt. Daarom herbouwt dit script elke toekomstige Joey/Sjoerd-
// opdracht met verkeerd type: intern aanmaken MET type (+ inmeet-sjabloon) →
// detailvelden terugzetten → verifiëren → pas daarna de oude verwijderen.
// external_id verhuist mee zodat de Outlook-sync-dedup blijft werken.
// Volgnummers veranderen hierdoor (onvermijdelijk). DRY-RUN zonder --execute.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + PLANADO_KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const EXECUTE = process.argv.includes('--execute');
const INMETERS = {
  '1f122cfa-17a2-6580-8257-7e80f004db9c': 'Joey',
  '1f122d19-e43e-6da0-8ffb-661a4ff9bb36': 'Sjoerd',
};
const TYPES = {
  inmeet: '1f11c802-6340-6680-9d06-7e73cee772e4',
  montage: '1f11c802-634b-6ef0-9d06-7e73cee772e4',
  winkel: '1f11c89f-35be-6820-831b-1d2c28c9b53e',
};
const TEMPLATE_INMEET = '1f11c802-65cd-6aa0-9d06-7e73cee772e4';
function soortUit(description) {
  const s = String(description || '').toLowerCase();
  if (/inmeet|inmeten/.test(s)) return 'inmeet';
  if (/montage/.test(s)) return 'montage';
  if (/winkel|showroom|telefonisch/.test(s)) return 'winkel';
  return null; // onbekend = niet aankomen
}
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(EXECUTE ? '=== HERBOUW (echt) ===' : '=== DRY-RUN (--execute om echt te herbouwen) ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://sonty.planadoapp.com/login', { waitUntil: 'networkidle', timeout: 45000 });
  await page.getByPlaceholder('E-mail').fill('daimy@sonty.nl');
  await page.getByPlaceholder('Wachtwoord').fill('^XU6C&SuS*FFnb');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 45000 });

  const intern = (methode, pad, body) => page.evaluate(async ({ methode, pad, body }) => {
    const r = await fetch(pad, {
      method: methode,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Planado-Notify-Assignees': 'false' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let json = null;
    try { json = await r.json(); } catch {}
    return { status: r.status, json };
  }, { methode, pad, body });

  // alle toekomstige Joey/Sjoerd-opdrachten via de publieke API
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
  console.log(doel.length + ' toekomstige opdrachten van Joey/Sjoerd');

  let herbouwd = 0, alGoed = 0, overgeslagen = 0, fouten = 0;
  for (const j of doel) {
    const { status: gs, json: oud } = await intern('GET', '/jobs/' + j.uuid);
    await wacht(600);
    if (gs !== 200 || !oud) { fouten++; console.log('  GET-fout op #' + j.serial_no); continue; }
    const soort = soortUit(oud.description);
    if (!soort) { overgeslagen++; continue; }
    if (oud.type_uuid === TYPES[soort]) { alGoed++; continue; }
    const kop = String(oud.description || '').split('\n')[0].slice(0, 40);
    console.log(`  ~ #${j.serial_no} [${soort}] ${kop}`);
    herbouwd++;
    if (!EXECUTE) continue;

    // 1. nieuwe opdracht met juist type (en voor inmeet ook het sjabloon)
    const workers = oud.assignees?.workers || [];
    const body = {
      status: 'posted',
      type_uuid: TYPES[soort],
      ...(soort === 'inmeet' ? { template_uuid: TEMPLATE_INMEET } : {}),
      description: oud.description || '',
      scheduled_at: oud.scheduled_at,
      scheduled_duration: oud.scheduled_duration || 3600,
      assignees: workers.map((w) => ({ uuid: w.uuid, type: 'user', access: w.access || 'view' })),
      address: oud.address ? { formatted: oud.address.formatted, apartment: oud.apartment, floor: oud.floor, entrance_no: oud.entrance_no } : undefined,
      contacts: (oud.contacts || []).filter((c) => c.value),
      external_id: oud.external_id || undefined,
      priority: 'normal',
      report_fields: [], custom_fields: [], skill_uuids: [], ordered_services: [], provided_services: [], used_materials: [],
    };
    // external_id is uniek en kan ALLEEN bij create gezet worden (publiek én intern
    // PATCH negeren hem) → oude eerst weg, dan nieuwe mét extId. Reddingsbestand
    // vooraf zodat een klap halverwege nooit een opdracht kan kosten.
    const oudeVelden = (j.custom_fields || (await (await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json())?.job?.custom_fields || []);
    await wacht(2600);
    const velden = oudeVelden.filter((f) => f.value).map((f) => ({ name: f.name, field_type: f.field_type, value: f.value }));
    fs.appendFileSync(path.join(__dirname, '..', 'data', 'herbouw-rescue.jsonl'),
      JSON.stringify({ serial: j.serial_no, uuid: j.uuid, oud, velden }) + '\n');

    const { status: ds } = await intern('DELETE', '/jobs/' + j.uuid);
    await wacht(600);
    if (ds !== 200) { fouten++; console.log(`    DELETE-fout ${ds} op #${j.serial_no} — overslaan`); continue; }

    let nieuw = null;
    for (let poging = 1; poging <= 3 && !nieuw; poging++) {
      const { status: cs, json: res } = await intern('POST', '/jobs', body);
      await wacht(600);
      if (cs === 201 && res?.uuid) nieuw = res;
      else console.log(`    CREATE-poging ${poging} fout ${cs}: ${JSON.stringify(res).slice(0, 120)}`);
    }
    if (!nieuw) {
      // laatste redmiddel: terugzetten zonder type zodat de afspraak nooit verdwijnt
      const { status: hs, json: herstel } = await intern('POST', '/jobs', { ...body, type_uuid: undefined, template_uuid: undefined });
      fouten++;
      console.log(`    HERSTEL zonder type: ${hs} ${JSON.stringify(herstel).slice(0, 80)} — zie data/herbouw-rescue.jsonl`);
      continue;
    }

    {
      // interne create NEGEERT address stil (ontdekt 06-08: 164 jobs zonder adres!)
      // → adres én velden altijd via de publieke PATCH nazetten
      const det = await (await fetch('https://api.planadoapp.com/v2/jobs/' + nieuw.uuid, { headers: PH })).json();
      const nh = det.job || det;
      await wacht(2600);
      const patch = { version: nh.version };
      if (velden.length) patch.custom_fields = velden;
      if (oud.address?.formatted) patch.address = { formatted: oud.address.formatted, apartment: oud.apartment, floor: oud.floor, entrance_no: oud.entrance_no };
      const pr = await fetch('https://api.planadoapp.com/v2/jobs/' + nieuw.uuid, {
        method: 'PATCH', headers: PH, body: JSON.stringify(patch),
      });
      await wacht(2600);
      if (!pr.ok) { console.log(`    na-PATCH ${pr.status} op nieuwe #${nieuw.serial_no}`); }
    }

    const { json: check } = await intern('GET', '/jobs/' + nieuw.uuid);
    await wacht(600);
    const goed = check && check.type_uuid === TYPES[soort]
      && Date.parse(check.scheduled_at) === Date.parse(oud.scheduled_at)
      && (check.assignees?.workers || []).length === workers.length
      && check.external_id === oud.external_id
      && (!oud.address?.formatted || !!check.address?.formatted);
    console.log(`    #${j.serial_no} -> #${nieuw.serial_no} (${soort}) ${goed ? 'OK' : 'CHECK-AFWIJKING — nakijken!'}`);
    if (!goed) fouten++;
  }
  console.log(`\nherbouwd: ${herbouwd} | type was al goed: ${alGoed} | onbekend soort overgeslagen: ${overgeslagen} | fouten: ${fouten}`);
  await browser.close();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
