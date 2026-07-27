#!/usr/bin/env node
/**
 * BOUWT DE VIER SONTY E-MAILSJABLONEN (Daimy 2026-07-27).
 *
 * Eén basis met vier varianten, zodat de huisstijl niet uiteen kan lopen zodra er een mail
 * bijkomt. De HTML is bewust ouderwets: tabellen, inline stijlen, geen flexbox of grid. Dat is
 * geen slordigheid maar noodzaak, want Outlook rendert met Word en kent moderne CSS niet.
 *
 * Vaste keuzes, gebaseerd op het onderzoek in docs/gameplan-mails-klaviyo.md:
 *  - EEN primaire knop per mail. De verstuurde maartcampagne had er tien en haalde 1,5% clicks.
 *  - Het persoonlijke blok (product, bedrag, offertenummer, geldig tot) is de kern van de mail,
 *    niet een voetnoot. Dat is precies wat de vorige campagnes misten.
 *  - Leesbaar zonder afbeeldingen: elke afbeelding heeft alt-tekst en draagt nooit de boodschap.
 *  - Dark mode is meegenomen, geen bijzaak: 2026-standaard.
 *  - Afmelden staat zichtbaar onderaan, niet verstopt. Dat beschermt de rest van de lijst.
 *
 * Klaviyo-variabelen staan in Django-stijl met een default, zodat een leeg veld nooit een
 * kapotte zin oplevert. Ontbreekt een kernveld, dan hoort de flow de mail over te slaan; dat is
 * dezelfde regel die de WhatsApp-templates al hanteren.
 *
 * Gebruik: node scripts/email/bouw-templates.js   (schrijft naar scripts/email/dist/)
 */
const fs = require('fs');
const path = require('path');

const UIT = path.join(__dirname, 'dist');

const MERK = {
  oranje: '#FF6B00',
  zwart: '#0a0a0a',
  kaart: '#1a1a1a',
  tekst: '#16181d',
  grijs: '#5b6470',
  lijn: '#e3e6ea',
  papier: '#ffffff',
  achtergrond: '#f4f5f7',
  logo: 'https://cdn.prod.website-files.com/666ab30f0f595f63bc4b0971/666ab30f0f595f63bc4b0b6e_Logo_White.webp',
  telefoon: '085 006 9681',
  adres: 'Frijdastraat 8F, 2288 EX Rijswijk',
  site: 'https://www.sonty.nl',
};

/** Knop die ook in Outlook rond en oranje blijft (VML-variant voor Word-rendering). */
const knop = (tekst, url) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
 <tr><td align="center" bgcolor="${MERK.oranje}" style="border-radius:8px;">
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:52px;v-text-anchor:middle;width:300px;" arcsize="16%" stroke="f" fillcolor="${MERK.oranje}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:17px;font-weight:bold;"><![endif]-->
  <a href="${url}" style="background:${MERK.oranje};border-radius:8px;color:#ffffff;display:inline-block;font-family:'Figtree',Inter,Arial,sans-serif;font-size:17px;font-weight:700;line-height:52px;text-align:center;text-decoration:none;width:300px;-webkit-text-size-adjust:none;">${tekst}</a>
  <!--[if mso]></center></v:roundrect><![endif]-->
 </td></tr>
</table>`;

/** Donkere kaart met de persoonlijke gegevens: het bewijs dat de mail over deze klant gaat. */
const persoonlijkBlok = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MERK.kaart};border-radius:12px;">
 <tr><td style="padding:24px 26px;font-family:'Figtree',Inter,Arial,sans-serif;">
   <div style="color:#8b95a3;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;">Jouw offerte</div>
   <div style="color:#ffffff;font-size:21px;font-weight:700;padding-top:8px;line-height:1.3;">{{ person.product|default:"Je zonwering op maat" }}</div>
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top:16px;">
     <tr>
       <td style="font-family:'Figtree',Inter,Arial,sans-serif;color:#8b95a3;font-size:13px;padding:5px 0;">Offertenummer</td>
       <td align="right" style="font-family:'Figtree',Inter,Arial,sans-serif;color:#ffffff;font-size:13px;font-weight:600;padding:5px 0;">{{ person.offertenummer|default:"-" }}</td>
     </tr>
     <tr>
       <td style="font-family:'Figtree',Inter,Arial,sans-serif;color:#8b95a3;font-size:13px;padding:5px 0;">Geldig tot</td>
       <td align="right" style="font-family:'Figtree',Inter,Arial,sans-serif;color:#ffffff;font-size:13px;font-weight:600;padding:5px 0;">{{ person.geldig_tot|default:"-" }}</td>
     </tr>
   </table>
   <div style="border-top:1px solid #2e3440;margin-top:14px;padding-top:14px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
       <tr>
         <td style="font-family:'Figtree',Inter,Arial,sans-serif;color:#8b95a3;font-size:14px;">Totaal</td>
         <td align="right" style="font-family:'Figtree',Inter,Arial,sans-serif;color:${MERK.oranje};font-size:26px;font-weight:800;">{{ person.bedrag|default:"" }}</td>
       </tr>
     </table>
   </div>
 </td></tr>
</table>`;

/**
 * Afzendblok: een mens met een naam en een telefoonnummer wekt meer vertrouwen dan een merk.
 * LET OP de class t-dark op de naam. Zonder die class viel "Jaimy van Sonty" in dark mode
 * volledig weg: bijna zwarte tekst op een bijna zwarte achtergrond. Gevonden in de
 * previewronde van 27 juli; elke donkere tekstkleur hoort hier een t-dark tegenhanger te hebben.
 */
const afzender = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${MERK.lijn};margin-top:6px;" class="lijn">
 <tr><td style="padding:22px 0 0;font-family:'Figtree',Inter,Arial,sans-serif;">
   <div class="t-dark" style="color:${MERK.tekst};font-size:15px;font-weight:700;">Jaimy van Sonty</div>
   <div class="t-soft" style="color:${MERK.grijs};font-size:14px;padding-top:3px;">Bel of app gerust: <a href="tel:+31850069681" style="color:${MERK.oranje};text-decoration:none;font-weight:600;">${MERK.telefoon}</a></div>
   <div class="t-soft" style="color:${MERK.grijs};font-size:14px;padding-top:2px;">Showroom: ${MERK.adres}</div>
 </td></tr>
</table>`;

const voet = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
 <tr><td align="center" style="padding:26px 24px 34px;font-family:'Figtree',Inter,Arial,sans-serif;color:#8b95a3;font-size:12px;line-height:1.6;">
   Sonty B.V. &middot; ${MERK.adres} &middot; <a href="${MERK.site}" style="color:#8b95a3;">sonty.nl</a><br>
   Je krijgt deze mail omdat je een offerte bij ons hebt aangevraagd.<br>
   <a href="{% unsubscribe %}" style="color:#8b95a3;text-decoration:underline;">Uitschrijven</a>
   &nbsp;&middot;&nbsp;
   <a href="{% manage_preferences %}" style="color:#8b95a3;text-decoration:underline;">Voorkeuren aanpassen</a>
 </td></tr>
</table>`;

/**
 * Zet een complete, zelfstandige mail in elkaar.
 * blokken = array met html-stukken die tussen kop en afzender komen.
 */
function mail({ naam, preheader, kop, intro, blokken, cta, ondersteuning }) {
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${naam}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
  body{margin:0!important;padding:0!important;width:100%!important;}
  a{color:${MERK.oranje};}
  @media screen and (max-width:620px){
    .wrap{width:100%!important;}
    .pad{padding-left:20px!important;padding-right:20px!important;}
    .kop{font-size:26px!important;line-height:1.25!important;}
    /* Knop op mobiel over de volle breedte: ook de tabel eromheen moet mee, anders blijft de
       knop op 300px staan en oogt hij verloren op een telefoon (previewronde 27 juli). */
    .knop table{width:100%!important;}
    .knop a{width:100%!important;display:block!important;}
    .beeld{height:auto!important;}
  }
  /* Dark mode: 2026-standaard, niet optioneel. Het papier wordt donker, de donkere kaart
     krijgt juist een randje zodat hij niet in de achtergrond verdwijnt. */
  @media (prefers-color-scheme:dark){
    .body-bg{background:#0f1115!important;}
    .paper{background:#15181d!important;}
    .t-dark{color:#e9edf2!important;}
    .t-soft{color:#a6b0bd!important;}
    .lijn{border-color:#2a2f36!important;}
  }
  [data-ogsc] .paper{background:#15181d!important;}
  [data-ogsc] .t-dark{color:#e9edf2!important;}
  [data-ogsc] .t-soft{color:#a6b0bd!important;}
</style>
</head>
<body class="body-bg" style="margin:0;padding:0;background:${MERK.achtergrond};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:transparent;">${preheader}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="body-bg" style="background:${MERK.achtergrond};">
 <tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

   <tr><td style="padding:0 0 18px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MERK.zwart};border-radius:12px;">
       <tr><td style="padding:18px 24px;">
         <img src="${MERK.logo}" width="104" alt="Sonty" style="display:block;width:104px;height:auto;">
       </td></tr>
     </table>
   </td></tr>

   <tr><td class="paper" style="background:${MERK.papier};border-radius:14px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
       <tr><td class="pad" style="padding:34px 36px 0;">
         <h1 class="kop t-dark" style="margin:0;font-family:'Figtree',Inter,Arial,sans-serif;font-size:30px;line-height:1.22;font-weight:800;color:${MERK.tekst};letter-spacing:-0.4px;">${kop}</h1>
         <p class="t-soft" style="margin:14px 0 0;font-family:'Figtree',Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:${MERK.grijs};">${intro}</p>
       </td></tr>

       ${blokken.map((b) => `<tr><td class="pad" style="padding:24px 36px 0;">${b}</td></tr>`).join('\n')}

       <tr><td class="pad knop" style="padding:26px 36px 0;">${knop(cta.tekst, cta.url)}</td></tr>

       ${ondersteuning ? `<tr><td class="pad" style="padding:24px 36px 0;">
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf7f3;border-left:3px solid ${MERK.oranje};border-radius:6px;">
           <tr><td style="padding:16px 18px;font-family:'Figtree',Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:${MERK.tekst};">${ondersteuning}</td></tr>
         </table>
       </td></tr>` : ''}

       <tr><td class="pad lijn" style="padding:26px 36px 34px;">${afzender()}</td></tr>
     </table>
   </td></tr>

   <tr><td>${voet()}</td></tr>
  </table>

 </td></tr>
</table>
</body>
</html>`;
  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// De vier sjablonen
// ─────────────────────────────────────────────────────────────────────────────

const FOTO = 'https://sonty-website.vercel.app/images/eigen/knikarm-gevel.webp';

const SJABLONEN = {
  // 1. OFFERTE — de werkpaard-mail voor reeks A. Persoonlijk blok is de kern.
  'sonty-offerte': mail({
    naam: 'Sonty - offerte',
    preheader: 'Even kijken of alles klopt, dan help ik je verder',
    kop: 'Hoi {{ first_name|default:"daar" }}, je offerte staat klaar',
    intro: 'Je hebt sinds {{ person.offerte_datum|default:"kort geleden" }} een offerte van ons liggen. Ik wil even checken of alles erin staat zoals jij het voor je ziet.',
    blokken: [persoonlijkBlok()],
    cta: { tekst: 'Bekijk je offerte', url: '{{ person.offerte_link|default:"https://www.sonty.nl" }}' },
    ondersteuning: 'Klopt er iets niet, of wil je een andere kleur of maat? Stuur gerust een berichtje terug, dan pas ik het voor je aan.',
  }),

  // 2. UITNODIGING — reeks B. Grote foto, één actie: een moment kiezen.
  'sonty-uitnodiging': mail({
    naam: 'Sonty - uitnodiging showroom',
    preheader: 'Even zien en voelen voordat je beslist',
    kop: 'Wil je het eerst even zien?',
    intro: 'Kleuren en stoffen zien er thuis anders uit dan op een scherm. In onze showroom in Rijswijk staat alles opgesteld, zodat je precies weet wat je krijgt.',
    blokken: [
      `<img src="${FOTO}" width="528" alt="Zonwering van Sonty op een woning" class="beeld" style="display:block;width:100%;max-width:528px;height:auto;border-radius:12px;">`,
      persoonlijkBlok(),
    ],
    cta: { tekst: 'Kies een moment', url: '{{ person.showroom_link|default:"https://www.sonty.nl/showroom" }}' },
    ondersteuning: '<strong>Goed om te weten:</strong> we nemen de tijd, er is geen verkooppraatje en je zit nergens aan vast. Ook op zaterdag geopend.',
  }),

  // 3. VERHAAL — reeks C en D. Ook hier één knop, geen tien links zoals in maart.
  'sonty-verhaal': mail({
    naam: 'Sonty - verhaal',
    preheader: 'Even laten zien wat er mogelijk is',
    kop: '{{ person.verhaal_kop|default:"Je zocht ooit zonwering" }}',
    intro: '{{ person.verhaal_intro|default:"Is het er destijds nooit van gekomen? Dat gebeurt vaker dan je denkt. Even laten zien wat er nu mogelijk is." }}',
    blokken: [
      `<img src="${FOTO}" width="528" alt="Zonwering van Sonty op een woning" class="beeld" style="display:block;width:100%;max-width:528px;height:auto;border-radius:12px;">`,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
         <tr><td style="font-family:'Figtree',Inter,Arial,sans-serif;font-size:16px;line-height:1.65;color:${MERK.grijs};" class="t-soft">
           {{ person.verhaal_tekst|default:"Onze eigen montageteams plaatsen alles zelf, en we werken uitsluitend met A-merken. Daardoor weet je vooraf wat je krijgt en bij wie je terechtkunt als er iets is." }}
         </td></tr>
       </table>`,
    ],
    cta: { tekst: '{{ person.verhaal_cta|default:"Bekijk wat het nu kost" }}', url: '{{ person.verhaal_link|default:"https://www.sonty.nl" }}' },
    ondersteuning: '4,9 uit 5 op Google &middot; ruim 3.000 klanten gingen je voor &middot; eigen montageteams',
  }),

  // 4. SERVICE — reeks E. Verkoopt niets. Houdt de lijst gezond, precies wat na maart nodig is.
  'sonty-service': mail({
    naam: 'Sonty - service',
    preheader: 'Even checken of alles naar wens is',
    kop: 'Alles naar wens, {{ first_name|default:"daar" }}?',
    intro: 'Je {{ person.product|default:"zonwering" }} is geplaatst. Ik hoor graag even of alles goed werkt en of je tevreden bent over hoe het is afgewerkt.',
    blokken: [
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
         <tr><td style="font-family:'Figtree',Inter,Arial,sans-serif;font-size:16px;line-height:1.65;color:${MERK.grijs};" class="t-soft">
           Is er iets niet goed, laat het dan gewoon weten. Dan lossen we het op. Je hebt
           <strong style="color:${MERK.tekst};" class="t-dark">3 jaar garantie op de montage, 5 jaar op het product en 7 jaar op de motor</strong>.
         </td></tr>
       </table>`,
    ],
    cta: { tekst: '{{ person.service_cta|default:"Laat het ons weten" }}', url: '{{ person.service_link|default:"https://www.sonty.nl/contact" }}' },
    ondersteuning: null,
  }),
};

fs.mkdirSync(UIT, { recursive: true });
for (const [naam, html] of Object.entries(SJABLONEN)) {
  fs.writeFileSync(path.join(UIT, naam + '.html'), html);
  console.log(`${naam}.html  (${(html.length / 1024).toFixed(1)} kB)`);
}
console.log(`\n${Object.keys(SJABLONEN).length} sjablonen geschreven naar ${UIT}`);
module.exports = { SJABLONEN, MERK };
