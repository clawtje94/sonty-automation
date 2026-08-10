// Maandtabbladen van de offerte-sheet (Daimy 10-08: "ik kan er niet op vertrouwen dat
// dit autonoom werkt").
//
// De rapporten hadden een handmatige lijst met tabnamen. Die liep stuk zodra er een
// maand bijkwam of iemand een spatie in de naam zette: de sheet heeft écht tabbladen
// die "Juli 2026 " en "Mei 2025 " heten, met spatie, en "Aug 2026" ontbrak gewoon.
// Gevolg: maandrapport en dashboard-update crashten met "Unable to parse range".
//
// Hier lezen we de tabnamen uit de sheet zelf en leiden we maand+jaar af. Nieuwe maand
// = werkt vanzelf, ook met rare spaties, emoji of afkortingen.
const MAANDEN = [
  ['jan', 1], ['januari', 1], ['feb', 2], ['februari', 2], ['maart', 3], ['mrt', 3], ['april', 4], ['apr', 4], ['mei', 5],
  ['juni', 6], ['jun', 6], ['juli', 7], ['jul', 7], ['aug', 8], ['augustus', 8], ['sep', 9], ['september', 9], ['okt', 10], ['oktober', 10],
  ['nov', 11], ['dec', 12],
];

// Tabs die WEL op een maand lijken maar niet mogen meetellen: "Augustus 2025" is een
// lege dubbelganger van "Aug 2025" en zou het jaartotaal dubbel maken (bekend uit
// conversie-sheet.js). Expliciet uitsluiten in plaats van erop vertrouwen dat de
// schrijfwijze toevallig niet matcht.
const NIET_MEETELLEN = [/^augustus 2025$/i, /alles bij elkaar/i, /^jaar /i, /blanco/i];

/** "Juli 2026 " → { maand: 7, jaar: 2026 }; niet-maandtabs → null. */
function duidTab(titel) {
  const ruw = String(titel || '').trim();
  if (NIET_MEETELLEN.some((r) => r.test(ruw))) return null;
  const schoon = ruw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const jaar = schoon.match(/\b(20\d{2})\b/);
  if (!jaar) return null;
  // langste naam eerst, anders matcht "jun" ook in "juni"
  const treffer = [...MAANDEN].sort((a, b) => b[0].length - a[0].length).find(([naam]) => schoon.startsWith(naam + ' ') || schoon === naam);
  if (!treffer) return null;
  return { maand: treffer[1], jaar: Number(jaar[1]) };
}

/**
 * Alle maandtabbladen van een jaar, in kalendervolgorde, met de EXACTE titel zoals
 * die in de sheet staat (inclusief spaties) zodat de range altijd klopt.
 * @returns {Promise<Array<{titel: string, maand: number, jaar: number}>>}
 */
async function maandTabs(sheets, spreadsheetId, jaar) {
  // Google beperkt het aantal leesverzoeken per minuut. Draaien er meerdere rapporten
  // vlak na elkaar, dan crashte het script met RESOURCE_EXHAUSTED (gezien 10-08).
  // Even wachten en opnieuw proberen is genoeg; dit is geen fout maar drukte.
  let meta = null;
  for (let poging = 0; poging < 4; poging++) {
    try { meta = await sheets.spreadsheets.get({ spreadsheetId }); break; }
    catch (e) {
      const limiet = /RESOURCE_EXHAUSTED|rateLimitExceeded|Quota exceeded/i.test(e.message || '');
      if (!limiet || poging === 3) throw e;
      await new Promise((r) => setTimeout(r, 20000 * (poging + 1)));
    }
  }
  return (meta.data.sheets || [])
    .map((s) => ({ titel: s.properties.title, ...(duidTab(s.properties.title) || {}) }))
    .filter((t) => t.maand && (!jaar || t.jaar === jaar))
    .sort((a, b) => a.jaar - b.jaar || a.maand - b.maand);
}

module.exports = { maandTabs, duidTab };
