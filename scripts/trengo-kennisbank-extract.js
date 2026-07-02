#!/usr/bin/env node
/**
 * Trengo Kennisbank Extractie
 *
 * Haalt alle tickets + berichten op van de afgelopen 12 maanden
 * uit alle Trengo kanalen. Slaat op als JSON voor analyse.
 */

const fs = require('fs');
const path = require('path');
const { getToken } = require('./trengo-api.js');

const OUTPUT_FILE = path.join(__dirname, '../data/trengo-alle-gesprekken.json');
const PROGRESS_FILE = path.join(__dirname, '../data/trengo-extract-progress.json');
const TWELVE_MONTHS_AGO = new Date(Date.now() - 365 * 86400000).toISOString();

async function trengoGet(token, endpoint) {
  const res = await fetch('https://app.trengo.com/api/v2' + endpoint, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
  });
  if (!res.ok) {
    if (res.status === 429) {
      console.log('  Rate limit, wacht 30s...');
      await new Promise(r => setTimeout(r, 30000));
      return trengoGet(token, endpoint);
    }
    return null;
  }
  return res.json();
}

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data));
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch { return null; }
}

async function main() {
  const token = await getToken();
  console.log('Token OK');

  // Load progress if exists
  let progress = loadProgress();
  let allTickets = [];
  let startPage = 1;

  if (progress && progress.tickets) {
    allTickets = progress.tickets;
    startPage = progress.nextPage || 1;
    console.log('Hervat vanaf pagina ' + startPage + ' (' + allTickets.length + ' tickets al opgehaald)');
  }

  // STAP 1: Alle tickets ophalen (paginated)
  console.log('\n=== STAP 1: Tickets ophalen ===');
  let page = startPage;
  let hasMore = true;
  let tooOld = false;

  while (hasMore && !tooOld) {
    const data = await trengoGet(token, '/tickets?page=' + page);
    if (!data || !data.data || data.data.length === 0) {
      hasMore = false;
      break;
    }

    for (const ticket of data.data) {
      // Check of ticket binnen 12 maanden valt
      if (ticket.created_at < TWELVE_MONTHS_AGO.substring(0, 10)) {
        tooOld = true;
        break;
      }

      allTickets.push({
        id: ticket.id,
        status: ticket.status,
        subject: ticket.subject,
        created_at: ticket.created_at,
        closed_at: ticket.closed_at,
        channel_type: ticket.channel?.type,
        channel_name: ticket.channel?.title,
        channel_id: ticket.channel?.id,
        contact_name: ticket.contact?.full_name || ticket.contact?.name,
        contact_email: ticket.contact?.email,
        contact_phone: ticket.contact?.phone,
        messages_count: ticket.messages_count,
        labels: ticket.labels?.map(l => l.name) || [],
        latest_message: ticket.latest_message?.message?.substring(0, 500),
        latest_message_type: ticket.latest_message?.type,
      });
    }

    // Save progress every 5 pages
    if (page % 5 === 0) {
      saveProgress({ tickets: allTickets, nextPage: page + 1 });
      console.log('  Pagina ' + page + ' — ' + allTickets.length + ' tickets (progress opgeslagen)');
    } else {
      process.stdout.write('  p' + page + '(' + allTickets.length + ') ');
    }

    hasMore = !!data.links?.next;
    page++;

    // Rate limit pauze
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n\nTotaal tickets: ' + allTickets.length);

  // STAP 2: Berichten ophalen per ticket
  console.log('\n=== STAP 2: Berichten ophalen ===');
  let msgCount = 0;
  let ticketsWithMessages = 0;

  for (let i = 0; i < allTickets.length; i++) {
    const ticket = allTickets[i];

    // Skip als berichten al opgehaald
    if (ticket.messages) continue;

    const msgs = await trengoGet(token, '/tickets/' + ticket.id + '/messages');
    const msgList = (msgs?.data || msgs || []);

    ticket.messages = msgList.map(m => ({
      type: m.type, // INBOUND / OUTBOUND
      body: (m.body || m.message || '').substring(0, 2000),
      created_at: m.created_at,
      sender: m.agent?.name || m.user?.name || null,
    }));

    msgCount += ticket.messages.length;
    ticketsWithMessages++;

    // Progress en rate limiting
    if (i % 20 === 0 && i > 0) {
      saveProgress({ tickets: allTickets, nextPage: page, messagesPhase: true, lastIndex: i });
      console.log('  ' + i + '/' + allTickets.length + ' tickets — ' + msgCount + ' berichten');
    }

    // Rate limit: 1 request per 300ms
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\nTotaal: ' + allTickets.length + ' tickets, ' + msgCount + ' berichten');

  // STAP 3: Opslaan
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allTickets, null, 2));
  console.log('Opgeslagen: ' + OUTPUT_FILE);

  // Cleanup progress file
  try { fs.unlinkSync(PROGRESS_FILE); } catch {}

  // Quick stats
  const channels = {};
  const months = {};
  for (const t of allTickets) {
    channels[t.channel_name || t.channel_type] = (channels[t.channel_name || t.channel_type] || 0) + 1;
    const month = (t.created_at || '').substring(0, 7);
    months[month] = (months[month] || 0) + 1;
  }
  console.log('\n=== Per kanaal ===');
  for (const [k, v] of Object.entries(channels).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + v + 'x ' + k);
  }
  console.log('\n=== Per maand ===');
  for (const [k, v] of Object.entries(months).sort()) {
    console.log('  ' + k + ': ' + v);
  }
}

main().catch(e => {
  console.error('FOUT:', e.message);
  process.exit(1);
});
