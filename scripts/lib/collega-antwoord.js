/**
 * READ-ONLY WHATSAPP-ASSISTENT VOOR COLLEGA'S (Daimy 19-08): alleen Joey en Sjoerd mogen
 * Sunny appen met vragen ("wat is het telefoonnummer van gripp offerte 4676", "welk adres
 * heeft ..."); Sunny antwoordt met feiten uit Gripp (alleen-lezen sleutel) en de
 * RP-export. ER WORDT NOOIT IETS AANGEPAST: de tools hieronder zijn uitsluitend
 * opzoek-functies, er bestaat hier geen enkele schrijf-route.
 */
const fs = require('fs');
const path = require('path');
const { GRIPP_API_KEY } = require('../secrets.js');

const ANTHROPIC_KEY = fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();

// ── wie heeft waar gemonteerd / wie staat wanneer gepland (Daimy 24-08) ─────────
// Bus-accounts in Planado → namen (zelfde indeling als cron-outlook-planado-sync.js).
const BUS_NAMEN = {
  '1f19ca1a-5a2d-66c0-8759-4e9ffeb6d4ca': 'Frenky & Dennis (bus 1)',
  '1f122f72-777f-6e80-8139-6e820cb7b164': 'Tygo & Kevin (bus 2)',
  '1f122f37-76db-68b0-9aad-4269fe2bbe9c': 'Yudi & Nick (bus 3)',
  '1f19ca1c-8ecb-6b90-8759-4e9ffeb6d4ca': 'Marvin (zzp) & Bart (bus 4)',
  '1f19ca1d-fec8-6e40-afc6-3674195d7c3f': 'Marvin & Moa (bus 5)',
  '1f19ca28-ce10-6130-8d3e-1253432d7d62': 'Arnold (service & binnenhuis, bus 6)',
  '1f122cfa-4eba-6810-9aad-4269fe2bbe9c': 'Nanny (binnenhuis/stoffering)',
  '1f122da2-8a5b-6c80-9ca9-72f9240343d3': 'Jorren',
  '1f122cfa-17a2-6580-8257-7e80f004db9c': 'Joey',
  '1f122d19-e43e-6da0-8ffb-661a4ff9bb36': 'Sjoerd',
};
const JOBS_CACHE = path.join(__dirname, '..', '..', 'data', 'planado-jobs-cache.json');

/** Cache verversen op de achtergrond als hij ouder is dan 12 uur (los proces, blokkeert niets). */
function ververfJobsCacheAls0ud() {
  try {
    const oud = !fs.existsSync(JOBS_CACHE) || Date.now() - JSON.parse(fs.readFileSync(JOBS_CACHE, 'utf8')).ts > 12 * 3600000;
    if (!oud) return false;
    const { spawn } = require('child_process');
    spawn(process.execPath, [path.join(__dirname, '..', 'planado-jobs-cache.js')], { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch { return false; }
}

/** Wie heeft/gaat er monteren, inmeten of service doen bij deze klant? Outlook (wanneer/wat) + Planado (welke bus/monteurs). */
async function wieBijKlant(zoekterm) {
  const z = String(zoekterm || '').toLowerCase().trim();
  if (z.length < 3) return { fout: 'zoekterm te kort' };
  const uit = { agenda: [], planado: [], cacheVerversen: false };
  // Outlook: agenda Sonty Montage, 1 jaar terug t/m 3 maanden vooruit
  try {
    const token = fs.readFileSync(path.join(__dirname, '..', '.owa-token.txt'), 'utf8').trim();
    const OH = { Authorization: 'Bearer ' + token };
    const cal = (((await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value) || []).find((c) => c.Name === 'Sonty Montage');
    const van = new Date(Date.now() - 365 * 86400000), tot = new Date(Date.now() + 92 * 86400000);
    let url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=500&$select=Subject,Start,End,IsCancelled&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
    while (url) {
      const j = await (await fetch(url, { headers: OH })).json();
      for (const e of (j.value || [])) {
        if (e.IsCancelled) continue;
        if (!String(e.Subject || '').toLowerCase().includes(z)) continue;
        uit.agenda.push({ wanneer: String(e.Start?.DateTime || '').slice(0, 16), wat: e.Subject });
      }
      url = j['@odata.nextLink'] || null;
    }
  } catch (e) { uit.agendaFout = String(e.message).slice(0, 80); }
  // Planado: cache doorzoeken op naam/adres → bus/monteurs
  try {
    const c = JSON.parse(fs.readFileSync(JOBS_CACHE, 'utf8'));
    for (const j of c.jobs || []) {
      if (!(String(j.omschrijving || '').toLowerCase().includes(z) || String(j.adres || '').toLowerCase().includes(z))) continue;
      uit.planado.push({ wanneer: String(j.scheduled_at || '').slice(0, 16), wie: BUS_NAMEN[j.assignee] || (j.assignee ? 'onbekend account' : 'niet toegewezen'), status: j.status, wat: String(j.omschrijving).split('\n')[0].slice(0, 90) });
    }
    uit.cacheStand = new Date(c.ts).toISOString().slice(0, 16) + ' (' + (c.jobs || []).length + ' opdrachten)';
  } catch { uit.planadoFout = 'opdrachten-administratie (nog) niet beschikbaar'; }
  uit.cacheVerversen = ververfJobsCacheAls0ud();
  uit.agenda.sort((a, b) => String(a.wanneer).localeCompare(b.wanneer));
  uit.planado.sort((a, b) => String(a.wanneer).localeCompare(b.wanneer));
  uit.agenda = uit.agenda.slice(-15); uit.planado = uit.planado.slice(-15);
  return uit;
}

async function grippCall(body) {
  const r = await fetch('https://api.gripp.com/public/api3.php', {
    method: 'POST', headers: { Authorization: 'Bearer ' + GRIPP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

/** Compacte productregels uit de Gripp-offerteregels (zelfde leeswijze als de Planado-verrijking). */
function productRegels(o) {
  const NIET = /heffing|toeslag|transport|totaal|btw/i;
  const uit = [];
  for (const l of o.offerlines || []) {
    const naam = String(l.product?.searchname || '').replace(/\s*\(\d+\)\s*$/, '').trim();
    if (!naam || NIET.test(naam)) continue;
    const ruw = String(l.description || '');
    const perRegel = (label) => (ruw.replace(/<[^>]+>/g, '\n').match(new RegExp(label + ':\\s*([^\\n]{1,60})', 'i')) || [])[1]?.trim();
    const b = perRegel('Breedte'), h = perRegel('Hoogte') || perRegel('Uitval');
    const kleur = [perRegel('Frame Kleur'), perRegel('Kleur Pantser') || perRegel('Doekkleur') || perRegel('Kleur doek') || perRegel('Kleur')].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' / ');
    const bediening = perRegel('Bediening'), motor = perRegel('Motor');
    const specs = [b && h ? `${b} x ${h}` : (b ? `${b} breed` : ''), kleur, bediening, motor].filter(Boolean).join(', ');
    const prijs = l.sellingprice != null ? ` (${Number(l.amount || 1)} x € ${Number(l.sellingprice).toFixed(2)} excl. btw)` : '';
    uit.push(`${Number(l.amount || 1)}x ${naam}${specs ? ': ' + specs : ''}${prijs}`);
  }
  return uit;
}

/** Concept-/offerte-PDF downloaden via Gripp's directe PDF-link (alleen-lezen). */
async function grippOffertePdf(nummer) {
  const j = await grippCall([{ method: 'offer.get', params: [[
    { field: 'offer.number', operator: 'equals', value: Number(nummer) }],
    { paging: { firstresult: 0, maxresults: 1 } }], id: 1 }]);
  const o = j?.[0]?.result?.rows?.[0];
  if (!o) return { gevonden: false };
  if (!o.directpdfurl) return { gevonden: true, pdf: false, reden: 'Gripp geeft geen PDF-link voor deze offerte' };
  const r = await fetch(o.directpdfurl);
  if (!r.ok) return { gevonden: true, pdf: false, reden: 'PDF-download gaf HTTP ' + r.status };
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.slice(0, 4).toString() !== '%PDF') return { gevonden: true, pdf: false, reden: 'geen geldige PDF terug' };
  const naam = `Offerte-${o.number}-${String(o.company?.searchname || 'klant').replace(/[^\w\-]+/g, '_').slice(0, 40)}.pdf`;
  const pad = path.join(require('os').tmpdir(), naam);
  fs.writeFileSync(pad, buf);
  return { gevonden: true, pdf: true, bestand: pad, naam, status: o.status?.searchname || o.status, klant: o.company?.searchname, bedragInclBtw: o.totalinclvat, bekijkOnline: o.viewonlineurl || null };
}

async function grippOfferte(nummer) {
  const j = await grippCall([{ method: 'offer.get', params: [[
    { field: 'offer.number', operator: 'equals', value: Number(nummer) }],
    { paging: { firstresult: 0, maxresults: 3 } }], id: 1 }]);
  const rows = j?.[0]?.result?.rows || [];
  if (!rows.length) return { gevonden: false };
  const uit = [];
  for (const o of rows) {
    const basis = {
      nummer: o.number, klant: o.company?.searchname, status: o.status?.searchname || o.status,
      bedragInclBtw: o.totalinclvat, gemaakt: o.createdon?.date, geaccepteerd: o.acceptedon?.date || null,
      onderwerp: o.subject || null,
      producten: productRegels(o),
      bekijkOnline: o.viewonlineurl || null,
    };
    if (o.company?.id) {
      const c = await grippCall([{ method: 'company.get', params: [[
        { field: 'company.id', operator: 'equals', value: o.company.id }],
        { paging: { firstresult: 0, maxresults: 1 } }], id: 1 }]);
      const bedrijf = c?.[0]?.result?.rows?.[0];
      if (bedrijf) {
        basis.telefoon = bedrijf.phone || null;
        basis.email = bedrijf.email || null;
        basis.adres = [bedrijf.visitingaddress_street, bedrijf.visitingaddress_streetnumber,
          bedrijf.visitingaddress_zipcode, bedrijf.visitingaddress_city].filter(Boolean).join(' ') || null;
        basis.contactpersoon = bedrijf.contact || null;
      }
    }
    uit.push(basis);
  }
  return { gevonden: true, offertes: uit };
}

function rpZoek(zoekterm) {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'email', 'rp-export.json'), 'utf8'));
  const lijst = Array.isArray(d) ? d : (d.rijen || d.data || []);
  const z = String(zoekterm).toLowerCase().trim();
  const hits = lijst.filter((r) =>
    String(r.offerteNummer) === z
    || `${r.voornaam} ${r.achternaam}`.toLowerCase().includes(z)
    || String(r.email || '').toLowerCase() === z
    || String(r.telefoon || '').replace(/\D/g, '').endsWith(z.replace(/\D/g, '') || 'x'));
  return hits.slice(0, 5).map((r) => ({
    naam: `${r.voornaam} ${r.achternaam}`.trim(), telefoon: r.telefoon || null, email: r.email,
    plaats: r.plaats || null, postcode: r.postcode || null, product: r.product,
    offerteNummer: r.offerteNummer, status: r.offerteStatus, bedrag: r.offerteBedrag,
    akkoord: r.heeftAkkoord === true, offerteLink: r.offerteLink,
    datum: r.offerteDatum ? new Date(Number(r.offerteDatum)).toISOString().slice(0, 10) : null,
  }));
}

const TOOLS = [
  { name: 'gripp_offerte', description: 'Zoek een Gripp-offerte op nummer (Gripp-nummers zijn meestal 4-5 cijfers). Geeft klant, telefoon, e-mail, adres, status, bedrag en de productregels (product, maten, kleur, bediening, motor, prijs).', input_schema: { type: 'object', properties: { nummer: { type: 'string' } }, required: ['nummer'] } },
  { name: 'gripp_offerte_pdf', description: 'Download de (concept)offerte-PDF van een Gripp-offerte op nummer zodat die als bijlage naar de collega gestuurd kan worden. Gebruik dit als de collega om de offerte/PDF/het document vraagt of "stuur maar door" zegt.', input_schema: { type: 'object', properties: { nummer: { type: 'string' } }, required: ['nummer'] } },
  { name: 'wie_bij_klant', description: 'Zoek op klantnaam of adres(deel) wie er bij die klant heeft gemonteerd/ingemeten/service gedaan of ingepland staat, en wanneer. Combineert de agenda (Sonty Montage, 1 jaar terug tot 3 maanden vooruit) met de Planado-opdrachten (welke bus/monteurs). Gebruik dit voor vragen als "wie heeft bij X gemonteerd?" of "wanneer staat Y gepland?".', input_schema: { type: 'object', properties: { zoekterm: { type: 'string' } }, required: ['zoekterm'] } },
  { name: 'rp_zoek', description: 'Zoek in de offerte-administratie (Reuzenpanda) op offertenummer (2026xxxx), klantnaam, e-mail of telefoonnummer. Geeft naam, telefoon, plaats, product, status en bedrag.', input_schema: { type: 'object', properties: { zoekterm: { type: 'string' } }, required: ['zoekterm'] } },
];

/** @returns {Promise<{tekst:string, bijlagen:Array<{bestand:string,naam:string}>}>} */
async function antwoordCollega(naam, vraag) {
  const berichten = [{ role: 'user', content: vraag }];
  const bijlagen = [];
  for (let ronde = 0; ronde < 4; ronde += 1) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5', max_tokens: 700, tools: TOOLS,
        system: `Je bent Sunny, de interne assistent van Sonty (zonwering, Rijswijk). Je appt met collega ${naam}.\n${(() => { try { return 'Wie doet wat bij Sonty:\n' + fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'sonty-team-rollen.md'), 'utf8').trim(); } catch { return ''; } })()}\n Beantwoord zijn vraag kort en direct in het Nederlands met feiten uit je opzoek-tools (Gripp en de offerte-administratie). Je mag (Daimy 24-08) ook opzoeken wie er bij een klant gemonteerd/ingemeten heeft of ingepland staat (tool wie_bij_klant; noem de bus-namen en datum; staat cacheVerversen op true, zeg dan dat de opdrachten-administratie net ververst wordt en het antwoord over een paar minuten completer kan zijn). Je mag (Daimy 21-08) ook vertellen welke producten met maten, kleur en bediening er in een Gripp-offerte staan, en je kunt de (concept)offerte-PDF ophalen met gripp_offerte_pdf: die wordt dan automatisch als bijlage meegestuurd, zeg dan kort "hier is de PDF". Regels: verder ben je STRIKT alleen-lezen, je kunt niks aanpassen, boeken of naar klanten versturen en belooft dat ook nooit; als een vraag om zo'n actie vraagt zeg je dat een mens dat moet doen. Vind je niks of twijfel je, zeg dat eerlijk. Geen gedachtestreepjes. Dit is een intern gesprek, klantgegevens delen mag.`,
        messages: berichten,
      }),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    berichten.push({ role: 'assistant', content: j.content });
    if (j.stop_reason !== 'tool_use') {
      return { tekst: j.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim(), bijlagen };
    }
    const resultaten = [];
    for (const c of j.content.filter((c) => c.type === 'tool_use')) {
      let uit;
      try {
        if (c.name === 'gripp_offerte') uit = await grippOfferte(c.input.nummer);
        else if (c.name === 'wie_bij_klant') uit = await wieBijKlant(c.input.zoekterm);
        else if (c.name === 'gripp_offerte_pdf') {
          uit = await grippOffertePdf(c.input.nummer);
          if (uit.pdf) bijlagen.push({ bestand: uit.bestand, naam: uit.naam });
          uit = { ...uit, bestand: undefined, bijlageWordtMeegestuurd: !!uit.pdf };
        } else uit = rpZoek(c.input.zoekterm);
      } catch (e) { uit = { fout: String(e.message).slice(0, 120) }; }
      resultaten.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(uit) });
    }
    berichten.push({ role: 'user', content: resultaten });
  }
  return { tekst: 'Dat krijg ik nu niet opgezocht; vraag het even aan Daimy.', bijlagen };
}

module.exports = { antwoordCollega, grippOffertePdf, productRegels, wieBijKlant };
