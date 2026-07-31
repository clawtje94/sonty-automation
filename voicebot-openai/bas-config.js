// Gedeelde Bas-config: prompt, tools en kennisbank-zoekfunctie.
// Gebruikt door server.js en scenario-test.js.
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const MODEL_DEFAULT = 'gpt-realtime-2.1';

// Kennisbank opdelen in ###-secties met hun ##-deel als context
function kennisbankSecties() {
  const tekst = fs.readFileSync(path.join(DATA, 'trengo-kennisbank.md'), 'utf8');
  const regels = tekst.split('\n');
  const secties = [];
  let deel = '', kop = '', buf = [];
  const push = () => { if (kop && buf.length) secties.push({ deel, kop, tekst: buf.join('\n').trim() }); };
  for (const r of regels) {
    if (r.startsWith('## ') && !r.startsWith('###')) { push(); deel = r.slice(3).trim(); kop = ''; buf = []; }
    else if (r.startsWith('### ')) { push(); kop = r.slice(4).trim(); buf = []; }
    else buf.push(r);
  }
  push();
  return secties;
}
const SECTIES = kennisbankSecties();

const STOP = new Set(['voor', 'naar', 'zijn', 'wordt', 'worden', 'heeft', 'hebben', 'deze', 'die', 'dat', 'een', 'het', 'ook', 'wat', 'hoe', 'kan', 'kunnen', 'over', 'jullie', 'graag', 'welke', 'mijn', 'jouw', 'dan', 'nog', 'wel', 'niet', 'met', 'van', 'bij', 'als']);

function kennisbankOpzoeken(vraag) {
  const termen = String(vraag || '').toLowerCase().replace(/[^a-z0-9à-ÿ\- ]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  const scored = SECTIES.map((s) => {
    const inhoud = (s.deel + ' ' + s.kop + ' ' + s.tekst).toLowerCase();
    const kopL = (s.deel + ' ' + s.kop).toLowerCase();
    let score = 0;
    for (const t of termen) {
      if (kopL.includes(t)) score += 5;
      score += Math.min(3, inhoud.split(t).length - 1);
    }
    return { s, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return 'Niets gevonden in de kennisbank over deze vraag. Zeg dat een collega dit bevestigt.';
  let uit = '';
  for (const { s } of scored.slice(0, 3)) {
    const blok = `[${s.deel} — ${s.kop}]\n${s.tekst}\n\n`;
    if (uit.length + blok.length > 6000) break;
    uit += blok;
  }
  return uit.trim();
}

function leesInstructies() {
  const prompt = fs.readFileSync(path.join(DATA, 'sunny-prompt.txt'), 'utf8');
  if (process.env.BAS_VOLLEDIGE_KENNISBANK === '1') {
    const kennisbank = fs.readFileSync(path.join(DATA, 'trengo-kennisbank.md'), 'utf8');
    return prompt + '\n\n=== KENNISBANK ===\n' + kennisbank;
  }
  return prompt + `

KENNISBANK: je hebt de tool kennisbank_opzoeken. Roep die aan VOORDAT je antwoordt bij elke vraag over producten, modellen, opties, doeken, kleuren, bediening, showroom, openingstijden, team, werkwijze, montage of levertijden. Alleen de FEITEN hierboven en toolresultaten uit dit gesprek zijn betrouwbaar; verzin niets zelf. Zeg eventueel kort iets als "momentje" terwijl je zoekt.

TAAL EN ACCENT: je spreekt UITSLUITEND Nederlands, ook als de beller Engels of een andere taal probeert. Spreek als een geboren Nederlander: neutraal Nederlands accent, Nederlandse zinsmelodie, geen Engelse of Amerikaanse tongval, geen Engelse woorden waar een Nederlands woord bestaat.

OPNEMEN: bij de start van het gesprek neem JIJ op, zoals een medewerker aan de telefoon: kort en warm, bijvoorbeeld "Goedemiddag, je spreekt met Bas van Sonty, waarmee kan ik je helpen?" (varieer de formulering, houd het kort). Daarna wacht je op de beller.`;
}

const TOOLS = [
  {
    type: 'function',
    name: 'prijs_berekenen',
    description:
      'Berekent de actuele Sonty-prijs (product+montage, incl btw). product: rolluikS37, rolluikS42, ' +
      'screenSquare85100, zipSquare85100, suneye, sunbasic, suneyeXL, sunelite, suncube150, ' +
      'sunproject100, suncontrol150. breedte/hoogte in mm (hoogte = uitval bij knikarm/veranda). ' +
      'bediening: io, draaischakelaar, solar, handbediend.',
    parameters: {
      type: 'object',
      properties: {
        product: { type: 'string' },
        breedte: { type: 'number' },
        hoogte: { type: 'number' },
        bediening: { type: 'string' },
      },
      required: ['product', 'breedte', 'hoogte'],
    },
  },
  {
    type: 'function',
    name: 'kennisbank_opzoeken',
    description: 'Zoekt in de Sonty-kennisbank. Geef de klantvraag of het onderwerp als zoekvraag; je krijgt de relevante secties terug.',
    parameters: {
      type: 'object',
      properties: { vraag: { type: 'string' } },
      required: ['vraag'],
    },
  },
  {
    type: 'function',
    name: 'end_call',
    description: 'Beëindigt het telefoongesprek nadat de klant afscheid heeft genomen.',
    parameters: { type: 'object', properties: {} },
  },
];

async function prijsBerekenen(q) {
  const u = `https://sonty-website.vercel.app/api/offerte-tool?action=prijs&product=${encodeURIComponent(q.product || '')}` +
    `&breedte=${encodeURIComponent(q.breedte || '')}&hoogte=${encodeURIComponent(q.hoogte || '')}` +
    `&bediening=${encodeURIComponent(q.bediening || 'io')}`;
  const j = await (await fetch(u)).json();
  return { totaal: j.totaal, boekprijs: j.boekprijs, montagePrijs: j.montagePrijs, error: j.error || null };
}

module.exports = { MODEL_DEFAULT, leesInstructies, TOOLS, prijsBerekenen, kennisbankOpzoeken };
