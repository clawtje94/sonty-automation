// WERKBON-MAIL (Daimy 2026-08-27): "elke werkbon moet gemaild worden, of die klaar is of niet,
// gewoon in z'n geheel." Deze lib bouwt uit een Planado-opdracht (v2 job-detail) één complete
// HTML-mail: opdracht, klant, adres, team, tijden, Gripp-nummer, de volledige omschrijving
// (productregels), ALLE rapportvelden van de werkbon (ingevuld én leeg), gebruikte materialen
// en foto-verwijzingen. Verzending via joey@ (Outlook REST, zelfde token als de andere crons).
//
// Adressen: data/werkbon-mail-adressen.txt (één per regel). Ontbreekt het bestand, dan de
// standaard hieronder. Alleen-lezen t.o.v. Planado.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const ADRES_PAD = path.join(ROOT, 'data', 'werkbon-mail-adressen.txt');
const STANDAARD_ADRESSEN = ['werkbon@sonty.nl', 'werkbonnen@sonty.nl'];

function werkbonAdressen() {
  try {
    const l = fs.readFileSync(ADRES_PAD, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
    if (l.length) return l;
  } catch { /* geen bestand: standaard */ }
  return STANDAARD_ADRESSEN;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const jaNee = (v) => v === true || /^(ja|yes|true|1)$/i.test(String(v ?? '').trim());

function nlTijd(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

/** Waarde van een rapportveld leesbaar maken; foto's/bestanden als lijst met links. */
function veldWaarde(f) {
  const v = f.value;
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return { tekst: '(niet ingevuld)', leeg: true };
  if (typeof v === 'boolean') return { tekst: v ? 'ja' : 'nee' };
  if (Array.isArray(v)) {
    const items = v.map((x) => {
      if (x && typeof x === 'object') {
        const url = x.url || x.file_url || x.download_url || x.image_url || x.original_url || null;
        const naam = x.name || x.filename || x.file_name || x.uuid || 'bestand';
        return url ? `<a href="${esc(url)}">${esc(naam)}</a>` : esc(naam);
      }
      return esc(x);
    });
    return { tekst: items.join(', '), html: true, aantal: v.length };
  }
  if (typeof v === 'object') return { tekst: esc(JSON.stringify(v)) };
  return { tekst: esc(String(v)) };
}

/** Het veld "Werk gereed?" opzoeken in de rapportvelden (naam kan licht afwijken). */
function werkGereed(reportFields) {
  const f = (reportFields || []).find((x) => /werk gereed/i.test(x.name || ''));
  if (!f) return { status: 'geen_werkbon', label: 'ZONDER WERKBON' };
  if (f.value === null || f.value === undefined || f.value === '') return { status: 'leeg', label: 'NIET INGEVULD' };
  return jaNee(f.value) ? { status: 'ja', label: 'GEREED' } : { status: 'nee', label: 'NIET GEREED' };
}

/**
 * Bouwt onderwerp + HTML + platte tekst uit een Planado job-detail.
 * @param {object} job   v2 job-detail (det.job)
 * @param {string} busNaam
 * @param {object} [opties] { voorbeeld: boolean }
 */
function bouwWerkbonMail(job, busNaam, opties = {}) {
  const velden = Array.isArray(job.report_fields) ? job.report_fields : [];
  const gereed = werkGereed(velden);
  const kop = String(job.description || '').split('\n')[0].trim().slice(0, 80) || ('#' + job.serial_no);
  const grippNr = (String(job.description || '').match(/Gripp:\s*(\d+)/i) || [])[1] || null;
  const contacten = job.contacts || [];
  const klant = job.client?.name || contacten[0]?.name || '-';
  const contactRegels = contacten.map((c) => `${esc(c.name || '')} ${esc(c.value || c.phone || c.email || '')}`.trim()).filter(Boolean);
  const adres = job.address?.formatted || job.site?.address?.formatted || '-';
  const namen = (job.assignees || []).map((a) => a.name || a.worker_name).filter((n) => n && n !== busNaam && !busNaam.includes(n));
  const ts = job.timestamps || {};
  const resolutie = job.resolution?.name || job.resolution || null;
  const materialen = (job.used_materials || []).map((m) => `${esc(m.name || m.material_name || '')}${m.quantity ? ' × ' + esc(m.quantity) : ''}`).filter(Boolean);
  const kleur = gereed.status === 'ja' ? '#15803D' : gereed.status === 'nee' ? '#B91C1C' : '#B45309';
  const voorbeeld = opties.voorbeeld ? '<div style="background:#FEF3C7;border:1px solid #F59E0B;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-weight:700">VOORBEELD: dit is een testmail met verzonnen antwoorden op een echte geplande opdracht. Zo ziet elke werkbon-mail er straks uit.</div>' : '';

  const rij = (k, v, html = false) => `<tr><td style="padding:6px 10px;color:#6b7280;white-space:nowrap;vertical-align:top;width:220px">${esc(k)}</td><td style="padding:6px 10px;vertical-align:top">${html ? v : esc(v)}</td></tr>`;

  const veldRijen = velden.map((f) => {
    const w = veldWaarde(f);
    const stijl = w.leeg ? 'color:#9ca3af;font-style:italic' : 'color:#111';
    const wanneer = f.filled_at ? `<div style="color:#9ca3af;font-size:11px">${esc(nlTijd(f.filled_at))}</div>` : '';
    return `<tr><td style="padding:7px 10px;border-top:1px solid #f3f4f6;color:#374151;vertical-align:top;width:300px">${esc(f.name || f.label || '')}${f.required ? ' <span style="color:#B91C1C">*</span>' : ''}</td><td style="padding:7px 10px;border-top:1px solid #f3f4f6;${stijl};vertical-align:top">${w.html ? w.tekst : esc(w.tekst)}${wanneer}</td></tr>`;
  }).join('');

  const fotoVelden = velden.filter((f) => Array.isArray(f.value) && f.value.length && /foto|photo|image|file|attachment/i.test((f.data_type || '') + ' ' + (f.field_type || '') + ' ' + (f.name || '')));
  const fotoNoot = fotoVelden.length
    ? `<p style="color:#6b7280;font-size:12px">Foto's/bestanden (${fotoVelden.reduce((n, f) => n + f.value.length, 0)}): hierboven gelinkt; ook terug te vinden in Planado bij opdracht #${esc(job.serial_no)}.</p>`
    : '';

  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#111;max-width:760px;margin:0 auto;padding:16px">
${voorbeeld}
<div style="border-left:6px solid ${kleur};padding:10px 14px;background:#f9fafb;border-radius:8px;margin-bottom:16px">
  <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Werkbon · ${esc(busNaam)}</div>
  <div style="font-size:20px;font-weight:800">#${esc(job.serial_no)} ${esc(kop)}</div>
  <div style="font-size:16px;font-weight:800;color:${kleur};margin-top:4px">${esc(gereed.label)}</div>
</div>
<table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:18px">
${rij('Klant', klant)}
${contactRegels.length ? rij('Contact', contactRegels.join('<br>'), true) : ''}
${rij('Adres', adres)}
${rij('Team', busNaam + (namen.length ? ' (' + namen.join(', ') + ')' : ''))}
${rij('Gepland', nlTijd(job.scheduled_at))}
${ts.started_at || ts.finished_at ? rij('Gestart / afgerond', `${nlTijd(ts.started_at)} → ${nlTijd(ts.finished_at)}`) : ''}
${resolutie ? rij('Afronding (Planado)', String(resolutie)) : ''}
${rij('Gripp-nummer', grippNr || '- (niet op de opdracht)')}
${rij('Planado-status', job.status || '-')}
</table>
<h3 style="font-size:15px;margin:0 0 6px">Werkbon (alle velden)</h3>
<table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:6px">${veldRijen || '<tr><td style="padding:8px;color:#9ca3af">Deze opdracht heeft geen werkbon-velden.</td></tr>'}</table>
${fotoNoot}
${materialen.length ? `<h3 style="font-size:15px;margin:18px 0 6px">Gebruikte materialen</h3><ul style="font-size:14px;margin:0;padding-left:18px">${materialen.map((m) => `<li>${m}</li>`).join('')}</ul>` : ''}
<h3 style="font-size:15px;margin:18px 0 6px">Omschrijving van de opdracht</h3>
<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;background:#f9fafb;padding:12px;border-radius:8px;border:1px solid #e5e7eb">${esc(job.description || '-')}</pre>
<p style="color:#9ca3af;font-size:11px;margin-top:18px">Automatisch verstuurd door de werkbon-verwerker (elke 30 min) zodra een team een opdracht in Planado afrondt. Planado-opdracht ${esc(job.uuid || '')}.</p>
</body></html>`;

  const tekst = [
    `WERKBON ${gereed.label} — #${job.serial_no} ${kop}`,
    `Team: ${busNaam}${namen.length ? ' (' + namen.join(', ') + ')' : ''}`,
    `Klant: ${klant}`, `Adres: ${adres}`, `Gepland: ${nlTijd(job.scheduled_at)}`,
    grippNr ? `Gripp: ${grippNr}` : 'Gripp: - (niet op de opdracht)', '',
    ...velden.map((f) => `${f.name}: ${veldWaarde(f).tekst.replace(/<[^>]+>/g, '')}`),
    '', 'Omschrijving:', String(job.description || '-'),
  ].join('\n');

  const onderwerp = `${opties.voorbeeld ? 'VOORBEELD — ' : ''}Werkbon ${gereed.label} — #${job.serial_no} ${kop} (${busNaam})`;
  return { onderwerp, html, tekst, gereed, grippNr, kop };
}

/** Verstuurt de mail via joey@ (Outlook REST). Geeft true bij 200/202. */
async function verstuurWerkbonMail({ onderwerp, html }, aan = werkbonAdressen()) {
  const OH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(ROOT, 'scripts', '.owa-token.txt'), 'utf8').trim(), 'Content-Type': 'application/json' };
  const r = await fetch('https://outlook.office.com/api/v2.0/me/sendmail', {
    method: 'POST', headers: OH,
    body: JSON.stringify({
      Message: { Subject: onderwerp, Body: { ContentType: 'HTML', Content: html }, ToRecipients: aan.map((a) => ({ EmailAddress: { Address: a } })) },
      SaveToSentItems: true,
    }),
  });
  return r.ok || r.status === 202;
}

module.exports = { bouwWerkbonMail, verstuurWerkbonMail, werkbonAdressen, werkGereed, jaNee };
