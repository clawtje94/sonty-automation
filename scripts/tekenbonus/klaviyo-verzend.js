// Klaviyo-verzending voor de tekenbonus-campagne (live-pad, GO Daimy 16-08 avond).
// Werkwijze per run per arm: profiel-properties zetten → verse lijst → campagne met de
// goedgekeurde variabelen-template → send job. Nieuwe eigen lijsten zijn veilig: de
// enige live flow ("Offerte aanvraag gedaan") triggert uitsluitend op lijst R76XQg
// (gecheckt 16-08); die lijst is hier hard verboden.
const { KLAVIYO_API_KEY } = require('../secrets.js');

const H = { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, accept: 'application/json', 'content-type': 'application/json', revision: '2024-10-15' };
const VERBODEN_LIJST = 'R76XQg';
// Variabelen-template, door Daimy goedgekeurd op de proef van 16-08 (bonus onderaan,
// teken-uitleg onder de knop). De "overige mails" (flow-pakket) blijven uit tot Daimy
// en Joey ze samen hebben gereviewd — daarom mailt de controle-arm NIET.
const BONUS_TEMPLATE = 'SfJgae';

async function api(pad, opties = {}) {
  const r = await fetch('https://a.klaviyo.com/api/' + pad, { headers: H, ...opties });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* geen json */ }
  return { status: r.status, ok: r.status < 300, j, t };
}

async function zetProfiel(email, voornaam, props) {
  let p = await api('profiles?filter=' + encodeURIComponent(`equals(email,"${email}")`));
  let id = p.j?.data?.[0]?.id;
  if (!id) {
    const c = await api('profiles', { method: 'POST', body: JSON.stringify({ data: { type: 'profile', attributes: { email, first_name: voornaam || undefined, properties: props } } }) });
    id = c.j?.data?.id;
    if (!id) throw new Error('profiel aanmaken faalde voor ' + email + ': ' + c.t.slice(0, 120));
    return id;
  }
  const u = await api('profiles/' + id, { method: 'PATCH', body: JSON.stringify({ data: { type: 'profile', id, attributes: { properties: props } } }) });
  if (!u.ok) throw new Error('profiel bijwerken faalde voor ' + email);
  return id;
}

async function verstuurArm({ armLabel, profielIds, onderwerp, preheader }) {
  if (!profielIds.length) return { verstuurd: 0 };
  const lijstNaam = `Tekenbonus ${armLabel} ${new Date().toISOString().slice(0, 10)}`;
  const l = await api('lists', { method: 'POST', body: JSON.stringify({ data: { type: 'list', attributes: { name: lijstNaam } } }) });
  let lijstId = l.j?.data?.id;
  if (!lijstId) {
    // lijst bestaat al (tweede run vandaag): opzoeken
    const zoek = await api('lists?filter=' + encodeURIComponent(`equals(name,'${lijstNaam}')`));
    lijstId = zoek.j?.data?.[0]?.id;
  }
  if (!lijstId || lijstId === VERBODEN_LIJST) throw new Error('geen veilige lijst voor ' + armLabel);
  const rel = await api(`lists/${lijstId}/relationships/profiles`, { method: 'POST', body: JSON.stringify({ data: profielIds.map((id) => ({ type: 'profile', id })) }) });
  if (rel.status >= 300) throw new Error('profielen aan lijst hangen faalde (' + rel.status + ')');

  const cj = await api('campaigns', { method: 'POST', body: JSON.stringify({ data: { type: 'campaign', attributes: {
    name: `Tekenbonus ${armLabel} ${new Date().toISOString().slice(0, 16)}`,
    audiences: { included: [lijstId], excluded: [] },
    send_strategy: { method: 'immediate' },
    'campaign-messages': { data: [{ type: 'campaign-message', attributes: { channel: 'email', label: armLabel, content: {
      subject: onderwerp, preview_text: preheader,
      from_email: 'aanvragen@sonty.nl', from_label: 'Jaimy van Sonty', reply_to_email: 'aanvragen@sonty.nl',
    } } }] },
  } } }) });
  const campagneId = cj.j?.data?.id;
  const berichtId = cj.j?.data?.relationships?.['campaign-messages']?.data?.[0]?.id;
  if (!campagneId || !berichtId) throw new Error('campagne aanmaken faalde: ' + cj.t.slice(0, 200));
  const at = await api('campaign-message-assign-template', { method: 'POST', body: JSON.stringify({ data: { type: 'campaign-message', id: berichtId, relationships: { template: { data: { type: 'template', id: BONUS_TEMPLATE } } } } }) });
  if (!at.ok) throw new Error('template koppelen faalde (' + at.status + ')');
  const send = await api('campaign-send-jobs', { method: 'POST', body: JSON.stringify({ data: { type: 'campaign-send-job', id: campagneId } }) });
  if (send.status >= 300) throw new Error('verzendjob faalde (' + send.status + ')');
  return { verstuurd: profielIds.length, campagneId, lijstId };
}

module.exports = { zetProfiel, verstuurArm, BONUS_TEMPLATE };
