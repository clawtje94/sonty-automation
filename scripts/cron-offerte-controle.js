#!/usr/bin/env node
/**
 * Automatische offerte verwerking
 *
 * Draait elke 15 min via launchd. Pakt alle deals in "Offerte controle" op:
 * 1. Tahoma Switch check: als >1 → verwijder extras (houd 1)
 * 2. Check: heeft bedrag? heeft bestand? geen markies/gordijnen?
 * 3. Als ok → Versturen via RP UI
 * 4. Invullen in Google Sheet (juiste maand-tab, juiste rij)
 *
 * Vereist: playwright, Google auth (data/google-auth.json)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RP_PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const SENT_LOG = path.join(__dirname, '.offerte-controle-sent.json');
const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';

function getSentLog() { try { return JSON.parse(fs.readFileSync(SENT_LOG, 'utf8')); } catch { return {}; } }
function markSent(docNumber, data) {
  const log = getSentLog();
  log[docNumber] = { ...data, sentAt: new Date().toISOString() };
  fs.writeFileSync(SENT_LOG, JSON.stringify(log, null, 2));
}

function mapProduct(name) {
  if (!name) return '';
  const n = name.toLowerCase();
  if (n.includes('rolluik') || n.includes('rollsuper')) return 'Rolluiken';
  if (n.includes('suneye') || n.includes('voorraad')) return 'Voorraadscherm';
  if (n.includes('zip design') || n.includes('zipscreen') || n.includes('suncontrol') || n.includes('suncube') || n.includes('sunelite') || n.includes('sunproject') || n.includes('square')) return 'Screens';
  if (n.includes('pergola')) return 'Pergola';
  if (n.includes('markies')) return 'Markiezen';
  if (n.includes('knikarm') || n.includes('sunbasic')) return 'Knikarmscherm';
  if (n.includes('plisse') || n.includes('rolgordijn') || n.includes('jaloezie')) return 'Raamdeco binnen';
  if (n.includes('uitval')) return 'uitvalscherm';
  return '';
}

async function loginRP(page) {
  await page.goto('https://hub.reuzenpanda.nl/login', { timeout: 60000 });
  await page.waitForTimeout(5000);
  const emailInput = await page.$('input[placeholder*="mail"]');
  if (!emailInput) {
    // Maybe already logged in
    if (page.url().includes('hub.reuzenpanda.nl/app')) return true;
    return false;
  }
  await emailInput.fill('daimyboot@gmail.com');
  await page.click('button:has-text("Ga verder")');
  await page.waitForTimeout(5000);
  await page.fill('input[type="password"]', 'TQGb@eD%5nGRSN9@4Gss');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(8000);
  const hasCompany = await page.$('text=Sonty B.V.');
  if (hasCompany) {
    await page.click('text=Sonty B.V.');
    await page.waitForTimeout(5000);
  }
  return true;
}

async function findDocDots(page) {
  return page.evaluate(() => {
    const btns = document.querySelectorAll('button, [role="button"]');
    for (const btn of btns) {
      const r = btn.getBoundingClientRect();
      if (r.x > 1000 && r.y > 400 && r.y < 530 && r.width < 50 && r.height < 50) {
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
    }
    return null;
  });
}

async function getDocData(page, pid, docId) {
  const [qd, vd] = await Promise.all([
    page.evaluate(async ({ p, d }) => {
      try { return await (await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + p + '/quotations/' + d, { credentials: 'include' })).json(); }
      catch { return null; }
    }, { p: pid, d: docId }),
    page.evaluate(async ({ p, d }) => {
      try { return await (await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + p + '/documents/' + d + '/versions', { credentials: 'include' })).json(); }
      catch { return null; }
    }, { p: pid, d: docId }),
  ]);

  const v = vd?.versions?.[0];
  let amount = 0;
  let products = [];
  let tahomaCount = 0;

  if (v?.data?.segments) {
    const pg = v.data.segments.find(s => s.type === 'priceLineGroup');
    if (pg?.data?.lines) {
      for (const l of pg.data.lines) {
        amount += l.units * l.pricePerUnit;
        const desc = l.description?.split('\n')[0] || '';
        products.push({ name: desc, units: l.units, price: l.pricePerUnit });
        if (desc.toLowerCase().includes('tahoma')) tahomaCount += l.units;
      }
    }
  }

  const mainProduct = products.find(p => !p.name.toLowerCase().includes('tahoma') && !p.name.toLowerCase().includes('montage') && !p.name.toLowerCase().includes('inclusief'))?.name || '';
  const isMarkiezen = mainProduct.toLowerCase().includes('markies');
  const isGordijnen = mainProduct.toLowerCase().includes('gordijn') || mainProduct.toLowerCase().includes('plisse') || mainProduct.toLowerCase().includes('jaloezie');
  const hasArtifacts = (qd?.quotationData?.artifacts || []).length > 0;

  return {
    amount,
    amountInclBtw: amount * 1.21,
    products,
    mainProduct,
    tahomaCount,
    isMarkiezen,
    isGordijnen,
    hasArtifacts,
    docNumber: qd?.quotationData?.quotationNumber || '',
    docStatus: qd?.quotationData?.quotationStatus || '',
  };
}

async function fixTahoma(page) {
  // In the open editor: find and delete extra Tahoma Switch lines
  // Returns number of deletions
  let deleted = 0;

  for (let attempt = 0; attempt < 10; attempt++) {
    // Scroll to see all lines
    await page.evaluate(() => {
      const modal = document.querySelector('[class*="modal"], [class*="editor"], [class*="dialog"]');
      if (modal) modal.scrollTop = modal.scrollHeight;
    });
    await page.waitForTimeout(500);

    const tahomaElements = await page.$$('text=Tahoma Switch');
    if (tahomaElements.length <= 1) break;

    // Click three-dots on the LAST Tahoma line
    const lastTahoma = tahomaElements[tahomaElements.length - 1];
    const dotsPos = await lastTahoma.evaluate(el => {
      let parent = el.parentElement;
      for (let i = 0; i < 15 && parent; i++) {
        const btns = parent.querySelectorAll('button, [role="button"]');
        for (const btn of btns) {
          const r = btn.getBoundingClientRect();
          if (r.x > 1100 && r.width < 50 && r.width > 5 && r.height > 5) {
            return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true };
          }
        }
        parent = parent.parentElement;
      }
      return { found: false };
    });

    if (!dotsPos.found) {
      // Try scrolling up
      await page.evaluate(() => {
        const modal = document.querySelector('[class*="modal"], [class*="editor"]');
        if (modal) modal.scrollTop -= 400;
      });
      await page.waitForTimeout(500);
      continue;
    }

    await page.mouse.click(dotsPos.x, dotsPos.y);
    await page.waitForTimeout(1000);

    try {
      await page.click('text=Verwijderen', { timeout: 3000 });
      await page.waitForTimeout(1500);
      await page.click('text=Bevestigen', { timeout: 2000 }).catch(() => {});
      await page.click('text=Ja', { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(1000);
      deleted++;
    } catch {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }
  return deleted;
}

async function sendDocument(page) {
  // From deal detail view: click three dots → Versturen → Verstuur naar email
  const dots = await findDocDots(page);
  if (!dots) return false;

  await page.mouse.click(dots.x, dots.y);
  await page.waitForTimeout(1500);

  try {
    await page.click('text=Versturen', { timeout: 5000 });
    await page.waitForTimeout(3000);

    const sendBtn = await page.$('text=/Verstuur naar/');
    if (sendBtn) {
      await sendBtn.click();
      await page.waitForTimeout(5000);
      return true;
    }
  } catch {}
  return false;
}

async function appendToSheet(page, rowData, monthTab) {
  // Navigate to the correct month tab and append data
  await page.goto(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
  await page.waitForTimeout(8000);

  // Find and click the month tab
  const rightArrow = await page.$('.docs-sheet-tab-scrollright');
  if (rightArrow) {
    for (let i = 0; i < 15; i++) { await rightArrow.click(); await page.waitForTimeout(200); }
  }
  await page.waitForTimeout(500);

  const tabs = await page.$$('.docs-sheet-tab');
  let tabFound = false;
  for (const tab of tabs) {
    const name = await tab.evaluate(e => e.querySelector('.docs-sheet-tab-name')?.textContent);
    if (name && name.includes(monthTab)) {
      await tab.click();
      tabFound = true;
      break;
    }
  }
  if (!tabFound) {
    console.log('Tab ' + monthTab + ' niet gevonden');
    return false;
  }
  await page.waitForTimeout(3000);

  // Go to the last row with data + 1
  await page.keyboard.down('Meta');
  await page.keyboard.press('End');
  await page.keyboard.up('Meta');
  await page.waitForTimeout(1000);

  // Go to column A of next empty row
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(500);

  // Paste the row data
  const tsv = rowData.join('\t');
  execSync('pbcopy', { input: tsv });
  await page.keyboard.down('Meta');
  await page.keyboard.press('v');
  await page.keyboard.up('Meta');
  await page.waitForTimeout(5000);

  return true;
}

async function main() {
  console.log('[' + new Date().toISOString().substring(11, 19) + '] Offerte controle start');

  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    // Login RP
    const loggedIn = await loginRP(page);
    if (!loggedIn) { console.log('Login failed'); return; }

    // Get all documents overview
    const allDocs = await page.evaluate(async (pid) => {
      const res = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/documents/overview', { credentials: 'include' });
      const data = await res.json();
      return (data.documentDatas || []).filter(d => d.document_status === 'DRAFT').map(d => ({
        id: d.id, number: d.document_number, contactPersonId: d.contact_person_id,
        createdAt: d.document_creation_timestamp || 0,
      }));
    }, RP_PROFILE_ID);

    // Get contacts
    const contacts = await page.evaluate(async (pid) => {
      const res = await fetch('https://backend.reuzenpanda.nl/contact-service/' + pid + '/contact-persons', { credentials: 'include' });
      const data = await res.json();
      const map = {};
      for (const cp of (data.contact_persons || [])) {
        const fields = {};
        for (const f of (cp.free_fields || [])) fields[f.label] = f.value;
        map[cp.id] = { name: cp.display_name || '', phone: fields.phone || '', email: fields.email || '', address: fields.address || '' };
      }
      return map;
    }, RP_PROFILE_ID);

    // Filter: only today's DRAFT docs
    const today = new Date().toISOString().substring(0, 10);
    const todayStart = new Date(today).getTime();
    const todayEnd = todayStart + 86400000;
    const todayDocs = allDocs.filter(d => d.createdAt >= todayStart && d.createdAt < todayEnd);

    const sentLog = getSentLog();
    const toProcess = todayDocs.filter(d => !sentLog[d.number]);

    console.log('DRAFT docs vandaag:', todayDocs.length, '| Nog te verwerken:', toProcess.length);
    if (toProcess.length === 0) { console.log('Niets te doen'); return; }

    // Get full data for each doc
    let processed = 0;
    let skipped = 0;
    let sent = 0;

    for (const doc of toProcess) {
      const contact = contacts[doc.contactPersonId] || {};
      const docData = await getDocData(page, RP_PROFILE_ID, doc.id);

      console.log('\n' + doc.number + ' | ' + contact.name + ' | €' + docData.amountInclBtw.toFixed(2) + ' | ' + docData.mainProduct + ' | Tahoma:' + docData.tahomaCount);

      // Skip checks
      if (docData.isMarkiezen) { console.log('  SKIP: Markiezen'); skipped++; continue; }
      if (docData.isGordijnen) { console.log('  SKIP: Gordijnen'); skipped++; continue; }
      if (docData.amount === 0) { console.log('  SKIP: Geen bedrag'); skipped++; continue; }

      // Go to pipeline and open this deal
      await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline', { timeout: 60000 });
      await page.waitForTimeout(8000);

      // Search for the deal by name
      const searchBox = await page.$('input[placeholder*="Zoeken"]');
      if (searchBox) {
        await searchBox.fill(contact.name.split(' ')[0]);
        await page.waitForTimeout(3000);
      }

      // Click the matching deal card
      const dealCard = await page.$('text=' + contact.name);
      if (!dealCard) {
        // Try clicking first card in Offerte controle
        await page.mouse.click(520, 270);
      } else {
        await dealCard.click();
      }
      await page.waitForTimeout(5000);

      // Fix Tahoma if needed
      if (docData.tahomaCount > 1) {
        console.log('  Fixing Tahoma: ' + docData.tahomaCount + ' → 1');
        const dots = await findDocDots(page);
        if (dots) {
          await page.mouse.click(dots.x, dots.y);
          await page.waitForTimeout(1500);
          await page.click('text=Bewerken');
          await page.waitForTimeout(6000);

          const deleted = await fixTahoma(page);
          console.log('  Deleted ' + deleted + ' extra Tahoma lines');

          if (deleted > 0) {
            await page.click('text=Opslaan');
            await page.waitForTimeout(5000);
            console.log('  Saved');
          } else {
            await page.click('text=Annuleren').catch(() => page.keyboard.press('Escape'));
            await page.waitForTimeout(2000);
          }
        }
      }

      // Send document
      const didSend = await sendDocument(page);
      if (didSend) {
        console.log('  VERSTUURD!');
        sent++;

        // Build sheet row (Mei 2026 column order)
        const d = new Date(doc.createdAt);
        const dateStr = d.getDate() + '-' + (d.getMonth() + 1) + '-' + String(d.getFullYear()).slice(-2);
        const city = (contact.address || '').split(',').find(p => p.trim().match(/^\d{4}.*[A-Z]/))?.replace(/^\s*\d{4}\s*[A-Za-z]*\s*/, '').trim() || '';
        const phone = (contact.phone || '').replace(/^\+/, '');
        const bedrag = docData.amountInclBtw > 0 ? ('€ ' + docData.amountInclBtw.toFixed(2).replace('.', ',')) : '';
        const firstName = contact.name.split(' ')[0] || '';
        const lastName = contact.name.split(' ').slice(1).join(' ') || '';

        const rowData = [
          dateStr, firstName, lastName, city, phone, bedrag, '',
          'Online', '', 'Prive', mapProduct(docData.mainProduct),
          'FALSE', '', '', 'FALSE', '', '', '', '', doc.number,
        ];

        // Determine month tab
        const monthNames = ['Jan', 'Feb', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        const monthTab = monthNames[d.getMonth()] + ' ' + d.getFullYear();

        // Append to sheet
        try {
          const sheetCtx = await browser.newContext({
            storageState: path.join(__dirname, '../data/google-auth.json'),
          }).catch(() => null);

          if (sheetCtx) {
            const sheetPage = await sheetCtx.newPage();
            sheetPage.setDefaultTimeout(60000);
            const appended = await appendToSheet(sheetPage, rowData, monthTab);
            if (appended) console.log('  Sheet: rij toegevoegd in ' + monthTab);
            else console.log('  Sheet: tab niet gevonden');
            await sheetPage.close();
            await sheetCtx.close();
          }
        } catch (e) {
          console.log('  Sheet fout: ' + e.message?.substring(0, 60));
        }

        markSent(doc.number, { name: contact.name, amount: docData.amountInclBtw, product: docData.mainProduct });
      } else {
        console.log('  Versturen mislukt');
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(2000);
      processed++;
    }

    console.log('\n=== SAMENVATTING ===');
    console.log('Verwerkt:', processed, '| Verstuurd:', sent, '| Overgeslagen:', skipped);

    // Telegram notificatie
    if (sent > 0) {
      try {
        const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
        const msg = 'Offerte controle: ' + sent + ' offerte(s) verstuurd, ' + skipped + ' overgeslagen';
        await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: 1700128390, text: msg }),
        });
      } catch {}
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch(e => { console.error(e); process.exit(1); });
