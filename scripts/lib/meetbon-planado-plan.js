// MEETBON → PLANADO: het PURE beslisdeel (Daimy 03-09-2026: "in alle montage-opdrachten zetten zodra de meetbon is
// ingevuld; bij aanpassingen altijd overal verwerken ZONDER nieuwe opdrachten aan te maken, alleen update").
//
// Hier staat geen netwerk: alleen (1) welke opdracht bij welke meetbon hoort, (2) welke opdrachten een update
// nodig hebben en (3) hoe de PATCH-body eruitziet. Daardoor kan het scenario-lab (sonty-website/scripts/tests/
// meetbon-planado-lab.ts) honderden combinaties doorlopen zonder Planado te raken. De netwerkkant zit in
// cron-meetbon-planado.js. Regels:
//   - er wordt NOOIT een opdracht aangemaakt; alleen bestaande montage-opdrachten (sjabloon "Montage …") worden bijgewerkt
//   - koppeling op het Gripp-nummer in de omschrijving ("Gripp: 6494", gezet door de Outlook-sync)
//   - afgeronde/geannuleerde opdrachten blijven met rust; de omschrijving wordt nooit aangeraakt
//   - update alleen als de vulling-hash van de meetbon anders is dan wat er voor die opdracht al in stond
//   - velden die een oudere opdracht nog niet heeft, worden bij de PATCH meegegeven mét field_type (Planado voegt ze dan toe)
//   - de werkbon-tekenlink komt in het rapportveld, alleen als dat leeg is; bestaande invoer van het team is heilig

const GRIPP_RE = /Gripp:\s*#?(\d{3,7})\b/i;

function grippUit(description) {
  const m = String(description || '').match(GRIPP_RE);
  return m ? m[1] : null;
}
function isMontage(job) {
  const naam = String((job && job.template && job.template.name) || '');
  return /^montage/i.test(naam.trim());
}
function isOpen(job) {
  const s = String((job && job.status) || '').toLowerCase();
  return !['finished', 'canceled', 'cancelled', 'completed'].includes(s);
}

/**
 * Welke opdrachten moeten bijgewerkt worden?
 * @param bonnen  [{gripp, hash, status}]  (alleen compleet/doorgezet, van /api/meetbon/planado-lijst)
 * @param jobs    [{uuid, serial_no, status, description, template:{name}}]  (detail-objecten uit Planado)
 * @param state   {[uuid]: {gripp, hash}}   (wat er al in staat)
 * @param opties  {alleen?: gripp, max?: n}
 * @returns {{ acties: [{uuid, serial_no, gripp, hash, reden}], overgeslagen: [{uuid, reden}] }}
 */
function plan(bonnen, jobs, state, opties = {}) {
  const perGripp = new Map((bonnen || []).map((b) => [String(b.gripp), b]));
  const acties = [], overgeslagen = [];
  for (const job of jobs || []) {
    const uuid = job.uuid;
    if (!isMontage(job)) { overgeslagen.push({ uuid, reden: 'geen montage-opdracht' }); continue; }
    if (!isOpen(job)) { overgeslagen.push({ uuid, reden: 'afgerond/geannuleerd' }); continue; }
    const gripp = grippUit(job.description);
    if (!gripp) { overgeslagen.push({ uuid, reden: 'geen Gripp-nummer in de omschrijving' }); continue; }
    if (opties.alleen && String(opties.alleen) !== gripp) { overgeslagen.push({ uuid, reden: 'niet de gevraagde bon' }); continue; }
    const bon = perGripp.get(gripp);
    if (!bon) { overgeslagen.push({ uuid, reden: `meetbon ${gripp} niet ingevuld` }); continue; }
    const eerder = state && state[uuid];
    if (eerder && eerder.hash === bon.hash) { overgeslagen.push({ uuid, reden: 'al actueel' }); continue; }
    acties.push({ uuid, serial_no: job.serial_no, gripp, hash: bon.hash, reden: eerder ? 'meetbon gewijzigd' : 'nog niet gevuld' });
  }
  const max = opties.max && opties.max > 0 ? opties.max : acties.length;
  return { acties: acties.slice(0, max), uitgesteld: acties.slice(max), overgeslagen };
}

/**
 * PATCH-body voor één opdracht. Bestanden zijn {name, base64_content} of null (dan blijft het veld zoals het is).
 * @param job        detail-object (custom_fields/report_fields met uuid, name, value)
 * @param vulling    van /api/meetbon/bon/<nr>/planado (tekst per veldnaam)
 * @param veldUuids  data/planado-veld-uuids.json ({custom:{naam:{uuid,field_type,data_type}}, report:{…}})
 * @param bestanden  {[veldnaam]: {name, base64_content}}  (PDF + foto's)
 * @param werkbonLink  tekenlink voor het rapportveld (of null)
 */
function maakPatch(job, vulling, veldUuids, bestanden = {}, werkbonLink = null) {
  const eigen = new Map((job.custom_fields || []).map((f) => [f.name, f]));
  const custom_fields = [];
  const problemen = [];
  const veld = (naam, value) => {
    const bestaand = eigen.get(naam);
    if (bestaand) { custom_fields.push({ uuid: bestaand.uuid, value }); return; }
    const def = veldUuids.custom[naam];
    if (!def) { problemen.push(`veld "${naam}" onbekend (niet in planado-veld-uuids.json)`); return; }
    custom_fields.push({ uuid: def.uuid, name: naam, field_type: def.field_type, data_type: def.data_type, value });
  };
  for (const [naam, tekst] of Object.entries(vulling.tekst || {})) {
    // een leeg tekstveld dat de opdracht nog niet heeft, hoeft niet toegevoegd te worden
    if (!tekst && !eigen.has(naam)) continue;
    veld(naam, tekst || '');
  }
  for (const [naam, bestand] of Object.entries(bestanden || {})) {
    if (!bestand || !bestand.base64_content) continue;
    veld(naam, { name: bestand.name, base64_content: bestand.base64_content });
  }
  const report_fields = [];
  if (werkbonLink) {
    const naam = 'Werkbon tekenen (klant)';
    const bestaand = (job.report_fields || []).find((f) => f.name === naam);
    if (bestaand) { if (!bestaand.value) report_fields.push({ uuid: bestaand.uuid, value: werkbonLink }); }
    else if (veldUuids.report && veldUuids.report[naam]) { const d = veldUuids.report[naam]; report_fields.push({ uuid: d.uuid, name: naam, field_type: d.field_type, data_type: d.data_type, value: werkbonLink }); }
  }
  const body = { custom_fields };
  if (report_fields.length) body.report_fields = report_fields;
  return { body, problemen };
}

/** Wat verandert er in de PATCH-body t.o.v. wat de opdracht al heeft? (voor de log en het lab) */
function verschil(job, body) {
  const huidig = new Map((job.custom_fields || []).map((f) => [f.uuid, f]));
  const nieuw = [], gewijzigd = [], gelijk = [];
  for (const f of body.custom_fields || []) {
    const h = huidig.get(f.uuid);
    if (!h) nieuw.push(f.name || f.uuid);
    else if (typeof f.value === 'string' ? (h.value || '') !== f.value : true) gewijzigd.push(h.name);
    else gelijk.push(h.name);
  }
  return { nieuw, gewijzigd, gelijk };
}

module.exports = { GRIPP_RE, grippUit, isMontage, isOpen, plan, maakPatch, verschil };
