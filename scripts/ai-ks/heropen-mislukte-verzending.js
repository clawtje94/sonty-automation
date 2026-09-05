#!/usr/bin/env node
// Heropen e-mailtickets waarvan Sunny's antwoord nooit is verstuurd (verzendfout, ticket toch
// gesloten; casus Kortenbout 05-09). Per ticket: heropenen, notitie met het klaarstaande
// concept uit log.jsonl, toewijzen aan team Mens nodig (haalt Sunny van het ticket, zodat de
// daemon hem niet alsnog beantwoordt), label Mens nodig. Gebruik: node heropen-mislukte-verzending.js <ticketId...>
const fs = require('fs'); const path = require('path');
const TT = fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim();
const H = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };
const { teamTags } = require('./team-tags.js');
const TEAM_MENS_NODIG = 431872, LABEL_MENS_NODIG = 1821764;
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, ep, body) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://app.trengo.com/api/v2' + ep, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 429) { await wacht(15000 * (i + 1)); continue; }
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
  }
  return { ok: false, status: 429 };
}
function concept(ticketId) {
  const rows = fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'ai-ks', 'log.jsonl'), 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((r) => r && r.email && String(r.ticket) === String(ticketId) && r.antwoord);
  const r = rows.at(-1);
  return r ? { tijd: r.tijd, tekst: String(r.antwoord).replace(/\s*\[(KLAAR|OPGELOST)\]\s*/g, '').trim() } : null;
}
(async () => {
  for (const id of process.argv.slice(2)) {
    const c = concept(id);
    const datum = c ? new Date(c.tijd).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'onbekend';
    const heropen = await api('POST', `/tickets/${id}/reopen`, {});
    const notitie = await api('POST', `/tickets/${id}/messages`, { internal_note: true, message: `${teamTags()} ⚠️ NOOIT BEANTWOORD: Sunny's antwoord van ${datum} is door een verzendfout NIET bij de klant aangekomen en het ticket werd toch gesloten (gevonden 05-09). De klant heeft dus niets gehoord. Graag zelf bellen of mailen.${c ? '\n\nHet antwoord dat toen klaarstond:\n\n' + c.tekst : ''}` });
    const toew = await api('POST', `/tickets/${id}/assign`, { type: 'team', team_id: TEAM_MENS_NODIG });
    const label = await api('POST', `/tickets/${id}/labels`, { label_id: LABEL_MENS_NODIG });
    await wacht(800);
    const na = await api('GET', `/tickets/${id}`);
    const t = na.json || {};
    console.log(`${id}: reopen ${heropen.status} | notitie ${notitie.status} | team ${toew.status} | label ${label.status} | NU: status ${t.status}, user ${t.user_id ?? t.assigned_user?.id ?? '-'}, team ${t.team_id ?? t.assigned_team?.id ?? '-'}, labels ${(t.labels || []).map((l) => l.name).join('|')}`);
    await wacht(1500);
  }
})();
