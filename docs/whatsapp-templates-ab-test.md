# WhatsApp-templates voor de A/B-test (juli 2026)

Aanmaken in Trengo: Instellingen, WhatsApp, Templates, Nieuwe template.
Kanaal: WhatsApp Business (+31 85 006 9681). Taal: Nederlands. Categorie: MARKETING.

Waarom handmatig: knoppen kunnen niet via de Trengo-API worden aangemaakt. Het
`components`-veld geeft een 500 bij elk formaat en een `buttons`-veld wordt genegeerd
(getest 26 juli, templates daarna weer opgeruimd). De tekst zelf kan wel via de API, maar
een template gaat bij aanmaken meteen naar Meta, dus dan zou het toevoegen van de knoppen
een tweede goedkeuringsronde kosten.

## Variabelen (bij alle vier gelijk)

| var | inhoud | voorbeeld voor Meta |
|-----|--------|---------------------|
| {{1}} | voornaam | Daimy |
| {{2}} | waarde van producten en montage | 7.966 euro |
| {{3}} | wat de klant betaalt | 6.771 euro |
| {{4}} | geldig tot | maandag 3 augustus |
| {{5}} | offertelink met offertenummer | https://document.reuzenpanda.nl/... — offertenummer: 202610102 |

Meta vraagt bij het opslaan om voorbeeldwaarden. Gebruik die uit de kolom hierboven.

## Gemeenschappelijke kop (staat in alle vier bovenaan)

```
Hi {{1}}, Jaimy hier van Sonty. Leuk dat ik je mag helpen!

Je prijsindicatie staat klaar. Aan producten en montage zit een waarde van {{2}}, maar met de actie die nu loopt betaal je {{3}}. Daar zit alles in, ook de btw, dus je komt niet voor verrassingen te staan. Deze prijs geldt nog tot {{4}}.

Bekijk je offerte hier: {{5}}
```

## 1. offerte_ab1_inmeten

Slot na de kop:
```
Ga je akkoord, dan plannen we het inmeten in. Onze adviseur neemt alle stalen en kleuren mee, dus je kiest gewoon thuis in je eigen licht. Pas na het inmeten staat de definitieve prijs vast.
```
Knoppen: `Dit is akkoord` | `Ik twijfel nog` | `Ik heb een vraag`

## 2. offerte_ab2_vertrouwen

```
Onze monteurs zijn bij ons in dienst, dus er komt geen onderaannemer over de vloer. Je krijgt 3 jaar garantie op de montage en 5 jaar op het product.
```
Knoppen: `Dit is akkoord` | `Ik twijfel nog` | `Ik heb een vraag`

## 3. offerte_ab3_klopt

```
Wil je even kijken of de maten en kleuren kloppen? Die heb je zelf ingeschat bij de aanvraag, dus daar zit vaak nog een verschil in. Ik pas het zo voor je aan.
```
Knoppen: `Alles klopt` | `Er moet iets anders` | `Ik heb een vraag`

## 4. offerte_ab4_kort

```
Wat wil je doen?
```
Knoppen: `Inmeten inplannen` | `Eerst showroom` | `Ik heb een vraag`

## Gecontroleerd

Alle vier zijn nagelopen op: lengte onder 1024 tekens (langste 520), variabelen netjes 1 tot
en met 5 zonder gaten, geen variabele aan het begin of eind, geen twee variabelen naast
elkaar, knopteksten onder de 25 tekens, geen dubbele knopteksten binnen een template.

Op stijl: geen gedachtestreepjes, geen emoji's, geen callcenter-frasen. Het woord "zonwering"
komt er niet in omdat 4 procent van de aanvragen raamdecoratie of behang is, en "motor" niet
omdat 19 procent van de aanvragen er geen heeft. "Montage" mag wel: van 37 gecontroleerde
offertes hadden alle 37 een montageregel.

## Zodra ze goedgekeurd zijn

Geef de vier template-id's door, dan zet ik ze in de verdeler. Die is al gebouwd en verdeelt
strikt om en om, legt per klant vast welke template hij kreeg, en zorgt dat de bot op elke
knop het juiste doet.
