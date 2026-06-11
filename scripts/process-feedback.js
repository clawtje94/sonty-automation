#!/usr/bin/env node
/**
 * Haal feedback op van de review pagina en verwerk in de bot kennis.
 * Draai periodiek of handmatig: node scripts/process-feedback.js
 */

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_FILE = path.join(__dirname, 'sonty-product-knowledge.json');
const TRAINING_FILE = path.join(__dirname, '..', 'data', 'bot-training-100.json');
const PROCESSED_FILE = path.join(__dirname, '.feedback-processed.json');

function getProcessed() { try { return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8')); } catch { return []; } }

async function main() {
  // Fetch feedback from BOTH sources: Vercel review page + WhatsApp #feedback
  let allFeedback = [];

  // Source 1: Vercel review page
  try {
    const res = await fetch('https://sonty-website.vercel.app/api/bot-feedback');
    const webFeedback = await res.json();
    allFeedback.push(...webFeedback.map(f => ({ ...f, source: 'web' })));
  } catch {}

  // Source 2: WhatsApp #feedback messages
  try {
    const waFile = path.join(LOG_DIR, 'feedback.jsonl');
    if (fs.existsSync(waFile)) {
      const lines = fs.readFileSync(waFile, 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const fb = JSON.parse(line);
        allFeedback.push({
          conversationId: 'wa-' + fb.ticketId,
          rating: 'bad',
          comment: fb.feedback,
          source: 'whatsapp',
          from: fb.from,
        });
      }
    }
  } catch {}

  const processed = getProcessed();
  const newFeedback = allFeedback.filter(f => !processed.includes(f.conversationId));

  if (newFeedback.length === 0) {
    console.log('Geen nieuwe feedback.');
    return;
  }

  console.log(`${newFeedback.length} nieuwe feedback(s):`);

  // Load training data for context
  const training = JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf8'));
  const knowledge = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));

  const badFeedback = [];
  const goodFeedback = [];

  for (const fb of newFeedback) {
    const conv = training.find(t => t.id === fb.conversationId);
    const emoji = fb.rating === 'good' ? '👍' : '👎';
    console.log(`  ${emoji} #${fb.conversationId}: "${conv?.klant || '?'}" → ${fb.comment || '(geen comment)'}`);

    if (fb.rating === 'bad' && fb.comment) {
      badFeedback.push({
        klant_vraag: conv?.klant,
        bot_antwoord: conv?.bot,
        feedback: fb.comment,
      });
    } else if (fb.rating === 'good') {
      goodFeedback.push({
        klant_vraag: conv?.klant,
        bot_antwoord: conv?.bot,
      });
    }

    processed.push(fb.conversationId);
  }

  // Save processed IDs
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processed));

  // Add bad feedback as corrections to knowledge
  if (badFeedback.length > 0) {
    if (!knowledge.feedback_correcties) knowledge.feedback_correcties = [];
    knowledge.feedback_correcties.push(...badFeedback.map(f => ({
      datum: new Date().toISOString().substring(0, 10),
      vraag: f.klant_vraag,
      fout_antwoord: f.bot_antwoord?.substring(0, 100),
      correctie: f.feedback,
    })));
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));
    console.log(`\n📝 ${badFeedback.length} correctie(s) toegevoegd aan kennisbank.`);
  }

  // Log good examples
  if (goodFeedback.length > 0) {
    if (!knowledge.goede_voorbeelden) knowledge.goede_voorbeelden = [];
    knowledge.goede_voorbeelden.push(...goodFeedback.map(f => ({
      vraag: f.klant_vraag,
      antwoord: f.bot_antwoord?.substring(0, 150),
    })));
    // Keep max 20 good examples
    knowledge.goede_voorbeelden = knowledge.goede_voorbeelden.slice(-20);
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));
    console.log(`✅ ${goodFeedback.length} goede voorbeeld(en) opgeslagen.`);
  }

  console.log('\nKlaar! Herstart de bot om de nieuwe kennis te laden.');
}

main().catch(console.error);
