// Gedeelde KvK/VvE-matchlogica: gebruikt door kvk-vve-koppel.js en
// vve-signalen.js. Een VvE-naam bevat bijna altijd straat + huisnummers, dus
// daarop matchen we. Liever geen naam dan de verkeerde: een fout gekoppelde VvE
// in een acquisitielijst is erger dan een leeg veld.

const VVE_RE = /vereniging\s+van\s+eigen(aars|aren)|^\s*"?v\.?v\.?e\.?\b/i;
const RANG = { zeker: 3, waarschijnlijk: 2, zwak: 1 };

// KvK kent 's-Gravenhage, de volksmond Den Haag; beide gelden als dezelfde plaats
function plaatsVarianten(plaats) {
  const p = (plaats || "").trim().toLowerCase();
  const paren = [
    ["'s-gravenhage", "den haag"],
    ["'s-hertogenbosch", "den bosch"],
  ];
  for (const paar of paren) if (paar.includes(p)) return paar;
  return [p];
}

// Noemt de naam een plaats ("... te Voorburg")? Zo ja: welke.
function plaatsUitNaam(naam) {
  const m = naam.match(/\bte\s+([A-Za-zÀ-ÿ'’.\- ]{3,40}?)\s*("|\)|,|$)/);
  return m ? m[1].trim().toLowerCase() : null;
}

// Huisnummers uit een VvE-naam halen (het deel achter de straatnaam).
function nummersUitNaam(naam, straat) {
  const schoon = naam.replace(/\b\d{4}\s?[A-Z]{2}\b/g, " "); // postcodes weg
  const i = schoon.toLowerCase().indexOf(straat.toLowerCase());
  if (i < 0) return null;
  let rest = schoon.slice(i + straat.length);
  rest = rest.replace(/\bte\s+[A-Za-z' -]+$/i, " "); // "te Voorburg" weg
  const nums = [...rest.matchAll(/\d+/g)].map((m) => parseInt(m[0], 10)).filter((n) => n > 0 && n < 5000);
  const pariteit = /oneven/i.test(rest) ? 1 : /\beven\b/i.test(rest) ? 0 : null;
  const bereik = /tot en met|t\/m|t\.m\.|\d\s*-\s*\d/i.test(rest);
  return { nums, pariteit, bereik };
}

// Hoe zeker is het dat deze VvE bij dit huisnummer hoort?
function beoordeel(naam, straat, nr) {
  const p = nummersUitNaam(naam, straat);
  if (!p) return null;
  const { nums, pariteit, bereik } = p;
  if (!nums.length) return { zekerheid: "zwak", spreiding: 9999 };
  if (pariteit !== null && nr % 2 !== pariteit) return null;
  if (nums.includes(nr)) return { zekerheid: "zeker", spreiding: 0 };
  const lo = Math.min(...nums), hi = Math.max(...nums);
  if (bereik && nr >= lo && nr <= hi) return { zekerheid: "waarschijnlijk", spreiding: hi - lo };
  return null;
}

module.exports = { VVE_RE, RANG, plaatsVarianten, plaatsUitNaam, nummersUitNaam, beoordeel };
