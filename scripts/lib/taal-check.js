// TAALPOORT (31-08, Daimy: "nederlands facking antwoord op een engels bericht" — Judith Bauwi).
// Pure check zonder LLM: detecteert of klanttekst en antwoord dezelfde taal hebben (nl/en) op stopwoorden.
// Bij mismatch hoort de verzender het bericht NIET te sturen. Lab: scenario-lab/onderdelen/taal-poort.js
const NL = ['de','het','een','en','je','jij','wij','niet','wel','graag','bedankt','afspraak','kunnen','wordt','voor','met','dan','ook','zodra','hoi','beste','groetjes','alvast','maandag','morgen'];
const EN = ['the','and','you','your','not','please','thanks','thank','appointment','can','will','would','for','with','then','also','hi','dear','regards','kind','monday','tomorrow','price','offer'];

function taalVan(tekst) {
  const w = String(tekst || '').toLowerCase().replace(/[^a-zà-ÿ' ]+/g, ' ').split(/\s+/).filter(Boolean);
  if (w.length < 3) return 'onbekend';
  let nl = 0, en = 0;
  for (const x of w) { if (NL.includes(x)) nl++; if (EN.includes(x)) en++; }
  if (nl === 0 && en === 0) return 'onbekend';
  if (en >= nl * 2 && en >= 2) return 'en';
  if (nl >= en * 2 && nl >= 2) return 'nl';
  return 'onbekend';
}

/** true = taal van het antwoord botst met de taal van de klant (dan NIET versturen). */
function taalMismatch(klanttekst, antwoord) {
  const k = taalVan(klanttekst), a = taalVan(antwoord);
  if (k === 'onbekend' || a === 'onbekend') return false; // twijfel → niet blokkeren
  return k !== a;
}

module.exports = { taalVan, taalMismatch };
