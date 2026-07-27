#!/usr/bin/env node
/**
 * DE SONTY E-MAILSJABLONEN (Daimy 2026-07-27, herzien na zijn feedback "zo weinig info,
 * we hebben zo veel foto's en zo veel goeie shit").
 *
 * De eerste versie was te kaal: kop, kaartje, knop, klaar. Dat verkocht niets en deed geen recht
 * aan wat er ligt. Nu wordt alles ingezet wat we echt hebben:
 *   - 282 eigen foto's (adviesgesprek, montageteams, showroom, projecten, de bus, de award)
 *   - 10 echte Google-reviews met naam, gemiddeld 4,9 uit 5
 *   - de garantie 3 jaar montage / 5 jaar product / 7 jaar motor
 *   - Sunmaster Premium Dealer van het jaar 2023
 *   - het vijfstappenproces van aanvraag tot installatie
 *
 * Wat NIET verandert, want daar gingen de vorige campagnes juist op stuk: er blijft ÉÉN primaire
 * knop. De maartmail had tien gelijkwaardige links en haalde 1,5% clicks bij 4,4% afmeldingen.
 * Rijk zijn is iets anders dan de lezer laten kiezen. Alles onder de knop is onderbouwing: het
 * beantwoordt de vraag "waarom zou ik deze club vertrouwen", niet "waar moet ik heen".
 *
 * Techniek: tabellen en inline stijlen, want Outlook rendert met Word. Alles blijft ruim onder de
 * 102 kB waarboven Gmail een mail afknipt, doordat foto's als URL worden geladen.
 *
 * Gebruik: node scripts/email/bouw-templates.js   (schrijft naar scripts/email/dist/)
 */
const fs = require('fs');
const path = require('path');

const UIT = path.join(__dirname, 'dist');
const CDN = 'https://sonty-website.vercel.app/images';

const M = {
  oranje: '#FF6B00',
  zwart: '#0a0a0a',
  kaart: '#1a1a1a',
  tekst: '#16181d',
  grijs: '#5b6470',
  zacht: '#8b95a3',
  lijn: '#e3e6ea',
  papier: '#ffffff',
  achtergrond: '#eef0f3',
  creme: '#faf7f3',
  logo: 'https://cdn.prod.website-files.com/666ab30f0f595f63bc4b0971/666ab30f0f595f63bc4b0b6e_Logo_White.webp',
  // APPEN, NIET BELLEN (Daimy 2026-07-27): het telefoonnummer mag nergens zichtbaar zijn.
  // Daarom overal een wa.me-link met voorgevulde tekst; het nummer zit in de link, niet in beeld.
  whatsapp: 'https://wa.me/31850069681?text=' + encodeURIComponent('Hoi Sonty! Ik heb een vraag over mijn offerte.'),
  adres: 'Frijdastraat 8F, 2288 EX Rijswijk',
  site: 'https://www.sonty.nl',
};

const F = 'font-family:Figtree,Inter,-apple-system,\'Segoe UI\',Arial,sans-serif';

/* ─────────────────────────── bouwstenen ─────────────────────────── */

const knop = (tekst, url) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;" class="knoptabel">
 <tr><td align="center" bgcolor="${M.oranje}" style="border-radius:10px;">
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:54px;v-text-anchor:middle;width:320px;" arcsize="18%" stroke="f" fillcolor="${M.oranje}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:17px;font-weight:bold;"><![endif]-->
  <a href="${url}" style="background:${M.oranje};border-radius:10px;color:#ffffff;display:inline-block;${F};font-size:17px;font-weight:700;line-height:54px;text-align:center;text-decoration:none;width:320px;-webkit-text-size-adjust:none;">${tekst}</a>
  <!--[if mso]></center></v:roundrect><![endif]-->
 </td></tr>
</table>`;

/** Grote sfeerfoto met bijschrift eronder. */
const beeld = (bestand, alt, bijschrift) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
 <tr><td><img src="${CDN}/${bestand}" width="528" alt="${alt}" class="beeld" style="display:block;width:100%;max-width:528px;height:auto;border-radius:12px;"></td></tr>
 ${bijschrift ? `<tr><td style="${F};font-size:12px;color:${M.zacht};padding-top:8px;" class="t-zacht">${bijschrift}</td></tr>` : ''}
</table>`;

/** De offertekaart: het bewijs dat deze mail over déze klant gaat. */
const offerteKaart = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${M.kaart};border-radius:14px;">
 <tr><td style="padding:26px 28px;${F};">
   <div style="color:${M.zacht};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700;">Jouw offerte</div>
   <div style="color:#ffffff;font-size:22px;font-weight:700;padding-top:9px;line-height:1.3;">{{ person.sonty_product|default:"Zonwering op maat" }}</div>
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top:18px;">
     <tr><td style="${F};color:${M.zacht};font-size:13px;padding:5px 0;">Offertenummer</td>
         <td align="right" style="${F};color:#ffffff;font-size:13px;font-weight:600;padding:5px 0;">{{ person.sonty_offertenummer|default:"-" }}</td></tr>
     <tr><td style="${F};color:${M.zacht};font-size:13px;padding:5px 0;">Geldig tot</td>
         <td align="right" style="${F};color:#ffffff;font-size:13px;font-weight:600;padding:5px 0;">{{ person.sonty_geldig_tot|default:"-" }}</td></tr>
     <tr><td style="${F};color:${M.zacht};font-size:13px;padding:5px 0;">Inclusief</td>
         <td align="right" style="${F};color:#ffffff;font-size:13px;font-weight:600;padding:5px 0;">montage door ons eigen team</td></tr>
   </table>
   <div style="border-top:1px solid #2e3440;margin-top:16px;padding-top:16px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
       <tr><td style="${F};color:${M.zacht};font-size:14px;">Totaal</td>
           <td align="right" style="${F};color:${M.oranje};font-size:27px;font-weight:800;">{{ person.sonty_bedrag|default:"" }}</td></tr>
     </table>
   </div>
 </td></tr>
</table>`;

/** Vier harde cijfers. Allemaal echt: 4,9 uit Google, 3.000+ klanten, dealer sinds 2013. */
const cijfers = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${M.zwart};border-radius:14px;">
 <tr><td style="padding:22px 10px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
   <tr>
    ${[['4.9', 'uit 500+ reviews'], ['3000+', 'tevreden klanten'], ['10+', 'jaar vakmanschap'], ['24u', 'reactie op je vraag']]
      .map(([n, l]) => `<td align="center" width="25%" style="${F};padding:4px 6px;">
       <div style="color:${M.oranje};font-size:21px;font-weight:800;line-height:1.1;">${n}</div>
       <div style="color:${M.zacht};font-size:10px;padding-top:5px;line-height:1.35;">${l}</div>
      </td>`).join('')}
   </tr>
  </table>
 </td></tr>
</table>`;

/** Echte Google-review, met naam. Nooit verzinnen. */
const review = (naam, tekst) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${M.creme};border-radius:12px;">
 <tr><td style="padding:22px 24px;${F};">
   <div style="color:${M.oranje};font-size:15px;letter-spacing:2px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
   <div style="color:${M.tekst};font-size:15px;line-height:1.6;padding-top:10px;font-style:italic;">&ldquo;${tekst}&rdquo;</div>
   <div style="color:${M.grijs};font-size:13px;padding-top:10px;font-weight:600;">${naam} &middot; Google review</div>
 </td></tr>
</table>`;

/** Wat er gebeurt nadat de klant ja zegt. Neemt onzekerheid weg, dat is de grootste rem. */
const stappen = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
 <tr><td style="${F};font-size:17px;font-weight:800;color:${M.tekst};padding-bottom:14px;" class="t-donker">Zo gaat het verder</td></tr>
 ${[
    ['1', 'Jij geeft akkoord', 'Online ondertekenen met &eacute;&eacute;n klik, of gewoon even terugmailen.'],
    ['2', 'Wij komen inmeten', 'Tot op de millimeter, want maatwerk begint bij goed meten.'],
    ['3', 'Productie op maat', 'Jouw maten, jouw kleur. Gemaakt bij onze vaste leveranciers.'],
    ['4', 'Onze monteurs plaatsen', 'Eigen team in dienst, geen onderaannemers. Netjes achtergelaten.'],
  ].map(([n, kop, tekst]) => `
  <tr><td style="padding-bottom:12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
     <tr>
      <td width="34" valign="top" style="padding-top:2px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="26" height="26" align="center" bgcolor="${M.oranje}" style="border-radius:13px;${F};color:#ffffff;font-size:12px;font-weight:800;line-height:26px;">${n}</td>
        </tr></table>
      </td>
      <td style="${F};padding-left:12px;">
        <div style="color:${M.tekst};font-size:15px;font-weight:700;line-height:1.35;" class="t-donker">${kop}</div>
        <div style="color:${M.grijs};font-size:14px;line-height:1.5;padding-top:2px;" class="t-zacht">${tekst}</div>
      </td>
     </tr>
    </table>
  </td></tr>`).join('')}
</table>`;

/** Garantieblok. Concreet en geruststellend; dit staat ook op de offerte zelf. */
const garantie = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${M.lijn};border-radius:12px;" class="rand">
 <tr><td style="padding:20px 22px;${F};">
   <div style="color:${M.tekst};font-size:15px;font-weight:700;" class="t-donker">En daarna laten we je niet los</div>
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top:12px;">
     <tr>
       ${[['3 jaar', 'op de montage'], ['5 jaar', 'op het product'], ['7 jaar', 'op de motor']]
         .map(([n, l]) => `<td width="33%" style="${F};">
            <div style="color:${M.oranje};font-size:17px;font-weight:800;">${n}</div>
            <div style="color:${M.grijs};font-size:12px;padding-top:2px;" class="t-zacht">${l}</div>
          </td>`).join('')}
     </tr>
   </table>
 </td></tr>
</table>`;

/** Showroom als zachte tweede stap. Geen concurrerende knop maar een tekstlink. */
const showroom = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${M.creme};border-radius:14px;">
 <tr><td style="padding:0;">
   <img src="${CDN}/eigen/showroom-tafel.webp" width="528" alt="De adviestafel in onze showroom in Rijswijk" class="beeld" style="display:block;width:100%;max-width:528px;height:auto;border-radius:14px 14px 0 0;">
 </td></tr>
 <tr><td style="padding:20px 24px 24px;${F};">
   <div style="color:${M.tekst};font-size:17px;font-weight:800;">Liever eerst even zien en voelen?</div>
   <div style="color:${M.grijs};font-size:14px;line-height:1.6;padding-top:8px;">
     Op een scherm zie je nooit hoe een kleur er in je eigen huis uitziet. In Rijswijk hangt
     alles klaar. We nemen er rustig de tijd voor, ook op zaterdag, en je zit nergens aan vast.
   </div>
   <div style="padding-top:12px;">
     <a href="${M.site}/showroom" style="color:${M.oranje};${F};font-size:14px;font-weight:700;text-decoration:none;">Plan je bezoek &rsaquo;</a>
     <span style="color:${M.zacht};${F};font-size:14px;"> &nbsp;of &nbsp;</span>
     <a href="${M.whatsapp}" style="color:${M.oranje};${F};font-size:14px;font-weight:700;text-decoration:none;">app ons even &rsaquo;</a>
   </div>
 </td></tr>
</table>`;

/**
 * Wat we allemaal doen. BEWUST ZONDER PRODUCTFOTO'S.
 * De bestandsnamen in de fotomap zijn niet betrouwbaar: zowel "screen-woning" als
 * "screen-rijtjeshuizen" blijken een knikarmscherm te tonen. Een foto onder het kopje "Screens"
 * zetten die in werkelijkheid iets anders is, is precies het soort fout dat een klant meteen ziet
 * en die het vertrouwen in de hele mail onderuit haalt. Daarom hier alleen tekst, en grote
 * sfeerbeelden alleen op plekken waar het bijschrift klopt met wat er echt op staat.
 */
const assortiment = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${M.lijn};border-radius:14px;" class="rand">
 <tr><td style="padding:24px 26px;${F};">
   <div style="font-size:17px;font-weight:800;color:${M.tekst};" class="t-donker">We doen alles onder één dak</div>
   <div style="font-size:14px;color:${M.grijs};line-height:1.6;padding-top:8px;" class="t-zacht">
     Van zonwering buiten tot raamdecoratie binnen. Alles op maat, en altijd geplaatst door onze
     eigen mensen.
   </div>
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top:16px;">
     <tr>
       <td width="50%" valign="top" style="${F};">
         <div style="font-size:11px;font-weight:800;color:${M.oranje};letter-spacing:1.4px;text-transform:uppercase;padding-bottom:8px;">Buiten</div>
         ${['Screens', 'Rolluiken', 'Knikarmschermen', 'Uitvalschermen', 'Markiezen', "Pergola's", 'Horren']
           .map((x) => `<div style="font-size:14px;color:${M.grijs};line-height:1.9;" class="t-zacht">${x}</div>`).join('')}
       </td>
       <td width="50%" valign="top" style="${F};">
         <div style="font-size:11px;font-weight:800;color:${M.oranje};letter-spacing:1.4px;text-transform:uppercase;padding-bottom:8px;">Binnen</div>
         ${['Gordijnen', 'Plissé en duette', 'Jaloezieën', 'Rolgordijnen', 'Shutters', 'Wandbekleding', 'Behang']
           .map((x) => `<div style="font-size:14px;color:${M.grijs};line-height:1.9;" class="t-zacht">${x}</div>`).join('')}
       </td>
     </tr>
   </table>
 </td></tr>
</table>`;

/** Afzender met gezicht: een mens verkoopt beter dan een logo. */
const afzender = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${M.lijn};" class="rand">
 <tr><td style="padding:22px 0 0;">
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
     <td width="76" valign="top">
       <!-- Geen portret: Jaimy is de naam waaronder we schrijven, dus er bestaat geen foto van
            hem. Een willekeurige collega als "Jaimy" neerzetten zou een klant misleiden. Het
            merkvlak doet hier hetzelfde werk zonder iets te suggereren wat niet klopt. -->
       <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
         <td width="60" height="60" align="center" bgcolor="${M.zwart}" style="border-radius:14px;">
           <img src="${M.logo}" width="38" alt="Sonty" style="display:block;width:38px;height:auto;">
         </td>
       </tr></table>
     </td>
     <td valign="middle" style="${F};">
       <div class="t-donker" style="color:${M.tekst};font-size:15px;font-weight:700;">Jaimy van Sonty</div>
       <div class="t-zacht" style="color:${M.grijs};font-size:14px;padding-top:3px;">Vraag? <a href="${M.whatsapp}" style="color:${M.oranje};text-decoration:none;font-weight:600;">Stuur me een appje &rsaquo;</a></div>
       <div class="t-zacht" style="color:${M.grijs};font-size:14px;padding-top:2px;">${M.adres}</div>
     </td>
    </tr>
   </table>
 </td></tr>
</table>`;

const voet = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
 <tr><td align="center" style="padding:26px 24px 34px;${F};color:${M.zacht};font-size:12px;line-height:1.65;">
   <div style="padding-bottom:8px;">
     <a href="${M.site}" style="color:${M.zacht};text-decoration:none;">sonty.nl</a> &nbsp;&middot;&nbsp;
     <a href="https://www.facebook.com/sonty.nl/" style="color:${M.zacht};text-decoration:none;">Facebook</a> &nbsp;&middot;&nbsp;
     <a href="https://www.instagram.com/sonty.nl/" style="color:${M.zacht};text-decoration:none;">Instagram</a>
   </div>
   Sonty B.V. &middot; ${M.adres}<br>
   Je krijgt deze mail omdat je een offerte bij ons hebt aangevraagd.<br>
   <a href="{% unsubscribe %}" style="color:${M.zacht};text-decoration:underline;">Uitschrijven</a>
   &nbsp;&middot;&nbsp;
   <a href="{% manage_preferences %}" style="color:${M.zacht};text-decoration:underline;">Voorkeuren aanpassen</a>
 </td></tr>
</table>`;

/* ─────────────────────────── casco ─────────────────────────── */

function mail({ naam, preheader, kop, intro, blokken }) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
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
  a{color:${M.oranje};}
  @media screen and (max-width:620px){
    .wrap{width:100%!important;}
    .pad{padding-left:20px!important;padding-right:20px!important;}
    .kop{font-size:26px!important;line-height:1.24!important;}
    .knoptabel{width:100%!important;}
    .knoptabel a{width:100%!important;display:block!important;}
    .beeld{height:auto!important;}
  }
  /* Dark mode. Zonder de t-klassen valt donkere tekst weg op een donkere achtergrond; dat ging
     in de eerste versie mis met de naam van de afzender. */
  @media (prefers-color-scheme:dark){
    .body-bg{background:#0f1115!important;}
    .paper{background:#15181d!important;}
    .t-donker{color:#e9edf2!important;}
    .t-zacht{color:#a6b0bd!important;}
    .rand{border-color:#2a2f36!important;}
  }
  [data-ogsc] .paper{background:#15181d!important;}
  [data-ogsc] .t-donker{color:#e9edf2!important;}
  [data-ogsc] .t-zacht{color:#a6b0bd!important;}
</style>
</head>
<body class="body-bg" style="margin:0;padding:0;background:${M.achtergrond};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:transparent;">${preheader}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="body-bg" style="background:${M.achtergrond};">
 <tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

   <tr><td style="padding:0 0 16px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${M.zwart};border-radius:12px;">
       <tr>
         <td style="padding:16px 22px;"><img src="${M.logo}" width="98" alt="Sonty" style="display:block;width:98px;height:auto;"></td>
         <td align="right" style="padding:16px 22px;${F};color:${M.zacht};font-size:11px;letter-spacing:1.2px;text-transform:uppercase;">Sinds 2013 &middot; Rijswijk</td>
       </tr>
     </table>
   </td></tr>

   <tr><td class="paper" style="background:${M.papier};border-radius:16px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
       <tr><td class="pad" style="padding:34px 36px 0;">
         <h1 class="kop t-donker" style="margin:0;${F};font-size:30px;line-height:1.2;font-weight:800;color:${M.tekst};letter-spacing:-0.5px;">${kop}</h1>
         <p class="t-zacht" style="margin:14px 0 0;${F};font-size:16px;line-height:1.65;color:${M.grijs};">${intro}</p>
       </td></tr>
       ${blokken.map((b) => `<tr><td class="pad" style="padding:24px 36px 0;">${b}</td></tr>`).join('\n')}
       <tr><td class="pad" style="padding:28px 36px 34px;">${afzender()}</td></tr>
     </table>
   </td></tr>

   <tr><td>${voet()}</td></tr>
  </table>
 </td></tr>
</table>
</body>
</html>`;
}

/* ─────────────────────────── de vier sjablonen ─────────────────────────── */

// Echte Google-reviews uit sonty-website/data/google-reviews-seed.json. Nooit verzinnen.
const REVIEW_ROLLUIK = ['Menno Vinos', 'Mijn vriendin en ik wilden al een lange tijd rolluiken, maar twijfelden bij welke partij. Sonty gaf eerlijk advies en het resultaat is prachtig.'];
const REVIEW_ALLES = ['Bas Komies', 'Sonty heeft bij ons het hele huis voorzien van rolluiken en gordijnen. De communicatie was goed en duidelijk.'];
const REVIEW_TRAJECT = ['Danny Jurjens', 'Uitstekend werk verricht! Van het eerste contact tot inmeten tot de installatie, in één woord TOP!'];

const SJABLONEN = {
  'sonty-offerte': mail({
    naam: 'Sonty - offerte',
    preheader: 'Even kijken of alles klopt, dan help ik je verder',
    kop: 'Hoi {{ first_name|default:"daar" }}, je offerte staat klaar',
    intro: 'Je offerte van {{ person.sonty_offerte_datum_nl|default:"kort geleden" }} staat nog voor je klaar. Even checken of alles erin staat zoals jij het voor je ziet?',
    blokken: [
      offerteKaart(),
      knop('Bekijk je offerte', '{{ person.sonty_offerte_link|default:"https://www.sonty.nl" }}'),
      cijfers(),
      review(...REVIEW_TRAJECT),
      stappen(),
      garantie(),
      showroom(),
    ],
  }),

  'sonty-uitnodiging': mail({
    naam: 'Sonty - showroom-uitnodiging',
    preheader: 'Even zien en voelen voordat je beslist',
    kop: 'Wil je het eerst even zien?',
    intro: 'Op een scherm zie je nooit hoe een doek er echt uitziet. In Rijswijk hangt alles klaar, dus je kunt het gewoon even vastpakken.',
    blokken: [
      beeld('eigen/showroom-opening.webp', 'Klanten in de showroom van Sonty in Rijswijk', 'Onze showroom aan de Frijdastraat, ook op zaterdag open'),
      knop('Kies een moment', '{{ person.sonty_showroom_link|default:"https://www.sonty.nl/showroom" }}'),
      offerteKaart(),
      review(...REVIEW_ALLES),
      beeld('eigen/kantoor-stalen.webp', 'Persoonlijk advies aan de adviestafel', 'We nemen rustig de tijd, zonder verkooppraatje'),
      cijfers(),
      garantie(),
    ],
  }),

  'sonty-verhaal': mail({
    naam: 'Sonty - verhaal',
    preheader: 'Even laten zien wat er mogelijk is',
    kop: '{{ person.sonty_verhaal_kop|default:"Je zocht ooit zonwering" }}',
    intro: '{{ person.sonty_verhaal_intro|default:"Is het er nooit van gekomen? Gebeurt vaker dan je denkt. Even laten zien wat er nu kan, en wat het kost." }}',
    blokken: [
      beeld('eigen/knikarm-gevel.webp', 'Zonwering van Sonty op een woning', 'Een van onze projecten: zonwering die de warmte buiten houdt'),
      knop('{{ person.sonty_verhaal_cta|default:"Bekijk wat het nu kost" }}', '{{ person.sonty_verhaal_link|default:"https://www.sonty.nl" }}'),
      assortiment(),
      review(...REVIEW_ROLLUIK),
      cijfers(),
      beeld('eigen/montage-team-1.webp', 'Onze eigen monteurs aan het werk', 'Onze monteurs zijn in dienst bij Sonty, geen onderaannemers'),
      garantie(),
      showroom(),
    ],
  }),

  'sonty-service': mail({
    naam: 'Sonty - service en nazorg',
    preheader: 'Even checken of alles naar wens is',
    kop: 'Alles naar wens, {{ first_name|default:"daar" }}?',
    intro: 'Je {{ person.sonty_product|default:"zonwering" }} is geplaatst. Werkt alles naar behoren en ben je tevreden over de afwerking? Is er iets niet goed, laat het gewoon even weten. Dan lossen we het op.',
    blokken: [
      garantie(),
      knop('{{ person.sonty_service_cta|default:"Laat het ons weten" }}', '{{ person.sonty_service_link|default:"https://www.sonty.nl/contact" }}'),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${M.creme};border-radius:12px;">
        <tr><td style="padding:20px 22px;${F};">
          <div style="color:${M.tekst};font-size:15px;font-weight:700;">Onderhoud: heel simpel</div>
          <div style="color:${M.grijs};font-size:14px;line-height:1.65;padding-top:8px;">
            Doek vuil? Even afspoelen met de tuinslang op een droge dag, en uitgestrekt laten drogen.
            Haal hem bij harde wind altijd in, ook met een windsensor erop. Verder heeft hij nauwelijks
            aandacht nodig.
          </div>
        </td></tr>
      </table>`,
      beeld('eigen/sonty-bus.webp', 'De servicebus van Sonty', 'Service nodig? Ons eigen team komt langs'),
      review(...REVIEW_TRAJECT),
      cijfers(),
    ],
  }),
};


/* ── weer- en seizoensmails ──
   Deze gaan uit op een moment dat het weer of het seizoen de aanleiding is. De toon is daarom
   behulpzaam en niet opdringerig: een seintje, geen aanbieding. En we zijn eerlijk over de
   levertijd, want niemand heeft overmorgen zonwering hangen. Doen alsof dat wel kan is precies
   het soort belofte waar je een klant mee kwijtraakt. */

SJABLONEN['sonty-weer-hitte'] = mail({
  naam: 'Sonty weermoment hitte',
  preheader: 'Even een seintje over het weer van volgende week',
  kop: 'Het wordt {{ person.sonty_weer_piek|default:"flink" }} graden, {{ first_name|default:"daar" }}',
  intro: 'Even een seintje: {{ person.sonty_weer_dag|default:"deze week" }} loopt het op naar {{ person.sonty_weer_piek|default:"boven de 29" }} graden. Precies het weer waarvoor je destijds je offerte hebt aangevraagd.',
  blokken: [
    offerteKaart(),
    knop('Bekijk je offerte', '{{ person.sonty_offerte_link|default:"https://www.sonty.nl" }}'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${M.lijn};border-radius:12px;" class="rand">
      <tr><td style="padding:20px 22px;${F};">
        <div style="color:${M.tekst};font-size:15px;font-weight:700;" class="t-donker">Eerlijk over de levertijd</div>
        <div style="color:${M.grijs};font-size:14px;line-height:1.65;padding-top:8px;" class="t-zacht">
          Voor deze week red je het niet meer, dat gaan we niet mooier maken dan het is. Reken op
          een aantal weken tussen akkoord en montage, en in het hoogseizoen loopt dat op. Wie nu
          beslist, zit er de rest van de zomer warmpjes bij. Of juist niet, dat is het idee.
        </div>
      </td></tr>
    </table>`,
    review(...REVIEW_ROLLUIK),
    cijfers(),
    garantie(),
    showroom(),
  ],
});

SJABLONEN['sonty-weer-lente'] = mail({
  naam: 'Sonty weermoment eerste lentedag',
  preheader: 'De eerste mooie dag van het jaar',
  kop: 'Eerste mooie dag van het jaar',
  intro: 'Het wordt {{ person.sonty_weer_piek|default:"boven de 20" }} graden, en dan denkt bijna iedereen weer aan buiten zitten. Jij vroeg ooit een offerte bij ons aan. Zal ik hem er weer even bij pakken?',
  blokken: [
    beeld('eigen/pergola-tuin-2.webp', 'Een pergola in de tuin, geplaatst door Sonty', 'Een van onze projecten'),
    knop('Bekijk je offerte', '{{ person.sonty_offerte_link|default:"https://www.sonty.nl" }}'),
    offerteKaart(),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${M.creme};border-radius:12px;">
      <tr><td style="padding:20px 22px;${F};">
        <div style="color:${M.tekst};font-size:15px;font-weight:700;">Nu is het rustig, straks niet meer</div>
        <div style="color:${M.grijs};font-size:14px;line-height:1.65;padding-top:8px;">
          In het voorjaar loopt het bij ons hard. Wie er nu bij is, heeft het voor de zomer hangen.
          Dat is geen verkooppraatje maar gewoon hoe onze planning loopt.
        </div>
      </td></tr>
    </table>`,
    review(...REVIEW_TRAJECT),
    assortiment(),
    cijfers(),
    garantie(),
  ],
});

SJABLONEN['sonty-weer-donker'] = mail({
  naam: 'Sonty weermoment donkere dagen',
  preheader: 'Nu de dagen korter worden',
  kop: 'Nu de dagen korter worden',
  intro: 'Het wordt weer vroeg donker. Precies het moment waarop je merkt hoe kaal een raam kan aanvoelen, en hoe veel kou er langs de ruit naar binnen komt.',
  blokken: [
    beeld('eigen/showroom-ramen.webp', 'Raamdecoratie in de showroom van Sonty', 'Raamdecoratie in onze showroom in Rijswijk'),
    knop('{{ person.sonty_verhaal_cta|default:"Bekijk je offerte" }}', '{{ person.sonty_offerte_link|default:"https://www.sonty.nl" }}'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${M.creme};border-radius:12px;">
      <tr><td style="padding:20px 22px;${F};">
        <div style="color:${M.tekst};font-size:15px;font-weight:700;">Scheelt echt in de warmte</div>
        <div style="color:${M.grijs};font-size:14px;line-height:1.65;padding-top:8px;">
          Duette gordijnen hebben luchtkamers die de kou tegenhouden, en een rolluik doet hetzelfde
          aan de buitenkant. Je merkt het vooral 's avonds, als het buiten vriest en je bank naast
          het raam staat.
        </div>
      </td></tr>
    </table>`,
    offerteKaart(),
    review(...REVIEW_ALLES),
    assortiment(),
    cijfers(),
    garantie(),
    showroom(),
  ],
});

SJABLONEN['sonty-welkom'] = mail({
  naam: 'Sonty welkom na aanvraag',
  preheader: 'Je aanvraag is binnen, dit gaat er nu gebeuren',
  kop: 'Je aanvraag is binnen, {{ first_name|default:"daar" }}',
  intro: 'Dank je wel, ik ga er meteen mee aan de slag. Je hoort binnen 24 uur van me met een prijsindicatie. Hieronder vast wat je van ons kunt verwachten.',
  blokken: [
    stappen(),
    knop('Bekijk ons werk', 'https://www.sonty.nl/portfolio'),
    cijfers(),
    review(...REVIEW_TRAJECT),
    assortiment(),
    garantie(),
    showroom(),
  ],
});

fs.mkdirSync(UIT, { recursive: true });
for (const [naam, html] of Object.entries(SJABLONEN)) {
  fs.writeFileSync(path.join(UIT, naam + '.html'), html);
  const kb = html.length / 1024;
  console.log(`${naam}.html  ${kb.toFixed(1)} kB${kb > 100 ? '  LET OP: Gmail knipt af boven 102 kB' : ''}`);
}
console.log(`\n${Object.keys(SJABLONEN).length} sjablonen geschreven naar ${UIT}`);
module.exports = { SJABLONEN, M };
