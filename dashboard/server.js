const express = require('express');
const path = require('path');
const app = express();
const PORT = 3456;

const HUBSPOT_TOKEN = require('../scripts/secrets').HUBSPOT_TOKEN;
const HUBSPOT_BASE = 'https://api.hubapi.com';
const PIPELINE_ID = '3623322812';

const DEAL_PROPERTIES = [
  'dealname', 'amount', 'inkoopbedrag', 'product_categorie',
  'verkoop_excl_btw', 'inkoop_excl_btw', 'dealstage', 'pipeline',
  'createdate', 'closedate', 'days_to_close', 'hs_analytics_source',
  'hs_is_closed_won', 'hs_is_closed_lost', 'closed_lost_reason',
  'eerste_offertebedrag', 'definitief_offertebedrag', 'afspraak_type',
  'lead_kwaliteit', 'lead_score', 'aantal_belpogingen', 'laatste_belpoging',
  'nurture_fase', 'offerte_verstuurd_datum', 'review_verstuurd'
];

// Cache
let cache = { deals: null, pipeline: null, timestamp: 0 };
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

async function hubspotFetch(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchAllDeals() {
  const allDeals = [];
  let after = undefined;
  const props = DEAL_PROPERTIES.join(',');

  while (true) {
    let url = `${HUBSPOT_BASE}/crm/v3/objects/deals?limit=100&properties=${props}`;
    if (after) url += `&after=${after}`;
    const data = await hubspotFetch(url);

    // Filter to only Sonty pipeline deals
    const pipelineDeals = data.results.filter(
      d => d.properties.pipeline === PIPELINE_ID
    );
    allDeals.push(...pipelineDeals);

    if (data.paging && data.paging.next && data.paging.next.after) {
      after = data.paging.next.after;
    } else {
      break;
    }
  }
  return allDeals;
}

async function fetchPipeline() {
  const data = await hubspotFetch(`${HUBSPOT_BASE}/crm/v3/pipelines/deals/${PIPELINE_ID}`);
  return data;
}

async function getData() {
  const now = Date.now();
  if (cache.deals && cache.pipeline && (now - cache.timestamp) < CACHE_TTL) {
    return { deals: cache.deals, pipeline: cache.pipeline };
  }
  const [deals, pipeline] = await Promise.all([fetchAllDeals(), fetchPipeline()]);
  cache = { deals, pipeline, timestamp: now };
  return { deals, pipeline };
}

// Ad spend storage (simple JSON file)
const AD_SPEND_FILE = path.join(__dirname, 'ad-spend.json');

function loadAdSpend() {
  try {
    return JSON.parse(require('fs').readFileSync(AD_SPEND_FILE, 'utf8'));
  } catch { return []; }
}

function saveAdSpend(data) {
  require('fs').writeFileSync(AD_SPEND_FILE, JSON.stringify(data, null, 2));
}

// Serve static files
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API routes
app.get('/api/deals', async (req, res) => {
  try {
    const { deals } = await getData();
    res.json({ deals });
  } catch (err) {
    console.error('Error fetching deals:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pipeline', async (req, res) => {
  try {
    const { pipeline } = await getData();
    res.json(pipeline);
  } catch (err) {
    console.error('Error fetching pipeline:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/all', async (req, res) => {
  try {
    const data = await getData();
    data.adSpend = loadAdSpend();
    res.json(data);
  } catch (err) {
    console.error('Error fetching data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ad spend CRUD
app.get('/api/ad-spend', (req, res) => {
  res.json(loadAdSpend());
});

app.post('/api/ad-spend', (req, res) => {
  const { month, google, meta } = req.body;
  if (!month) return res.status(400).json({ error: 'month is required (YYYY-MM)' });
  const data = loadAdSpend();
  const existing = data.find(d => d.month === month);
  if (existing) {
    if (google !== undefined) existing.google = Number(google);
    if (meta !== undefined) existing.meta = Number(meta);
  } else {
    data.push({ month, google: Number(google || 0), meta: Number(meta || 0) });
  }
  data.sort((a, b) => a.month.localeCompare(b.month));
  saveAdSpend(data);
  res.json({ ok: true, data });
});

app.delete('/api/ad-spend/:month', (req, res) => {
  const { month } = req.params;
  let data = loadAdSpend();
  const before = data.length;
  data = data.filter(d => d.month !== month);
  if (data.length === before) {
    return res.status(404).json({ error: 'Maand niet gevonden' });
  }
  saveAdSpend(data);
  res.json({ ok: true, data });
});

// Ideas board storage
const IDEAS_FILE = path.join(__dirname, 'ideas.json');

function loadIdeas() {
  try {
    return JSON.parse(require('fs').readFileSync(IDEAS_FILE, 'utf8'));
  } catch { return []; }
}

function saveIdeas(data) {
  require('fs').writeFileSync(IDEAS_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/ideas', (req, res) => {
  res.json(loadIdeas());
});

app.post('/api/ideas', (req, res) => {
  const { title, description, author, priority } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const data = loadIdeas();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  data.push({
    id,
    title,
    description: description || '',
    author: author || 'Daimy',
    priority: priority || 'normaal',
    status: 'idee',
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  });
  saveIdeas(data);
  res.json({ ok: true, data });
});

app.patch('/api/ideas/:id', (req, res) => {
  const data = loadIdeas();
  const item = data.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });
  const { title, description, status, priority } = req.body;
  if (title !== undefined) item.title = title;
  if (description !== undefined) item.description = description;
  if (status !== undefined) item.status = status;
  if (priority !== undefined) item.priority = priority;
  item.updated = new Date().toISOString();
  saveIdeas(data);
  res.json({ ok: true, data });
});

app.delete('/api/ideas/:id', (req, res) => {
  let data = loadIdeas();
  const before = data.length;
  data = data.filter(i => i.id !== req.params.id);
  if (data.length === before) return res.status(404).json({ error: 'Niet gevonden' });
  saveIdeas(data);
  res.json({ ok: true, data });
});

// Changelog storage
const CHANGELOG_FILE = path.join(__dirname, 'changelog.json');

function loadChangelog() {
  try {
    return JSON.parse(require('fs').readFileSync(CHANGELOG_FILE, 'utf8'));
  } catch { return []; }
}

function saveChangelog(data) {
  require('fs').writeFileSync(CHANGELOG_FILE, JSON.stringify(data, null, 2));
}

// Calculate KPI snapshot from current deals
function calcKPISnapshot(deals) {
  const total = deals.length;
  const won = deals.filter(d => d.properties.hs_is_closed_won === 'true');
  const lost = deals.filter(d => d.properties.hs_is_closed_lost === 'true');
  const open = deals.filter(d => d.properties.hs_is_closed_won !== 'true' && d.properties.hs_is_closed_lost !== 'true');
  const omzet = won.reduce((s, d) => s + (Number(d.properties.amount) || 0), 0);
  const inkoop = won.reduce((s, d) => s + (Number(d.properties.inkoopbedrag) || 0), 0);
  const winRate = total > 0 ? ((won.length / (won.length + lost.length)) * 100) || 0 : 0;
  const avgDeal = won.length > 0 ? omzet / won.length : 0;
  const avgDays = won.filter(d => d.properties.days_to_close).length > 0
    ? won.reduce((s, d) => s + (Number(d.properties.days_to_close) || 0), 0) / won.filter(d => d.properties.days_to_close).length
    : 0;

  return {
    totaal_deals: total,
    open_deals: open.length,
    gewonnen: won.length,
    verloren: lost.length,
    omzet: Math.round(omzet),
    inkoop: Math.round(inkoop),
    marge: Math.round(omzet - inkoop),
    slagingspercentage: Math.round(winRate * 10) / 10,
    gem_dealwaarde: Math.round(avgDeal),
    gem_dagen_tot_sluiting: Math.round(avgDays)
  };
}

app.get('/api/changelog', (req, res) => {
  const data = loadChangelog();
  res.json(data);
});

app.post('/api/changelog', async (req, res) => {
  const { title, description, category } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  // Get current KPI snapshot
  let snapshot = {};
  try {
    const { deals } = await getData();
    snapshot = calcKPISnapshot(deals);
  } catch (err) {
    console.error('Could not calc snapshot:', err.message);
  }

  const data = loadChangelog();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  data.unshift({
    id,
    title,
    description: description || '',
    category: category || 'verbetering',
    snapshot,
    created: new Date().toISOString()
  });
  saveChangelog(data);
  res.json({ ok: true, data });
});

app.delete('/api/changelog/:id', (req, res) => {
  let data = loadChangelog();
  const before = data.length;
  data = data.filter(i => i.id !== req.params.id);
  if (data.length === before) return res.status(404).json({ error: 'Niet gevonden' });
  saveChangelog(data);
  res.json({ ok: true, data });
});

app.listen(PORT, () => {
  console.log(`Sonty Dashboard draait op http://localhost:${PORT}`);
});
