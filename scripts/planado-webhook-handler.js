#!/usr/bin/env node
// Planado Webhook Handler
// Receives Planado job_finished webhooks and updates HubSpot deal stages
// Replaces ZAP-04 (opmeting klaar) and ZAP-09 (installatie klaar)

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const PORT = 3847;
const WEBHOOK_SECRET = 'sonty_planado_f84c5c34ba89';
const HUBSPOT_TOKEN = require('./secrets').HUBSPOT_TOKEN;
const PIPELINE_ID = '3623322812';
const TELEGRAM_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TELEGRAM_CHAT = 1700128390;

// HubSpot stage IDs (from Sonty Verkooppijplijn)
const STAGES = {
  OPMETING_AFGEROND: '4999295187',      // Stage 8
  INSTALLATIE_AFGEROND: '4999295193',    // Stage 16
};

// Template name patterns
const OPMETING_TEMPLATES = ['inmeet afspraak', 'inmeet'];
const INSTALLATIE_TEMPLATES = ['montage afspraak', 'montage'];

function log(msg) {
  const ts = new Date().toLocaleString('nl-NL');
  console.log(`[${ts}] ${msg}`);
}

function sendTelegram(text) {
  const data = JSON.stringify({ chat_id: TELEGRAM_CHAT, text });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  };
  const req = https.request(options);
  req.on('error', () => {});
  req.write(data);
  req.end();
}

function hubspotRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'api.hubapi.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body || '{}') }); }
        catch(e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Find HubSpot deal by Planado job ID
async function findDealByPlanadoJobId(jobUuid, propertyName) {
  const searchBody = {
    filterGroups: [{
      filters: [{
        propertyName,
        operator: 'EQ',
        value: jobUuid
      }]
    }],
    properties: ['dealname', 'dealstage', 'pipeline', 'planado_job_id_opmeting', 'planado_job_id_installatie'],
    limit: 1
  };
  const result = await hubspotRequest('POST', '/crm/v3/objects/deals/search', searchBody);
  if (result.data.total > 0) return result.data.results[0];
  return null;
}

// Update HubSpot deal stage
async function updateDealStage(dealId, stageId, properties = {}) {
  const body = {
    properties: {
      dealstage: stageId,
      pipeline: PIPELINE_ID,
      ...properties
    }
  };
  return hubspotRequest('PATCH', `/crm/v3/objects/deals/${dealId}`, body);
}

// Verify webhook signature
function verifySignature(body, signature) {
  if (!WEBHOOK_SECRET || !signature) return true; // Skip if no secret
  const hash = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  return hash === signature;
}

// Determine job type from template name
function getJobType(templateName) {
  const name = (templateName || '').toLowerCase();
  if (OPMETING_TEMPLATES.some(t => name.includes(t))) return 'opmeting';
  if (INSTALLATIE_TEMPLATES.some(t => name.includes(t))) return 'installatie';
  return 'unknown';
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook/planado') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Sonty Planado Webhook Handler - OK');
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      // Verify signature
      const signature = req.headers['x-planado-secret'] || req.headers['x-webhook-secret'];
      if (!verifySignature(body, signature)) {
        log('WARN: Invalid webhook signature');
        res.writeHead(401);
        res.end('Invalid signature');
        return;
      }

      const payload = JSON.parse(body);
      log(`Webhook received: event=${payload.event || 'unknown'}`);

      // Handle job_finished event
      if (payload.event === 'job_finished' || payload.type === 'job_finished') {
        const job = payload.job || payload.data || payload;
        const jobUuid = job.uuid || job.id || '';
        const templateName = job.template?.name || job.template_name || '';
        const externalId = job.external_id || '';
        const clientName = job.client?.name || job.client_name || '';
        const resolution = job.resolution?.name || job.resolution || '';

        log(`Job finished: uuid=${jobUuid}, template="${templateName}", client="${clientName}", resolution="${resolution}"`);

        const jobType = getJobType(templateName);
        log(`Job type: ${jobType}`);

        if (jobType === 'unknown') {
          log(`Skipping: unknown template "${templateName}"`);
          sendTelegram(`⚠️ Planado: Opdracht voltooid maar onbekend type: "${templateName}" voor klant ${clientName}`);
          res.writeHead(200);
          res.end('OK - unknown type');
          return;
        }

        // Find the deal
        const propertyName = jobType === 'opmeting' ? 'planado_job_id_opmeting' : 'planado_job_id_installatie';
        let deal = await findDealByPlanadoJobId(jobUuid, propertyName);

        // If not found by job ID, try external_id as deal ID
        if (!deal && externalId) {
          try {
            const result = await hubspotRequest('GET', `/crm/v3/objects/deals/${externalId}?properties=dealname,dealstage,pipeline`);
            if (result.status === 200) deal = result.data;
          } catch(e) {}
        }

        if (!deal) {
          log(`WARN: No HubSpot deal found for job ${jobUuid}`);
          sendTelegram(`⚠️ Planado: Opdracht ${jobType} voltooid voor ${clientName}, maar geen HubSpot deal gevonden!`);
          res.writeHead(200);
          res.end('OK - no deal found');
          return;
        }

        const dealName = deal.properties?.dealname || deal.id;
        const newStage = jobType === 'opmeting' ? STAGES.OPMETING_AFGEROND : STAGES.INSTALLATIE_AFGEROND;
        const dateProperty = jobType === 'opmeting' ? 'opmeting_datum' : 'installatiedatum';

        // Update deal stage
        const updateProps = {};
        updateProps[dateProperty] = new Date().toISOString().slice(0, 10);

        const updateResult = await updateDealStage(deal.id, newStage, updateProps);
        
        if (updateResult.status === 200) {
          const stageLabel = jobType === 'opmeting' ? 'Opmeting Afgerond' : 'Installatie Afgerond';
          log(`SUCCESS: Deal "${dealName}" → ${stageLabel}`);
          sendTelegram(`✅ ${stageLabel}: "${dealName}" (${clientName}) - automatisch bijgewerkt in HubSpot`);
        } else {
          log(`ERROR updating deal: ${JSON.stringify(updateResult.data)}`);
          sendTelegram(`❌ Fout bij updaten deal "${dealName}": ${JSON.stringify(updateResult.data).substring(0, 200)}`);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    } catch(e) {
      log('Error processing webhook: ' + e.message);
      res.writeHead(500);
      res.end('Internal error');
    }
  });
});

server.listen(PORT, () => {
  log(`Planado webhook handler running on port ${PORT}`);
  log(`Endpoint: http://localhost:${PORT}/webhook/planado`);
  log('Handles: ZAP-04 (opmeting) + ZAP-09 (installatie)');
});
