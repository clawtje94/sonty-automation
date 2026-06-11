#!/usr/bin/env node
/**
 * Bouwt de Sunmaster-configurators op het Reuzenpanda SONTY TEST profiel.
 *
 * Werkwijze: kloont de 7 bewezen Sonty B.V. configurators (data/rp-configurator-voorbeelden/),
 * hermapt alle ID's (steps/questions/answers/relations + conditie-verwijzingen),
 * herordent vragen naar een logische offerte-opbouw en PUT ze via de API-user
 * naar het testprofiel. Idempotent: bestaande configurator met dezelfde naam wordt geüpdatet.
 *
 * VEILIGHEID: schrijft UITSLUITEND naar het Sonty test profiel (TEST_PID).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEST_PID = '23944e59-c24d-4032-a9fa-dbdb6f52bc94';
const BASE = 'https://backend.reuzenpanda.nl';
const CREDS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'rp-api-credentials.json'), 'utf8'));
const VOORBEELDEN = path.join(__dirname, '..', 'data', 'rp-configurator-voorbeelden');

// companyProfile-object voor het testprofiel (uit de UI-capture; alleen id is echt nodig,
// maar we sturen wat de UI ook stuurt)
const TEST_PROFILE = { id: TEST_PID, name: 'Sonty test' };

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

async function login() {
  const res = await fetch(`${BASE}/authentication-service/login-api`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CREDS.email, password: CREDS.password }),
  });
  const j = await res.json();
  if (j.type !== 'SUCCESS') throw new Error('Login mislukt: ' + JSON.stringify(j).slice(0, 200));
  return j.sessionKey;
}

function api(sk) {
  return async (method, ep, body) => {
    const res = await fetch(`${BASE}${ep}`, {
      method, headers: { 'X-AUTHORIZATION': sk, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { j = text; }
    return { status: res.status, body: j };
  };
}

/** Sorteersleutel voor logische vraag-volgorde op een modelpagina. */
function questionSortKey(q, idx, questions) {
  const naam = (q.name || '').toLowerCase();
  if (q.type === 'RADIO' && naam.startsWith('kies')) return [0, idx];
  if (q.type === 'NUMBER') return [1, idx];                        // maten eerst
  if (q.type === 'RADIO' && naam === 'uitval') return [2, idx];
  if (q.type === 'RADIO' && naam.includes('kleur')) return [3, idx];
  if (q.type === 'TEXT' && idx > 0) {
    // vrije RAL-tekst hoort direct na de kleurvraag
    const prev = questions[idx - 1];
    if (prev && prev.type === 'RADIO' && (prev.name || '').toLowerCase().includes('kleur')) return [3, idx + 0.5];
  }
  if (q.type === 'RADIO' && naam.includes('bediening')) return [4, idx];
  return [5, idx];
}

function transform(conf) {
  const clone = JSON.parse(JSON.stringify(conf));

  // 1) Vragen herordenen op elke PAGE (contact/bedankt blijven zoals ze zijn)
  for (const step of clone.steps || []) {
    if (step.type !== 'PAGE') continue;
    const qs = step.questions || [];
    if (qs.length < 2) continue;
    const isContact = qs.some((q) => q.technicalType === 'EMAIL');
    if (isContact) continue;
    const keyed = qs.map((q, i) => ({ q, key: questionSortKey(q, i, qs) }));
    keyed.sort((a, b) => (a.key[0] - b.key[0]) || (a.key[1] - b.key[1]));
    step.questions = keyed.map((k, i) => { k.q.position = i; return k.q; });
  }

  // 2) Alle interne ID's hermappen (behalve afbeelding-URL's: die bevatten het
  //    oude configurator-id in het pad en moeten blijven werken)
  const idMap = new Map();
  const collect = (id) => { if (id && !idMap.has(id)) idMap.set(id, crypto.randomUUID()); };
  for (const s of clone.steps || []) {
    collect(s.id);
    for (const q of s.questions || []) {
      collect(q.id);
      for (const a of (q.metaData && q.metaData.answers) || []) collect(a.id);
    }
  }
  for (const r of clone.relations || []) collect(r.id);

  // Afbeeldings-URL's veiligstellen vóór de globale replace
  const imgs = [];
  let json = JSON.stringify(clone);
  json = json.replace(/"https:\/\/[^"]+"/g, (m) => { imgs.push(m); return `"__IMG_${imgs.length - 1}__"`; });
  json = json.replace(UUID_RE, (u) => idMap.get(u) || u);
  json = json.replace(/"__IMG_(\d+)__"/g, (_, i) => imgs[Number(i)]);
  const out = JSON.parse(json);

  // 3) Server-velden resetten en aan testprofiel hangen
  out.id = null;
  out.templateId = null;
  out.companyProfile = TEST_PROFILE;
  out.domains = [];
  out.show = false; // nog niet live tonen
  if (!out.advancedSettings) out.advancedSettings = {};
  if (!out.advancedSettings.formType) out.advancedSettings.formType = 'FORM';
  return out;
}

(async () => {
  const sk = await login();
  const call = api(sk);

  // Bestaande configurators op het testprofiel (voor idempotentie + opruimen Prijstest)
  const list = await call('GET', `/widget-service/${TEST_PID}/configurators`);
  const existing = (list.body.configurators || []);
  const byName = new Map(existing.map((c) => [c.name, c.id]));

  // Prijstest opruimen als die nog bestaat
  if (byName.has('Prijstest')) {
    await call('DELETE', `/widget-service/${TEST_PID}/configurators/${byName.get('Prijstest')}`);
    console.log('Prijstest verwijderd');
  }

  const files = fs.readdirSync(VOORBEELDEN).filter((f) => f.startsWith('sonty-bv-') && f.endsWith('.json'));
  const results = [];
  for (const f of files) {
    const dump = JSON.parse(fs.readFileSync(path.join(VOORBEELDEN, f), 'utf8'));
    const conf = dump.body.configurator || dump.body;
    const nieuw = transform(conf);
    if (byName.has(nieuw.name)) nieuw.id = byName.get(nieuw.name); // update i.p.v. duplicaat

    const res = await call('PUT', `/widget-service/${TEST_PID}/configurators?templateId=`, { configurator: nieuw });
    const ok = res.status === 200 || res.status === 201;
    const id = ok ? (res.body.configurator || {}).id : null;
    results.push({ name: nieuw.name, status: res.status, id });
    console.log(`${ok ? 'OK ' : 'FOUT'} ${nieuw.name} -> ${res.status}${id ? ' (' + id + ')' : ''}`);
    if (!ok) console.log('  ', JSON.stringify(res.body).slice(0, 300));
  }

  fs.writeFileSync(path.join(__dirname, '..', 'data', 'rp-testprofiel-configurators.json'), JSON.stringify(results, null, 2));
  console.log('\nKlaar:', results.filter((r) => r.id).length, 'van', results.length);
})();
