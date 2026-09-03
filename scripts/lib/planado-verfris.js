// VERFRISSEN van een bestaande Planado-opdracht uit Outlook (Daimy 03-09-2026, audit vóór "alle bussen op Planado"):
// de sync zette interne notities, adres en telefoon alleen bij het AANMAKEN in de opdracht. Wijzigt kantoor daarna de
// notities in Outlook/Bookings (Blaauboer: "windsensor plaatsen, factuur maken"; Schrooten: "al twee keer verzet"), dan
// bleef Planado stil op de oude tekst. Deze pure functie bepaalt welke PATCH nodig is; getest in tests/planado-verfris-regressie.js.
// Regels: (1) blok "Interne notities (Outlook):" wordt vervangen als de tekst afwijkt, toegevoegd als hij ontbreekt, en
// verwijderd als Outlook geen notities meer heeft; (2) adres alleen zetten als Planado er GEEN met huisnummer heeft (een
// door kantoor gecorrigeerd adres blijft staan); (3) telefoon alleen toevoegen als er nog geen contact is.
const KOP = 'Interne notities (Outlook):';
function norm(s) { return String(s || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim(); }
function zonderNotitieBlok(desc) {
  // blok loopt tot de volgende lege regel gevolgd door "Adres (Outlook):" of het einde
  return norm(desc).replace(new RegExp('\\n*' + KOP.replace(/[()]/g, '\\$&') + '\\n[\\s\\S]*?(?=\\n\\n(?:Adres \\(Outlook\\):|MEETBON)|$)'), '').trim();
}
function notitieBlokUit(desc) {
  const m = norm(desc).match(new RegExp(KOP.replace(/[()]/g, '\\$&') + '\\n([\\s\\S]*?)(?=\\n\\n(?:Adres \\(Outlook\\):|MEETBON)|$)'));
  return m ? norm(m[1]) : '';
}
// postcode (1567 GB) telt niet als huisnummer: "1567 GB Assendelft" is een adres ZONDER straat (Schipper #459)
// en "(adres in Gripp 6475)" is ook geen adres: een huisnummer staat achter een straatnaam
function heeftHuisnummer(adres) { const t = String(adres || '').replace(/\b\d{4}\s?[A-Za-z]{2}\b/g, '').replace(/gripp\s*#?\d+/gi, ''); return /\p{L}{2,}\.?\s*\d{1,4}\b/u.test(t); }
/**
 * @param {{ huidig: {description?:string, address?:{formatted?:string}, contacts?:any[]}, notities?:string, adresTekst?:string, telNr?:string|null, wieKlant?:string, soortKlus?:string }} p
 * @returns {{ patch: object, redenen: string[] }}
 */
function verfrisPatch({ huidig, notities = '', adresTekst = '', telNr = null, wieKlant = '', soortKlus = '' }) {
  const patch = {}; const redenen = [];
  const desc = String(huidig?.description || '');
  const nu = notitieBlokUit(desc); const gewenst = norm(notities).slice(0, 900);
  if (nu !== gewenst) {
    const basis = zonderNotitieBlok(desc);
    // adresregel apart houden zodat de volgorde notities → adres blijft
    const adresM = basis.match(/\n*Adres \(Outlook\):[^\n]*$/); const zonderAdres = adresM ? basis.slice(0, adresM.index).trim() : basis;
    const staart = adresM ? adresM[0].trim() : '';
    const delen = [zonderAdres]; if (gewenst) delen.push(KOP + '\n' + gewenst); if (staart) delen.push(staart);
    patch.description = delen.filter(Boolean).join('\n\n');
    redenen.push(gewenst ? (nu ? 'notities gewijzigd' : 'notities toegevoegd') : 'notities verwijderd (leeg in Outlook)');
  }
  const pAdres = huidig?.address?.formatted || '';
  if (heeftHuisnummer(adresTekst) && !heeftHuisnummer(pAdres)) { patch.address = { formatted: String(adresTekst).trim().slice(0, 200) }; redenen.push(pAdres ? 'adres zonder huisnummer aangevuld' : 'adres toegevoegd'); }
  if (telNr && soortKlus !== 'winkel' && !(huidig?.contacts || []).length) { patch.contacts = [{ type: 'phone', name: wieKlant || 'klant', value: telNr }]; redenen.push('telefoon toegevoegd'); }
  return { patch, redenen };
}
module.exports = { verfrisPatch, notitieBlokUit, zonderNotitieBlok, KOP };
