#!/usr/bin/env node
// Gripp-info in de Planado-inmeetopdrachten (Daimy 2026-08-05: "ze moeten precies
// weten wat ze gaan inmeten").
//
// Sleutel-ladder (overlegd met Daimy):
// 1. POSTCODE + HUISNUMMER uit het adres van de opdracht (87% dekking) — dit is
//    letterlijk waar gemeten wordt. Bij meerdere Gripp-kaarten op één adres wint
//    degene met de nieuwste offerte.
// 2. STRAAT + HUISNUMMER als de postcode ontbreekt (Outlook-locaties zijn vaak
//    "Aalbersestraat 41 Naaldwijk" zonder postcode — Daimy 05-08 Mariska Bo(o)gaard).
// 3. Telefoonnummer als vangnet (laatste 9 cijfers, phone én mobile, LIKE — Gripp
//    bewaart formaten door elkaar).
// 3. Naam als laatste vangnet (Daimy 05-08 "alles moet gewoon bij iedereen ingevuld
//    staan"): achternaam-zoek in Gripp, alleen koppelen bij PRECIES één kandidaat
//    wiens naam als geheel woord in de opdrachtnaam voorkomt (of andersom).
// 4. Twijfel (geen match, of match zonder offerte) = NIET koppelen, wel melden.
//
// In de opdracht komt: "Gripp: <nr>", de productregels compact, en de meetbon-link.
// Skipt alles wat al "Gripp:" in de omschrijving heeft. DRY-RUN zonder --execute.
const fs = require('fs');
const path = require('path');

const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const GRIPP_KEY = require('./secrets.js').GRIPP_API_KEY;
const PH = { Authorization: 'Bearer ' + PLANADO_KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const EXECUTE = process.argv.includes('--execute');
const VERVERS = process.argv.includes('--ververs'); // bestaande In te meten-velden opnieuw uit Gripp opbouwen (bv. na formatwijziging)
const INMETERS = {
  '1f122cfa-17a2-6580-8257-7e80f004db9c': 'Joey',
  '1f122d19-e43e-6da0-8ffb-661a4ff9bb36': 'Sjoerd',
};
const TYPES = {
  inmeet: '1f11c802-6340-6680-9d06-7e73cee772e4',
  montage: '1f11c802-634b-6ef0-9d06-7e73cee772e4',
  winkel: '1f11c89f-35be-6820-831b-1d2c28c9b53e',
  default: '1f11c802-6337-6970-9d06-7e73cee772e4',
};
// Planado NEGEERT type_uuid bij POST (stil!); alleen PATCH werkt. Daarom repareert
// deze pas ook meteen de types van alle gesyncte opdrachten.
function soortUit(description) {
  const s = String(description || '').toLowerCase();
  if (/inmeet|inmeten/.test(s)) return 'inmeet';
  if (/montage/.test(s)) return 'montage';
  if (/winkel|showroom|telefonisch/.test(s)) return 'winkel';
  return 'default';
}
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

// Planado-inputvelden zijn max 200 tekens: hele productregels laten staan en de rest
// als "+N meer" — de volledige lijst staat altijd in de omschrijving.
function kortVeld(tekst) {
  if (String(tekst || '').length <= 200) return tekst;
  const delen = String(tekst).split(' · ');
  for (let n = delen.length - 1; n >= 1; n--) {
    const kandidaat = delen.slice(0, n).join(' · ') + ` · +${delen.length - n} meer (zie omschrijving)`;
    if (kandidaat.length <= 200) return kandidaat;
  }
  return String(tekst).slice(0, 170) + '… (zie omschrijving)';
}

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

/** Straatnaam + huisnummer uit een adres zonder postcode ("Aalbersestraat 41 Naaldwijk"). */
function straatSleutel(adres) {
  const m = String(adres || '').match(/^\s*([\p{L} .'-]{5,}?)\s+(\d{1,4})(?!\d)/u); // (?!\d) i.p.v. \b: huisletter "12a" telt ook
  if (!m) return null;
  return { straat: m[1].trim(), nr: m[2] };
}

/** Nieuwste offerte van een Gripp-klant, of null. */
async function nieuwsteOfferte(companyId) {
  const res = await gripp('offer.get', [
    [{ field: 'offer.company', operator: 'equals', value: companyId }],
    { paging: { firstresult: 0, maxresults: 1 }, orderings: [{ field: 'offer.id', direction: 'desc' }] },
  ]);
  return res?.rows?.[0] || null;
}

/** Achternaam-vangnet: langste naamwoord zoeken, alleen bij 1 ondubbelzinnige hit. */
async function zoekOpNaam(klantnaam) {
  const RUIS = /^(de|den|der|van|het|ten|ter|heer|mevrouw|mevr|dhr|en|winkel|familie|fam)$/i;
  const woorden = String(klantnaam || '').replace(/[^\p{L} ]/gu, ' ').split(/\s+/)
    .filter((w) => w.length >= 4 && !RUIS.test(w))
    .sort((a, b) => b.length - a.length);
  if (!woorden.length) return null;
  // Probeer de 2 langste woorden apart: "Arold Borger, Wittgensteinlaan" moet via
  // Borger matchen, niet stranden op het adresdeel in de naam.
  let rows = [];
  for (const woord of woorden.slice(0, 2)) {
    const res = await gripp('company.get', [
      [{ field: 'company.searchname', operator: 'like', value: `%${woord}%` }],
      { paging: { firstresult: 0, maxresults: 5 } },
    ]);
    await wacht(1600);
    rows = res?.rows || [];
    if (rows.length) break;
  }
  // Ondubbelzinnig = precies één kaart waarvan de volledige naam wederzijds past
  const past = rows.filter((k) => {
    const kn = String(k.searchname || '').toLowerCase();
    const on = String(klantnaam || '').toLowerCase();
    const kw = kn.replace(/[^\p{L} ]/gu, ' ').split(/\s+/).filter((w) => w.length >= 4 && !RUIS.test(w));
    const ow = on.replace(/[^\p{L} ]/gu, ' ').split(/\s+/).filter((w) => w.length >= 4 && !RUIS.test(w));
    return kw.length && ow.length && (kw.every((w) => on.includes(w)) || ow.every((w) => kn.includes(w)));
  });
  if (past.length === 1) return past;
  if (past.length > 1) {
    // Meerdere verwante kaarten ("Jan Testman" + "Testman BV"/"Jan Testmans"): als
    // precies één kaartnaam letterlijk het begin van de opdrachtnaam is, is dát hem.
    const plat = (x) => String(x || '').toLowerCase().replace(/[^\p{L} ]/gu, ' ').replace(/\s+/g, ' ').trim();
    const exactBegin = past.filter((k) => plat(klantnaam).startsWith(plat(k.searchname)));
    if (exactBegin.length === 1) return exactBegin;
  }
  return null;
}

/** Klant zoeken: adres eerst, telefoon als vangnet, naam als laatste redmiddel. */
async function zoekKlant(adres, telefoon, klantnaam) {
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
  if (!kandidaten.length) {
    const st = straatSleutel(adres);
    if (st) {
      const res = await gripp('company.get', [
        [
          { field: 'company.visitingaddress_street', operator: 'like', value: `%${st.straat}%` },
          { field: 'company.visitingaddress_streetnumber', operator: 'like', value: `${st.nr}%` },
        ],
        { paging: { firstresult: 0, maxresults: 5 } },
      ]);
      kandidaten = res?.rows || [];
      await wacht(1600);
    }
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
  if (!kandidaten.length && klantnaam) {
    let opNaam = (await zoekOpNaam(klantnaam)) || [];
    // Scenario-lab 06-08: een naam-match mag een TEGENSPREKEND adres nooit overrulen —
    // zelfde naam op een ander adres is vaker een andere persoon dan een verhuizing.
    // Kaart zonder adres (zoals Jeanette de Jong) blijft gewoon toegestaan.
    const pcJob = adresSleutel(adres)?.pc;
    const stJob = straatSleutel(adres)?.straat?.toLowerCase();
    opNaam = opNaam.filter((k) => {
      const pcKaart = String(k.visitingaddress_zipcode || '').replace(/\s/g, '').toUpperCase();
      if (pcJob && pcKaart) return pcKaart === pcJob;
      const straatKaart = String(k.visitingaddress_street || '').toLowerCase();
      if (stJob && straatKaart) return straatKaart.includes(stJob);
      return true;
    });
    kandidaten = opNaam;
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
    const ruw = String(l.description || '');
    const tekst = ruw.replace(/<[^>]+>/g, ' ');
    const b = (tekst.match(/Breedte:\s*(\d+)/i) || [])[1];
    const h = (tekst.match(/(?:Hoogte|Uitval):\s*(\d+)/i) || [])[1];
    // kleur + bediening (Daimy 05-08: "ik wil het product maar ook de bediening
    // weten en de kleur") — regels per \n lezen, Gripp bewaart de RP-specs zo
    const perRegel = (label) => (ruw.replace(/<[^>]+>/g, '\n').match(new RegExp(label + ':\\s*([^\\n]{2,40})', 'i')) || [])[1]?.trim();
    const kleur = [perRegel('Frame Kleur'), perRegel('Kleur Pantser') || perRegel('Doekkleur') || perRegel('Kleur doek') || perRegel('Kleur')]
      .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' / ');
    const bediening = perRegel('Bediening');
    const maat = b && h ? ` ${b}×${h}` : b ? ` ${b} breed` : '';
    const extra = [kleur, bediening].filter(Boolean).join(' — ');
    regels.push(`${l.amount || 1}x ${naam}${maat}${extra ? ` — ${extra}` : ''}`);
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
    j.scheduled_at && Date.parse(j.scheduled_at) > nu && INMETERS[j.assignee?.worker_uuid],
  );
  console.log(`${doel.length} toekomstige opdrachten van Joey/Sjoerd (types repareren + inmeet verrijken)`);

  let verrijkt = 0, typeFix = 0, alGoed = 0, nietGekoppeld = 0, fouten = 0;
  const nietLijst = [];

  for (const j of doel) {
    const det = await (await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json();
    const job = det.job || det;
    await wacht(2600);

    const soort = soortUit(job.description);
    const patch = {};
    if (job.type_uuid !== TYPES[soort]) { patch.type_uuid = TYPES[soort]; typeFix++; }

    const heeftGripp = /Gripp:\s*\d/.test(job.description || '');
    const klantregel = (job.description || '').split('\n')[0];

    // Detailvelden (Daimy 05-08): 'Meetbon' als tikbare link (field_type 'link') en
    // 'In te meten' als tekstveld (field_type 'input') zodat de producten in één
    // oogopslag zichtbaar zijn. PATCH vervangt de hele array, dus bestaande velden
    // altijd meesturen. Ook met terugwerkende kracht op jobs die al een Gripp-blok
    // in de omschrijving hebben.
    const veldenVoor = (nr, producten) => {
      producten = kortVeld(producten);
      const bestaand = (job.custom_fields || []).map((f) => ({ name: f.name, field_type: f.field_type, value: f.value }));
      const zet = (naam, field_type, value) => {
        const i = bestaand.findIndex((f) => f.name === naam);
        if (i >= 0) bestaand[i] = { name: naam, field_type, value };
        else bestaand.push({ name: naam, field_type, value });
      };
      zet('In te meten', 'input', producten);
      zet('Meetbon', 'link', `https://sonty-website.vercel.app/admin/meetbon/${nr}`);
      return bestaand;
    };
    if (heeftGripp) {
      const nr = (job.description.match(/Gripp:\s*(\d+)/) || [])[1];
      const veldOntbreekt = !['Meetbon', 'In te meten'].every((n) => (job.custom_fields || []).some((f) => f.name === n && f.value));
      if (nr && (veldOntbreekt || VERVERS)) {
        let blok = null;
        if (VERVERS && soort === 'inmeet') {
          // vers uit Gripp zodat kleur + bediening in het veld komen
          const res = await gripp('offer.get', [
            [{ field: 'offer.number', operator: 'equals', value: Number(nr) }],
            { paging: { firstresult: 0, maxresults: 1 } },
          ]);
          await wacht(1600);
          const off = res?.rows?.[0];
          if (off) blok = productRegels(off).join(' · ');
        }
        if (!blok) blok = (job.description.split('IN TE METEN:')[1] || '').split('MEETBON')[0]
          .split('\n').map((r) => r.replace(/^\s*-\s*/, '').trim()).filter(Boolean).join(' · ');
        const huidig = (job.custom_fields || []).find((f) => f.name === 'In te meten')?.value || '';
        if (veldOntbreekt || (blok && kortVeld(blok) !== huidig)) patch.custom_fields = veldenVoor(nr, blok || 'zie omschrijving');
      }
    }

    if (soort === 'inmeet' && !heeftGripp) {
      const adres = job.address?.formatted || '';
      const tel = (job.contacts || []).find((c) => c.type === 'phone' && c.value && c.value !== '-')?.value;
      const klantnaam = klantregel.replace(/^Inmeten Sonty - /, '').trim();
      const match = await zoekKlant(adres, tel, /joey\s*winkel|^winkel/i.test(klantnaam) ? null : klantnaam);
      if (match) {
        const nr = match.offerte.number;
        const regels = productRegels(match.offerte);
        console.log(`  + #${job.serial_no} ${klantregel.slice(0, 34)} -> Gripp ${nr} (${match.company.searchname.slice(0, 24)}): ${regels.length} product(en)`);
        verrijkt++;
        patch.description = `${job.description || ''}\n\nGripp: ${nr}\nIN TE METEN:\n${regels.map((r) => '- ' + r).join('\n') || '- (geen productregels gevonden — check offerte)'}\n\nMEETBON (invullen op telefoon):\nhttps://sonty-website.vercel.app/admin/meetbon/${nr}`;
        patch.custom_fields = veldenVoor(nr, regels.join(' · ') || 'zie omschrijving');
      } else {
        nietGekoppeld++;
        nietLijst.push(`${job.serial_no} ${klantregel.slice(0, 40)}`);
      }
    } else if (heeftGripp) alGoed++;

    if (EXECUTE && Object.keys(patch).length) {
      const r = await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, {
        method: 'PATCH', headers: PH,
        body: JSON.stringify({ version: job.version, ...patch }),
      });
      if (!r.ok) { fouten++; console.log(`    FOUT ${r.status}: ${(await r.text()).slice(0, 100)}`); }
      await wacht(2600);
    }
  }

  console.log(`\nverrijkt: ${verrijkt} | type gefixt: ${typeFix} | had al Gripp-info: ${alGoed} | niet te koppelen: ${nietGekoppeld} | fouten: ${fouten}`);
  if (nietLijst.length) console.log('NIET GEKOPPELD:\n  ' + nietLijst.join('\n  '));
}

module.exports = { zoekKlant, productRegels, TYPES, soortUit, adresSleutel, straatSleutel, kortVeld };
if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
