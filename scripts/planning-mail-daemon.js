#!/usr/bin/env node
// PLANNING-MAIL-DAEMON — verwerkt ongelezen mails uit orders@sonty.nl én info@sonty.nl
// (Inbox, via joey's OWA-token, ALLEEN-LEZEN: mails blijven ongelezen) in de Planning-sheet
// tab "Claude ai test". Elke aangeraakte rij wordt lichtblauw en krijgt een regel in
// kolom B "Ai opmerking" met wat er is gebeurd. Draait 1 ronde per aanroep (launchd
// nl.sonty.planning-mail, elke 30 min).
//
// Kolommen: A checkbox | B Ai opmerking | C naam+klantnr | D Plaats | E Regio | F Ordernummer
//           G Besteld | H Geleverd op | I Datum gepland | J Teams | K Team opmerking
//           L Wat is besteld | M weken-formule
// Alleen leveranciersmail wordt verwerkt; klantmail (bv. op info@) wordt overgeslagen.
const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/clawdboot/sonty/node_modules/playwright');
const { google } = require('/Users/clawdboot/sonty/node_modules/googleapis');

const SHEET = '1xkQaLKgAgvhP46JtZWRRj2zWpqr5_J5z9xTiiqT9lvs';
const TAB = 'Claude ai test';
const SHEET_ID = 273253041;
const BLAUW = { red: 0.812, green: 0.886, blue: 0.953 };
const MAILBOXEN = ['orders@sonty.nl', 'info@sonty.nl'];
const STATE_FILE = '/Users/clawdboot/sonty/data/planning-mail-state.json';
const LEVERANCIERS = /sunmaster\.nl|@ne\.nl|roma\.de|toppoint\.eu|unilux\.nl|velux|fakro|markiezen|somfy|dersimo|peitsman/i;
const TG = { token: '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40', chat: 1700128390 };
const MAANDEN = { januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6, juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12 };

const nu = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const stempel = () => `[${nu().slice(8, 10)}-${nu().slice(5, 7)} ${nu().slice(11, 16)} Claude]`;
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
    await emailInput.fill('joey@sontymontage.nl');
    await page.locator('input[type="submit"]').click();
    await page.waitForTimeout(3000);
    const pw = await page.$('input[type="password"]');
    if (pw) { await pw.fill('Shja..59'); await page.locator('input[type="submit"]').click(); await page.waitForTimeout(3000); }
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
  const url = `https://outlook.office.com/api/v2.0/users/${mailbox}/MailFolders/Inbox/messages?$filter=IsRead eq false&$top=50&$select=Subject,From,ReceivedDateTime,Body,IsRead&$orderby=ReceivedDateTime asc`;
  const r = await page.request.get(url, { headers: H });
  if (!r.ok()) { console.log(`  ${mailbox}: fout ${r.status()}`); return []; }
  return (((await r.json()).value) || []).map((m) => ({
    id: m.Id, mailbox,
    subject: (m.Subject || '').replace(/^(FW|RE|Fwd|Antw):\s*/i, '').trim(),
    from: m.From?.EmailAddress?.Address || '',
    received: m.ReceivedDateTime || '',
    body: (m.Body?.Content || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 4000),
  }));
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
    if (!d || !MAANDEN[d[2].toLowerCase()]) return { type: 'nieuw', naam: `(laadmelding ${x[1]})`, ordernr: x[2], opm: `Laadmelding NE voor ${x[1]} ${x[2]}, maar de aankomstdatum kon niet uit de mail gelezen worden. Handmatig bekijken.`, wat: `${x[1]}, zie laadmelding` };
    const [dag, mnd, jr] = [+d[1], MAANDEN[d[2].toLowerCase()], +d[3]];
    return { type: 'update', ordernr: x[2], geleverdSerial: serial(dag, mnd, jr), geleverdTekst: ddmmyyyy(dag, mnd, jr), nieuwWat: `${x[1]}, zie laadmelding`, opm: `Laadmelding NE (${x[1]} ${x[2]}): verwachte aankomst ${d[1]} ${d[2]} ${d[3]}. "Geleverd op" bijgewerkt.` };
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
    if (/^gewijzigde/i.test(soort)) return { type: 'opmerking', ordernr: x[2], naam, opm: `Sunmaster stuurde een GEWIJZIGDE orderbevestiging voor ${x[2]} (${x[3]}). Wijziging staat in de PDF-bijlage — handmatig controleren.`, wat: 'Sunmaster, zie PDF-bijlage' };
    return { type: 'nieuw-of-opmerking', ordernr: x[2], naam, besteld, wat: 'Sunmaster, productdetails in PDF-bijlage', opm: `Sunmaster ${x[1].toLowerCase()} ${x[2]}, referentie ${x[3]} (mail ${besteld}). Details in PDF-bijlage.` };
  }
  if ((x = s.match(/^Toppoint orderbevestiging (\d+)/i)))
    return { type: 'nieuw-of-opmerking', ordernr: x[1], naam: '(naam in PDF)', besteld, wat: 'Toppoint, orderbevestiging in PDF-bijlage', opm: `Toppoint orderbevestiging ${x[1]} (mail ${besteld}, in productie genomen). Klantnaam in PDF-bijlage.` };
  if ((x = s.match(/^Orderbevestiging VELUX Nederland ([\d-]+)/i)))
    return { type: 'nieuw-of-opmerking', ordernr: x[1], naam: '(klant onbekend)', besteld, wat: 'Velux, orderbevestiging in PDF-bijlage', opm: `Velux orderbevestiging ${x[1]} (mail ${besteld}). Klantreferentie in bijlage.` };
  if ((x = s.match(/^Orderbevestiging Unilux (.+)$/i)))
    return { type: 'nieuw', naam: x[1].trim(), ordernr: '(zie PDF)', besteld, wat: 'Unilux, orderbevestiging in PDF-bijlage', opm: `Unilux orderbevestiging "${x[1].trim()}" (mail ${besteld}). Ordernummer en details in PDF-bijlage.` };
  if (/^Leveroverzicht Unilux/i.test(s)) return { type: 'negeer', reden: 'leveroverzicht; laadmeldingen dekken dit' };
  if (/Retourmelding/i.test(s)) {
    const ref = (m.body.match(/referentie\s+(\S+?)\s*\(/) || m.body.match(/referentie\s+(\S+)/) || [])[1] || '(onbekend)';
    return { type: 'nieuw-of-opmerking', ordernr: ref, naam: `RETOUR ${ref}`, besteld: '', wat: 'Retourzending, afhaaldag bevestigen bij NE', opm: `${s} (mail ${besteld}): retouropdracht ${ref} wacht op bevestiging van de afhaaldag bij NE. ACTIE NODIG.` };
  }
  if (LEVERANCIERS.test(m.from) || LEVERANCIERS.test(s))
    return { type: 'nieuw', naam: '(handmatig bekijken)', ordernr: '', besteld, wat: (s || '(geen onderwerp)').slice(0, 90), opm: `Leveranciersmail van ${m.from} niet automatisch te duiden: "${s}". Handmatig bekijken.` };
  return { type: 'skip', reden: 'geen leveranciersmail' };
}

(async () => {
  const state = loadState();
  console.log(`[${nu()}] planning-mail ronde start`);
  const { browser, page, token } = await owaSessie();
  let mails = [];
  for (const mb of MAILBOXEN) mails.push(...await haalOngelezen(page, token, mb));
  await browser.close();
  mails = mails.filter((m) => !state.verwerkt[m.id] && !state.overgeslagen[m.id]);
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
      const f = String((rows[i] || [])[5] ?? '').trim();
      if (!f) continue;
      if (f === String(ordernr) || f === kaal) return i;
      const fd = f.replace(/\D/g, ''), kd = kaal.replace(/\D/g, '');
      if (fd.length >= 7 && kd.length >= 7 && (kd.startsWith(fd) || fd.startsWith(kd.slice(0, 7)))) return i;
    }
    return -1;
  };
  let laatste = 0;
  for (let i = 0; i < rows.length; i++) if (String((rows[i] || [])[2] ?? '').trim() || String((rows[i] || [])[5] ?? '').trim()) laatste = i + 1;

  const waarden = []; // values.batchUpdate data
  const blauw = new Set(); // 0-based rijen
  const opmPerRij = {}; // rij(1-based) -> [teksten]
  const nieuweRijen = []; // {velden C..L, opm}
  const verslag = [];
  const opm = (rij, tekst) => { (opmPerRij[rij] = opmPerRij[rij] || []).push(`${stempel()} ${tekst}`); };

  const verwerkActie = (m, a) => {
    if (a.type === 'multi') { a.acties.forEach((sub) => verwerkActie(m, sub)); return true; }
    if (a.type === 'skip') { state.overgeslagen[m.id] = a.reden; return false; }
    if (a.type === 'negeer') { state.verwerkt[m.id] = nu(); verslag.push(`genegeerd: ${m.subject} (${a.reden})`); return false; }
    if (a.type === 'update' || a.type === 'opmerking' || a.type === 'nieuw-of-opmerking') {
      const i = vindRij(a.ordernr);
      if (i >= 0) {
        const rij = i + 1;
        if (a.type === 'update') {
          const huidig = (rows[i] || [])[7];
          if (huidig !== a.geleverdSerial) {
            waarden.push({ range: `'${TAB}'!H${rij}`, values: [[a.geleverdTekst]] });
            rows[i][7] = a.geleverdSerial;
            opm(rij, a.opm); blauw.add(i); verslag.push(`rij ${rij}: ${a.opm}`);
          } else { verslag.push(`rij ${rij}: leverdatum stond al goed (${a.geleverdTekst})`); }
        } else {
          opm(rij, a.opm); blauw.add(i); verslag.push(`rij ${rij}: ${a.opm}`);
        }
        state.verwerkt[m.id] = nu();
        return true;
      }
      if (a.type === 'opmerking' || a.type === 'nieuw-of-opmerking' || a.type === 'update') {
        const n = { naam: a.naam || '(onbekend)', ordernr: a.ordernr, besteld: a.besteld || '', geleverd: a.geleverdTekst || '', wat: a.nieuwWat || a.wat || '', opm: a.opm + (a.type === 'update' ? ' LET OP: ordernummer niet in de sheet gevonden — nieuwe rij gemaakt.' : '') };
        nieuweRijen.push(n); state.verwerkt[m.id] = nu();
        return true;
      }
    }
    if (a.type === 'nieuw') {
      nieuweRijen.push({ naam: a.naam, ordernr: a.ordernr, besteld: a.besteld || '', geleverd: '', wat: a.wat, opm: a.opm });
      state.verwerkt[m.id] = nu();
      return true;
    }
    return false;
  };

  for (const m of mails) {
    try { verwerkActie(m, duiden(m)); } catch (e) { console.log(`  [${m.subject}] FOUT: ${e.message}`); }
  }

  // Nieuwe rijen achteraan (dedupe binnen deze ronde op ordernr+naam)
  const gezien = new Set();
  const uniek = nieuweRijen.filter((n) => { const k = n.ordernr + '|' + n.naam; if (gezien.has(k)) return false; gezien.add(k); return true; });
  if (uniek.length) {
    const start = laatste + 1;
    const values = uniek.map((n, i) => {
      const r = start + i;
      return ['FALSE', `${stempel()} ${n.opm}`, n.naam, '', '', n.ordernr, n.besteld, n.geleverd, '', '', '', n.wat,
        `=IF(I${r + 1060}=TRUE; ""; IF(ISBLANK(G${r}); ""; DATEDIF(G${r}; TODAY(); "D")))`];
    });
    waarden.push({ range: `'${TAB}'!A${start}:M${start + uniek.length - 1}`, values });
    for (let i = 0; i < uniek.length; i++) blauw.add(start - 1 + i);
    uniek.forEach((n, i) => verslag.push(`rij ${start + i} NIEUW: ${n.naam} ${n.ordernr}`));
  }
  // Opmerkingen bij bestaande rijen: bestaande tekst aanvullen
  for (const [rij, teksten] of Object.entries(opmPerRij)) {
    const oud = String((rows[rij - 1] || [])[1] ?? '').trim();
    waarden.push({ range: `'${TAB}'!B${rij}`, values: [[(oud ? oud + '\n' : '') + teksten.join('\n')]] });
  }

  if (waarden.length) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET, requestBody: { valueInputOption: 'USER_ENTERED', data: waarden } });
    const requests = [...blauw].map((r0) => ({ repeatCell: {
      range: { sheetId: SHEET_ID, startRowIndex: r0, endRowIndex: r0 + 1, startColumnIndex: 0, endColumnIndex: 13 },
      cell: { userEnteredFormat: { backgroundColor: BLAUW } }, fields: 'userEnteredFormat.backgroundColor' } }));
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET, requestBody: { requests } });
  }
  saveState(state);
  console.log(verslag.length ? verslag.map((v) => '  ' + v).join('\n') : '  geen sheet-wijzigingen');
  if (verslag.length) {
    const tekst = `Planning (Claude ai test) bijgewerkt vanuit orders@/info@:\n` + verslag.slice(0, 15).map((v) => '- ' + v.slice(0, 150)).join('\n') + (verslag.length > 15 ? `\n(+${verslag.length - 15} meer)` : '') + '\nMails blijven ongelezen.';
    await fetch(`https://api.telegram.org/bot${TG.token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG.chat, text: tekst.slice(0, 3900) }) }).catch(() => {});
  }
  console.log(`[${nu()}] ronde klaar`);
})().catch((e) => { console.log('FOUT:', e.message); process.exit(1); });
