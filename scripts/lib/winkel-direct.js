// Winkel-direct (Daimy 29-08: "in het inmeet-dashboard een winkelafspraak gelijk kunnen
// inplannen, op offertenummer, zodat je gelijk weet welke offerte het is").
// Pure hulpfuncties, zonder netwerk, zodat het scenario-lab ze kan doorrekenen:
//  - zoekTerm: wat typte de winkel? RP-offertenummer (8 cijfers, begint met 20), Gripp-nummer
//    (3-5 cijfers) of een naam
//  - matchItems: welke RP-kaarten op "Inmeten inplannen" passen daarbij (0 = afwijzen met reden,
//    2+ = afwijzen "maak specifieker"; nooit stil de eerste pakken)
//  - isWinkeluur: alleen dan kijkt de daemon zelf elke minuut in RP naar nieuwe klanten
//  - nieuweItems: kaarten die de daemon nog niet kent (en geen testkaart zijn)

const TESTKAART = /\btest\b|reuzenpanda|^[\s/|-]+$/i;

function zoekTerm(invoer) {
  const s = String(invoer || '').trim();
  const cijfers = s.replace(/\D/g, '');
  if (s && cijfers === s.replace(/[\s.-]/g, '')) {
    if (/^20\d{6,8}$/.test(cijfers)) return { soort: 'offerte', waarde: cijfers };
    if (/^\d{3,5}$/.test(cijfers)) return { soort: 'gripp', waarde: cijfers };
    if (cijfers.length >= 6) return { soort: 'offerte', waarde: cijfers };
  }
  if (s.length >= 2) return { soort: 'naam', waarde: s.toLowerCase() };
  return { soort: 'leeg', waarde: '' };
}

const isActief = (i, statusId) => i && i.status_id === statusId && !(i.technical_labels || []).some((l) => l?.type === 'ITEM_ARCHIVED');

/**
 * items: RP-kaarten (met status_id, summary, technical_labels)
 * term: uitkomst van zoekTerm
 * nummersPerItem: { [itemId]: ['20263228', …] } (RP-offertenummers per kaart, uit leesOfferte)
 * grippKlant: klantnaam uit Gripp bij een Gripp-nummer (of null)
 */
function matchItems(items, term, statusId, nummersPerItem = {}, grippKlant = null) {
  const actief = (items || []).filter((i) => isActief(i, statusId) && !TESTKAART.test(i.summary || ''));
  if (term.soort === 'leeg') return { kandidaten: [], reden: 'vul een offertenummer of naam in' };
  if (term.soort === 'offerte') {
    const k = actief.filter((i) => (nummersPerItem[i.id] || []).map(String).includes(term.waarde));
    if (!k.length) return { kandidaten: [], reden: `geen klant met offerte ${term.waarde} op "Inmeten inplannen" — staat de kaart al op die status in RP?` };
    if (k.length > 1) return { kandidaten: k, reden: `offerte ${term.waarde} hangt aan ${k.length} kaarten (${k.map((i) => i.summary).join(', ')}) — zoek op naam` };
    return { kandidaten: k };
  }
  if (term.soort === 'gripp') {
    if (!grippKlant) return { kandidaten: [], reden: `Gripp-offerte ${term.waarde} niet gevonden; vul het RP-offertenummer (20…) of de naam in` };
    const n = grippKlant.toLowerCase();
    const k = actief.filter((i) => String(i.summary || '').toLowerCase().includes(n) || n.includes(String(i.summary || '').toLowerCase()));
    if (!k.length) return { kandidaten: [], reden: `Gripp ${term.waarde} = ${grippKlant}, maar die staat niet op "Inmeten inplannen"` };
    if (k.length > 1) return { kandidaten: k, reden: `Gripp ${term.waarde} = ${grippKlant}: ${k.length} kaarten passen — zoek op naam` };
    return { kandidaten: k };
  }
  const k = actief.filter((i) => String(i.summary || '').toLowerCase().includes(term.waarde));
  if (!k.length) return { kandidaten: [], reden: `geen lead "${term.waarde}" op "Inmeten inplannen" — zet hem eerst op die status in RP` };
  if (k.length > 1) return { kandidaten: k, reden: `meerdere leads passen op "${term.waarde}" (${k.map((i) => i.summary).join(', ')}) — maak de naam specifieker of gebruik het offertenummer` };
  return { kandidaten: k };
}

/** Winkeluren ma–za 08:30–18:00 (Europe/Amsterdam). */
function isWinkeluur(d = new Date()) {
  const lokaal = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const dag = lokaal.getDay(); // 0 = zo
  if (dag === 0) return false;
  const min = lokaal.getHours() * 60 + lokaal.getMinutes();
  return min >= 8 * 60 + 30 && min < 18 * 60;
}

/** Kaarten die nieuw zijn voor de daemon (nog niet doorgerekend), zonder testkaarten. */
function nieuweItems(items, gezienIds, statusId) {
  const gezien = new Set(gezienIds || []);
  return (items || []).filter((i) => isActief(i, statusId) && !TESTKAART.test(i.summary || '') && !gezien.has(i.id));
}

module.exports = { zoekTerm, matchItems, isWinkeluur, nieuweItems, TESTKAART };
