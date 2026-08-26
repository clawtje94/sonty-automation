const { planadoFetch } = require('./planado-fetch.js');
// EEN AFSPRAAK ANNULEREN (Daimy 10-08: "Connie staat als geboekt in het dashboard maar
// NIET in de Planado agenda????????").
//
// Een inmeetafspraak leeft op drie plekken: de opdracht in Planado, de afspraak in de
// Outlook-agenda "Sonty Montage", en ons eigen boekingenbestand waar het dashboard uit
// leest. Ik heb bij Connie alleen de Planado-opdracht weggegooid. Gevolg:
//   - het dashboard bleef "geboekt" tonen, op een datum die zij had afgezegd;
//   - de Outlook-afspraak bleef staan op haar OUDE adres;
//   - en de Outlook→Planado-sync maakte er een nieuwe, naamloze opdracht van terug.
//     Mijn opruimactie draaide zichzelf dus terug, en niemand zag het.
//
// Daarom kan annuleren vanaf nu maar op één manier: hierlangs, en dan alle drie tegelijk.
// De Outlook-kant gaat EERST, want zolang die er staat zet de sync de opdracht terug.
const fs = require('fs');
const path = require('path');

const PLANADO_KEY = fs.readFileSync(path.join(__dirname, '..', 'planado-api-key.txt'), 'utf8').trim();
const BOEKINGEN = path.join(__dirname, '..', '..', 'data', 'inmeet-boekingen.json');
const OWA_TOKEN = () => fs.readFileSync(path.join(__dirname, '..', '.owa-token.txt'), 'utf8').trim();

async function outlookAgenda() {
  const OH = { Authorization: 'Bearer ' + OWA_TOKEN() };
  const cals = (await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value || [];
  const cal = cals.find((c) => c.Name === 'Sonty Montage');
  if (!cal) throw new Error('agenda "Sonty Montage" niet gevonden');
  return { id: cal.Id, OH };
}

/**
 * @param {{naam: string, aankomst: string|Date, rpItemId?: string}} boeking
 * @returns {Promise<{outlook: number, planado: number, administratie: boolean, gemist: string[]}>}
 */
async function annuleer({ naam, aankomst, rpItemId }) {
  const van = new Date(aankomst);
  const rond = (a, b) => Math.abs(new Date(a) - new Date(b)) < 60000;
  const uitkomst = { outlook: 0, planado: 0, administratie: false, gemist: [] };

  // 1. OUTLOOK EERST — anders zet de sync de opdracht meteen terug.
  try {
    const { id, OH } = await outlookAgenda();
    const dag = van.toISOString().slice(0, 10);
    const j = await (await fetch(`https://outlook.office.com/api/v2.0/me/calendars/${id}/calendarView`
      + `?$top=100&$select=Subject,Start&startDateTime=${dag}T00:00:00Z&endDateTime=${dag}T23:59:59Z`, { headers: OH })).json();
    const achternaam = String(naam || '').split(' ').filter(Boolean).pop() || '';
    for (const e of j.value || []) {
      const zelfdeTijd = rond(e.Start.DateTime + 'Z', van);
      const zelfdeKlant = achternaam && new RegExp(achternaam, 'i').test(e.Subject || '');
      if (!zelfdeTijd && !zelfdeKlant) continue;
      // een OPTIE-blokje is geen afspraak; die heeft zijn eigen opruiming
      if (/^OPTIE bot/i.test(e.Subject || '')) continue;
      const del = await fetch(`https://outlook.office.com/api/v2.0/me/events/${e.Id}`, { method: 'DELETE', headers: OH });
      if (del.ok || del.status === 204) uitkomst.outlook++;
      else uitkomst.gemist.push(`Outlook "${e.Subject}" (${del.status})`);
    }
  } catch (e) { uitkomst.gemist.push('Outlook: ' + e.message.slice(0, 60)); }

  // 2. PLANADO: alle opdrachten op dat tijdstip, ook de naamloze die de sync heeft
  //    achtergelaten (external_id begint dan met "ol-").
  try {
    let after = null; const jobs = [];
    for (let i = 0; i < 40; i++) {
      const r = await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), {
        headers: { Authorization: 'Bearer ' + PLANADO_KEY },
      });
      const d = await r.json();
      const l = d.jobs || d.data || [];
      if (!l.length) break;
      jobs.push(...l); after = l[l.length - 1].uuid;
      await new Promise((r2) => setTimeout(r2, 2600));
    }
    for (const j of jobs) {
      const zelfdeTijd = j.scheduled_at && rond(j.scheduled_at, van);
      const eigenId = rpItemId && j.external_id === `rp-${rpItemId}`;
      if (!zelfdeTijd && !eigenId) continue;
      const del = await planadoFetch('https://api.planadoapp.com/v2/jobs/' + (j.job_uuid || j.uuid), {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + PLANADO_KEY },
      });
      if (del.ok) uitkomst.planado++;
      else uitkomst.gemist.push(`Planado ${j.uuid} (${del.status})`);
    }
  } catch (e) { uitkomst.gemist.push('Planado: ' + e.message.slice(0, 60)); }

  // 3. ONZE ADMINISTRATIE — anders blijft het dashboard een afspraak tonen die nergens
  //    meer bestaat, en dat is precies hoe dit misging.
  try {
    const alles = JSON.parse(fs.readFileSync(BOEKINGEN, 'utf8'));
    for (const [id, b] of Object.entries(alles)) {
      if (id !== rpItemId && !(b.aankomst && rond(b.aankomst, van) && b.naam === naam)) continue;
      b.status = 'geannuleerd';
      b.geannuleerdOp = new Date().toISOString();
      uitkomst.administratie = true;
    }
    fs.writeFileSync(BOEKINGEN, JSON.stringify(alles, null, 1));
  } catch (e) { uitkomst.gemist.push('administratie: ' + e.message.slice(0, 60)); }

  return uitkomst;
}

module.exports = { annuleer };
