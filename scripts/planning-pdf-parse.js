// Parser voor leveranciers-PDF's (tekst uit pdftotext -layout) t.b.v. de planning.
// duidPdf(tekst) herkent de leverancier aan de inhoud en geeft terug wat er te vinden is:
// { leverancier, ordernr, referentie, orderdatum, leverdatum, producten: [..] }
// Datums als dd-mm-jjjj strings; alles wat niet gevonden wordt blijft undefined.

const MAANDEN_EN = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const pak = (t, re) => (t.match(re) || [])[1]?.trim();
const dmy = (s) => {
  if (!s) return undefined;
  let m;
  if ((m = s.match(/^(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{2,4})$/)))
    return `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}-${m[3].length === 2 ? '20' + m[3] : m[3]}`;
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)) && MAANDEN_EN[m[2].toLowerCase()])
    return `${m[1].padStart(2, '0')}-${String(MAANDEN_EN[m[2].toLowerCase()]).padStart(2, '0')}-${m[3]}`;
  return undefined;
};

function duidPdf(t) {
  // SUNMASTER — "Portaalbevestiging 2609516" / "Orderbevestiging 2607506", productregels "2609516-1  1  Zipscreen ..."
  if (/sunmaster/i.test(t) || /(Portaalbevestiging|Orderbevestiging)\s+\d{7}/.test(t)) {
    const producten = [...t.matchAll(/^\s*\d{6,8}-\d+\s+(\d+)\s+([A-Za-z].+?)\s*$/gm)]
      .map((m) => `${m[1]}x ${m[2].replace(/(\s+-?[\d.,]+){2,}\s*$/, '').replace(/\s+/g, ' ').trim()}`);
    const leverdatums = [...t.matchAll(/^(\d{2}-\d{2}-\d{4})\b/gm)].map((m) => m[1]);
    return {
      leverancier: 'Sunmaster',
      ordernr: pak(t, /(?:Portaalbevestiging|Orderbevestiging)\s+(\d{6,8})/),
      referentie: pak(t, /Uw referentie\s*:\s*(.+)/),
      orderdatum: dmy(pak(t, /Orderdatum\s*:\s*([\d-]+)/)),
      leverdatum: leverdatums[0],
      producten,
    };
  }
  // TOPPOINT — "Ordernummer : 26084369", regels "001  1  9128417089  omschrijving"
  if (/toppoint/i.test(t) || /Orderinvoerdatum/i.test(t)) {
    return {
      leverancier: 'Toppoint',
      ordernr: pak(t, /Ordernummer\s*:\s*(\d+)/),
      referentie: pak(t, /Referentie\s*:\s*(.+?)(?:\s{2,}|$)/m),
      orderdatum: dmy(pak(t, /Orderinvoerdatum\s*:\s*([\dA-Za-z ]+)/)),
      producten: [...t.matchAll(/^\s*\d{3}\s+(\d+)\s+\d{6,}\s+(.+?)\s{2,}/gm)].map((m) => `${m[1]}x ${m[2].trim()}`),
    };
  }
  // UNILUX — "Order Nummer : 1208154", "Vertrek datum : 28-07-26", artikelregels na "Art.code"
  if (/unilux/i.test(t) || /Vertrek datum/i.test(t)) {
    const prod = [...t.matchAll(/^\s*[A-Z0-9][\w\/-]{4,}\s{2,}(.+?)\s{2,}(\d+)\s/gm)]
      .filter((m) => !/Omschrijving|Totaal|BTW/i.test(m[1]))
      .map((m) => `${m[2]}x ${m[1].replace(/\s+/g, ' ').trim()}`);
    return {
      leverancier: 'Unilux',
      ordernr: pak(t, /Order Nummer\s*:\s*(\d+)/i),
      referentie: pak(t, /Ref\. klant\s*:\s*(.+?)(?:\s{2,}|$)/m),
      orderdatum: dmy(pak(t, /Order datum\s*:\s*([\d-]+)/i)),
      leverdatum: dmy(pak(t, /Vertrek datum\s*:\s*([\d-]+)/i)),
      producten: prod,
    };
  }
  // VELUX — "Uw bestelnummer" (klantref op volgende regel), "Verwachte Afleverdatum", regels "10  3 ST  SSL SK08 ..."
  if (/velux/i.test(t) || /Verwachte Afleverdatum/i.test(t)) {
    const refBlok = t.match(/Uw bestelnummer\s+Verwachte Afleverdatum\s*\n\s*(.+?)\s{2,}([\d.]+)/);
    const producten = [...t.matchAll(/^\s*\d+\s+(\d+)\s+ST\s+(\S[^\n]*?)\s{2,}[\d.,]+\s*$/gm)].map((m) => `${m[1]}x ${m[2].trim()}`);
    const omschr = [...t.matchAll(/^\s{20,}([A-Z][a-z][^\n]*?)\s{2,}[\d.,-]+\s*$/gm)].map((m) => m[1].trim()).filter((x) => !/korting|Totaal/i.test(x));
    return {
      leverancier: 'Velux',
      ordernr: pak(t, /(?:ORDERBEVESTIGING[\s\S]{0,80}?|Nederland\s+[\d-]*?)(\d{10})/),
      referentie: refBlok?.[1],
      orderdatum: dmy(pak(t, /Besteldatum[\s\S]{0,80}?(\d{2}\.\d{2}\.\d{4})/)),
      leverdatum: dmy(refBlok?.[2]),
      producten: producten.map((p, i) => omschr[i] ? `${p} (${omschr[i]})` : p),
    };
  }
  // MARKIEZEN NEDERLAND / generiek NL — "Order nr. : 49907", "Order referentie : ..."
  if (/Order referentie/i.test(t)) {
    const na = t.split(/Aantal\s+Omschrijving/i)[1] || '';
    return {
      leverancier: 'Markiezen Nederland',
      ordernr: pak(t, /Order nr\.\s*:\s*(\d+)/i),
      referentie: pak(t, /Order referentie\s*:\s*(.+)/i),
      orderdatum: dmy(pak(t, /Datum\s*:\s*([\d-]+)/i)),
      producten: [...na.matchAll(/^\s*(\d+)\s{2,}([A-Z][^\n]+?)(?:\s{2,}|$)/gm)].slice(0, 6).map((m) => `${m[1]}x ${m[2].replace(/\s+/g, ' ').trim()}`),
    };
  }
  return { leverancier: undefined };
}

module.exports = { duidPdf };
