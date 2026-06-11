#!/usr/bin/env node
/**
 * HubSpot Permanent Session
 * Usage:
 *   Login:      node hubspot-permanent-session.js login <code>
 *   Screenshot: node hubspot-permanent-session.js screenshot <deal_id>
 *   Navigate:   node hubspot-permanent-session.js goto <url>
 *   Layout:     node hubspot-permanent-session.js layout
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '..', 'data', 'hubspot-browser');
const ACCOUNT_ID = '147970649';

async function getContext() {
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1400, height: 900 },
  });
}

async function login(page, code) {
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(4000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}

  // Check if already logged in
  if (!page.url().includes('login')) { console.log('Already logged in!'); return true; }

  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(3000);
  await page.click('text=Sign in with password');
  await page.waitForTimeout(2000);
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(5000);

  if (page.url().includes('confirm') && code) {
    await page.fill('input[placeholder*="code"], input[type="text"]', code);
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(8000);
  }

  return !page.url().includes('login') && !page.url().includes('confirm');
}

async function screenshot(page, dealId) {
  await page.goto(`https://app-eu1.hubspot.com/contacts/${ACCOUNT_ID}/record/0-3/${dealId}`);
  await page.waitForTimeout(8000);
  try { await page.click('[aria-label="Close"]', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("×")', { timeout: 1000 }); } catch(e) {}
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/hs-screenshot.png' });

  // Send to Telegram
  const fileData = fs.readFileSync('/tmp/hs-screenshot.png');
  const boundary = '----FB' + Math.random().toString(36).substr(2);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n1700128390\r\n--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\nHubSpot Deal\r\n--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="hs.png"\r\nContent-Type: image/png\r\n\r\n`),
    fileData,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendPhoto', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  console.log('Photo sent:', (await res.json()).ok ? 'OK' : 'FAILED');
}

async function configureLayout(page) {
  // Go to record customization
  await page.goto(`https://app-eu1.hubspot.com/sales-products-settings/${ACCOUNT_ID}/object/0-3/record-customization`);
  await page.waitForTimeout(5000);
  await page.click('a:has-text("Standaardweergave")');
  await page.waitForTimeout(8000);
  console.log('Layout editor:', page.url());
  await page.screenshot({ path: '/tmp/hs-layout-editor.png' });

  // TODO: configure sidebar properties
  console.log('In layout editor — configure manually or extend this script');
}

async function main() {
  const cmd = process.argv[2] || 'login';
  const arg = process.argv[3] || '';

  const ctx = await getContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  try {
    if (cmd === 'login') {
      const ok = await login(page, arg);
      console.log(ok ? 'LOGIN_OK' : 'LOGIN_FAILED');
      if (!ok && !arg) console.log('Usage: node hubspot-permanent-session.js login <6-digit-code>');
    } else if (cmd === 'screenshot') {
      // Check if logged in
      await page.goto(`https://app-eu1.hubspot.com/contacts/${ACCOUNT_ID}`);
      await page.waitForTimeout(5000);
      if (page.url().includes('login')) {
        console.log('NOT_LOGGED_IN — run: node hubspot-permanent-session.js login <code>');
      } else {
        await screenshot(page, arg || '496073833660');
      }
    } else if (cmd === 'layout') {
      await page.goto(`https://app-eu1.hubspot.com/contacts/${ACCOUNT_ID}`);
      await page.waitForTimeout(5000);
      if (page.url().includes('login')) {
        console.log('NOT_LOGGED_IN');
      } else {
        await configureLayout(page);
      }
    } else if (cmd === 'goto') {
      await page.goto(arg);
      await page.waitForTimeout(5000);
      await page.screenshot({ path: '/tmp/hs-goto.png' });
      console.log('URL:', page.url());
    }
  } finally {
    await ctx.close();
  }
}

main().catch(console.error);
