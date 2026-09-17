# Wat Claude al kan regelen vóór de overstap naar de nieuwe website (volgende week)

Opgesteld 17-09-2026. Gebaseerd op de gemeten checklist (docs/checklist-overgang-website-2026-09-16.md). Volgorde = volgorde van uitvoeren. Alles hieronder kan zonder DNS-wijziging, dus zonder risico voor de huidige site.

## A. Kan ik zelf, zonder jou (start direct na je "ja")

| # | Wat | Waarom | Tijd | Bewijs dat het klaar is |
|---|-----|--------|------|-------------------------|
| 1 | **Formulieren naar Trengo**: contact, reparatie en zakelijk maken een ticket op aanvragen@ met de klant als afzender, plus melding, plus spam-rem (honeypot + limiet per IP). TRENGO_TOKEN staat al in Vercel. | Anders komt geen enkel formulier na de switch bij het team terecht. | halve dag + lab | testformulier → ticket in Trengo met klant als afzender, antwoord komt bij de klant aan |
| 2 | **Site-URL op sonty.nl**: NEXT_PUBLIC_SITE_URL zetten en de 8 hardcoded vercel.app-links in de sitecode eruit (tekenlink, werkbon, inmeetlink, admin-mails). | Klanten krijgen anders vercel.app-links in mails. | 1 uur | live gemeten: klantlink in testmail begint met https://sonty.nl |
| 3 | **Back-up van de leaddata**: dagelijkse export van KV naar de Mac mini en Blob (launchd), herstelproef op een kopie, alarm als de export uitblijft. | Er is nu geen enkele back-up; na de switch is dit de enige plek voor nieuwe leads. | halve dag | back-upbestand met aantal dossiers + geslaagde herstelproef |
| 4 | **Domein alvast koppelen in Vercel**: sonty.nl en www.sonty.nl toevoegen aan het project, www → kaal domein. Verandert niets aan de live site zolang de DNS niet wijzigt. | Vercel geeft dan exact de DNS-records die jij (of ik) bij Neostrada moet zetten. | 15 min | `vercel domains ls` toont sonty.nl + de benodigde records |
| 5 | **noindex op sonty-website.vercel.app** (alleen op die hostnaam, sonty.nl blijft indexeerbaar). | Anders staat dezelfde site twee keer in Google. | 30 min | header gemeten op vercel.app en niet op sonty.nl |
| 6 | **Verzendcentrum-proef in testmodus**: één eigen testaanvraag van configurator tot prijsvoorstel (mail naar joey@/daimy@, WhatsApp overgeslagen), klantlink, tekenen, Sunny-opvolging, Sheet-rij. | Op de switchdag gaat het verzendcentrum op "eigen"; dat mag geen eerste keer zijn. | 2 uur | verzendlog + mail in jullie inbox + Sheet-rij |
| 7 | **Sleutels die ik heb**: Telegram (bot + chat) en een nieuwe CRON_SECRET in Vercel; hardcoded codes (meetbon, werkbon, belscherm, monteur-pin, financiering) naar env. | Niet nodig voor de switch, wel gratis hygiëne nu ik er toch zit. | 30 min | env-lijst |
| 8 | **Klik-lab configurator**: Playwright loopt alle 12 producten en varianten door tot en met de aanvraag, elke nacht. | Vangt fouten zoals de dubbele TaHoma-vraag vóór klanten ze zien. | halve dag | rapport 0 fouten |
| 9 | **Gouda- en Leidschendam-stadspagina's** bouwen op de echte data (beide plaatsen zitten al in stad-historie-2026.json), zodat de oude URL's 200 geven in plaats van een redirect. | Ranking van twee bestaande pagina's behouden. | 1 uur | beide URL's 200 op de nieuwe site, overlap-lab < 30% |
| 10 | **Ads-landingspagina's uitlezen**: via de Meta Ads-koppeling de eind-URL's van alle actieve advertenties ophalen en tegen de nieuwe sitemap leggen; Google Ads via de alleen-lezen koppeling proberen. | Een 404 als landingspagina kost direct geld. | 1 uur | lijst URL's met status op de nieuwe site |
| 11 | **Draaiboek switchdag** met tijden: TTL-check, DNS-wijziging, 15-minutencontrole (curl, www-redirect, Cookiebot, tracking-meting, testaanvraag, contactformulier), terugdraaistap. | Geen improvisatie op de dag zelf. | 1 uur | document in docs/ |
| 12 | **Uptime-wacht**: launchd-check elke 5 minuten op https://sonty.nl (200 + kenmerk van de nieuwe site), alarm op Telegram bij afwijking, vanaf de switch. | Direct weten als DNS of Vercel omvalt. | 30 min | eerste groene melding |
| 13 | **Smoke-run dag vóór de switch**: 38 pagina's desktop + iPhone-formaat, configurator-flow, admin-inlog. | Laatste controle op de exacte build die live gaat. | 1 uur | screenshots + 0 fouten |

Totaal: ongeveer 3 werkdagen, ruim binnen deze week.

## B. Kan ik pas na iets van jou

| # | Wat | Wat ik van jou nodig heb |
|---|-----|--------------------------|
| 14 | DNS wijzigen bij Neostrada (TTL laag, A @ en CNAME www; mail-records laten staan) | Neostrada-login, óf jij voert de twee records in die ik je stuur |
| 15 | Search Console verifiëren en sitemap indienen | eigenaar-toegang op de Search Console-property (of het verificatie-token) |
| 16 | Reviews live verversen | Google Places API-key (V23) |
| 17 | Verzendcentrum op "eigen" op de switchdag (bron eigen, testmodus uit, automatisch versturen aan) | jouw "go" op de dag zelf, direct na de DNS-wijziging |
| 18 | Zapier-zaps met Reuzenpanda controleren | jouw blik in het Zapier-account (in de code niet zichtbaar) |
| 19 | Webflow opzeggen | pas na 14 dagen zonder terugval, jij |

## Niet nodig vóór de switch (bewust later)

Klaviyo-sleutel op de site (export loopt vanaf de Mac mini), productfoto's van de RP-server (pas bij RP-uit), 61 scripts met vercel.app-links (blijven werken), RP helemaal uitzetten (V20, eigen tempo).
