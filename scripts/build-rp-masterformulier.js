#!/usr/bin/env node
/**
 * Bouwt het master-formulier "Stel je product samen" op het SONTY TEST profiel:
 * één flow die begint met productkeuze (zoals de oude Direct Samenstellen-widget),
 * met daarin de 7 Sunmaster-categorieflows + nieuw: Raamdecoratie binnen (Toppoint).
 *
 * Werkwijze: leest de 7 bestaande configurators van het testprofiel, voegt hun
 * pagina's samen achter een centraal keuzemenu, bouwt de Toppoint-flow uit de
 * geparsede prijsdata, en eindigt in één gedeelde contact- + bedanktpagina.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEST_PID = '23944e59-c24d-4032-a9fa-dbdb6f52bc94';
const BASE = 'https://backend.reuzenpanda.nl';
const CREDS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'rp-api-credentials.json'), 'utf8'));
const TP = JSON.parse(fs.readFileSync(path.join(process.env.HOME, 'zonweringdirect', 'data', 'toppoint-parsed-prices.json'), 'utf8'));
const MASTER_NAAM = 'Stel je product samen';

// Foto's + omschrijvingen uit de huidige live widget (RP-gehost, werken gegarandeerd)
const LIVE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'rp-configurator-voorbeelden', 'live-product-templates.json'), 'utf8'));
const liveByName = new Map(LIVE.map((p) => [p.name.toLowerCase().trim(), p]));
const liveFoto = (naam) => { const p = liveByName.get(naam.toLowerCase().trim()); return p && p.image_url; };
const liveUitleg = (naam) => {
  const p = liveByName.get(naam.toLowerCase().trim());
  const d = p && (p.description || '').trim().replace(/\s+/g, ' ');
  return d && !/^stel hier/i.test(d) && !/opmerking veld/i.test(d) ? d : null;
};

const uuid = () => crypto.randomUUID();

async function login() {
  const res = await fetch(`${BASE}/authentication-service/login-api`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CREDS.email, password: CREDS.password }),
  });
  const j = await res.json();
  if (j.type !== 'SUCCESS') throw new Error('login mislukt');
  return j.sessionKey;
}
const api = (sk) => async (method, ep, body) => {
  const res = await fetch(`${BASE}${ep}`, {
    method, headers: { 'X-AUTHORIZATION': sk, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch { j = text; }
  return { status: res.status, body: j };
};

// ── Vraag/pagina-helpers (zelfde vormen als de bestaande configurators) ──
const radio = (naam, antwoorden, { required = true, position = 0 } = {}) => ({
  id: uuid(), name: naam, conditionalName: null, description: '', conditionalDescription: null,
  type: 'RADIO', technicalType: null, required, position,
  metaData: { answers: antwoorden.map((a, i) => ({ id: uuid(), text: a.text, position: i, metaData: a.beschrijving ? { description: a.beschrijving } : {} })), marginTop: 'DEFAULT' },
  answerAsumeLogic: null, conditionalInfo: null, conditions: null, conditionType: null, condition: null, hide: false, technicalName: null,
});
const number = (naam, min, max, { position = 0, placeholder = '0' } = {}) => ({
  id: uuid(), name: naam, conditionalName: null, description: '', conditionalDescription: null,
  type: 'NUMBER', technicalType: null, required: true, position,
  metaData: { min, max, step: 1, placeholder, marginTop: 'DEFAULT' },
  answerAsumeLogic: null, conditionalInfo: null, conditions: null, conditionType: null, condition: null, hide: false, technicalName: null,
});
const pagina = (naam, vragen, position) => ({
  id: uuid(), name: naam, type: 'PAGE', subType: 'DEFAULT', position, theme: 'BARCELONA',
  metaData: { footerNextButtonIcon: 'arrow_right', footerNextButtonText: 'Volgende', footerPreviousButtonIcon: 'arrow_left' },
  relations: [], layout: { composition: 'FULL_WIDTH', fixedHeading: false, progressBar: true, mediaType: 'FULL' },
  questions: vragen.map((q, i) => ({ ...q, position: i })),
});
// Conditionele paginafoto: wisselt mee met het gekozen antwoord (zoals de oude flow)
const headingImage = (vraag, fotoPerAnswerIdx, defaultUrl) => {
  const data = [];
  (vraag.metaData.answers || []).forEach((a, i) => {
    const url = fotoPerAnswerIdx[i];
    if (!url) return;
    data.push({ id: uuid(), type: 'ALL_TRUE', conditions: [{ type: 'QUESTION', metaData: { comparator: 'EQUAL', questionId: vraag.id, answerId: a.id } }], url });
  });
  if (defaultUrl) data.push({ id: uuid(), type: 'ALL_TRUE', conditions: [], url: defaultUrl });
  return [{ index: 0, image: { data } }];
};
const metFoto = (p, vraag, fotos, defaultUrl) => {
  p.metaData.headingImage = headingImage(vraag, fotos, defaultUrl);
  p.layout = { composition: 'HORIZONTAL_RIGHT', fixedHeading: true, progressBar: false, mediaType: 'SMALL' };
  return p;
};

const rel = (from, to, conditions = null) => ({
  id: uuid(), from, to, position: 0,
  conditionType: conditions ? 'AND' : 'NO_CONDITION',
  conditions: conditions || [],
});
const condEq = (questionId, answerId) => ({
  groupConditionType: null, logicType: null, type: 'QUESTION', conditions: null, position: 0,
  metaData: { questionId, condition: '', comparator: 'EQUALS', value: answerId },
});

// ── Toppoint-flow ──
const TP_LABELS = { '1': 'Basis collectie', '2': 'Comfort collectie', '3': 'Plus collectie', '4': 'Luxe collectie', '5': 'Premium collectie', A: 'Standaard model', B: 'Vrijhangend model', C: 'Top-down model', D: 'Top-down/bottom-up', E: 'Collectie E', F: 'Collectie F', P: 'Deurmodel', O: 'PVC-uitvoering' };
const TP_BEDIENING = {
  rolgordijnen: [['Handbediend (ketting)', 'Standaard'], ['Elektrisch — Motion accu', 'Oplaadbare accu (USB-C), geen stroompunt nodig'], ['Elektrisch — Brel 230V', 'Vaste stroomaansluiting'], ['Elektrisch — Somfy io', 'Premium, smart home ready']],
  'duo-rolgordijnen': [['Handbediend (ketting)', 'Standaard'], ['Elektrisch — Motion accu', 'Oplaadbare accu (USB-C)'], ['Elektrisch — Brel 230V', 'Vaste stroomaansluiting']],
  jaloezieen: [['Handbediend (koord + tuimelstang)', 'Standaard'], ['Elektrisch — Motion accu', 'Oplaadbare accu, draadloos'], ['Elektrisch — Somfy Tilt & Lift', 'Premium kantelen + liften']],
  'jaloezieen-hout': [['Handbediend (koord + tuimelstang)', 'Standaard'], ['Elektrisch — Motion accu', 'Oplaadbare accu, draadloos']],
  plisse: [['Handbediend (handgreep)', 'Standaard'], ['Elektrisch — Motion accu', 'Oplaadbare accu, draadloos']],
  lamellen: [['Handbediend (koord + ketting)', 'Standaard'], ['Elektrisch — Somfy RTS', 'Volledig elektrisch draaien + schuiven']],
  vouwgordijnen: [['Handbediend (ketting)', 'Standaard'], ['Elektrisch — Motion accu', 'Oplaadbare accu, draadloos']],
  horren: [['Standaard', '']],
};
const TP_NAMEN = {
  rolgordijnen: 'Rolgordijnen', 'duo-rolgordijnen': 'Duo-rolgordijnen', jaloezieen: 'Jaloezieën (aluminium)',
  'jaloezieen-hout': 'Jaloezieën (hout)', plisse: 'Plissé', lamellen: 'Verticale lamellen',
  vouwgordijnen: 'Vouwgordijnen', horren: 'Horren',
};
const TP_UITLEG = {
  rolgordijnen: 'Strak en tijdloos. Keuze uit verduisterende of lichtdoorlatende doeken, in vijf collecties.',
  'duo-rolgordijnen': 'Afwisselend transparante en dichte banen: regel lichtinval traploos zonder het rolgordijn op te trekken.',
  jaloezieen: 'Aluminium jaloezieën (Scala) met kantelbare lamellen — licht sturen wanneer jij dat wilt.',
  'jaloezieen-hout': 'Houten jaloezieën (Silva) voor een warme, natuurlijke uitstraling.',
  plisse: 'Gevouwen stof die compact opvouwt. Ook als isolerend dubbel doek (Iso) of top-down/bottom-up.',
  lamellen: 'Verticale lamellen, ideaal voor grote ramen en schuifpuien. In stof, PVC/ALU of isolerend (Iso Reflex).',
  vouwgordijnen: 'De zachte uitstraling van een gordijn, het gemak van een rolgordijn: vouwt op in horizontale plooien.',
  horren: 'Op maat gemaakte inzethorren, rolhorren en plissé hordeuren — ongestoord ventileren.',
};

// RP-gehoste foto's per binnen-type uit de oude widget (alleen exacte product-matches)
function toppointFotos() {
  const p = LIVE.find((x) => x.name === 'Raamdecoratie');
  const optie = p && (p.options || []).find((o) => (o.choices || []).length);
  const choice = (naam) => { const c = optie && optie.choices.find((ch) => ch.name === naam); return c && c.image && c.image.url; };
  return {
    rolgordijnen: choice('Rolgordijn'),
    jaloezieen: choice('Jaloezie aluminium'),
    'jaloezieen-hout': choice('Jaloezie Hout'),
    plisse: choice('Duo plissé'),
    vouwgordijnen: choice('Vouwgordijnen'),
    // duo-rolgordijnen, lamellen, horren: nog geen eigen foto → default
  };
}

function bouwToppointFlow(naarContactId) {
  const steps = [], relations = [];
  const catKeys = Object.keys(TP_NAMEN);
  const tpFoto = toppointFotos();

  const binnenMenu = pagina('Raamdecoratie binnen', [
    radio('Welke raamdecoratie zoek je?', catKeys.map((k) => ({ text: TP_NAMEN[k], beschrijving: TP_UITLEG[k] }))),
  ], 0);
  const raamdecoFoto = liveFoto('Raamdecoratie');
  metFoto(binnenMenu, binnenMenu.questions[0], catKeys.map((k) => tpFoto[k]), raamdecoFoto);
  steps.push(binnenMenu);
  const menuVraag = binnenMenu.questions[0];

  catKeys.forEach((key, i) => {
    const types = (TP.categories[key] || []).filter((t) => t.grids && t.grids.length);
    if (!types.length) return;
    const vragen = [];
    if (types.length > 1) {
      vragen.push(radio('Kies je model', types.map((t) => {
        const g = t.grids[0];
        return { text: t.name, beschrijving: `Breedte ${g.widths[0]}–${g.widths[g.widths.length - 1]} cm, hoogte ${g.heights[0]}–${g.heights[g.heights.length - 1]} cm` };
      })));
    }
    const minB = Math.min(...types.map((t) => t.grids[0].widths[0]));
    const maxB = Math.max(...types.map((t) => t.grids[0].widths[t.grids[0].widths.length - 1]));
    const minH = Math.min(...types.map((t) => t.grids[0].heights[0]));
    const maxH = Math.max(...types.map((t) => t.grids[0].heights[t.grids[0].heights.length - 1]));
    vragen.push(number(`Breedte in cm (${minB}–${maxB})`, minB, maxB));
    vragen.push(number(`Hoogte in cm (${minH}–${maxH})`, minH, maxH));
    const groepen = [...new Set((types[0].grids || []).map((g) => TP_LABELS[String(g.stofgroep)] || `Collectie ${g.stofgroep}`))];
    if (groepen.length > 1) vragen.push(radio('Welke collectie?', groepen.map((g) => ({ text: g }))));
    const bediening = TP_BEDIENING[key] || [];
    if (bediening.length > 1) vragen.push(radio('Welk type bediening wil je?', bediening.map(([t, b]) => ({ text: t, beschrijving: b }))));

    if (vragen[0] && vragen[0].type === 'RADIO') vragen[0].description = TP_UITLEG[key] || '';
    const p = pagina(TP_NAMEN[key], vragen, i + 1);
    metFoto(p, vragen[0], [], tpFoto[key] || raamdecoFoto);
    steps.push(p);
    relations.push(rel(binnenMenu.id, p.id, [condEq(menuVraag.id, menuVraag.metaData.answers[i].id)]));
    relations.push(rel(p.id, naarContactId));
  });

  return { steps, relations, entryId: binnenMenu.id };
}

(async () => {
  const sk = await login();
  const call = api(sk);

  // Bestaande configurators van het testprofiel ophalen
  const list = await call('GET', `/widget-service/${TEST_PID}/configurators`);
  const bestaand = list.body.configurators || [];
  const bronnen = [];
  for (const c of bestaand.filter((c) => c.name !== MASTER_NAAM)) {
    const det = await call('GET', `/widget-service/${TEST_PID}/configurators/${c.id}`);
    bronnen.push(det.body.configurator);
  }
  console.log('Bronnen:', bronnen.map((b) => b.name).join(', '));

  // Gedeelde contact- en bedanktpagina: neem ze uit de eerste bron (incl. technicalTypes)
  const eerste = bronnen[0];
  const contactBron = eerste.steps.find((s) => s.questions.some((q) => q.technicalType === 'EMAIL'));
  const bedanktBron = eerste.steps.find((s) => s.type === 'FINAL_PAGE');
  const contact = JSON.parse(JSON.stringify(contactBron)
    .replace(new RegExp(contactBron.id, 'g'), uuid()));
  contact.questions = contact.questions.map((q) => ({ ...q, id: uuid() }));
  const bedankt = JSON.parse(JSON.stringify(bedanktBron).replace(new RegExp(bedanktBron.id, 'g'), uuid()));

  const masterSteps = [];
  const masterRels = [rel(contact.id, bedankt.id)];

  // Centraal keuzemenu
  const categorieen = [
    { naam: 'Knikarmscherm', bron: 'Knikarmschermen', beschrijving: 'Uitklapbaar zonnescherm voor terras of balkon' },
    { naam: 'Screen', bron: 'Screens', beschrijving: 'Verticale buitenzonwering voor ramen' },
    { naam: 'Uitvalscherm', bron: 'Uitvalschermen', beschrijving: 'Klassiek uitvallend zonnescherm' },
    { naam: 'Rolluik', bron: 'Rolluiken', beschrijving: 'Isolerend, verduisterend en inbraakwerend' },
    { naam: 'Serre zonwering', bron: 'Serre zonwering', beschrijving: 'Zonwering voor serre of veranda' },
    { naam: 'Markies', bron: 'Markies', beschrijving: 'Klassieke gebogen zonwering' },
    { naam: 'Pergola', bron: 'Pergola', beschrijving: 'Vaste overkapping met doek' },
    { naam: 'Raamdecoratie binnen', bron: null, beschrijving: 'Rolgordijnen, jaloezieën, plissé en meer' },
  ];
  const keuzemenu = pagina('Productkeuze', [
    radio('Waar ben je naar op zoek?', categorieen.map((c) => ({ text: c.naam, beschrijving: c.beschrijving }))),
  ], 0);
  const hoofdvraag = keuzemenu.questions[0];
  // Foto wisselt mee met de gekozen categorie (RP-gehoste foto's uit de live widget)
  const FOTO_NAAM = { Knikarmscherm: 'Knikarmschermen', Screen: 'Screens', Uitvalscherm: 'Uitvalschermen', Rolluik: 'Rolluik', 'Serre zonwering': 'Serre zonwering', Markies: 'Markiezen', Pergola: 'Pergola', 'Raamdecoratie binnen': 'Raamdecoratie' };
  metFoto(keuzemenu, hoofdvraag, categorieen.map((c) => liveFoto(FOTO_NAAM[c.naam] || c.naam)), liveFoto('Knikarmschermen'));
  masterSteps.push(keuzemenu);

  // Sunmaster-categorieflows invoegen
  categorieen.forEach((cat, i) => {
    if (!cat.bron) return;
    const bron = bronnen.find((b) => b.name === cat.bron);
    if (!bron) { console.log('ONTBREEKT:', cat.bron); return; }
    const bronContact = bron.steps.find((s) => s.questions.some((q) => q.technicalType === 'EMAIL'));
    const bronFinals = bron.steps.filter((s) => s.type === 'FINAL_PAGE');
    const skip = new Set([bronContact && bronContact.id, ...bronFinals.map((s) => s.id)].filter(Boolean));
    const pages = bron.steps.filter((s) => !skip.has(s.id));
    const entry = pages.slice().sort((a, b) => a.position - b.position)[0];

    const pagesKopie = JSON.parse(JSON.stringify(pages));
    // Model-uitleg uit de live widget toevoegen aan keuze-antwoorden zonder omschrijving
    for (const p of pagesKopie) {
      for (const q of p.questions || []) {
        if (q.type !== 'RADIO') continue;
        for (const a of (q.metaData && q.metaData.answers) || []) {
          if (a.metaData && a.metaData.description) continue;
          const uitleg = liveUitleg(a.text);
          if (uitleg) { a.metaData = a.metaData || {}; a.metaData.description = uitleg; }
        }
      }
    }
    masterSteps.push(...pagesKopie);
    for (const r of bron.relations) {
      if (skip.has(r.from)) continue;
      const to = skip.has(r.to) ? contact.id : r.to;
      masterRels.push({ ...JSON.parse(JSON.stringify(r)), id: uuid(), to });
    }
    masterRels.push(rel(keuzemenu.id, entry.id, [condEq(hoofdvraag.id, hoofdvraag.metaData.answers[i].id)]));
  });

  // Toppoint-flow invoegen
  const tpFlow = bouwToppointFlow(contact.id);
  masterSteps.push(...tpFlow.steps);
  masterRels.push(...tpFlow.relations);
  const binnenIdx = categorieen.findIndex((c) => c.naam === 'Raamdecoratie binnen');
  masterRels.push(rel(keuzemenu.id, tpFlow.entryId, [condEq(hoofdvraag.id, hoofdvraag.metaData.answers[binnenIdx].id)]));

  // "Nog een product?"-lus: elke categorieflow eindigt hier; Ja → terug naar keuzemenu
  const nogEen = pagina('Nog een product?', [
    radio('Wil je nog een product toevoegen?', [
      { text: 'Ja, nog een product toevoegen' },
      { text: 'Nee, ik ben klaar' },
    ]),
  ], 0);
  nogEen.questions[0].description = 'Je kunt meerdere producten in één aanvraag samenstellen.';
  const nogVraag = nogEen.questions[0];
  for (const r of masterRels) {
    if (r.to === contact.id && r.from !== nogEen.id) r.to = nogEen.id;
  }
  masterRels.push(rel(nogEen.id, keuzemenu.id, [condEq(nogVraag.id, nogVraag.metaData.answers[0].id)]));
  masterRels.push(rel(nogEen.id, contact.id, [condEq(nogVraag.id, nogVraag.metaData.answers[1].id)]));
  masterSteps.push(nogEen);

  // Contact + bedankt achteraan
  masterSteps.push(contact, bedankt);
  masterSteps.forEach((s, i) => { s.position = i; });

  const master = {
    id: null, templateId: null, name: MASTER_NAAM,
    advancedSettings: { ...(eerste.advancedSettings || {}), formType: (eerste.advancedSettings && eerste.advancedSettings.formType) || 'FORM', automation: true },
    resultScore: null, priceCalculationType: null,
    steps: masterSteps, relations: masterRels,
    companyProfile: { id: TEST_PID, name: 'Sonty test' },
    style: {
      ...eerste.style,
      // Sonty-branding (sonty.nl: oranje + zwart + logo)
      buttonColor: '#F97316', borderColor: '#F97316', questionColor: '#0a0a0a',
      answerColor: '#1a1a1a', answerSelectedColor: '#F97316', buttonTextColor: '#FFFFFF',
      logoUrl: 'https://cdn.prod.website-files.com/666ab30f0f595f63bc4b0971/666ab58ba2dd970e144ccb1c_logo-sonty.webp',
    },
    displaySettings: eerste.displaySettings,
    analyticsSettings: { trackingPixels: [] }, locale: '', domains: [], show: false, metaData: {}, type: 'EXTERNAL',
  };

  // Idempotent: bestaande master updaten via PUT /configurators/{id}
  // (PUT op de collectie máákt altijd een nieuwe, ook als er een id meegaat)
  const huidige = bestaand.find((c) => c.name === MASTER_NAAM);
  let res;
  if (huidige) {
    master.id = huidige.id;
    res = await call('PUT', `/widget-service/${TEST_PID}/configurators/${huidige.id}`, { configurator: master });
  } else {
    res = await call('PUT', `/widget-service/${TEST_PID}/configurators?templateId=`, { configurator: master });
  }
  const ok = res.status === 200 || res.status === 201;
  console.log(`Master "${MASTER_NAAM}" -> ${res.status}${ok ? ' id=' + res.body.configurator.id : ''}`);
  if (!ok) console.log(JSON.stringify(res.body).slice(0, 400));
  else {
    console.log(`Steps: ${masterSteps.length}, relations: ${masterRels.length}`);
    console.log(`Testlink: https://directsamenstellen.nl/${res.body.configurator.id}`);
  }
})();
