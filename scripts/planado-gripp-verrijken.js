#!/usr/bin/env node
// Gripp-info in de Planado-inmeetopdrachten (Daimy 2026-08-05: "ze moeten precies
// weten wat ze gaan inmeten").
//
// Sleutel-ladder (overlegd met Daimy):
// 1. POSTCODE + HUISNUMMER uit het adres van de opdracht (87% dekking) — dit is
//    letterlijk waar gemeten wordt. Bij meerdere Gripp-kaarten op één adres wint
//    degene met de nieuwste offerte.
// 2. Telefoonnummer als vangnet (laatste 9 cijfers, phone én mobile, LIKE — Gripp
//    bewaart formaten door elkaar).
// 3. Twijfel (geen match, of match zonder offerte) = NIET koppelen, wel melden.
//
// In de opdracht komt: "Gripp: <nr>", de productregels compact, en de meetbon-link.
// Skipt alles wat al "Gripp:" in de omschrijving heeft. DRY-RUN zonder --execute.
const fs = require('fs');
const path = require('path');

const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const GRIPP_KEY = require('./secrets.js').GRIPP_API_KEY;
const PH = { Authorization: 'Bearer ' + PLANADO_KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const EXECUTE = process.argv.includes('--execute');
const INMETERS = {
  '1f122cfa-17a2-6580-8257-7e80f004db9c': 'Joey',
  '1f122d19-e43e-6da0-8ffb-661a4ff9bb36': 'Sjoerd',
};
const INMEET_TYPE = '1f11c802-6340-6680-9d06-7e73cee772e4';
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function gripp(method, params) {
  const r = await fetch('https://api.gripp.com/public/api3.php', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + GRIPP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ method, params, id: 1 }]),
  });
  return (await r.json())?.[0]?.result;
}

/** Postcode + huisnummer uit een vrij adresveld. */
function adresSleutel(adres) {
  const pc = (String(adres || '').match(/(\d{4})\s*([A-Za-z]{2})/) || [])[0];
  if (!pc) return null;
  const zonderPc = String(adres).replace(pc, ' ');
  const nr = (zonderPc.match(/\b(\d{1,4})\b/) || [])[1];
  if (!nr) return null;
  return { pc: pc.replace(/\s/g, '').toUpperCase(), nr };
}

/** Nieuwste offerte van een Gripp-klant, of null. */
async function nieuwsteOfferte(companyId) {
  const res = await gripp('offer.get', [
    [{ field: 'offer.company', operator: 'equals', value: companyId }],
    { paging: { firstresult: 0, maxresults: 1 }, orderings: [{ field: 'offer.id', direction: 'desc' }] },
  ]);
  return res?.rows?.[0] || null;
}

/** Klant zoeken: adres eerst, telefoon als vangnet. Geeft {company, offerte} of null. */
async function zoekKlant(adres, telefoon) {
  let kandidaten = [];
  const sleutel = adresSleutel(adres);
  if (sleutel) {
    const res = await gripp('company.get', [
      [
        { field: 'company.visitingaddress_zipcode', operator: 'like', value: `%${sleutel.pc.slice(0, 4)}%${sleutel.pc.slice(4)}%` },
        { field: 'company.visitingaddress_streetnumber', operator: 'like', value: `${sleutel.nr}%` },
      ],
      { paging: { firstresult: 0, maxresults: 5 } },
    ]);
    kandidaten = res?.rows || [];
    await wacht(1600);
  }
  if (!kandidaten.length && telefoon) {
    const kaal = String(telefoon).replace(/\D/g, '').slice(-9);
    if (kaal.length === 9) {
      for (const veld of ['phone', 'mobile']) {
        const res = await gripp('company.get', [
          [{ field: `company.${veld}`, operator: 'like', value: `%${kaal}%` }],
          { paging: { firstresult: 0, maxresults: 5 } },
        ]);
        kandidaten.push(...(res?.rows || []));
        await wacht(1600);
      }
      kandidaten = [...new Map(kandidaten.map((k) => [k.id, k])).values()];
    }
  }
  if (!kandidaten.length) return null;

  // Meerdere kaarten op één adres (bv. bewoner + BV): degene met de nieuwste offerte wint.
  let beste = null;
  for (const k of kandidaten) {
    const o = await nieuwsteOfferte(k.id);
    await wacht(1600);
    if (o && (!beste || o.id > beste.offerte.id)) beste = { company: k, offerte: o };
  }
  return beste; // null als geen enkele kandidaat een offerte heeft
}

/** Compacte productregels voor in de opdracht-omschrijving. */
function productRegels(offerte) {
  const NIET = /montage|heffing|toeslag|korting|actie|transport|totaal|btw|afstandsbediening|wandschakelaar|smoove|tahoma/i;
  const regels = [];
  for (const l of offerte.offerlines || []) {
    const naam = String(l.product?.searchname || '').replace(/\s*\(\d+\)\s*$/, '').trim();
    if (!naam || NIET.test(naam)) continue;
    const tekst = String(l.description || '').replace(/<[^>]+>/g, ' ');
    const b = (tekst.match(/Breedte:\s*(\d+)/i) || [])[1];
    const h = (tekst.match(/(?:Hoogte|Uitval):\s*(\d+)/i) || [])[1];
    const kleur = (tekst.match(/Kleur[^:]*:\s*([^\n]{2,25}?)(?:\s+[A-Z][a-z]+:|$)/) || [])[1];
    const maat = b && h ? ` ${b}×${h}` : b ? ` ${b} breed` : '';
    regels.push(`${l.amount || 1}x ${naam}${maat}${kleur ? ` — ${kleur.trim()}` : ''}`);
  }
  return regels;
}

async function main() {
  console.log(EXECUTE ? '=== VERRIJKEN (echt) ===' : '=== DRY-RUN (--execute om echt te schrijven) ===');

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
  const doel = jobs.filter((j) =>
    j.scheduled_at && Date.parse(j.scheduled_at) > nu &&
    INMETERS[j.assignee?.worker_uuid] && j.type_uuid === INMEET_TYPE,
  );
  console.log(`${doel.length} toekomstige inmeet-opdrachten van Joey/Sjoerd`);

  let verrijkt = 0, alGoed = 0, nietGekoppeld = 0, fouten = 0;
  const nietLijst = [];

  for (const j of doel) {
    const det = await (await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json();
    const job = det.job || det;
    await wacht(2600);
    if (/Gripp:\s*\d/.test(job.description || '')) { alGoed++; continue; }

    const adres = job.address?.formatted || '';
    const tel = (job.contacts || []).find((c) => c.type === 'phone' && c.value && c.value !== '-')?.value;
    const klantregel = (job.description || '').split('\n')[0];

    const match = await zoekKlant(adres, tel);
    if (!match) {
      nietGekoppeld++;
      nietLijst.push(`${job.serial_no} ${klantregel.slice(0, 40)}`);
      continue;
    }
    const nr = match.offerte.number;
    const regels = productRegels(match.offerte);
    console.log(`  + #${job.serial_no} ${klantregel.slice(0, 34)} -> Gripp ${nr} (${match.company.searchname.slice(0, 24)}): ${regels.length} product(en)`);
    verrijkt++;
    if (EXECUTE) {
      const nieuw = `${job.description || ''}\n\nGripp: ${nr}\nIN TE METEN:\n${regels.map((r) => '- ' + r).join('\n') || '- (geen productregels gevonden — check offerte)'}\n\nMEETBON (invullen op telefoon):\nhttps://sonty-website.vercel.app/admin/meetbon/${nr}`;
      const r = await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, {
        method: 'PATCH', headers: PH,
        body: JSON.stringify({ version: job.version, description: nieuw }),
      });
      if (!r.ok) { fouten++; console.log(`    FOUT ${r.status}`); }
      await wacht(2600);
    }
  }

  console.log(`\nverrijkt: ${verrijkt} | had al Gripp-info: ${alGoed} | niet te koppelen: ${nietGekoppeld} | fouten: ${fouten}`);
  if (nietLijst.length) console.log('NIET GEKOPPELD:\n  ' + nietLijst.join('\n  '));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
