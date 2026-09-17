# Pre-launch sweep nieuwe Sonty-site (sonty-website.vercel.app), 17-09-2026

Uitgevoerd op alle 103 routes uit de sitemap plus /configurator, /veelgestelde-vragen en een 404-pagina, op 375 / 768 / 1024 / 1440 px. Meetmiddelen: eigen crawler (Playwright), Lighthouse 13.4 mobiel (lokaal, gesimuleerde 4G), curl op headers en redirects, Trengo- en KV-controles. Bedrijfsgegevens gebruikt: Sonty B.V., Frijdastraat 8F Rijswijk, KvK 70927618, btw NL858524468B01, WhatsApp 085 006 9681, aanvragen@sonty.nl / info@sonty.nl, opgericht 2013, werkgebied Zuid-Holland.

## D. Go / no-go

**Go, met drie voorwaarden.** Er zijn geen blockers meer in copy, links, formulieren, redirects, headers of juridische pagina's. Vóór de DNS-switch moeten nog:

1. Jouw antwoord op de drie feitenvragen hieronder (openingstijden, postcode, oprichtingsjaar), want die staan nu op meerdere plekken en ik heb één variant gekozen.
2. Verzendcentrum op "eigen" op de switchdag (staat in het draaiboek).
3. Search Console-verificatie en sitemap na de switch (Daimy geeft toegang).

Snelheid op mobiel (Lighthouse 59-63) is geen blocker maar wel het grootste open punt; zie de tabel.

## A. Bevindingen

Ernst: blocker / hoog / laag. Status: gefixt / open.

| # | Pagina | Element | Probleem | Ernst | Status |
|---|--------|---------|----------|-------|--------|
| 1 | alle 103 | interne links | 0 kapotte interne links, 0 links naar vercel.app of localhost, 0 href="#", externe links met rel=noopener | - | ok |
| 2 | /blog/zonwering-subsidie-2026 | bron-URL in em | horizontale scroll op 375 px (77 px) | hoog | gefixt (overflow-wrap) |
| 3 | /configurator | h1 | geen h1 | hoog | gefixt |
| 4 | 42 pagina's | title | buiten 40-65 tekens (legal 20-32, blogs/categorie 66-80) | hoog | gefixt: 40 van 42; 2 lange plaatsnamen via korter sjabloon |
| 5 | 33 pagina's | meta description | buiten 110-170 tekens (diensten 63-109, categorie 235-252, vacatures 200) | hoog | gefixt (alle diensten, categorie, zakelijk, legal, home, contact, portfolio, vacatures, 2 blogs) |
| 6 | 10 pagina's | og:image | ontbrak (over-ons, assortiment, reparatie, portfolio, vacatures, visualisatie, zakelijk + 5 sectoren) | hoog | gefixt |
| 7 | 30 pagina's | copy | gedachtestreepjes (6 per dienstenpagina via 3 gedeelde componenten, vacature 21) | hoog | gefixt op alle publieke pagina's (admin niet) |
| 8 | 6 pagina's | copy | AI-taal: "naadloos" x4, "wij begrijpen dat" x2 | hoog | gefixt; 1 keer "naadloos" staat in een echte klantreview op /reviews, laten staan |
| 9 | blog school, vacature | u/uw | u-vorm in je-site | laag | gefixt (blog); overige treffers zijn "km/u" |
| 10 | privacyverklaring, algemene voorwaarden | u/uw | juridische teksten in u-vorm (28 keer) | laag | open, vraag C3 |
| 11 | 4 blogs, mail-FAQ, PDF | levertijd | "4-6 weken", "8-10 weken", "3 weken voorraad" | blocker (beleid Daimy) | gefixt, overal weg; AV-artikel 7 blijft (juridisch, noemt geen termijn) |
| 12 | 4 plekken | openingstijden | di-vr 9:00 (PDF, mail) versus 9:30 (showroom-pagina, 8 plekken); za 9:00 versus 9:30 | hoog | gefixt op 9:30 overal, vraag C1 |
| 13 | PDF versus site | postcode | 2288 EZ (5x) versus 2288 EX (24x) | hoog | open, vraag C2 |
| 14 | over-ons, PDF, offertepagina | oprichtingsjaar | tijdlijn zegt "2014 start als ZZP'er", jij zegt 2013; "12+ jaar" stond hardcoded | laag | jaren nu berekend vanaf 2013; vraag C4 |
| 15 | PDF, mail | garantie | 5/10/5 (PDF), 5/7/5 (mail-FAQ) versus beleid 3/5/7 | blocker | gefixt |
| 16 | offertepagina + PDF | telefoon | 3x bellen, beleid is WhatsApp | hoog | gefixt |
| 17 | 36 afbeeldingen | gewicht | 304-730 KB per stuk | hoog | gefixt: alle 36 onder 300 KB (13,1 MB naar 9,6 MB) |
| 18 | home | 2 foto's | komen van een externe CDN (393 en 367 KB) | laag | open: lokaal hosten en comprimeren |
| 19 | alle pagina's | console | 404 op pagead2.googlesyndication.com/dfp.min.js, geladen door de GTM-container | laag | open, GTM (Daimy of beheerder) |
| 20 | alle pagina's | main-landmark | geen <main> op 99 pagina's | hoog | gefixt: één main in de root-layout, pagina-mains naar div |
| 21 | alle pagina's | skip-link, focus | ontbraken | hoog | gefixt: skip-link naar h1, zichtbare focus-ring |
| 22 | footer | tikdoelen | tel/mail-links kleiner dan 24 px | laag | gefixt |
| 23 | diensten, contact | aria/label | doekstalen-knoppen met afwijkend aria-label; select zonder naam | laag | gefixt |
| 24 | home, diensten, contact | contrast | oranje accenten (#EA580C/#BF5317) en grijs (#888) onder 4.5:1 | hoog | grotendeels gefixt (a11y 88 naar 96); rest open: leestijd-labels op blogkaarten, badges "STANDAARD/MEEST GEKOZEN" op modelkaarten, "SNELSTE ANTWOORD" op contact, footer-navigatiehint |
| 25 | diensten | tabel | vergelijkingstabel zonder th-koppen (keuzegids) | laag | open: koprij heeft al th, Lighthouse wil per cel een koppeling |
| 26 | vercel.app | X-Robots-Tag | moet noindex zijn tot de switch | - | gefixt en gemeten; sonty.nl zelf krijgt geen noindex |
| 27 | headers | CSP | HSTS, X-Frame-Options, nosniff, referrer en permissions aanwezig; geen Content-Security-Policy | laag | open (advies: eerst report-only) |
| 28 | env | sleutels | geen gevoelige NEXT_PUBLIC_-waarden; CRON_SECRET en codes gezet | - | ok |
| 29 | redirects | oude URL's | alle 57 uit de oude sitemap 301/308; www naar sonty.nl; /diensten/vloeren toegevoegd | - | ok |
| 30 | build | console.log | 4 API-routes loggen (bewust, server-side); 0 in componenten | laag | open, mag blijven |
| 31 | formulieren | werking | contact naar Trengo-ticket + bevestiging + honeypot + limiet (429 na 5), dubbele submit afgevangen; configurator naar CRM | - | ok (live getest) |
| 32 | cookies/tracking | Cookiebot | banner alleen op sonty.nl (domeingroep), server-side GTM op sst.sonty.nl; op vercel.app niet meetbaar | - | ok, meten op de switchdag |
| 33 | Lighthouse mobiel | scores | home 59/96/96/69, diensten 60/96/96/69, configurator 63/96/96/69, contact 63/91/96/69 (perf/a11y/bp/seo) | hoog (perf) | open: LCP 9-16 s gesimuleerd door hero-achtergrond + 3,8 MB paginagewicht + 550 KB GTM-scripts; SEO 69 alleen door noindex op vercel.app |
| 34 | productnamen | consistentie | "knikarmscherm" (27 pagina's) naast "zonnescherm" (7 pagina's, als synoniem) | laag | open, vraag C5 |

## B. Aanpassingen (bestanden)

Commits 9dd28bd, a3a1588, 2bab17a, ebbf99d, c858930, b1379c7 op main (allemaal live).

- `lib/diensten.ts`: 13 shortDescriptions herschreven (110-165 tekens).
- `app/categorie/[slug]/page.tsx`: titel-sjabloon, META_DESC per categorie.
- `app/zakelijk/page.tsx`, `lib/zakelijk-sectoren.ts`: titels en beschrijvingen ingekort, og:image.
- `app/page.tsx`, `app/contact/page.tsx`, `app/assortiment/page.tsx`, `app/reparatie/page.tsx`, `app/portfolio/page.tsx`, `app/vacatures/page.tsx`, `app/over-ons/page.tsx`, `app/vacatures/monteur/page.tsx`, `app/blog/page.tsx`, `app/zonwering/[city]/page.tsx`: titels/beschrijvingen, og:image, preload hero, contrastkleuren.
- `app/algemene-voorwaarden/page.tsx`, `app/privacyverklaring/page.tsx`, `app/privacy-beleid/page.tsx`, `app/cookiebeleid/page.tsx`: titels en beschrijving.
- `content/blog/posts.json`: 10 metaTitles, 2 metaDescriptions; `content/blog/*.md`: AI-woorden, je-vorm, levertijd.
- `components/GoogleReviews.tsx`, `components/ProductKeuzegids.tsx`, `components/StickyCtaBar.tsx`, `components/BlendShowcase.tsx`, `app/diensten/[slug]/page.tsx`, `app/zakelijk/[sector]/page.tsx`: gedachtestreepjes, AI-woorden, contrast.
- `components/SontyHeader.tsx`: skip-link. `components/SontyFooter.tsx`: tikdoelen. `components/DoekCollectie.tsx`: aria-label weg. `components/ContactForm.tsx`: select-naam.
- `app/layout.tsx`: `<main id="inhoud">`; 23 pagina's `<main>` naar `<div>`.
- `app/globals.css`: skip-link, :focus-visible, overflow-wrap voor artikel-links.
- `app/configurator/page.tsx`: h1.
- `lib/offerte-pdf/OfferteBrochure.tsx`, `app/offerte/[token]/OfferteView.tsx`, `lib/verzendcentrum/mail-templates.ts`: openingstijden 9:30, garantie 3/5/7, WhatsApp, geen levertijd.
- `public/images/**`: 36 foto's opnieuw gecomprimeerd (webp q72, avif q45, max 1800 px breed).
- `.gitignore`: data/klik-lab-configurator.json.

## C. Vragen aan jou

1. **Openingstijden**: showroom-pagina zegt di t/m vr 9:30-17:00 en za 9:30-16:00; PDF en mails zeiden 9:00. Ik heb overal 9:30 gezet. Klopt dat?
2. **Postcode**: 2288 EX (site, footer, showroom) of 2288 EZ (PDF, CLAUDE.md)? Ik kon het niet via PDOK bevestigen.
3. **u/uw in privacyverklaring en algemene voorwaarden**: laten staan (juridische toon) of omzetten naar je-vorm zoals de rest van de site?
4. **Oprichtingsjaar**: jij zegt 2013, de tijdlijn op /over-ons zegt "2014: Joey begint als ZZP'er". Wat is het jaar dat we overal noemen? Nu rekenen pagina en PDF vanaf 2013 ("13+ jaar").
5. **"Zonnescherm" als synoniem** voor knikarmscherm op 7 pagina's: bewust laten (zoekterm) of overal knikarmscherm?
6. **GTM**: de container laadt een Google-adscript dat 404 geeft (dfp.min.js). Kan de beheerder die tag weghalen?
7. **Search Console en Meta**: toegang voor verificatie, en de Meta-koppeling opnieuw autoriseren voor de landingspagina-check.

## Niet gedaan, bewust

- Lighthouse-snelheid boven 90 op mobiel: vraagt hero-afbeelding per breakpoint via next/image, minder JavaScript in de eerste laad en een lichtere GTM-container. Dat is een eigen werkblok van 1-2 dagen; niet nodig voor de switch.
- Content-Security-Policy: pas in report-only, daarna afdwingen, om GTM/Cookiebot niet te breken.
- Reviews en merklogo's: reviews komen uit de Google-cache met echte teksten (seed als fallback); Sunmaster- en Somfy-vermeldingen zijn dealer-vermeldingen.
