# Concept vertragingsmail v2 (Vertraging-tab, 70 klanten) — NOG NIET VERSTUREN

## HARDE REGELS (Daimy 2026-07-09)
- IEDEREEN in de Vertraging-tab mailen, allemaal DEZELFDE mail (ook "is binnen"-regels, geen uitzonderingen).
- NIETS versturen (ook geen testmail-run naar klanten) tot Daimy er EXPLICIET om vraagt.
- Onderwerpregel DEFINITIEF (keuze Daimy): "Update over je bestelling bij Sonty".
- Verzendscript: scripts/vertraging-mail.js (alleen testmodus; bulk pas na expliciet verzoek). Testmail naar daimy@sonty.nl verstuurd 2026-07-09.

Status: concept v2 na feedback Daimy (2026-07-09): niet uitnodigen tot bellen, FIFO uitleggen
(oudste order eerst, geen uitzonderingen), bellen/klagen versnelt niets, achterstand naar
verwachting over 3 tot 4 weken ingelopen, geen wachttijd-indicatie tot montage mogelijk.
Doelgroep: klanten in tab "Vertraging. " van het offerte-register.
Verzendkanaal (voorstel, zelfde als duo-mail): Trengo "Aanvragen" (aanvragen@sonty.nl), per klant gepersonaliseerd.

---

**Onderwerp:** Een update over Sonty en je bestelling

Hi [voornaam],

Je hoort van ons omdat je een bestelling bij Sonty hebt lopen. Eerlijk is eerlijk: de levering duurt langer dan de bedoeling was, en daar balen wij minstens net zo hard van als jij. Daarom leggen we je graag uit wat er speelt.

Sonty is het afgelopen jaar harder gegroeid dan we hadden durven dromen. Meer mensen dan ooit kozen voor onze zonwering, en dat merken we op twee plekken. Onze leverancier heeft door de drukte langere levertijden nodig, en ook onze eigen montageplanning kon de vraag even niet bijbenen. Dat laatste hebben we inmiddels opgelost, en we zijn de achterstand nu volop aan het inlopen. We hopen die over 3 tot 4 weken te hebben ingehaald.

Goed om te weten: we behandelen alle bestellingen strikt op volgorde van binnenkomst. De oudste bestelling is dus als eerste aan de beurt, en daar maken we voor niemand een uitzondering op. Zo zorgen we ervoor dat we de service en kwaliteit kunnen blijven leveren die je van Sonty gewend bent. Want liever iets meer geduld vragen dan haastwerk afleveren. Bellen of mailen maakt je levering daarom helaas niet sneller, hoe graag we je ook aan de telefoon te woord staan. Een precieze indicatie van de wachttijd tot montage kunnen we op dit moment niet geven.

Wat je van ons mag verwachten: zodra jouw producten bij ons binnen zijn, nemen wij direct contact met je op om de montageafspraak in te plannen. Je hoeft daar zelf niets voor te doen, wij houden jouw bestelling in de gaten.

Zeker nu het warmere weer voor de deur staat, snappen we de frustratie van het wachten maar al te goed: je wilt gewoon van je zonwering genieten. Toch vragen we je om nog even geduld. Dat is geen leuke boodschap om te sturen, maar we vertellen je liever eerlijk hoe het zit. Zijn je contactgegevens veranderd? Geef het dan wel even door via een reactie op deze mail, zodat we je straks direct kunnen bereiken.

Nogmaals sorry voor het wachten, en bedankt voor je vertrouwen in Sonty.

Met zonnige groet,

Joey
Sonty B.V.
Frijdastraat 8F, Rijswijk
info@sonty.nl

---

## Opmerkingen bij uitvoering (na akkoord)
- GEEN telefoonnummer in de mail (verzoek Daimy: mensen moeten niet gaan bellen).
- De sheet heeft geen voornaam-kolom (kolom A is "Achternaam + klantnr"). Personalisatie: voornaam opzoeken via Gripp/RP op mailadres, anders terugvallen op "Hi," zonder naam.
- 2 regels zonder mailadres (samenwerkingen Koen Zitoen / Leco van Zadelhoff) en 1 regel met Gripp-waarschuwing in de mailkolom (de Bruin): handmatig afhandelen.
- Dubbele klanten in de lijst (bijv. Koops, Fennes, Steenbergen, Nijveldt 2x): één mail per uniek mailadres.
- Klanten met teamopmerking "is binnen" mogelijk uitsluiten (product is er al): checken met Daimy.
