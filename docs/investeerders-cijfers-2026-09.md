# Sonty: onderbouwing groeiverhaal (stand 5 september 2026)

Alle cijfers hieronder komen uit eigen systemen. Bron staat per regel. Wat niet te onderbouwen is, staat apart in deel 3.

## 1. Feiten

### Commercie, januari t/m juli, 2025 tegenover 2026
Bron: offerteregister (Google Sheet), tabellen data/conversie-2025-tabellen.json en data/conversie-2026-tabellen.json. Akkoord = order met ingevuld bedrag.

| | 2025 jan-jul | 2026 jan-jul | Verschil |
|---|---|---|---|
| Offertes (leads) | 6.141 | 10.355 | +69% |
| Akkoorden (orders) | 762 | 1.049 | +38% |
| Akkoordwaarde incl. btw | € 2,76 mln | € 3,88 mln | +41% |
| Gemiddelde order | € 3.617 | € 3.702 | +2% |

Heel 2025: 9.198 offertes, 1.110 akkoorden, € 4,15 mln akkoordwaarde.
2026 t/m augustus (augustus nog niet volledig bijgewerkt): 11.827 offertes, 1.157 akkoorden, € 4,30 mln.
Dus: eind augustus 2026 al meer orders en meer orderwaarde dan in heel 2025.

### Teamcapaciteit (wat er aan output bij is gekomen)
Bron: scripts/capaciteitsmonitor.js op het offerteregister, gedraaid 5 september 2026.

| | Voorjaar 2026 (W13-W16) | Eind juli 2026 | Nu (W36) |
|---|---|---|---|
| Plafond team, beste 4 weken | 35 orders/week | 35 | 51,5 orders/week (W31-W34) |
| Werkelijke verwerking | | 25 orders/week | 41 orders/week |
| Instroom | | 500 offertes/week | 346 offertes/week |
| Verzadiging | | 177% (oordeel AFSCHALEN) | 84% (oordeel VASTHOUDEN) |
| Offertes per order | | 15,0 | 10,1 (gezond is ~8) |
| Doorlooptijd tot akkoord | | 21 dagen | 24 dagen |

Conclusie: het team sluit nu 47% meer orders per week dan het beste voorjaarsniveau, en 65% meer dan eind juli. De instroom is bewust teruggebracht naar wat het team aankan.

### AI-klantenservice Sunny
Bron: data/ai-ks/log.jsonl (elke interactie op WhatsApp en e-mail), sinds 3 juli 2026.

| | Juli | Augustus | Totaal 3 jul t/m 5 sep |
|---|---|---|---|
| Interacties (WhatsApp + mail) | 1.885 | 2.394 | 4.575 |
| Naar een mens doorgezet | 164 (8,7%) | 182 (7,6%) | 383 (8,4%) |
| Offertes aangemaakt of aangepast door Sunny | 121 | 153 | 288 |
| Inmeetafspraken via Sunny | 57 | 63 | 123 |
| Showroomafspraken via Sunny | 8 | 19 | 29 |

Ruim 90% van alle klantcontact wordt zonder mens afgehandeld; de rest gaat met een klaarstaand concept naar het team.

### Conversie per week rond de livegang (bron: scripts/conversie-week-sheet.js)
- W23-W28 (juni, begin juli): 7 tot 13%
- W29-W31 (bot live vanaf 16 juli): 14,1%, 13,6%, 10,5%, de hoogste weken van het jaar
- W32 en later (prijsverhoging 3 augustus, vakantie): 5 tot 8%, de laatste weken lopen nog op omdat akkoorden ~3 weken achterlopen
Geen harde causaliteit claimen: seizoen en prijsverhoging spelen mee.

### Marketing
Bron: data/ad-spend.json (Meta via API, Google handmatig).
- 2026 jan-jul: € 170k Meta + € 202k Google = € 372k. Dat is € 36 per lead en € 355 per order, 9,6% van de akkoordwaarde.
- 2025 is niet vergelijkbaar: Google-uitgaven zijn alleen voor maart-mei vastgelegd.
- Q2-rapport (maart-mei 2026, 4.433 online leads): online conversie 3,4%; Google binnen 10 km 10,6%; Instagram 2,3%.

### Wat er gebouwd is (in eigen beheer, allemaal live)
- Sunny: prijsmotor, offertes maken en aanpassen, showroom boeken, inmeten plannen op reistijd en agenda, harde verzendpoorten, taalspiegeling.
- Eigen CRM en planning (vervangt extern pakket van ruim € 1.000 per maand), inmeet-dashboard, vakantie- en bezettingsoverzicht, belscherm buitendienst.
- Keten na akkoord: meetbon op locatie, offerte in boekhouding bijwerken, digitaal tekenen, aanbetaling 40%, bestel-dashboard, werkbon die de klant op de telefoon tekent, montage-opdrachten automatisch naar de monteurs-app.
- Website: eigen Next.js-site, configurator, gevel-visualisatie, rekentool inmeters, websitefoto-beheer.
- Marketing-automatisering: e-mailflows op echte gebeurtenissen (review pas na montage), weekrapport, SEO-agent, buren-campagnes op zonligging, VvE-radar.
- Sturing: capaciteitsmonitor (wekelijks op- of afschalen), conversiemeting, personeelsdashboard, scenario-lab (elke automatisering eerst honderden gegenereerde gevallen, pas dan live).

### Afstand tot de showroom (het argument voor meer winkels)
Bron: data/conversie-rapport-2026-q2.txt (maart-mei 2026, 4.433 online leads), conversie per afstand tot Rijswijk.

| Afstand | Google | Instagram |
|---|---|---|
| 0-10 km | 10,6% | 4,1% |
| 10-20 km | 4,5% | 3,2% |
| 20-40 km | 2,9% | 3,3% |
| 40-60 km | 2,2% | 1,9% |
| 60 km+ | 0,0% | 0,0% |

Binnen 10 km van de showroom converteert een Google-lead 2 tot 4 keer zo goed als verder weg. Dat is het gemeten bewijs dat een fysieke winkel de conversie draagt.
De interne aanname "showroombezoekers converteren bijna 10x beter" staat nergens gemeten; niet publiek gebruiken.

### Aangeleverd door Daimy (niet uit onze systemen te controleren)
- Tijdlijn: Joey begon met 1 montagebus, nu rijden er 5. 3 inmeters. Salesteam belt vanaf september elke lead.
- Backoffice nu voor 75% geautomatiseerd, doel 85% vóór het seizoen 2027 begint.
- Nieuwe website komt eraan.
- Gezocht: leverancier die meegroeit, en investeerder voor 5 winkels, het liefst gefinancierd vóór Q2 2027. Winkels waar klanten kijken en voelen en waar alleen nog een verkoper zit.
- Ruim 70% meer inkoop bij leveranciers dan vorig jaar.
- 600+ Google-reviews, 4,9.

## 2. Wat de cijfers zeggen (voor het verhaal)
1. De vraag groeit harder dan het team: +69% leads, +38% orders. Het gat daartussen is capaciteit, en dat gat is sinds juli aantoonbaar gedicht (25 naar 41 orders per week, verzadiging 177% naar 84%).
2. Het team is in vier maanden 47% productiever geworden zonder dat de vraag wegviel.
3. Ruim 90% van het klantcontact loopt zonder mens. Dat is wat een tweede vestiging goedkoop maakt in kantoorbezetting.
4. Eind augustus staat 2026 al boven heel 2025 in orders en orderwaarde.

## 3. Let op, niet publiek zeggen zonder check
- "Ruim 70% meer inkoop": ons register laat +69% offertes en +41% orderwaarde zien. Het inkoopcijfer bij leveranciers komt van Daimy zelf.
- Conversie na de prijsverhoging ligt lager (5 tot 8% tegen 10 tot 14% in juli). Deels vertraging in de administratie, deels seizoen, maar het is een vraag die een investeerder gaat stellen.
- Marketingkosten per order (€ 355) zijn niet met 2025 te vergelijken door ontbrekende Google-cijfers.

## 4. Post (LinkedIn)

Joey begon met één montagebus. Vandaag rijden er vijf.

Daartussen zit een tijdlijn die ik graag eerlijk vertel. Van januari tot en met juli kwamen er 69% meer aanvragen binnen dan vorig jaar. We sloten 38% meer orders. Eind augustus staat 2026 al boven heel 2025, en het seizoen is nog niet klaar.

Het gat tussen die 69% en die 38% was ons probleem. In juli deed het team 25 orders per week terwijl er 500 offertes per week binnenkwamen. Offertes verouderden, klanten kochten elders. We hebben toen niet de marketing uitgezet, maar het bedrijf verbouwd: extra bussen, drie inmeters, een salesteam dat vanaf deze maand elke lead persoonlijk belt, en een eigen softwarelaag.

Die softwarelaag is het echte verhaal. Onze backoffice is nu voor 75% geautomatiseerd en gaat naar 85% voordat het seizoen van 2027 begint. Onze AI-collega Sunny heeft sinds juli ruim 4.500 klantgesprekken op WhatsApp en e-mail afgehandeld, meer dan 90% zonder tussenkomst van een mens. Ze rekent prijzen, heeft bijna 300 offertes gemaakt of aangepast en ruim 120 inmeetafspraken ingepland. Meetbon, digitaal tekenen, aanbetaling, bestelling bij de leverancier, werkbon op de telefoon van de klant: het loopt door zonder kantoor. Gemeten resultaat: het team sluit nu 41 orders per week met een plafond van ruim 50, de wachtrij is weg, de vraag is niet gezakt.

En nu het gekke. We lopen niet meer vast op klanten en niet meer op capaciteit. We lopen vast op winkels. Onze cijfers zijn daar heel duidelijk over: een aanvraag binnen 10 kilometer van onze showroom wordt 2 tot 4 keer zo vaak een order als een aanvraag verder weg. Mensen willen zonwering zien en voelen. Met alles geautomatiseerd hoeft er in zo'n winkel alleen nog een verkoper te zitten.

Daarom zoeken we twee partners.

Een investeerder die vijf winkels wil financieren, het liefst nog vóór het tweede kwartaal van 2027, zodat ze open zijn als het seizoen begint. Rotterdam is de eerste. Het model is gemeten, de software staat, de marketing werkt. Wat we nodig hebben is de brandstof om te schalen.

En een leverancier die groei ziet als iets om samen in te investeren, niet als iets om af te romen. Een fabrikant of assembleur van zonwering die begrijpt dat een dealer die dit jaar ruim 70% meer inkoopt en volgend jaar vijf winkels opent geen risico is maar een kans, en die daar in marge, marketing en financieringsruimte naar handelt.

Ken je iemand die hierbij past, of ben je dat zelf? Stuur me een bericht of tag ze hieronder.

#zonwering #groei #ondernemen #retail #groeikapitaal
