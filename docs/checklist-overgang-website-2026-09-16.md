# Checklist overgang naar de nieuwe website (sonty.nl van Webflow naar Vercel)

Gecontroleerd 16-09-2026, 17:30. Elk punt is gemeten (DNS, Vercel CLI, live curl, code), niet aangenomen. Gevraagd door Daimy: "een lijst die je goed goed hebt gecontroleerd".

## A. Vóór de switch (bouwen, Claude)

1. **13 sleutels ontbreken in Vercel productie** (gemeten met `vercel env pull`): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, KLAVIYO_PRIVATE_KEY, CRON_SECRET, NEXT_PUBLIC_SITE_URL, GOOGLE_PLACES_API_KEY, GOOGLE_PLACE_ID, MEETBON_CODE, WERKBON_SECRET, BELSCHERM_CODE, MONTEUR_PIN, FINANCIERING_PASSWORD, POSTBODE_MAILBOX_ID. Gevolg nu: nieuwe leads geven geen Telegram-melding en geen Klaviyo-profiel (code slaat over met een waarschuwing), cron-routes zijn met een nagemaakte user-agent aan te roepen, klantlinks wijzen naar vercel.app. Places-key = Daimy (V23).
2. **Formulieren naar Trengo**: contact, reparatie en zakelijk maken nu alleen een KV-lead (zichtbaar in /admin/formulieren); geen Trengo-ticket op aanvragen@, geen reCAPTCHA, geen limiet. Op Webflow komen ze per mail in Trengo. Bouwen: ticket met de klant als afzender + Telegram + spam-rem.
3. **Back-up van de KV-database**: geen enkele back-upjob gevonden (launchd, scripts). Dagelijkse export naar de Mac mini en Blob, herstelproef, alarm als hij uitblijft.
4. **Hardcoded vercel.app-links in de sitecode** (8 plekken: inmeet-aanbod, offerte-tool pdfLink, eigen-crm klantlink, notifications, leads.ts, admin-wachtwoord-mail, lead-store) via één SITE_URL. Daarnaast 61 scripts en databestanden in ~/sonty die vercel.app-links versturen.
5. **noindex op sonty-website.vercel.app** zodra sonty.nl live is (robots.txt staat nu op Allow; anders dubbele indexering van dezelfde site).
6. **Redirects**: /diensten/vloeren (oude footer-link) gaf 404, vandaag toegevoegd naar /diensten/woninginrichting. Alle 57 URL's uit de oude sitemap geven 200 of 301/308. Twee keuzes voor Daimy: /zonwering/gouda (nu naar /diensten/zonwering, Gouda-pagina bestaat alleen op de oude site) en /zonwering/leidschendam (nu naar Voorburg).
7. **Search Console**: geen google-site-verification in de code. Verificatie regelen en sitemap indienen direct na de switch.
8. **Klik-lab configurator**: alle 12 producten en varianten tot en met de aanvraag automatisch doorlopen (bestaat nog niet; het maatgrenzen-lab test alleen de motor). Vandaag handmatig gedaan voor screens, rolluik en TaHoma.
9. **Productfoto's**: 10 foto's op de productkaarten van de configurator komen van user-info.reuzenpanda.nl. Naar eigen hosting, anders breken ze zodra RP uit gaat.

## B. De switch zelf

10. sonty.nl en www.sonty.nl toevoegen aan het Vercel-project (nu: geen enkel sonty.nl-domein gekoppeld; alleen foreverlume.com en zonweringdirect.nl). www doorsturen naar het kale domein (code en canonical gaan uit van https://sonty.nl).
11. Neostrada DNS: TTL eerst laag; daarna alleen A @ (nu 198.202.211.1) en CNAME www (nu cdn.webflow.com) wijzigen naar de records die Vercel opgeeft. **Laten staan:** MX (Outlook), SPF, DKIM selector1/2, _dmarc, autodiscover, klaviyo-site-verification, A-record sst.sonty.nl, wildcard *.sonty.nl. Wie: Daimy, of Claude met de Neostrada-login.
12. admin.sonty.nl valt nu onder de wildcard (185.94.230.197); als CNAME naar Vercel zetten als het team dat adres wil gebruiken.

## C. Direct na de switch (binnen 15 minuten)

13. curl-checks: sonty.nl op Vercel, www → 301, /diensten/shutters → 301, steekproef oude URL's, /admin bereikbaar.
14. Cookiebot-banner zichtbaar (domeingroep bevat sonty.nl, op vercel.app bewust niet), tracking-meting met scripts/tracking-meting.mjs: configurator.conversion, contact_form_submit, Ads-conversie.
15. Eén echte testaanvraag via de configurator (KV-lead, Telegram, bevestigingsmail) en één contactformulier (Trengo-ticket).
16. Ads-landingspagina's: bij de Google Ads- en Meta-beheerders opvragen op welke paden campagnes landen en die op de nieuwe site checken (lokaal niet zichtbaar).

## D. Eerste twee weken

17. Search Console dekking en 404-rapport dagelijks lezen; website-link in het Google Bedrijfsprofiel controleren.
18. Automations omzetten naar sonty.nl-links (punt 4).
19. Webflow laten staan als terugvaloptie; na 14 dagen hosting opzeggen. Webflow-formuliermails, HubSpot-script en RP-widget op de oude site vervallen vanzelf.

## Wat NIET hoeft (gecontroleerd)

- Blog-redirects: de Webflow-blog heeft geen artikel-URL's (alleen /blog).
- GTM/Cookiebot-wijzigingen: tracking is al server-side via sst.sonty.nl overgezet (29-08 gemeten).
- Redirects voor de overige oude URL's: bestaan al en zijn vandaag live doorgemeten.
- Mail: MX/SPF/DKIM veranderen niet.

## Losstaand van de website: Reuzenpanda uit

Staat in docs/overstap-website-configurator-2026-09-16.html §3. Kan pas na V20 (RP-automation "Offerte verstuurd" uit) en hoeft niet tegelijk met de domeinswitch.
