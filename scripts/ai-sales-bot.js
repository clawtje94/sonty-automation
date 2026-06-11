#!/usr/bin/env node
/**
 * Sonty AI Sales Bot — WhatsApp via Trengo
 *
 * Draait elke minuut, checkt nieuwe berichten, antwoordt via Claude AI.
 *
 * Flow:
 * 1. Poll Trengo voor nieuwe inbound WhatsApp berichten
 * 2. Stuur bericht + context naar Claude API
 * 3. Claude genereert sales-gericht antwoord
 * 4. Stuur antwoord via Trengo API
 * 5. Log gesprek voor zelflering
 */

const fs = require('fs');
const path = require('path');

const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const HS_TOKEN = require('./secrets').HUBSPOT_TOKEN;
const HS_BASE = 'https://api.hubapi.com';
const SONNY_USER_ID = 747786; // Sonny Sonty bot user in Trengo
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'sonty-bot-prompt.md'), 'utf8').trim();
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
const WA_CHANNEL_ID = 1359857;
const STATE_FILE = path.join(__dirname, '.bot-state.json');
const LOG_DIR = path.join(__dirname, '..', 'data', 'bot-conversations');

// Ensure log dir exists
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Track which messages we've already processed
function getState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { lastCheck: null, processed: {} }; } }
function saveState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }



async function trengoAPI(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('https://app.trengo.com/api/v2' + endpoint, opts);
  return res.json();
}

async function askClaude(messages, customerContext) {
  if (!CLAUDE_API_KEY) {
    console.log('  ⚠️ ANTHROPIC_API_KEY niet ingesteld — dry run');
    return '(Bot is in test modus — geen Claude API key)';
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT + '\n\n## Klant context\n' + customerContext,
      messages: messages,
    }),
  });

  const data = await res.json();
  let reply = data.content?.[0]?.text;

  // Veiligheidsfilter: corrigeer bekende fouten voordat het verstuurd wordt
  if (reply) {
    // Fix "gratis inmeting" → altijd vervangen
    reply = reply.replace(/gratis inmet(ing|en)/gi, 'inmeting (€75, bij afname verrekend)');
    reply = reply.replace(/gratis opmeting/gi, 'inmeting (€75, bij afname verrekend)');
    reply = reply.replace(/kosteloz?e? inmet/gi, 'inmeting (€75, bij afname verrekend)');
    // Fix oude levertijd
    reply = reply.replace(/4-6 weken/g, '6-8 weken');
    reply = reply.replace(/4 tot 6 weken/g, '6 tot 8 weken');
    // Fix lamellen pergola
    reply = reply.replace(/lamellen ?pergola/gi, 'pergola met ZIP-screen');
  }

  // NOOIT een leeg of fout bericht sturen
  if (!reply || reply.length < 5 || reply.includes('geen antwoord') || reply.includes('test modus') || reply.includes('ERROR')) {
    console.log('  ⛔ GEBLOKKEERD: geen geldig antwoord van Claude:', JSON.stringify(data).substring(0, 200));

    // Check of credits op zijn → stuur alert mail via Trengo
    if (JSON.stringify(data).includes('credit balance')) {
      try {
        const alertSent = path.join(__dirname, '.credits-alert-sent');
        if (!fs.existsSync(alertSent) || Date.now() - fs.statSync(alertSent).mtimeMs > 86400000) {
          await trengoAPI('/tickets', 'POST', {
            channel_id: 1347356, // Email kanaal
            contact_id: null,
            subject: '⚠️ Sonny Bot: Anthropic credits zijn op!',
            message: 'De AI sales bot kan niet meer reageren omdat de Anthropic API credits op zijn.\\n\\nGa naar https://console.anthropic.com → Plans & Billing → Buy Credits om credits toe te voegen.\\n\\n$5-10 is genoeg voor weken.',
            recipient_email: 'daimy@sonty.nl',
          });
          fs.writeFileSync(alertSent, new Date().toISOString());
          console.log('  📧 Alert mail verstuurd naar daimy@sonty.nl');
        }
      } catch {}
    }

    return null;
  }

  return reply;
}

async function getConversationHistory(ticketId) {
  const data = await trengoAPI('/tickets/' + ticketId + '/messages?limit=20');
  return (data.data || []).map(m => ({
    role: m.type === 'INBOUND' ? 'user' : 'assistant',
    content: m.body || m.message || '',
  })).reverse(); // oldest first
}

async function sendReply(ticketId, message) {
  return trengoAPI('/tickets/' + ticketId + '/messages', 'POST', {
    message: message,
    type: 'OUTBOUND',
  });
}

function logConversation(ticketId, contact, messages, botReply) {
  const logFile = path.join(LOG_DIR, ticketId + '.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    contact: contact,
    messages: messages.slice(-5),
    botReply: botReply,
  };
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
}

async function processNewMessages() {
  const state = getState();

  // Get recent WhatsApp tickets (all statuses)
  const tickets = await trengoAPI('/tickets?channel_id=' + WA_CHANNEL_ID + '&limit=20');

  // Tickets waar een mens het heeft overgenomen — bot stopt
  if (!state.humanTakeover) state.humanTakeover = {};

  let processed = 0;
  for (const ticket of (tickets.data || [])) {
    const ticketId = ticket.id;
    const contact = ticket.contact || {};
    const contactName = contact.full_name || contact.name || 'klant';

    // Skip als een mens dit ticket al heeft overgenomen
    if (state.humanTakeover[ticketId]) continue;

    // Get messages
    const messagesData = await trengoAPI('/tickets/' + ticketId + '/messages?limit=20');
    const messages = messagesData.data || [];

    if (messages.length === 0) continue;

    // Check of een MENS (niet de API) een outbound bericht heeft gestuurd → bot stopt
    for (const m of messages) {
      if (m.type === 'OUTBOUND' && m.user_id && m.user_id !== 736327) {
        // user_id 736327 = Daimy (API user). Ander user_id = mens heeft overgenomen
        // Actually check: als het bericht NIET via API is gestuurd (heeft whatsapp_message_id maar geen bot marker)
      }
      // Simpeler: als er een outbound bericht is van een ANDER user_id dan de API, is het een mens
      if (m.type === 'OUTBOUND' && m.body_type === 'TEXT' && !m.is_auto_reply) {
        // Check of dit bericht door het team is gestuurd (niet via onze API)
        // Bot berichten hebben user_id van de API owner. Handmatige berichten hebben een ander user_id.
        const isManualReply = m.user_id && m.user_id !== 736327 && m.user_id !== SONNY_USER_ID;
        if (isManualReply) {
          state.humanTakeover[ticketId] = new Date().toISOString();
          console.log('  👤 Mens heeft ticket #' + ticketId + ' overgenomen (' + contactName + ') → bot stopt');
          break;
        }
      }
    }
    if (state.humanTakeover[ticketId]) continue;

    // Check if last message is INBOUND (from customer) and not yet processed
    const lastMsg = messages[0]; // newest first
    if (lastMsg.type !== 'INBOUND') continue;

    const msgId = lastMsg.id.toString();
    if (state.processed[msgId]) continue;

    // Verzamel ALLE opeenvolgende inbound berichten (klant stuurt vaak 2-3 berichten)
    const inboundMessages = [];
    for (const m of messages) {
      if (m.type === 'INBOUND') {
        if (state.processed[m.id.toString()]) break;
        inboundMessages.unshift(m.body || m.message || '');
      } else {
        break; // stop bij eerste outbound (= ons vorige antwoord)
      }
    }

    const customerMessage = inboundMessages.filter(m => m.trim()).join('\n');
    if (!customerMessage.trim()) continue;

    // Mark alle inbound berichten als processed
    for (const m of messages) {
      if (m.type === 'INBOUND' && !state.processed[m.id.toString()]) {
        state.processed[m.id.toString()] = new Date().toISOString();
      } else if (m.type !== 'INBOUND') break;
    }

    console.log('\n📨 ' + inboundMessages.length + ' bericht(en) van ' + contactName + ': ' + customerMessage.substring(0, 80));

    // Check for #feedback command from Daimy or Joey
    if (customerMessage.trim().toLowerCase().startsWith('#feedback')) {
      const feedback = customerMessage.replace(/^#feedback\s*/i, '').trim();
      if (feedback) {
        // Save feedback
        const feedbackFile = path.join(LOG_DIR, 'feedback.jsonl');
        fs.appendFileSync(feedbackFile, JSON.stringify({
          timestamp: new Date().toISOString(),
          from: contactName,
          phone: contact.phone,
          ticketId: ticketId,
          feedback: feedback,
        }) + '\n');

        // Confirm via WhatsApp
        await sendReply(ticketId, '✅ Feedback ontvangen! Ik pas dit aan: "' + feedback.substring(0, 100) + '"');
        console.log('📝 Feedback opgeslagen: ' + feedback.substring(0, 60));

        state.processed[msgId] = new Date().toISOString();
        processed++;
        continue;
      }
    }

    // Build conversation history for Claude
    const history = messages.reverse().map(m => ({
      role: m.type === 'INBOUND' ? 'user' : 'assistant',
      content: m.body || m.message || '',
    })).filter(m => m.content.trim());

    // Build customer context
    const customerContext = [
      'Naam: ' + contactName,
      'Telefoon: ' + (contact.phone || '?'),
      'Ticket: #' + ticketId,
    ].join('\n');

    // Ask Claude for response
    const botReply = await askClaude(history, customerContext);
    if (!botReply) { console.log('  ⛔ Geen antwoord — wordt niet verstuurd'); state.processed[msgId] = new Date().toISOString(); continue; }
    console.log('🤖 Antwoord: ' + botReply.substring(0, 80));

    // Check if bot should escalate to human
    const needsHuman = botReply.includes('collega') || botReply.includes('schakel') || botReply.includes('even iemand');

    // Check if appointment was confirmed (bot mentions a day/time)
    const appointmentConfirmed = /(?:staat genoteerd|ingepland|afspraak.*bevestig|tot (?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag))/i.test(botReply);

    // Send reply via Trengo — ALLEEN als we een geldig antwoord hebben
    if (botReply && botReply.length > 5) {
      await sendReply(ticketId, botReply);
      console.log('✅ Verstuurd!');

      try {
        if (needsHuman) {
          // Escaleer: unassign ticket zodat het in "New" komt + label
          await trengoAPI('/tickets/' + ticketId, 'PUT', { user_id: null });
          await trengoAPI('/tickets/' + ticketId + '/labels', 'POST', { label_id: 1821764 }); // 👤 Mens nodig
          state.humanTakeover[ticketId] = new Date().toISOString();
          console.log('  👤 Geëscaleerd naar team');
        } else {
          // Assign aan Sonny Bot + label
          // Bot assigned niet meer - ticket blijft in NEW zodat team kan meelezen
          await trengoAPI('/tickets/' + ticketId + '/labels', 'POST', { label_id: 1821763 }); // 🤖 AI Bot
        }

        if (appointmentConfirmed) {
          // Showroom afspraak → team moet inplannen via Bookings
          await trengoAPI('/tickets/' + ticketId, 'PUT', { user_id: null });
          await trengoAPI('/tickets/' + ticketId + '/labels', 'POST', { label_id: 1816444 }); // Showroom bezoek
          console.log('  📅 Showroom afspraak → team pakt op');
        }
      } catch {}
    }

    // Log conversation
    logConversation(ticketId.toString(), contactName, history, botReply);

    // Save conversation summary to HubSpot as note on matching deal
    try {
      const phone = contact.phone || '';
      if (phone) {
        // Find HubSpot contact by phone
        const hsSearch = await fetch(HS_BASE + '/crm/v3/objects/contacts/search', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + HS_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'phone', operator: 'EQ', value: phone }] }], limit: 1 }),
        });
        const hsData = await hsSearch.json();
        const contactId = hsData.results?.[0]?.id;

        if (contactId) {
          // Get associated deals
          const assocRes = await (await fetch(HS_BASE + '/crm/v4/objects/contacts/' + contactId + '/associations/deals', { headers: { 'Authorization': 'Bearer ' + HS_TOKEN } })).json();
          const dealId = assocRes.results?.[0]?.toObjectId;

          if (dealId) {
            // Build summary
            const lastMessages = history.slice(-4).map(m => (m.role === 'user' ? '← Klant: ' : '→ Bot: ') + m.content.substring(0, 100)).join('\n');
            const noteBody = '📱 WhatsApp gesprek (AI Bot)\n\n' + lastMessages + '\n\n---\nTrengo ticket #' + ticketId;

            // Create note
            const noteRes = await fetch(HS_BASE + '/crm/v3/objects/notes', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + HS_TOKEN, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                properties: { hs_note_body: noteBody, hs_timestamp: new Date().toISOString() },
                associations: [{ to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] }],
              }),
            });
            if (noteRes.ok) console.log('  📋 HubSpot note op deal #' + dealId);
          }
        }
      }
    } catch (e) {
      console.log('  ⚠️ HubSpot note fout:', e.message?.substring(0, 60));
    }

    // Mark as processed
    state.processed[msgId] = new Date().toISOString();
    processed++;

    await new Promise(r => setTimeout(r, 1000)); // Rate limit
  }

  // Clean old processed entries (keep last 1000)
  if (state.processed && typeof state.processed === 'object') {
    const processedEntries = Object.entries(state.processed);
    if (processedEntries.length > 1000) {
      state.processed = Object.fromEntries(processedEntries.slice(-500));
    }
  }

  state.lastCheck = new Date().toISOString();
  saveState(state);

  if (processed > 0) {
    console.log('\n✅ ' + processed + ' bericht(en) verwerkt');
  }

  return processed;
}

// Main
if (require.main === module) {
  const cmd = process.argv[2];

  if (cmd === 'once') {
    // Run once
    processNewMessages().catch(console.error);
  } else if (cmd === 'watch') {
    // Poll every 60 seconds
    console.log('🤖 Sonty AI Sales Bot gestart — polling elke 60s');
    const run = async () => {
      try { await processNewMessages(); } catch (e) { console.error('Fout:', e.message); }
      setTimeout(run, 60000);
    };
    run();
  } else {
    console.log('Sonty AI Sales Bot');
    console.log('  node ai-sales-bot.js once   — verwerk nieuwe berichten (1x)');
    console.log('  node ai-sales-bot.js watch  — continu draaien (elke 60s)');
    console.log('');
    console.log('Vereist: ANTHROPIC_API_KEY environment variable');
  }
}

module.exports = { processNewMessages };
