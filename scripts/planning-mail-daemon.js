#!/usr/bin/env node
// PLANNING-MAIL-DAEMON — verwerkt ongelezen mails uit orders@sonty.nl én info@sonty.nl
// (Inbox, via joey's OWA-token, ALLEEN-LEZEN: mails blijven ongelezen) in de Planning-sheet
// tab "Claude ai test". Elke aangeraakte rij wordt lichtblauw en krijgt een regel in
// kolom B "Ai opmerking" met wat er is gebeurd. Draait 1 ronde per aanroep (launchd
// nl.sonty.planning-mail, elke 30 min).
//
// Kolommen (23-07, indeling Daimy): A checkbox | B Ai opmerking (KORT) | C Datum aanpassing |
//   D leverancier | E Gripp-nummer | F Naam | G Opmerking bestelling (nabestelling=ROOD) |
//   H Plaats | I Regio | J Ordernummer | K Besteld | L Geleverd op | M gepland | N Teams |
//   O Team opmerking | P Wat is besteld | Q weken-formule
// Per levering één rij; zelfde Gripp-nr = zelfde klant. Als álle rijen van een nummer een
// "Geleverd op" hebben, markeert de daemon ze als compleet (Daimy 23-07).
// Alleen leveranciersmail wordt verwerkt; klantmail (bv. op info@) wordt overgeslagen.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/Users/clawdboot/sonty/node_modules/playwright');
const { google } = require('/Users/clawdboot/sonty/node_modules/googleapis');
const { duidPdf } = require('/Users/clawdboot/sonty/scripts/planning-pdf-parse.js');
const SECRETS = require('/Users/clawdboot/sonty/scripts/secrets.js');
const { audit } = require('/Users/clawdboot/sonty/scripts/audit.js');

const SHEET = '1xkQaLKgAgvhP46JtZWRRj2zWpqr5_J5z9xTiiqT9lvs';
const TAB = 'Claude ai test';
const SHEET_ID = 273253041;
const BLAUW = { red: 0.812, green: 0.886, blue: 0.953 };
const MAILBOXEN = ['orders@sonty.nl', 'info@sonty.nl'];
const STATE_FILE = '/Users/clawdboot/sonty/data/planning-mail-state.json';
const LEVERANCIERS = /sunmaster\.nl|@ne\.nl|roma\.de|toppoint\.eu|unilux\.nl|velux|fakro|markiezen|somfy|dersimo|peitsman|poedercoat/i;
const TG = { token: SECRETS.TELEGRAM_BOT_TOKEN, chat: SECRETS.TELEGRAM_CHAT_ID };
const MAANDEN = { januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6, juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12 };

const nu = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' });

// Plaats opzoeken in Gripp op achternaam (alleen-lezen, zuinig: 1 batch-call per ronde).
// Alleen invullen als alle matches in dezelfde plaats wonen — anders liever leeg dan fout.
const SKIP_PLAATS = /handmatig bekijken|RETOUR|niet gevonden|TP aanvulling|^Voorraad|laadmelding/i;
const zoeknaam = (naam) => String(naam || '')
  .replace(/\s*\([^)]*\)/g, ' ').replace(/\b\d{3,}\b/g, ' ')
  .replace(/\b(nabestelling|spoed)\b/gi, ' ').replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();
async function grippPlaatsen(namen) {
  if (!namen.length) return {};
  try {
    const res = await fetch('https://api.gripp.com/public/api3.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.GRIPP_API_KEY },
      body: JSON.stringify(namen.map((n, i) => ({ method: 'company.get',
        params: [[{ field: 'company.searchname', operator: 'like', value: '%' + n + '%' }], { paging: { firstresult: 0, maxresults: 10 } }], id: i + 1 }))),
    });
    const j = await res.json();
    const uit = {};
    j.forEach((resp, i) => {
      const steden = [...new Set((resp.result?.rows || []).map((c) => String(c.visitingaddress_city || '').trim()).filter(Boolean))];
      if (steden.length === 1) uit[namen[i]] = steden[0];
    });
    return uit;
  } catch (e) { console.log('  gripp-fout:', e.message); return {}; }
}
// EXACTE plaats-lookup: het klantnr in de sheetnaam ("Hachioui 6018") is het Gripp-OFFERTEnummer
// (ontdekt 23-07). offer.number -> company -> stad. 100% zeker, dus geen naam-gok nodig.
async function grippPlaatsViaOffer(nummers) {
  if (!nummers.length) return {};
  try {
    const res = await fetch('https://api.gripp.com/public/api3.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.GRIPP_API_KEY },
      body: JSON.stringify(nummers.map((nr, i) => ({ method: 'offer.get',
        params: [[{ field: 'offer.number', operator: 'equals', value: Number(nr) }], { paging: { firstresult: 0, maxresults: 2 } }], id: i + 1 }))),
    });
    const j = await res.json();
    const perNr = {};
    j.forEach((resp, i) => {
      const rows = resp.result?.rows || [];
      if (rows.length === 1 && rows[0].company?.id) perNr[nummers[i]] = { companyId: rows[0].company.id, regels: (rows[0].offerlines || []).map((l) => ({ n: l.amount || 1, product: String(l.product?.searchname || l.description || '').trim() })) };
    });
    const ids = [...new Set(Object.values(perNr).map((x) => x.companyId))];
    if (!ids.length) return {};
    const res2 = await fetch('https://api.gripp.com/public/api3.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.GRIPP_API_KEY },
      body: JSON.stringify([{ method: 'company.get', params: [[{ field: 'company.id', operator: 'in', value: ids }], { paging: { firstresult: 0, maxresults: 100 } }], id: 1 }]),
    });
    const stadVan = {};
    for (const c of (((await res2.json())[0] || {}).result?.rows || [])) stadVan[c.id] = String(c.visitingaddress_city || '').trim();
    const uit = {};
    for (const [nr, info] of Object.entries(perNr)) uit[nr] = { stad: stadVan[info.companyId] || '', regels: info.regels };
    return uit;
  } catch (e) { console.log('  gripp-offer-fout:', e.message); return {}; }
}
// Naam "Hachioui 6018 (samenwerking)" -> { nr, naam, toevoeging } voor kolommen E/F/G
function splitsNaam(vol) {
  let naam = String(vol || '').trim();
  const nr = (naam.match(/\b(\d{4,7})\b/) || [])[1] || '';
  const toevoegingen = [];
  naam = naam.replace(/\(([^)]*)\)/g, (_, x) => { if (x.trim()) toevoegingen.push(x.trim()); return ' '; });
  naam = naam.replace(/\b(nabestelling|prive|privé|spoed|samenwerking|winkelklant)\b/gi, (w) => { toevoegingen.push(w.toLowerCase()); return ' '; });
  if (nr) naam = naam.replace(nr, ' ');
  naam = naam.replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();
  return { nr, naam: naam || String(vol || '').trim(), toevoeging: [...new Set(toevoegingen)].join(', ') };
}
// Offerte-regel -> leverancier (conservatief: alleen bij duidelijke productwoorden)
const REGEL_SKIP = /montage|korting|hoogwerker|tahoma|switch|bezoek|demontage|afvoer|spoedlevering|verzend/i;
const REGEL_LEV = [[/zip|screen|rolluik|suneye|knikarm|uitval|square|markies|volant/i, 'Sunmaster'], [/hordeur|rolhor|inklem|pliss|\bhor(ren)?\b/i, 'Unilux']];
function verwachteLeveranciers(regels) {
  const uit = {};
  for (const r of (regels || [])) {
    if (!r.product || REGEL_SKIP.test(r.product)) continue;
    for (const [re, lev] of REGEL_LEV) if (re.test(r.product)) { (uit[lev] = uit[lev] || []).push(r.n + 'x ' + r.product); break; }
  }
  return uit;
}
const serial = (d, m, y) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
const ddmmyyyy = (d, m, y) => `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { verwerkt: {}, overgeslagen: {} }; } }
function saveState(s) { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); }

async function owaSessie() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  let token = null;
  page.on('request', (req) => {
    const a = req.headers()['authorization'];
    if (a && a.startsWith('Bearer ') && req.url().includes('outlook.office.com')) token = a.replace('Bearer ', '');
  });
  await page.goto('https://outlook.office.com/mail/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const emailInput = await page.$('input[type="email"], input[name="loginfmt"]');
  if (emailInput) {
    await emailInput.fill(SECRETS.OWA_LOGIN.email);
    await page.locator('input[type="submit"]').click();
    await page.waitForTimeout(3000);
    const pw = await page.$('input[type="password"]');
    if (pw) { await pw.fill(SECRETS.OWA_LOGIN.password); await page.locator('input[type="submit"]').click(); await page.waitForTimeout(3000); }
    try {
      const y = page.locator('input[value="Yes"], input[value="Ja"], #idSIButton9');
      if (await y.count()) { await y.first().click(); await page.waitForTimeout(3000); }
    } catch {}
  }
  await page.waitForTimeout(8000);
  if (!token) { await browser.close(); throw new Error('geen OWA-token'); }
  return { browser, page, token };
}

async function haalOngelezen(page, token, mailbox) {
  const H = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
  // Doorpaginaren: de inbox kan meer dan 50 ongelezen mails bevatten (de eerste batch
  // blijft bewust ongelezen staan) — zonder $skip-lus vallen de NIEUWSTE mails buiten beeld.
  const alle = [];
  for (let skip = 0; skip < 1000; skip += 50) {
    const url = `https://outlook.office.com/api/v2.0/users/${mailbox}/MailFolders/Inbox/messages?$filter=IsRead eq false&$top=50&$skip=${skip}&$select=Subject,From,ReceivedDateTime,Body,IsRead,HasAttachments,InternetMessageId&$orderby=ReceivedDateTime asc`;
    const r = await page.request.get(url, { headers: H });
    if (!r.ok()) { console.log(`  ${mailbox}: fout ${r.status()}`); break; }
    const batch = ((await r.json()).value) || [];
    alle.push(...batch);
    if (batch.length < 50) break;
  }
  return alle.map((m) => ({
    id: m.Id, imid: m.InternetMessageId || m.Id, mailbox, hasAtt: !!m.HasAttachments,
    subject: (m.Subject || '').replace(/^(FW|RE|Fwd|Antw):\s*/i, '').trim(),
    from: m.From?.EmailAddress?.Address || '',
    received: m.ReceivedDateTime || '',
    body: (m.Body?.Content || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 4000),
  }));
}

// PDF-bijlagen van een mail ophalen (met het al bemachtigde OWA-token) en de best
// leesbare parse teruggeven. Mail blijft ongelezen; dit is een losse API-call.
async function leesPdf(m, token) {
  try {
    const r = await fetch(`https://outlook.office.com/api/v2.0/users/${m.mailbox}/messages/${m.id}/attachments`, {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
    if (!r.ok) return null;
    let beste = null;
    for (const att of (((await r.json()).value) || [])) {
      if (!/pdf$/i.test(att.Name || '') || !att.ContentBytes) continue;
      const tmp = path.join(os.tmpdir(), `plm-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
      try {
        fs.writeFileSync(tmp, Buffer.from(att.ContentBytes, 'base64'));
        execFileSync('/opt/homebrew/bin/pdftotext', ['-layout', tmp, tmp + '.txt']);
        const parse = duidPdf(fs.readFileSync(tmp + '.txt', 'utf8'));
        // beste = de parse met de meeste inhoud (ordernr + producten wint)
        const score = (p) => (p?.ordernr ? 2 : 0) + (p?.producten?.length ? 2 : 0) + (p?.leverdatum ? 1 : 0) + (p?.referentie ? 1 : 0);
        if (score(parse) > score(beste)) beste = parse;
      } finally { try { fs.unlinkSync(tmp); fs.unlinkSync(tmp + '.txt'); } catch {} }
    }
    return beste && beste.leverancier ? beste : null;
  } catch (e) { console.log(`  [${m.subject}] pdf-fout: ${e.message}`); return null; }
}

const KORT = (arr, max = 220) => { const s = (arr || []).join(' + '); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
const refNaarNaam = (ref) => (ref || '').replace(/\s*\((\d+)([^)]*)\)/, ' $1$2').replace(/\s+\/\s*$/, '').replace(/\s+/g, ' ').trim();

// Vult een duiden()-actie aan met wat er echt in de PDF staat (naam, besteld-/leverdatum,
// productomschrijving). PDF wint van placeholders, nooit van al zekere subject-data.
function verrijkMetPdf(a, pdf) {
  if (!a || !pdf) return;
  if (a.type === 'multi') { a.acties.forEach((sub) => verrijkMetPdf(sub, pdf)); return; }
  const placeholder = (v) => !v || /^\(/.test(String(v).trim());
  if (placeholder(a.naam) && pdf.referentie) a.naam = refNaarNaam(pdf.referentie);
  if ((placeholder(a.ordernr) || !a.ordernr) && pdf.ordernr) a.ordernr = pdf.ordernr;
  if (pdf.orderdatum) a.besteld = pdf.orderdatum;
  if (pdf.producten?.length) a.wat = KORT(pdf.producten);
  if (pdf.leverdatum && !a.geleverdTekst) {
    a.geleverdTekst = pdf.leverdatum;
    const [d, mnd, j] = pdf.leverdatum.split('-').map(Number);
    a.geleverdSerial = serial(d, mnd, j);
  }
  if (a.kort && pdf.leverdatum && !/Geleverd op/.test(a.kort)) a.kort += `, levering ${pdf.leverdatum}`;
  a.opm = (a.opm || '').replace(/\s*(Details|Productdetails|Klantnaam|Klantreferentie|Ordernummer en details|Wijziging staat|Bevestigde leverdatum staat)[^.]*in (de )?(PDF-)?bijlage[^.]*\./i, '') +
    ` PDF gelezen (${pdf.leverancier}): ${KORT(pdf.producten, 160) || 'geen productregels'}${pdf.leverdatum ? ', leverdatum ' + pdf.leverdatum : ''}.`;
}

// ---- mail -> actie. Geeft {type:'update', ordernr, geleverdSerial, geleverdTekst, opm}
// of {type:'nieuw', rij:[C..L-velden], opm} of {type:'skip'|'negeer'} terug. ----
function duiden(m) {
  const s = m.subject;
  const mailDatum = m.received.slice(0, 10).split('-'); // [yyyy,mm,dd]
  const besteld = ddmmyyyy(+mailDatum[2], +mailDatum[1], +mailDatum[0]);
  let x;
  if ((x = s.match(/^Laadmelding (.+?) (\S+)$/))) {
    const d = m.body.match(/Verwachte aankomst\s+\w+\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    if (!d || !MAANDEN[d[2].toLowerCase()]) return { type: 'nieuw', naam: `(laadmelding ${x[1]})`, ordernr: x[2], lev: x[1], kort: 'Laadmelding zonder leesbare datum, handmatig bekijken', opm: `Laadmelding NE voor ${x[1]} ${x[2]}, maar de aankomstdatum kon niet uit de mail gelezen worden. Handmatig bekijken.`, wat: `${x[1]}, zie laadmelding` };
    const [dag, mnd, jr] = [+d[1], MAANDEN[d[2].toLowerCase()], +d[3]];
    return { type: 'update', ordernr: x[2], lev: x[1], kort: `Geleverd op → ${ddmmyyyy(dag, mnd, jr)} (laadmelding NE)`, geleverdSerial: serial(dag, mnd, jr), geleverdTekst: ddmmyyyy(dag, mnd, jr), nieuwWat: `${x[1]}, zie laadmelding`, opm: `Laadmelding NE (${x[1]} ${x[2]}): verwachte aankomst ${d[1]} ${d[2]} ${d[3]}. "Geleverd op" bijgewerkt.` };
  }
  if (/^ROMA comes to you/i.test(s)) {
    const d = m.body.match(/between (\d{2})\.(\d{2})\.(\d{4})/);
    const lijst = [...m.body.matchAll(/(\d{6,8})\s*\/\s*([A-Za-zÀ-ÿ0-9 _-]+?)(?=,|\s+Your ROMA|$)/g)];
    if (!d || !lijst.length) return { type: 'skip', reden: 'ROMA-mail niet leesbaar' };
    return { type: 'multi', acties: lijst.map((o) => ({ type: 'update', ordernr: o[1], geleverdSerial: serial(+d[1], +d[2], +d[3]), geleverdTekst: ddmmyyyy(+d[1], +d[2], +d[3]), nieuwWat: `ROMA, ref ${o[2].trim()}`, opm: `ROMA levermelding: levering ${d[1]}.${d[2]}.${d[3]} (order ${o[1]} / ${o[2].trim()}). "Geleverd op" bijgewerkt.` })) };
  }
  if ((x = s.match(/^(Portaalbevestiging|Orderbevestiging|Gewijzigde orderbevestiging) (\d+) met referentie (.+)$/i))) {
    const soort = x[1].toLowerCase();
    const naam = x[3].replace(/\s*\((\d+)([^)]*)\)/, ' $1$2').trim();
    if (/^gewijzigde/i.test(soort)) return { type: 'opmerking', ordernr: x[2], naam, lev: 'Sunmaster', kort: `Gewijzigde orderbevestiging ontvangen — PDF controleren`, opm: `Sunmaster stuurde een GEWIJZIGDE orderbevestiging voor ${x[2]} (${x[3]}). Wijziging staat in de PDF-bijlage — handmatig controleren.`, wat: 'Sunmaster, zie PDF-bijlage' };
    return { type: 'nieuw-of-opmerking', ordernr: x[2], naam, lev: 'Sunmaster', kort: `Nieuw: ${soort} ${x[2]}`, besteld, wat: 'Sunmaster, productdetails in PDF-bijlage', opm: `Sunmaster ${x[1].toLowerCase()} ${x[2]}, referentie ${x[3]} (mail ${besteld}). Details in PDF-bijlage.` };
  }
  if ((x = s.match(/^Toppoint orderbevestiging (\d+)/i)))
    return { type: 'nieuw-of-opmerking', ordernr: x[1], naam: '(naam in PDF)', lev: 'Toppoint', kort: `Nieuw: orderbevestiging ${x[1]}`, besteld, wat: 'Toppoint, orderbevestiging in PDF-bijlage', opm: `Toppoint orderbevestiging ${x[1]} (mail ${besteld}, in productie genomen). Klantnaam in PDF-bijlage.` };
  if ((x = s.match(/^Orderbevestiging VELUX Nederland ([\d-]+)/i)))
    return { type: 'nieuw-of-opmerking', ordernr: x[1], naam: '(klant onbekend)', lev: 'Velux', kort: `Nieuw: orderbevestiging ${x[1]}`, besteld, wat: 'Velux, orderbevestiging in PDF-bijlage', opm: `Velux orderbevestiging ${x[1]} (mail ${besteld}). Klantreferentie in bijlage.` };
  if ((x = s.match(/^Orderbevestiging Unilux (.+)$/i)))
    return { type: 'nieuw', naam: x[1].trim(), ordernr: '(zie PDF)', lev: 'Unilux', kort: 'Nieuw: orderbevestiging', besteld, wat: 'Unilux, orderbevestiging in PDF-bijlage', opm: `Unilux orderbevestiging "${x[1].trim()}" (mail ${besteld}). Ordernummer en details in PDF-bijlage.` };
  if (/^Leveroverzicht Unilux/i.test(s)) return { type: 'negeer', reden: 'leveroverzicht; laadmeldingen dekken dit' };
  if (/Retourmelding/i.test(s)) {
    const ref = (m.body.match(/referentie\s+(\S+?)\s*\(/) || m.body.match(/referentie\s+(\S+)/) || [])[1] || '(onbekend)';
    return { type: 'nieuw-of-opmerking', ordernr: ref, naam: `RETOUR ${ref}`, lev: 'NE', kort: 'Retour: afhaaldag bevestigen bij NE', besteld: '', wat: 'Retourzending, afhaaldag bevestigen bij NE', opm: `${s} (mail ${besteld}): retouropdracht ${ref} wacht op bevestiging van de afhaaldag bij NE. ACTIE NODIG.` };
  }
  // SUNMASTER AFLEVERBON (ontdekt 23-07): "Afleverbon 29240 uw referentie Versluis (nabestelling) ons ordernr. 2609xxx"
  // = de spullen zijn GELEVERD -> Geleverd op = maildatum.
  if ((x = s.match(/^Afleverbon\s+(\d+)\s+uw referentie\s+(.+?)\s+ons ordernr\.?\s*(\d+)/i))) {
    const [jr, mnd, dag] = m.received.slice(0, 10).split('-').map(Number);
    return { type: 'update', ordernr: x[3], naam: x[2].trim(), lev: 'Sunmaster', geleverdSerial: serial(dag, mnd, jr), geleverdTekst: besteld,
      kort: `Geleverd op → ${besteld} (afleverbon ${x[1]})`, nieuwWat: 'Sunmaster, zie afleverbon', opm: `Sunmaster afleverbon ${x[1]} (${x[2].trim()}, order ${x[3]}): geleverd.` };
  }
  // WEBSHOP-BEVESTIGING (Markiezen Nederland / Poedercoating Culemborg, zelfde sjabloon):
  // referentie + orderdatum + bestelling staan gewoon in de mailtekst — alles wordt op
  // referentie besteld (Daimy 23-07), dus die lezen we hier uit.
  if (/^Bevestiging van bestelling/i.test(s) || /Uw referentie\s+\S/.test(m.body)) {
    const ref = (m.body.match(/Uw referentie\s+(.{2,60}?)\s+(?:Bestelling|Orderdatum|€)/i) || [])[1];
    // MARKIEZEN stuurt na deze webshop-mail ALTIJD de definitieve orderbevestiging (met PDF en
    // ordernr) — alleen die hebben we nodig (Daimy 23-07, dubbel-rij 1404/1405). Dus negeren.
    if (ref && /markiezen/i.test(m.from)) return { type: 'negeer', reden: 'webshop-bevestiging Markiezen; definitieve orderbevestiging volgt' };
    if (ref) {
      const od = m.body.match(/Orderdatum\s+(\d{1,2})-(\d{1,2})-(\d{2,4})/);
      const besteldDatum = od ? ddmmyyyy(+od[1], +od[2], od[3].length === 2 ? +('20' + od[3]) : +od[3]) : besteld;
      const bestelDeel = (m.body.match(/Bestelling\s+(.{10,180}?)(?:\s*€|\s*Opties|$)/i) || [])[1] || '';
      const lev = /markiezen/i.test(m.from) ? 'Markiezen Nederland' : /poedercoat/i.test(m.from) ? 'Poedercoating Culemborg' : ((m.from.match(/@([\w-]+)/) || [])[1] || '');
      return { type: 'nieuw', naam: ref.trim(), ordernr: '', lev, besteld: besteldDatum,
        kort: 'Bevestiging van bestelling (definitieve orderbevestiging volgt)', wat: bestelDeel.replace(/\s+/g, ' ').trim().slice(0, 160) || 'zie bevestiging',
        opm: `Webshop-bevestiging van ${lev}, referentie ${ref.trim()}.` };
    }
  }
  if (LEVERANCIERS.test(m.from) || LEVERANCIERS.test(s))
    return { type: 'nieuw', naam: '(handmatig bekijken)', ordernr: '', lev: (m.from.match(/@([\w-]+)/) || [])[1] || '', kort: 'Leveranciersmail, handmatig bekijken', besteld, wat: (s || '(geen onderwerp)').slice(0, 90), opm: `Leveranciersmail van ${m.from} niet automatisch te duiden: "${s}". Handmatig bekijken.` };
  return { type: 'skip', reden: 'geen leveranciersmail' };
}

const LOCK = '/Users/clawdboot/sonty/data/planning-mail.lock';

(async () => {
  // Lock tegen gelijktijdige runs (launchd + handmatig schreven op 22-07 dubbele rijen).
  try {
    const st = fs.statSync(LOCK);
    if (Date.now() - st.mtimeMs < 10 * 60 * 1000) { console.log('lock actief, ronde overgeslagen'); return; }
  } catch {}
  // Kill-switch: bestand data/kill/nl.sonty.planning-mail = dienst stil (zie SYSTEMEN.md)
  if (fs.existsSync('/Users/clawdboot/sonty/data/kill/nl.sonty.planning-mail')) { console.log('kill-switch actief, ronde overgeslagen'); return; }
  fs.writeFileSync(LOCK, String(process.pid));
  try {
  const state = loadState();
  console.log(`[${nu()}] planning-mail ronde start`);
  const { browser, page, token } = await owaSessie();
  let mails = [];
  for (const mb of MAILBOXEN) mails.push(...await haalOngelezen(page, token, mb));
  await browser.close();
  // Dedupe op InternetMessageId (zelfde mail kan in orders@ én info@ zitten) + al verwerkt.
  const inRonde = new Set();
  mails = mails.filter((m) => {
    if (state.verwerkt[m.id] || state.overgeslagen[m.id] || state.verwerkt[m.imid] || state.overgeslagen[m.imid]) return false;
    if (inRonde.has(m.imid)) return false;
    inRonde.add(m.imid);
    return true;
  });
  console.log(`  nieuw te beoordelen: ${mails.length}`);
  if (!mails.length) { console.log('  niets te doen'); return; }

  const auth = new google.auth.GoogleAuth({ keyFile: '/Users/clawdboot/sonty/data/google-service-account.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const grid = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET, range: `'${TAB}'!A1:M2500`, valueRenderOption: 'UNFORMATTED_VALUE' });
  const rows = grid.data.values || [];
  const vindRij = (ordernr) => {
    const kaal = String(ordernr).replace(/^CV/i, '').replace(/^SN/i, '');
    if (!kaal) return -1;
    for (let i = 1; i < rows.length; i++) {
      const f = String((rows[i] || [])[9] ?? '').trim();
      if (!f) continue;
      if (f === String(ordernr) || f === kaal) return i;
      const fd = f.replace(/\D/g, ''), kd = kaal.replace(/\D/g, '');
      if (fd.length >= 7 && kd.length >= 7 && (kd.startsWith(fd) || fd.startsWith(kd.slice(0, 7)))) return i;
    }
    return -1;
  };
  let laatste = 0;
  for (let i = 0; i < rows.length; i++) if (String((rows[i] || [])[5] ?? '').trim() || String((rows[i] || [])[9] ?? '').trim() || String((rows[i] || [])[4] ?? '').trim()) laatste = i + 1;

  const waarden = []; // values.batchUpdate data
  const formatRequests = []; // extra opmaak (datumformat nieuwe rijen)
  const blauw = new Set(); // 0-based rijen
  const opmPerRij = {}; // rij(1-based) -> [teksten]
  const nieuweRijen = []; // {velden C..L, opm}
  const verslag = [];
  const opm = (rij, tekst) => { (opmPerRij[rij] = opmPerRij[rij] || []).push(tekst); };
  const vandaagKort = `${nu().slice(8, 10)}-${nu().slice(5, 7)}`;
  // C = datum aanpassing, D = leverancier (alleen zetten als D nog leeg is)
  const stempelRij = (rij, a) => {
    waarden.push({ range: `'${TAB}'!C${rij}`, values: [[vandaagKort]] });
    if (a.lev && !String((rows[rij - 1] || [])[3] || '').trim()) waarden.push({ range: `'${TAB}'!D${rij}`, values: [[a.lev]] });
  };

  const verwerkActie = (m, a) => {
    if (a.type === 'multi') { a.acties.forEach((sub) => verwerkActie(m, sub)); return true; }
    if (a.type === 'skip') { state.overgeslagen[m.imid] = a.reden; return false; }
    if (a.type === 'negeer') { state.verwerkt[m.imid] = nu(); verslag.push(`genegeerd: ${m.subject} (${a.reden})`); return false; }
    if (a.type === 'update' || a.type === 'opmerking' || a.type === 'nieuw-of-opmerking') {
      const i = vindRij(a.ordernr);
      if (i >= 0) {
        const rij = i + 1;
        if (a.geleverdSerial && (rows[i] || [])[11] !== a.geleverdSerial) {
          waarden.push({ range: `'${TAB}'!L${rij}`, values: [[a.geleverdTekst]] });
          rows[i][11] = a.geleverdSerial;
          stempelRij(rij, a); opm(rij, a.kort || a.opm); blauw.add(i); verslag.push(`rij ${rij}: ${a.kort || a.opm}`);
        } else if (a.type === 'update') {
          verslag.push(`rij ${rij}: leverdatum stond al goed (${a.geleverdTekst})`);
        } else {
          stempelRij(rij, a); opm(rij, a.kort || a.opm); blauw.add(i); verslag.push(`rij ${rij}: ${a.kort || a.opm}`);
        }
        state.verwerkt[m.imid] = nu();
        return true;
      }
      if (a.type === 'opmerking' || a.type === 'nieuw-of-opmerking' || a.type === 'update') {
        const n = { naam: a.naam || '(onbekend)', ordernr: a.ordernr, besteld: a.besteld || '', geleverd: a.geleverdTekst || '', wat: a.nieuwWat || a.wat || '', kort: (a.kort || '') + (a.type === 'update' ? ' (ordernr niet in sheet, nieuwe rij)' : ''), lev: a.lev, opm: a.opm + (a.type === 'update' ? ' LET OP: ordernummer niet in de sheet gevonden — nieuwe rij gemaakt.' : '') };
        nieuweRijen.push(n); state.verwerkt[m.imid] = nu();
        return true;
      }
    }
    if (a.type === 'nieuw') {
      nieuweRijen.push({ naam: a.naam, ordernr: a.ordernr, besteld: a.besteld || '', geleverd: a.geleverdTekst || '', wat: a.wat, opm: a.opm, kort: a.kort, lev: a.lev });
      state.verwerkt[m.imid] = nu();
      return true;
    }
    return false;
  };

  for (const m of mails) {
    try {
      const a = duiden(m);
      if (m.hasAtt && a.type !== 'skip' && a.type !== 'negeer') verrijkMetPdf(a, await leesPdf(m, token));
      verwerkActie(m, a);
    } catch (e) { console.log(`  [${m.subject}] FOUT: ${e.message}`); }
  }

  // Nieuwe rijen achteraan (dedupe binnen deze ronde op ordernr+naam)
  // Dedupe alleen op écht ordernummer — rijen zonder ordernr (bv. 2x "handmatig bekijken")
  // zijn aparte mails en mogen nooit tegen elkaar wegvallen.
  const gezien = new Set();
  const uniek = nieuweRijen.filter((n, i) => { const k = n.ordernr ? n.ordernr + '|' + n.naam : 'mail-' + i; if (gezien.has(k)) return false; gezien.add(k); return true; });
  if (uniek.length) {
    // Plaats (D) via Gripp + Regio (E) via plaats->regio-mapping uit de bestaande rijen
    const telling = {};
    for (const r of rows) {
      const p = String((r || [])[7] || '').trim().toLowerCase().replace(/^'s-gravenhage$|^denhaag$/, 'den haag'), rg = String((r || [])[8] || '').trim();
      if (p && rg) (telling[p] = telling[p] || {})[rg] = (telling[p][rg] || 0) + 1;
    }
    const normPlaats = (pl) => String(pl || '').trim().toLowerCase().replace(/^'s-gravenhage$|^denhaag$/, 'den haag');
    const regioVan = (pl) => { const t = telling[normPlaats(pl)]; return t ? Object.entries(t).sort((a, b) => b[1] - a[1])[0][0] : ''; };
    const nummers = [...new Set(uniek.map((n) => (String(n.naam).match(/\b(\d{4,6})\b/) || [])[1]).filter(Boolean))];
    const plaatsViaNr = await grippPlaatsViaOffer(nummers);
    const namen = [...new Set(uniek.filter((n) => !SKIP_PLAATS.test(n.naam) && !plaatsViaNr[(String(n.naam).match(/\b(\d{4,6})\b/) || [])[1]]).map((n) => zoeknaam(n.naam)).filter((z) => z.length >= 3))];
    const plaatsVan = await grippPlaatsen(namen);
    const start = laatste + 1;
    const values = uniek.map((n, i) => {
      const r = start + i;
      const plaats = plaatsVan[zoeknaam(n.naam)] || '';
      // Kolom A leeg laten: daar zit een checkbox in die het team zelf doortrekt (Daimy 22-07)
      return ['', n.opm, n.naam, plaats, plaats ? regioVan(plaats) : '', n.ordernr, n.besteld, n.geleverd, '', '', '', n.wat,
        `=IF(I${r + 1060}=TRUE; ""; IF(ISBLANK(G${r}); ""; DATEDIF(G${r}; TODAY(); "D")))`];
    });
    waarden.push({ range: `'${TAB}'!A${start}:M${start + uniek.length - 1}`, values });
    for (let i = 0; i < uniek.length; i++) blauw.add(start - 1 + i);
    // Datumkolommen van de nieuwe rijen in de sheet-stijl (dd-mm) zetten
    formatRequests.push({ repeatCell: {
      range: { sheetId: SHEET_ID, startRowIndex: start - 1, endRowIndex: start - 1 + uniek.length, startColumnIndex: 10, endColumnIndex: 12 },
      cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd-mm' } } },
      fields: 'userEnteredFormat.numberFormat' } });
    alle.forEach((n, i) => verslag.push(`rij ${start + i} NIEUW: ${n.naam} ${n.nr || ''} ${n.ordernr || ''}`));
  }
  // Opmerkingen bij bestaande rijen: bestaande tekst aanvullen
  for (const [rij, teksten] of Object.entries(opmPerRij)) {
    const oud = String((rows[rij - 1] || [])[1] ?? '').trim();
    waarden.push({ range: `'${TAB}'!B${rij}`, values: [[(oud ? oud + '\n' : '') + teksten.join('\n')]] });
  }

  if (waarden.length) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET, requestBody: { valueInputOption: 'USER_ENTERED', data: waarden } });
    const requests = [...blauw].map((r0) => ({ repeatCell: {
      range: { sheetId: SHEET_ID, startRowIndex: r0, endRowIndex: r0 + 1, startColumnIndex: 0, endColumnIndex: 17 },
      cell: { userEnteredFormat: { backgroundColor: BLAUW } }, fields: 'userEnteredFormat.backgroundColor' } }));
    requests.push(...formatRequests);
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET, requestBody: { requests } });
  }
  // HERGROEPEREN (Daimy 23-07): AI-rijen met een ref die eerder in de sheet staat, worden
  // direct onder die groep gezet — zo staan alle leveringen van één klantnummer bij elkaar.
  try {
    for (let ronde = 0; ronde < 10; ronde++) {
      const vg = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET, range: `'${TAB}'!A1:E2500` });
      const gr = vg.data.values || [];
      let move = null;
      const grens = {};
      for (let i = 2; i < gr.length && !move; i++) {
        const nr = String((gr[i] || [])[4] || '').trim();
        if (!nr) continue;
        if (grens[nr] === undefined) { grens[nr] = i; continue; }
        if (i === grens[nr] + 1) { grens[nr] = i; continue; }
        const aiRij = !!String((gr[i] || [])[2] || '').trim();
        if (aiRij) move = { van: i, naar: grens[nr] + 1, nr };
        else grens[nr] = i;
      }
      if (!move) break;
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET, requestBody: { requests: [{ moveDimension: {
        source: { sheetId: SHEET_ID, dimension: 'ROWS', startIndex: move.van, endIndex: move.van + 1 }, destinationIndex: move.naar } }] } });
      console.log(`  ref ${move.nr}: rij ${move.van + 1} bij de groep gezet (nu rij ${move.naar + 1})`);
    }
  } catch (e) { console.log('  hergroepeer-fout:', e.message); }
  // COMPLEET-CHECK (Daimy 23-07, aangescherpt): "Geleverd op" telt alleen als het een ECHTE
  // datum is die vandaag of eerder is — een toekomstige (verwachte) leverdatum of tekst
  // ("week 32") betekent NIET binnen. Pas als álle rijen van een nummer echt binnen zijn:
  // "✔ compleet" + groene E-cellen.
  try {
    const vandaagSerial = Math.round((Date.now() - Date.UTC(1899, 11, 30)) / 86400000);
    const vers = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET, range: `'${TAB}'!A1:Q2500`, valueRenderOption: 'UNFORMATTED_VALUE' });
    const vr = vers.data.values || [];
    const perNr = {};
    for (let i = 2; i < vr.length; i++) {
      const nr = String((vr[i] || [])[4] || '').trim();
      if (!nr) continue;
      const l = (vr[i] || [])[11];
      (perNr[nr] = perNr[nr] || []).push({ rij: i + 1, geleverd: typeof l === 'number' && l <= vandaagSerial, b: String((vr[i] || [])[1] || ''), aiRij: !!String((vr[i] || [])[2] || '').trim() });
    }
    const cWaarden = [], cFormats = [];
    for (const [nr, lijst] of Object.entries(perNr)) {
      if (!lijst.some((x) => x.aiRij)) continue;               // alleen nummers waar de AI bij betrokken is
      if (!lijst.every((x) => x.geleverd)) continue;           // pas compleet als ALLES binnen is
      for (const x of lijst) {
        if (/✔ compleet/.test(x.b)) continue;
        cWaarden.push({ range: `'${TAB}'!B${x.rij}`, values: [[(x.b ? x.b + '\n' : '') + `✔ compleet (${lijst.length} levering${lijst.length > 1 ? 'en' : ''} binnen)`]] });
        cFormats.push({ repeatCell: { range: { sheetId: SHEET_ID, startRowIndex: x.rij - 1, endRowIndex: x.rij, startColumnIndex: 4, endColumnIndex: 5 },
          cell: { userEnteredFormat: { backgroundColor: { red: 0.72, green: 0.88, blue: 0.72 } } }, fields: 'userEnteredFormat.backgroundColor' } });
        verslag.push(`rij ${x.rij}: ✔ compleet (${nr}, ${lijst.length} leveringen)`);
      }
    }
    if (cWaarden.length) {
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET, requestBody: { valueInputOption: 'USER_ENTERED', data: cWaarden } });
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET, requestBody: { requests: cFormats } });
    }
  } catch (e) { console.log('  compleet-check fout:', e.message); }
  saveState(state);
  if (verslag.length) audit('planning-mail', 'sheet-bijgewerkt', { tab: TAB, wijzigingen: verslag.length, detail: verslag.slice(0, 20) });
  console.log(verslag.length ? verslag.map((v) => '  ' + v).join('\n') : '  geen sheet-wijzigingen');
  if (verslag.length) {
    const tekst = `Planning (Claude ai test) bijgewerkt vanuit orders@/info@:\n` + verslag.slice(0, 15).map((v) => '- ' + v.slice(0, 150)).join('\n') + (verslag.length > 15 ? `\n(+${verslag.length - 15} meer)` : '') + '\nMails blijven ongelezen.';
    await fetch(`https://api.telegram.org/bot${TG.token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG.chat, text: tekst.slice(0, 3900) }) }).catch(() => {});
  }
  console.log(`[${nu()}] ronde klaar`);
  } finally { try { fs.unlinkSync(LOCK); } catch {} }
})().catch((e) => { console.log('FOUT:', e.message); process.exit(1); });
