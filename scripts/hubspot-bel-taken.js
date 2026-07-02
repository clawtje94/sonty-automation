#!/usr/bin/env node
// Sonty — bel-taken generator voor verse leads (<=10 dagen, stage Nieuwe Lead)
// Maakt/ververst per lead een HubSpot CALL-taak met alle beschikbare info, toegewezen aan owner.
// Idempotent: bestaat er al een open bel-taak, dan wordt de body ververst (geen dubbele).
// Gebruik:
//   node scripts/hubspot-bel-taken.js [aantal]     -> verwerk N nieuwste leads (default 5)
//   node scripts/hubspot-bel-taken.js all          -> verwerk ALLE verse leads (<=10 dgn)
//   node scripts/hubspot-bel-taken.js 5 --dry       -> toon alleen, niets schrijven
const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const { getTeVer, normPhone } = require('./te-ver-phones'); // "TE VER"-leads uit register uitsluiten
const OWNER = 89279987;               // Daimy (later: Marijn)
const STAGE_NIEUWE_LEAD = '4998659267';
const PORTAL = '147970649';
const BASE = 'https://api.hubapi.com';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const arg = process.argv[2] || '5';
const ALL = arg === 'all';
const RECENT = arg === 'recent';        // alleen leads van de afgelopen 2 uur (goedkope cron-modus)
const LIMIT = (ALL || RECENT) ? 200 : parseInt(arg, 10);
const DRY = process.argv.includes('--dry');

const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
async function sendTelegram(text) {
  await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

// Alert max 1x per 6 uur (script draait elke 15 min — anders alert-spam)
function alertThrottled(key, text) {
  const fs = require('fs'), path = require('path');
  const marker = path.join(__dirname, '.beltaken-alert-' + key + '.txt');
  try {
    if (fs.existsSync(marker) && Date.now() - fs.statSync(marker).mtimeMs < 6 * 3600 * 1000) return Promise.resolve();
    fs.writeFileSync(marker, new Date().toISOString());
  } catch {}
  return sendTelegram(text);
}

const jget = async (u) => (await fetch(u, { headers: H })).json();
const jpost = async (u, b) => { const r = await fetch(u, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { ok: r.ok, status: r.status, data: await r.json() }; };
const jpatch = async (u, b) => { const r = await fetch(u, { method: 'PATCH', headers: H, body: JSON.stringify(b) }); return { ok: r.ok, status: r.status, data: await r.json() }; };

function daysAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
}
function nlDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// Bouwt een volledige, goed leesbare taak-body met alles wat beschikbaar is.
function buildBody({ naam, tel, mail, createdate, rp, offerteLink, quote, product, dealUrl, amount, waContact, waStatus, waLink }) {
  const d = daysAgo(createdate);
  const ouderdom = d === null ? '—' : (d === 0 ? 'vandaag binnengekomen' : `${d} dag${d === 1 ? '' : 'en'} geleden`);
  const telLine = tel && tel !== '(geen nummer)'
    ? `📞 <b><a href="tel:${tel.replace(/\s/g, '')}">${tel}</a></b>  (klik om te bellen)`
    : `📞 <b>Geen telefoonnummer bekend</b> — mail de klant`;
  const L = [];
  L.push(`<b>━━ KLANT ━━</b>`);
  L.push(`👤 ${naam}`);
  L.push(telLine);
  L.push(mail ? `✉️ <a href="mailto:${mail}">${mail}</a>` : `✉️ Geen e-mail bekend`);
  L.push(``);
  L.push(`<b>━━ LEAD ━━</b>`);
  L.push(`📅 Binnengekomen: ${nlDate(createdate)} (${ouderdom})`);
  L.push(`🌐 Bron: Reuzenpanda / advertentie`);
  L.push(`🛒 Interesse / product: ${product || '— (nog niet geconfigureerd)'}`);
  L.push(`💰 Prijsindicatie: ${quote ? '€ ' + quote : '— (nog geen offerte)'}`);
  L.push(`💶 Deal-waarde: ${amount ? '€ ' + amount : '—'}`);
  L.push(``);
  L.push(`<b>━━ WHATSAPP ━━</b>`);
  if (waContact === 'true') L.push(`💬 Al WhatsApp-contact${waStatus ? ' (' + (waStatus === 'closed' ? 'gesloten' : 'open') + ')' : ''}${waLink ? ' — <a href="' + waLink + '">open in Trengo</a>' : ''}`);
  else L.push(`💬 Nog geen WhatsApp-contact`);
  L.push(`📜 Volledige WhatsApp- en mailgeschiedenis: zie de <a href="${dealUrl}">contactkaart</a>`);
  L.push(``);
  L.push(`<b>━━ LINKS ━━</b>`);
  L.push(`🔗 <a href="${dealUrl}">Open deal in HubSpot</a>`);
  L.push(rp ? `✏️ <a href="${rp}">Offerte aanpassen in Reuzenpanda</a>` : `✏️ Reuzenpanda: nog geen offerte`);
  if (offerteLink) L.push(`🟠 <a href="${offerteLink}">Offerte bekijken / sturen (klantlink)</a>`);
  L.push(``);
  L.push(`<b>━━ NA HET BELLEN ━━</b>`);
  L.push(`1️⃣ Zet op de deal het veld <b>"📞 Bel resultaat"</b>`);
  L.push(`2️⃣ Verschuif de stage (Belpoging 1 → Belpoging 2 → In Contact)`);
  L.push(`3️⃣ Notitie maken? Klik <b>"Notitie"</b> op de deal, of voeg een opmerking toe aan deze taak`);
  return L.join('<br>');
}

async function getOpenBelTaak(dealId) {
  const at = await jget(`${BASE}/crm/v4/objects/deals/${dealId}/associations/tasks`);
  for (const t of (at.results || [])) {
    const tk = await jget(`${BASE}/crm/v3/objects/tasks/${t.toObjectId}?properties=hs_task_subject,hs_task_status`);
    if (tk.properties && tk.properties.hs_task_status !== 'COMPLETED' && /Bel:/.test(tk.properties.hs_task_subject || '')) {
      return t.toObjectId;
    }
  }
  return null;
}

(async () => {
  // RECENT: alleen afgelopen 2 uur (ms-timestamp). Anders: laatste 10 dagen (datum).
  const sinceValue = RECENT
    ? String(Date.now() - 2 * 3600 * 1000)
    : new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const body = {
    filterGroups: [{ filters: [
      { propertyName: 'dealstage', operator: 'EQ', value: STAGE_NIEUWE_LEAD },
      { propertyName: 'createdate', operator: 'GTE', value: sinceValue },
    ] }],
    sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
    properties: ['dealname', 'createdate', 'sonty_reuzenpanda_link', 'sonty_offerte_link', 'sonty_first_quote_amount', 'product_categorie', 'inkoopbedrag', 'amount', 'sonty_wa_contact_gehad', 'sonty_wa_status', 'sonty_wa_link', 'sonty_niet_bellen'],
    limit: LIMIT,
  };
  // Pagineer: bij 'all' alle pagina's ophalen, anders alleen de eerste (max LIMIT)
  let todo = [];
  let after;
  let total = 0;
  do {
    const page = (await jpost(`${BASE}/crm/v3/objects/deals/search`, after ? { ...body, after } : body)).data;
    total = page.total;
    todo.push(...(page.results || []));
    after = page.paging && page.paging.next && page.paging.next.after;
  } while (ALL && after && todo.length < total);
  if (!ALL) todo = todo.slice(0, LIMIT);
  console.log(`Verse leads totaal: ${total}. Verwerk: ${todo.length}${DRY ? ' (DRY)' : ''}\n`);

  // "TE VER"-leads uit het register laden (niet bellen).
  // Faalt dit, dan SLAAN we de run OVER: doorgaan zonder uitsluiting zou bel-taken
  // aanmaken voor TE VER-leads. Volgende cron-run (15 min) probeert het opnieuw.
  let teVer;
  try {
    teVer = await getTeVer();
    console.log(`Uitsluiting: ${teVer.phones.size} TE VER + ${teVer.akkoordPhones.size} akkoord/ingekocht (tabs: ${teVer.scannedTabs.join(', ')})\n`);
    if (teVer.missingMonths && teVer.missingMonths.length) {
      await alertThrottled('tab', '⚠️ Bel-taken: maandtab(s) niet gevonden in offerte-register: ' + teVer.missingMonths.join(', ') + '. TE VER-uitsluiting voor die maand(en) ontbreekt — check de tabnaam in de sheet.');
    }
  } catch (e) {
    console.log(`❌ TE VER-lijst niet geladen (${e.message}) — run OVERGESLAGEN\n`);
    await alertThrottled('fail', '🚨 Bel-taken run overgeslagen: TE VER-lijst kon niet geladen worden (' + e.message.substring(0, 150) + '). Zonder die lijst zouden TE VER-leads een bel-taak krijgen. Volgende run probeert opnieuw.');
    process.exit(1);
  }

  let created = 0, updated = 0, skipped = 0, teVerSkip = 0;
  for (const d of todo) {
    await new Promise(r => setTimeout(r, 80)); // throttle tegen rate limits
    const id = d.id, naam = d.properties.dealname || 'Onbekend';
    // proefleads (belscherm-test) krijgen geen bel-taak
    if (/proefklant|\btest\b/i.test(naam)) continue;
    // contact + telefoon
    const ac = await jget(`${BASE}/crm/v4/objects/deals/${id}/associations/contacts`);
    const cid = ac.results && ac.results[0] && ac.results[0].toObjectId;
    let tel = '(geen nummer)', mail = '';
    if (cid) {
      const c = await jget(`${BASE}/crm/v3/objects/contacts/${cid}?properties=phone,mobilephone,email`);
      tel = c.properties.phone || c.properties.mobilephone || '(geen nummer)';
      mail = c.properties.email || '';
    }
    // Uitsluiten? TE VER (kolom F) OF al akkoord/ingekocht (sheet kolom W/L of HubSpot inkoopbedrag).
    // Zo ja: geen bel-taak; bestaande open bel-taak verwijderen.
    const np = normPhone(tel);
    const naamLower = naam.trim().toLowerCase();
    const inkoopHS = parseFloat(d.properties.inkoopbedrag || '0') || 0;
    let reden = null;
    if ((np && teVer.phones.has(np)) || teVer.names.has(naamLower)) reden = 'TE VER';
    else if (inkoopHS > 0 || (np && teVer.akkoordPhones.has(np)) || teVer.akkoordNames.has(naamLower)) reden = 'AKKOORD';
    if (reden) {
      if (!DRY) {
        const ex = await getOpenBelTaak(id); if (ex) await fetch(`${BASE}/crm/v3/objects/tasks/${ex}`, { method: 'DELETE', headers: H });
        // vlag voor het belscherm (sonty.nl/admin/belscherm): deze lead niet bellen
        if (d.properties.sonty_niet_bellen !== 'true') await jpatch(`${BASE}/crm/v3/objects/deals/${id}`, { properties: { sonty_niet_bellen: 'true' } });
      }
      console.log(`${reden}  ${naam} — overgeslagen`);
      teVerSkip++; continue;
    }
    const taskBody = buildBody({
      naam, tel, mail,
      createdate: d.properties.createdate,
      rp: d.properties.sonty_reuzenpanda_link,
      offerteLink: d.properties.sonty_offerte_link,
      quote: d.properties.sonty_first_quote_amount,
      product: d.properties.product_categorie,
      amount: d.properties.amount,
      waContact: d.properties.sonty_wa_contact_gehad,
      waStatus: d.properties.sonty_wa_status,
      waLink: d.properties.sonty_wa_link,
      dealUrl: `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${id}`,
    });
    if (DRY) { console.log(`DRY  ${naam} | tel ${tel}`); continue; }

    const existing = await getOpenBelTaak(id);
    if (existing) {
      const u = await jpatch(`${BASE}/crm/v3/objects/tasks/${existing}`, { properties: { hs_task_body: taskBody, hs_task_priority: 'HIGH', hs_task_type: 'CALL' } });
      console.log(u.ok ? `UPD  ${naam} — taak ${existing} ververst` : `FAIL ${naam} — ${u.status}`);
      if (u.ok) updated++;
      continue;
    }
    const task = await jpost(`${BASE}/crm/v3/objects/tasks`, { properties: {
      hs_task_subject: `📞 Bel: ${naam}`,
      hs_task_body: taskBody,
      hs_task_status: 'NOT_STARTED',
      hs_task_priority: 'HIGH',
      hs_task_type: 'CALL',
      // due = moment dat de lead binnenkwam → oudste leads bovenaan in de queue (oplopend op due-datum)
      hs_timestamp: String(new Date(d.properties.createdate || Date.now()).getTime()),
      hubspot_owner_id: String(OWNER),
    } });
    if (!task.ok) { console.log(`FAIL ${naam} — ${task.status} ${JSON.stringify(task.data).slice(0, 160)}`); continue; }
    const tid = task.data.id;
    await fetch(`${BASE}/crm/v4/objects/tasks/${tid}/associations/default/deals/${id}`, { method: 'PUT', headers: H });
    if (cid) await fetch(`${BASE}/crm/v4/objects/tasks/${tid}/associations/default/contacts/${cid}`, { method: 'PUT', headers: H });
    console.log(`OK   ${naam} — taak ${tid} | tel ${tel}`);
    created++;
  }
  console.log(`\nKlaar. Aangemaakt: ${created}, ververst: ${updated}, uitgesloten (TE VER/akkoord): ${teVerSkip}`);
})();
