# Checklist overgang naar de nieuwe website (sonty.nl van Webflow naar Vercel)

Gecontroleerd 16-09-2026, aangescherpt 17-09 (Daimy: "denk goed na wat echt nodig is en wat niet, zoals Telegram"). Elk punt is gemeten, niet aangenomen.

## Kern: wat de switch inhoudt

Zodra sonty.nl naar Vercel wijst, verdwijnt de Reuzenpanda-widget mee met Webflow. Elke nieuwe aanvraag komt dan via de eigen configurator in het eigen CRM. Dat betekent dat de switch van de website **ook de overstap voor nieuwe leads** is: het verzendcentrum moet op dat moment op "eigen" staan, anders blijft een aanvraag stil in de pipeline liggen. Oude RP-leads lopen gewoon door (rp-sync, V4, Sunny). V20 (RP-automation "Offerte verstuurd" uit) hoeft daar niet voor: die automation raakt alleen RP-items.

## ECHT NODIG vóór de switch (anders klantcontact of geld stuk)

1. **Formulieren naar Trengo.** Contact, reparatie en zakelijk maken nu alleen een KV-lead; geen ticket op aanvragen@, dus niemand antwoordt. Bouwen: Trengo-ticket met de klant als afzender, plus spam-rem. (Lost ook het no-reply@webflow-gat op.)
2. **Automatisch prijsvoorstel voor configurator-aanvragen.** Verzendcentrum: bron eigen, testmodus uit, automatisch versturen aan, precies op het moment van de switch. Eerste echte aanvraag volgen (mail + WhatsApp + klantlink, Sheet-rij, Sunny-opvolging, Gripp bij akkoord: nog niet live bewezen met een eigen lead).
3. **Domein koppelen en DNS.** sonty.nl en www.sonty.nl aan het Vercel-project (nu geen sonty.nl-domein gekoppeld), www naar kaal domein. Neostrada: alleen A @ en CNAME www wijzigen; MX, SPF, DKIM selector1/2, _dmarc, autodiscover, klaviyo-site-verification, sst.sonty.nl en de wildcard laten staan. TTL eerst laag.
4. **Site-URL op sonty.nl.** NEXT_PUBLIC_SITE_URL zetten en de 8 hardcoded vercel.app-links in de sitecode eruit, zodat klanten tekenlinks, werkbon- en inmeetlinks op sonty.nl krijgen.
5. **Ads-landingspagina's.** Bij de Google Ads- en Meta-beheerders opvragen op welke paden campagnes landen en die op de nieuwe site checken. Een 404 als landingspagina kost direct geld.
6. **noindex op sonty-website.vercel.app** zodra sonty.nl live is (robots staat op Allow; anders dubbele indexering) en **Search Console** verifiëren + sitemap indienen.
7. **Redirect-keuzes.** Alle 57 oude URL's landen goed; vloeren gefixt. Daimy beslist: /zonwering/gouda (nu naar /diensten/zonwering) en /zonwering/leidschendam (nu naar Voorburg).
8. **Back-up van de leaddata (KV).** Geen back-upjob gevonden. Niet technisch blokkerend, wel de enige plek waar nieuwe leads straks staan: dagelijkse export plus herstelproef vóór de switch.

## Direct na de switch (binnen 15 minuten)

9. curl-checks: sonty.nl op Vercel, www → 301, /diensten/shutters → 301, /admin bereikbaar.
10. Cookiebot-banner zichtbaar en tracking-meting (configurator.conversion, contact_form_submit, Ads-conversie).
11. Eén echte testaanvraag via de configurator en één contactformulier doorlopen.

## NIET nodig voor de website (later, of hoort bij RP-uit)

- **Telegram-sleutels op de site.** Leadmeldingen komen al vanaf de Mac mini (Sheet-sync meldt nieuwe offertes, pipeline en Sunny zien de lead). Handig, niet nodig.
- **Klaviyo-sleutel op de site.** De Klaviyo-export loopt vanaf de Mac mini en neemt eigen offertes al mee.
- **Google Places-key.** Reviews staan op een vaste waarde; werkt, later verversen.
- **CRON_SECRET en de codes** (meetbon, werkbon, belscherm, monteur-pin, financiering, Postbode-mailbox): beveiligingshygiëne, 10 minuten werk, niet blokkerend.
- **Productfoto's van de RP-server** (10 stuks): pas nodig bij RP-uit.
- **Klik-lab door alle 12 producten**: kwaliteitsverbetering, niet blokkerend.
- **61 scripts met vercel.app-links** in ~/sonty: blijven werken, geleidelijk omzetten.
- **Webflow opzeggen**: pas na 14 dagen zonder terugval.
- **Blog-redirects, GTM/Cookiebot-wijzigingen, mail-records**: niet nodig, gecontroleerd.

## Losstaand: Reuzenpanda helemaal uit

Staat in docs/overstap-website-configurator-2026-09-16.html §3 (V20, parallelweken, rp-uitzetten.js, Zapier, contract). Kan ná de websiteswitch, in eigen tempo.
