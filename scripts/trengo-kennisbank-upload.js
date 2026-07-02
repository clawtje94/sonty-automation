#!/usr/bin/env node
/**
 * Upload kennisbank artikelen naar Trengo Help Center
 * Elk artikel = 1 vraag met compleet antwoord
 */

const { getToken } = require('./trengo-api.js');

const HC_ID = 32224;
const CATS = {
  producten: 93893,
  prijzen: 93894,
  montage: 93895,
  garantie: 93896,
  kleuren: 93897,
  bediening: 93898,
  faq: 93899,
  situaties: 93900,
  over_sonty: 93901,
};

// Alle artikelen — elk artikel is een complete, op zichzelf staande kennisbron
const ARTICLES = [

  // ==================== OVER SONTY ====================
  { cat: 'over_sonty', title: 'Wie is Sonty?', body: `
Sonty is de specialist in zonwering en woninginrichting in de regio Haaglanden. We zijn gevestigd in Rijswijk en leveren uitsluitend A-merk producten.

Wat ons onderscheidt:
- We gebruiken alleen Sunmaster zonwering (Nederlands A-merk, geproduceerd in Nijkerk) en Somfy motoren (wereldleider)
- Al onze monteurs zijn in eigen dienst — geen onderaannemers
- 3000+ tevreden klanten en een 4.9/5.0 score op Google met 600+ reviews
- Sunmaster Premium Dealer
- Persoonlijk contact: je hebt altijd een vast aanspreekpunt

Ons team: Daimy (eigenaar/sales), Joey (eigenaar/inmeter), Jorren (sales/klantenservice), Jaimy (klantenservice/planning), Nanny (planning), Sjoerd (inmeter/showroom) en 7 vaste monteurs.

Adres: Frijdastraat 8F, 2288 EX Rijswijk
Telefoon: 085 006 9681
Email: info@sonty.nl
` },

  { cat: 'over_sonty', title: 'Openingstijden showroom', body: `
Onze showroom in Rijswijk is open:
- Dinsdag t/m vrijdag: 9:30 - 17:00
- Zaterdag: 9:30 - 16:00
- Zondag en maandag: gesloten

Je kunt gewoon binnenlopen, geen afspraak nodig.

Adres: Frijdastraat 8F, 2288 EX Rijswijk

In de showroom hebben we werkende modellen van al onze producten (screens, knikarmschermen, rolluiken), alle doekstalen en kleurstalen. We hebben ook binnenraamdecoratie: gordijnen, plisses, vouwgordijnen en Arte behang.
` },

  { cat: 'over_sonty', title: 'In welk gebied werkt Sonty?', body: `
Ons kerngebied is Haaglanden: Den Haag, Rijswijk, Delft, Zoetermeer, Westland, Leidschendam-Voorburg en omgeving.

We komen tot 60 km bij alle opdrachten en tot 125 km bij opdrachten boven €7.500.

Val je buiten ons werkgebied? Dan verwijzen we je graag door naar een Sunmaster dealer bij jou in de buurt.
` },

  { cat: 'over_sonty', title: 'Welke merken gebruikt Sonty?', body: `
We gebruiken uitsluitend A-merken:

Frame en constructie: Sunmaster — Nederlands merk, eigen productie in Nijkerk. Al bijna 55 jaar een toonaangevende producent van zonwering. Qualicoat en CE-gecertificeerd. Onderdelen zijn altijd leverbaar.

Motoren: Somfy — wereldleider in motoren voor zonwering. 7 jaar garantie op de motor. Koppelbaar met smart home (Tahoma, Google Home, Alexa).

Doek: Sunmaster huiscollectie (standaard, geen meerprijs), Dickson, Para, Sattler, Swela (premium collecties).

Horren: Unilux — A-merk in horren en hordeuren.

Wij kiezen bewust voor A-merken. Goedkopere merken uit het buitenland gaan minder lang mee en bij problemen zijn onderdelen vaak niet meer leverbaar.
` },

  // ==================== PRODUCTEN — SCREENS ====================
  { cat: 'producten', title: 'Wat is een screen?', body: `
Een screen is buitenzonwering voor je ramen. Het is een doek dat aan de buitenkant van je raam wordt gemonteerd en naar beneden rolt.

Wat doet een screen:
- Filtert zonlicht: je houdt uitzicht naar buiten, maar de warmte blijft buiten
- Privacy: overdag kunnen buren niet naar binnen kijken (bij daglicht)
- Tot 90% minder warmte-instraling in de zomer
- UV-bescherming voor je meubels en vloer
- Je huis blijft koeler zonder airco

Belangrijk om te weten:
- Een screen verduistert niet 100%. Voor volledige verduistering heb je een rolluik nodig
- 's Avonds met het licht aan kunnen buren wel naar binnen kijken (het doek is semi-transparant)
- Bij ons zijn alle screens uitgevoerd met een Somfy motor en afstandsbediening
` },

  { cat: 'producten', title: 'Wat is de Zip Design 110? (ons meest verkochte screen)', body: `
De Zip Design 110 is ons meest verkochte screen en de standaard keuze voor de meeste situaties.

Wat maakt de Zip Design 110 bijzonder:
- ZIP-geleiding: het doek zit vast in de zijgeleiders via een ritssysteem. Het doek kan niet klapperen bij wind
- Windvast tot windkracht 8-9
- Cassettebak van 110mm: als het doek is opgerold, zit het volledig beschermd in de cassette
- Strak, modern design
- Fluisterstille Somfy motor
- Leverbaar tot 500cm breed en 270cm hoog
- Standaard doek: Serge 525 gr/m2 (warmtewerend, uitzicht behouden)

Standaardkleuren frame (geen meerprijs): RAL 9010 (wit), RAL 9001 (cremewit), Antraciet structuur, RAL 9005 structuur, RAL 7016 structuur.

Beschikbare bediening: Somfy IO afstandsbediening (standaard), Somfy Solar (draadloos, zonne-energie), Somfy LT draaischakelaar (goedkoopst).
` },

  { cat: 'producten', title: 'Wat is het verschil tussen Zip Design 110 en Screen Square?', body: `
Het grote verschil is de ZIP-geleiding:

Zip Design 110:
- Het doek zit vast in de zijgeleiders via een ritssysteem (ZIP)
- Windvast tot windkracht 8-9: het doek klappert niet
- Cassettebak van 110mm
- Leverbaar tot 500cm breed
- Onze standaard aanbeveling

Screen Square (zonder ZIP):
- Het doek draait vrij in de rail, niet vastgezet
- Bij wind kan het doek gaan klapperen — dan moet je het screen omhoog doen
- Niet windvast
- Kleiner profiel
- Leverbaar tot 400cm breed
- Goedkoper dan Zip Design 110

Ons advies: kies voor Zip Design 110 tenzij je raam echt heel beschut ligt en je op budget zit. De windvastheid en het strakke design zijn de meerprijs waard.
` },

  { cat: 'producten', title: 'Wat is de Zip Square 85/100?', body: `
De Zip Square 85/100 is een compact zipscreen met een dunner profiel dan de Zip Design 110.

Kenmerken:
- Wel ZIP-geleiding (windvast), maar met een dunner profiel (85 of 100mm)
- Compact: ideaal als er weinig ruimte is boven het raam
- Leverbaar tot 400cm breed en 280cm hoog
- Iets goedkoper dan de Zip Design 110
- Geen Somfy Solar IO optie beschikbaar

Wanneer kiezen voor Zip Square:
- Als je windvastheid wilt maar een compacter profiel nodig hebt
- Als er weinig ruimte is boven het raam (minder dan 110mm)
- Als budget een rol speelt maar je wel windvast wilt
` },

  // ==================== PRODUCTEN — KNIKARMSCHERMEN ====================
  { cat: 'producten', title: 'Wat is een knikarmscherm? (zonnescherm)', body: `
Een knikarmscherm (ook wel zonnescherm of markies) is een uitrolbaar doek dat boven je terras of balkon wordt gemonteerd. Het biedt schaduw en bescherming tegen de zon. Het doek rolt uit via twee opvouwbare armen.

Er zijn modellen met en zonder cassette:
- Zonder cassette (SunBasic): het doek ligt bloot als ingerold. Goedkoper, maar korter meegaand
- Met cassette (SunEye, SunElite): het doek en de armen zijn beschermd. Langer meegaand en mooier

Belangrijk: een knikarmscherm moet altijd worden ingerold bij wind en regen (tenzij je een windsensor hebt). Stormschade valt niet onder de garantie.

Alle knikarmschermen worden standaard geleverd met een Somfy motor en afstandsbediening.
` },

  { cat: 'producten', title: 'Welke knikarmschermen heeft Sonty? (vergelijking)', body: `
Wij hebben 5 knikarmschermen, van instap tot topmodel:

SunBasic — Instapmodel
- Open arm, geen cassette
- Goedkoopste optie
- Max 600cm breed, uitval tot 300cm

SunBasic Cassette — Instap met bescherming
- Gesloten cassette: doek beschermd tegen weer
- Iets duurder, maar veel langer meegaand
- Max 600cm breed, uitval tot 300cm

SunEye — Premium (onze bestseller)
- Gesloten, slank cassette-design
- Beste prijs-kwaliteit verhouding
- Max 550cm breed (bij uitval 300cm)
- Onze aanbeveling voor de meeste klanten

SunEye XL — Extra breed
- Zelfde kwaliteit als SunEye, maar breder
- Max 745cm breed, uitval tot 350cm
- Voor brede terrassen die met een standaard SunEye niet te overspannen zijn

SunElite — Het topmodel
- Allerhoogste segment, zwaardere constructie
- Optioneel LED-verlichting in de cassette
- Uitval tot 350cm
- Alleen in RAL 9010 mat of Antraciet structuur
` },

  { cat: 'producten', title: 'Wat is het verschil tussen SunEye en SunElite?', body: `
De SunEye is ons premium knikarmscherm en onze bestseller. De SunElite is het absolute topmodel.

SunEye:
- Gesloten, slank cassette-design
- Sterke aluminium knikarmen
- Max 550cm breed (uitval 300cm)
- Mooie prijs-kwaliteit verhouding
- Voor de meeste terrassen meer dan voldoende

SunElite:
- Knikarmscherm uit het allerhoogste segment
- Zwaardere, stevigere constructie
- Uitval tot 350cm (SunEye max 300cm)
- Optioneel: LED-verlichting in de cassette voor sfeerverlichting op je terras
- Alleen leverbaar in RAL 9010 mat of Antraciet structuur
- Duurder dan de SunEye

Ons advies: voor de meeste klanten is de SunEye de beste keuze. Kies de SunElite als je het allerbeste wilt, LED-verlichting wenst, of een uitval van meer dan 300cm nodig hebt.
` },

  // ==================== PRODUCTEN — ROLLUIKEN ====================
  { cat: 'producten', title: 'Wat is een rolluik en wat zijn de voordelen?', body: `
Een rolluik is buitenzonwering die volledig afsluit. Het bestaat uit aluminium lamellen die voor het raam naar beneden rollen.

Voordelen van een rolluik:
1. Inbraakpreventie: een gesloten rolluik is een extra barriere tegen inbrekers
2. Volledige verduistering: ideaal voor slaapkamers, thuisbioscoop of nachtdienst
3. Isolatie: tot 30% energiebesparing in de winter. Het rolluik creëert een isolerende luchtlaag
4. Geluidsdemping: merkbaar minder straatgeluid, vliegtuiglawaai of verkeer
5. Warmtewering in de zomer: houdt de warmte buiten
6. Privacy: volledig dicht = niemand kan naar binnen kijken

Wij leveren twee types:
- Rolluik S-37: standaard, tot 300cm breed
- Rolluik S-42 (RollSUPER): breed profiel, tot 400cm breed, stevigere constructie

Beide types hebben dubbelwandige aluminium lamellen met PU-schuim voor extra isolatie.

De pantserkleur (lamellen) wordt standaard in dezelfde kleur als het frame geleverd.
` },

  { cat: 'producten', title: 'Wat is het verschil tussen een screen en een rolluik?', body: `
Screen:
- Filtert zonlicht: je houdt uitzicht naar buiten
- Semi-transparant doek: niet 100% verduisterend
- Geen inbraakpreventie
- Beperkte isolatie
- Geen geluidsdemping
- Goedkoper dan een rolluik

Rolluik:
- Volledig dicht: geen uitzicht als het gesloten is
- 100% verduisterend
- Inbraakpreventie
- Tot 30% energiebesparing door isolatie
- Geluidsdemping
- Duurder dan een screen

Wanneer een screen: als je zonwering op je ramen wilt met behoud van uitzicht en daglicht.
Wanneer een rolluik: als je volledige verduistering, inbraakbeveiliging, isolatie of geluidsdemping wilt. Ideaal voor slaapkamers.

Veel klanten kiezen screens voor de woonkamer en rolluiken voor de slaapkamers.
` },

  // ==================== PRODUCTEN — UITVALSCHERMEN ====================
  { cat: 'producten', title: 'Wat is een uitvalscherm?', body: `
Een uitvalscherm is een compacte buitenzonwering die naar buiten uitvalt (kantelt). Het wordt vaak gebruikt op de eerste verdieping of bij ramen waar een knikarmscherm te groot is.

Wij leveren twee types:
- SunCube 150: gesloten cassette met rond design (150mm). Compact en strak. Max 600cm breed.
- SunProject 100: rechthoekige cassette. Budget-optie.

Verschil met een knikarmscherm: een uitvalscherm is bedoeld voor ramen (biedt zonwering op het raam), een knikarmscherm is bedoeld voor terrassen (biedt schaduw op het terras).

Groot voordeel: uitvalschermen hebben stormarmen waardoor ze stevig vast zitten. Je hoeft ze niet in te rollen bij wind. Een windsensor is daarom niet nodig bij uitvalschermen.
` },

  // ==================== PRODUCTEN — SERRE/PERGOLA ====================
  { cat: 'producten', title: 'Welke serrezonwering heeft Sonty?', body: `
Voor serres en veranda's hebben we de SunControl lijn:

SunControl 150 — Onderdak, zonder ZIP
- Zonwering onder je serre of veranda
- Zonder ZIP-geleiding
- Budget optie

SunControl 165 ZIP — Onderdak, windvast (onze aanbeveling)
- Met ZIP-geleiding: windvast
- Onder de serre gemonteerd
- Onze standaard keuze voor serrezonwering

SunControl 165 ZIP Bovendak — Bovenop de serre
- Zelfde product, maar bovenop de serre gemonteerd
- Wordt gekozen als er onder de serre onvoldoende ruimte is

SunControl Pergola — Vrijstaand met palen
- Vrijstaande overkapping voor je terras
- Stevig aluminium frame met eigen palen
- Beschermd tegen zon en lichte regen
- Let op: het doek is wind- en vochtbestendig maar niet 100% waterdicht. Het is en blijft een zonwering

Verschil serre vs. pergola: heb je al een bestaande serre? Dan is SunControl 165 ZIP de keuze. Wil je een vrijstaande overkapping zonder bestaande constructie? Dan is de Pergola wat je zoekt.

Standaardkleuren: RAL 7016 (Antraciet structuur) en RAL 9010 (wit). RAL-kleur naar keuze: +15% meerprijs.
` },

  // ==================== PRODUCTEN — BINNENZONWERING ====================
  { cat: 'producten', title: 'Heeft Sonty ook gordijnen, plisses of behang?', body: `
Ja! In onze showroom in Rijswijk hebben we een breed assortiment binnenraamdecoratie:
- Gordijnen en gordijnrailsen
- Plisses (plissegordijnen)
- Vouwgordijnen
- Rolgordijnen
- Arte behang (premium behangcollectie)

Voor binnenraamdecoratie werken we op afspraak in de showroom. Tijdens het bezoek nemen we alles met je door: stofkeuze, kleur, ophangsysteem en afmetingen. Onze adviseur helpt je graag.

Showroom: Frijdastraat 8F, 2288 EX Rijswijk
Openingstijden: di-vr 9:30-17:00, za 9:30-16:00
` },

  { cat: 'producten', title: 'Levert Sonty ook horren?', body: `
Ja, wij leveren horren van Unilux — een A-merk in horren en hordeuren. Beschikbaar als:
- Plissehor (vouwhor)
- Rolhor
- Schuifhor
- Hordeur (enkel en dubbel)

Neem contact op voor een offerte. Onze inmeter kan horren mee-inmeten bij een inmeetafspraak voor zonwering.
` },

  // ==================== BEDIENING EN MOTOREN ====================
  { cat: 'bediening', title: 'Welke bediening opties zijn er?', body: `
Wij bieden verschillende bedieningsopties:

Somfy IO — Afstandsbediening (standaard)
- Draadloze afstandsbediening (Situo 1 IO)
- Fluisterstille motor
- Koppelbaar met Tahoma Switch voor smartphone-bediening
- Dit is onze standaard en aanbeveling

Somfy Solar — Draadloos op zonne-energie
- Geen bekabeling nodig: de motor werkt op een klein zonnepaneel
- Ideaal als er geen stroomaansluiting bij het raam is
- Werkt ook bij bewolkt weer en indirect daglicht
- Inclusief afstandsbediening
- Iets duurder, maar je bespaart op elektra-aanleg

Somfy LT — Draaischakelaar
- Bedrade motor met vaste schakelaar op de muur
- Goedkoopste gemotoriseerde optie
- Geen afstandsbediening: je moet bij de schakelaar staan
- Niet koppelbaar met Tahoma

Handbediening — Slingerstang (alleen bij knikarmschermen en uitvalschermen)
- Geen motor, geen stroom nodig
- Goedkoopste optie
- Niet beschikbaar bij screens en rolluiken (die hebben altijd een motor nodig)
` },

  { cat: 'bediening', title: 'Wat is de Tahoma Switch? (smart home)', body: `
De Tahoma Switch is de smart home hub van Somfy. Hiermee bedien je al je Somfy producten via de Somfy app op je telefoon, waar je ook bent.

Wat kun je ermee:
- Zonwering bedienen via je telefoon (ook als je niet thuis bent)
- Tijdschema's instellen: automatisch in- en uitrollen op vaste tijden
- Koppelen met Google Home, Amazon Alexa, Apple HomeKit, Philips Hue
- Alle Somfy producten in 1 app

Belangrijk:
- Je hebt per woning maar 1 Tahoma nodig, ongeacht het aantal Somfy producten
- Werkt alleen met Somfy IO motoren (niet met LT of handbediening)
- Inclusief installatie en uitleg door onze monteur
` },

  { cat: 'bediening', title: 'Werkt een Somfy Solar motor ook bij bewolkt weer?', body: `
Ja, Somfy solar motoren werken ook bij indirect daglicht en bewolkt weer. Het zonnepaneel heeft geen directe zon nodig om op te laden.

De enige situatie waar solar niet geschikt is: ramen die de hele dag in volledige schaduw liggen, zoals een noord-gevel onder een diep overstek. In dat geval raden we een bedrade motor aan.

Voordelen van solar:
- Geen bekabeling nodig: alles volledig draadloos
- Geen boren naar binnen: de montage blijft netjes aan de buitenkant
- Ideaal voor appartementen, dakkapellen en situaties zonder stopcontact bij het raam
- Je bespaart op de kosten voor elektra-aanleg
` },

  { cat: 'bediening', title: 'Wat is een Eolis 3D windsensor?', body: `
De Eolis 3D windsensor is een automatische windbeveiliging voor knikarmschermen. De sensor meet de windsnelheid en rolt het scherm automatisch in bij harde wind.

Waarom een windsensor:
- Je hoeft niet meer zelf op te letten: het scherm beschermt zichzelf
- Ideaal als je niet thuis bent en het plotseling gaat waaien
- Zonder sensor kan je scherm beschadigen door wind — en stormschade valt niet onder de garantie

De sensor werkt draadloos op batterij en koppelt automatisch met de Somfy IO motor.

Let op: een windsensor is alleen nodig bij knikarmschermen. Screens met ZIP zijn al windvast en uitvalschermen hebben stormarmen.
` },

  { cat: 'bediening', title: 'Moet er een stopcontact bij het raam zijn?', body: `
Dat hangt af van de gekozen bediening:

Bedrade motoren (Somfy IO, Somfy LT): ja, er moet een stroomaansluiting in de buurt zijn. Onze monteurs werken de bekabeling netjes weg langs de muur of door de gevel. Het aanleggen van een nieuw stroomcircuit valt buiten onze montage — daarvoor heb je een elektricien nodig.

Solar motoren (Somfy Solar): nee, geen stopcontact nodig. De motor werkt volledig op zonne-energie via een klein zonnepaneel op de cassette. Geen kabels, alles draadloos.

Tip: heb je geen stopcontact bij het raam? Overweeg solar. Het is iets duurder maar je bespaart op elektra-aanleg en je hebt geen kabels.
` },

  { cat: 'bediening', title: 'Kan ik mijn zonwering koppelen met mijn smart home systeem?', body: `
Ja, met de Tahoma Switch van Somfy. Hiermee bedien je al je Somfy producten via de app en koppel je ze met:
- Google Home (stembediening)
- Amazon Alexa (stembediening)
- Apple HomeKit
- Philips Hue
- IFTTT

Je hebt per woning maar 1 Tahoma nodig. De Tahoma werkt alleen met Somfy IO motoren.

Heb je een Busch-Jaeger of KNX domotica-systeem? Dan kun je kiezen voor Somfy LT motoren. Wij leveren de zonwering met LT motor, maar het aansluiten op het domotica-systeem moet je zelf (laten) doen.
` },

  // ==================== KLEUREN EN OPTIES ====================
  { cat: 'kleuren', title: 'Welke kleuren zijn beschikbaar?', body: `
Elk product heeft standaardkleuren (geen meerprijs), trendkleuren (kleine meerprijs) en RAL-kleuren (hogere meerprijs).

Populairste standaardkleuren:
- RAL 9010 (wit) — past bij vrijwel elk huis, veruit de populairste keuze
- Antraciet structuur / RAL 7016 — populair bij moderne woningen met donkere kozijnen
- RAL 9001 (cremewit)
- RAL 9005 structuur (zwart)

Trendkleuren (kleine meerprijs): RAL 7039, RAL 9007 structuur, RAL 9010 structuur, DB 703, RAL 7021.

RAL-kleuren: elke kleur uit het RAL-kleurenwaaier is leverbaar op aanvraag. Hogere meerprijs en langere levertijd (6-8 weken).

Tip: kies dezelfde kleur als je kozijnen, dan valt de zonwering het minst op. Twijfel je? Kom langs in de showroom om de kleuren in het echt te zien.
` },

  { cat: 'kleuren', title: 'Hoe kies ik de doekkleur?', body: `
De doekkleur kies je tijdens de inmeetafspraak of in de showroom.

Onze inmeter neemt alle doekstalen mee naar de afspraak. Zo kun je thuis, bij je eigen raam, de kleuren vergelijken.

Wil je uitgebreider kiezen? Kom dan langs in onze showroom. Daar hebben we alle collecties:
- Sunmaster huiscollectie (standaard, geen meerprijs)
- Dickson collectie (premium, meerprijs per m2)
- Para / Sattler / Swela (premium, meerprijs per m2)

Tips voor de doekkleur:
- Donkere doeken werken beter tegen zonlicht maar beperken meer het uitzicht
- Lichte doeken laten meer licht door maar bieden minder warmtewering
- Bij screens kun je via de showroom of de Dickson website alvast kleuren bekijken
` },

  // ==================== MONTAGE EN INMETEN ====================
  { cat: 'montage', title: 'Hoe werkt het proces van aanvraag tot montage?', body: `
Stap 1: Prijsindicatie
Je doet een aanvraag via onze website. Binnen 1 werkdag ontvang je een vrijblijvende prijsindicatie per email.

Stap 2: Offerte bekijken
Bekijk de offerte rustig. Heb je vragen? Stuur een berichtje of bel ons.

Stap 3: Inmeetafspraak
Als je verder wilt, plannen we een gratis inmeetafspraak. Onze inmeter komt bij je langs.

Stap 4: Inmeten (30-45 min)
Onze inmeter neemt exacte maten op, bekijkt de montage-mogelijkheden, en neemt doek- en kleurstalen mee. Na inmeten ontvang je een definitieve offerte.

Stap 5: Akkoord + aanbetaling
Na akkoord betaal je een aanbetaling van 30%.

Stap 6: Bestelling en levering
Wij bestellen bij Sunmaster. Levertijd: 4-6 weken (standaardkleuren) of 6-8 weken (niet-standaard kleuren).

Stap 7: Montage
Onze monteurs komen het plaatsen. Inclusief bevestiging, afstellen, uitleg en opruimen.

Stap 8: Restbetaling
Het restbedrag betaal je na de montage.
` },

  { cat: 'montage', title: 'Wat kost een inmeetafspraak?', body: `
De inmeetafspraak is gratis als je bij ons bestelt.

Ga je na inmeten niet met ons verder? Dan brengen we €75 inmeetkosten in rekening. Van dit bedrag doneren we €25 aan het Maxima Kinderziekenhuis.

Dit doen we zodat we onze inmeters effectief kunnen inzetten en niet overal gratis langs hoeven.

Tijdens de inmeetafspraak neemt onze inmeter exacte maten op, bekijkt de montage-situatie en neemt alle doek- en kleurstalen mee. Je zit nergens aan vast.
` },

  { cat: 'montage', title: 'Kan ik zelf inmeten?', body: `
We raden het af. Onze inmeter controleert niet alleen de maten, maar ook:
- De ondergrond (is de muur geschikt voor montage?)
- De beschikbare ruimte voor de cassette
- Eventuele obstakels (dakgoot, leidingen, roosters)
- De beste montage-positie

Verkeerd inmeten kan leiden tot producten die niet passen. En omdat alles maatwerk is, kan het niet worden teruggestuurd of hergebruikt.
` },

  { cat: 'montage', title: 'Hoe lang duurt de montage?', body: `
Gemiddelde montageduur per product:
- Screen: 1-2 uur per stuk
- Knikarmscherm: 2-3 uur
- Rolluik: 1,5-2 uur per stuk
- Uitvalscherm: 1,5-2 uur
- Serre/pergola zonwering: 3-4 uur

De montage wordt uitgevoerd door onze eigen monteurs. Inclusief bevestiging met chemisch anker, afstellen, uitleg over de bediening en opruimen van verpakkingsmateriaal.
` },

  { cat: 'montage', title: 'Wat als het regent op de dag van de montage?', body: `
Onze monteurs werken ook bij licht regenachtig weer. Bij zware regen of storm plannen we de afspraak opnieuw in — we nemen dan contact met je op.
` },

  // ==================== PRIJZEN EN BETALING ====================
  { cat: 'prijzen', title: 'Wat zit er in de prijs? Is het all-in?', body: `
Ja, onze prijzen zijn all-in en inclusief:
- Het product zelf (frame, doek, motor, afstandsbediening)
- Professionele montage door onze eigen monteurs
- Klein materiaal en bevestiging (chemisch anker, schroeven)
- Afstellen en uitleg
- Opruimen verpakkingsmateriaal
- BTW (21%)

Wat er eventueel bij kan komen:
- Niet-standaard kleur (trend/RAL meerprijs)
- Extra accessoires: windsensor, Tahoma Switch, verlengde muursteunen
- Hoogwerker (bij montage boven de 2e verdieping)
- Elektra-aanleg (als er geen stroom bij het raam is)
` },

  { cat: 'prijzen', title: 'Hoe wordt er betaald?', body: `
Na akkoord op de definitieve offerte: aanbetaling van 30%.
Het restbedrag betaal je na afronding van de montage.
Betaling via bankoverschrijving.
` },

  { cat: 'prijzen', title: 'Geeft Sonty korting?', body: `
Onze prijzen zijn scherp en all-in. We werken niet met kunstmatig hoge prijzen om daar vervolgens korting op te geven. Wat je ziet is wat je betaalt.

Bij voorraadschermen zit er al 20% korting verwerkt in de prijs.

Bij grotere opdrachten met meerdere producten kunnen we soms kijken naar een pakketprijs. Neem contact op om de mogelijkheden te bespreken.
` },

  { cat: 'prijzen', title: 'Waarom is Sonty duurder dan een andere aanbieder?', body: `
We begrijpen dat je wilt vergelijken, en dat moedigen we aan. Let bij het vergelijken op:

1. Het merk: wij gebruiken uitsluitend Sunmaster (Nederlands A-merk, 55 jaar ervaring). Veel concurrenten gebruiken goedkopere merken uit China of Turkije met dunner aluminium.

2. De motor: bij ons altijd Somfy (wereldleider, 7 jaar garantie). Andere aanbieders gebruiken soms goedkopere motoren die na een paar jaar problemen geven.

3. Eigen monteurs: al onze monteurs zijn in dienst. Geen onderaannemers die je niet meer kunt bereiken bij problemen.

4. Garantie: 5 jaar product + 7 jaar motor. Veel concurrenten bieden minder.

5. Service: check onze 600+ Google reviews. Daar lees je hoe klanten onze service ervaren, ook na de montage.

Goedkoop is niet altijd voordelig als je over 5 jaar problemen krijgt en de leverancier niet meer bereikbaar is.
` },

  { cat: 'prijzen', title: 'Kan het goedkoper? Alternatieven bij beperkt budget', body: `
We kunnen altijd kijken naar alternatieven die beter bij je budget passen:

- Ander model: bijv. SunBasic i.p.v. SunEye bespaart flink. Of Screen Square i.p.v. Zip Design 110
- Andere bediening: draaischakelaar i.p.v. afstandsbediening is goedkoper. Handbediening (bij knikarmschermen) is het goedkoopst
- Standaardkleur kiezen: geen meerprijs. Niet-standaard kleuren kosten extra
- Windsensor en Tahoma zijn optioneel: kun je eventueel later nog bijkopen

Neem contact op en vertel wat je budget is. We denken graag mee over de beste oplossing.
` },

  // ==================== GARANTIE EN SERVICE ====================
  { cat: 'garantie', title: 'Hoeveel garantie geeft Sonty?', body: `
Onze standaard garantie:
- 5 jaar op het product (frame, cassette, armen, geleiders, doek)
- 7 jaar op de Somfy motor
- 2 jaar op de montage

Sunmaster is een Nederlands merk met eigen productie in Nijkerk. Onderdelen zijn altijd leverbaar, ook na jaren.

Wat valt onder garantie: fabricagefouten, motordefecten bij normaal gebruik, constructiefouten.

Wat valt niet onder garantie: stormschade bij knikarmschermen (het scherm moet bij wind ingerold zijn), normale slijtage van het doek, schade door verkeerd gebruik of derden.
` },

  { cat: 'garantie', title: 'Mijn zonwering doet het niet meer. Wat nu?', body: `
Neem contact op via 085 006 9681 of stuur een WhatsApp. Beschrijf het probleem en stuur eventueel een foto of video.

Check eerst:
- Is de batterij van de afstandsbediening niet leeg?
- Staat er stroom op het stopcontact? (bij bedrade motoren)
- Is de stroomgroep niet uitgeschakeld?

Ons serviceteam helpt je verder. We repareren ook zonwering die niet bij ons is gekocht.
` },

  { cat: 'garantie', title: 'Hoe onderhoud ik mijn zonwering?', body: `
Tips voor een lange levensduur:

- Rol het product regelmatig in en uit zodat het mechanisme soepel blijft
- Knikarmschermen: altijd inrollen bij wind en regen (tenzij je een windsensor hebt)
- Doek reinigen: met lauw water en een zachte borstel. Geen hogedrukreiniger of agressieve schoonmaakmiddelen
- Frame: af en toe afspoelen met water
- Jaarlijks: controleer of alle schroeven en bevestigingen nog goed vast zitten
- Laat het doek altijd eerst drogen voordat je het oprolt (voorkomt schimmelvorming)
` },

  // ==================== LEVERTIJD ====================
  { cat: 'faq', title: 'Hoe lang is de levertijd?', body: `
Standaardkleuren: 4-6 weken na bestelling tot en met montage.
Trendkleuren: 5-7 weken.
RAL-kleuren: 6-8 weken (langere levertijd door speciale coating).
Voorraadschermen: 2-3 weken (beperkte voorraad).

In het hoogseizoen (mei-augustus) kan de levertijd iets langer zijn door drukte bij de fabriek.

Alles is maatwerk en wordt speciaal voor jou geproduceerd. Snellere levering is helaas niet mogelijk.

Na bestelling ontvang je een orderbevestiging. Zodra de producten bij ons zijn geleverd, nemen we contact op om de montage in te plannen.
` },

  // ==================== SITUATIES ====================
  { cat: 'situaties', title: 'Kan er een screen op mijn dakkapel?', body: `
Ja, we plaatsen regelmatig screens en rolluiken op dakkapellen.

Tips:
- Bij twee raamvlakken: per vlak een apart screen (niet 1 breed screen over de hele dakkapel)
- Solar bediening is hier ideaal: geen kabels naar binnen, alles netjes aan de buitenkant
- Check of er voldoende ruimte is boven het raam voor de cassette (Zip Design 110 = 110mm hoog)
- Bij een rolluik: controleer of de dakkapel geschikt is voor de kastmaat

Stuur een foto van je dakkapel, dan kunnen we een inschatting maken.
` },

  { cat: 'situaties', title: 'Kan er een screen op een schuifpui?', body: `
Ja, en dat doen we veel! Bij brede schuifpuien is de Zip Design 110 ideaal (leverbaar tot 500cm breed). Het screen wordt boven de schuifpui gemonteerd en rolt naar beneden.

Aandachtspunten:
- Meet de breedte van je schuifpui: tot 500cm kan het in 1 screen
- Bij bredere schuifpuien: 2 aparte screens naast elkaar
- Het screen mag de schuifpui niet blokkeren als deze open staat
` },

  { cat: 'situaties', title: 'Ik woon in een appartement/VvE. Wat moet ik weten?', body: `
Bij een VvE heb je meestal toestemming nodig voor buitenzonwering. Check je VvE-reglement.

Veelvoorkomende VvE-eisen:
- Kleur is vaak voorgeschreven (passend bij het gebouw)
- Soms is alleen een bepaald type zonwering toegestaan
- Schriftelijke toestemming van het bestuur is vereist

Wij helpen graag met het opstellen van een verzoek aan de VvE.

Solar bediening is populair in appartementen: geen boren naar binnen nodig, alles netjes aan de buitenkant.
` },

  { cat: 'situaties', title: 'Ik woon op de derde verdieping of hoger. Kan dat?', body: `
Ja, maar boven de tweede verdieping moet er gewerkt worden met een hoogwerker of steiger. Extra kosten zijn afhankelijk van de situatie.

Stuur een foto van de gevel zodat we een inschatting kunnen maken van de mogelijkheden en eventuele extra kosten.

Tip: solar bediening is hier extra handig — geen kabels naar binnen boren op hoogte.
` },

  { cat: 'situaties', title: 'Past een screen onder mijn dakgoot?', body: `
De cassette van een Zip Design 110 is 110mm hoog. Als er minimaal 110mm ruimte is tussen de bovenkant van je raam en de dakgoot, dan past het.

De Zip Square heeft een kleiner profiel (85 of 100mm) — als er minder ruimte is, kan dat een optie zijn.

Stuur een foto van de situatie, dan maken we een inschatting. Tijdens de inmeetafspraak controleert onze monteur dit uiteraard ook.
` },

  // ==================== VEELGESTELDE VRAGEN ====================
  { cat: 'faq', title: 'Kan ik mijn offerte nog aanpassen?', body: `
Ja, altijd! Andere kleur, ander model, andere bediening, andere maten — laat het weten en we passen de offerte aan. Stuur een berichtje of bel 085 006 9681.
` },

  { cat: 'faq', title: 'Kan ik mijn bestelling annuleren?', body: `
Voor bestelling bij de fabriek: kosteloos annuleren.
Na bestelling: helaas niet meer mogelijk. Alles wordt op maat geproduceerd en kan niet worden teruggestuurd of hergebruikt.
` },

  { cat: 'faq', title: 'Welk product is het beste voor mijn slaapkamer?', body: `
Voor maximale verduistering: een rolluik. Een rolluik sluit het raam volledig af — ideaal voor slaapkamers, nachtdienst of thuisbioscoop. Bijkomende voordelen: isolatie (warmer in de winter) en geluidsdemping.

Een screen verduistert ook, maar niet 100%. Er komt altijd nog wat licht door het doek.
` },

  { cat: 'faq', title: 'Ik twijfel nog. Wat raden jullie aan?', body: `
Neem gerust de tijd! Een paar tips:
- Kom langs in onze showroom om de producten in het echt te zien en te voelen
- Vraag een gratis inmeetafspraak aan — je zit nergens aan vast
- Check onze 600+ Google reviews voor ervaringen van andere klanten
- Stuur je vragen via WhatsApp of email, we denken graag mee

Wil je advies over welk product het beste past bij jouw situatie? Vertel ons waarvoor je het nodig hebt (zonwering terras, raam, slaapkamer), of wind een factor is, en wat voor jou het belangrijkst is (verduistering, warmtewering, privacy, design). Dan geven we gericht advies.
` },

  { cat: 'faq', title: 'Hoe bespaar ik energie met zonwering?', body: `
Screens: tot 90% minder warmte-instraling in de zomer. Je huis blijft koeler zonder airco.

Rolluiken: tot 30% energiebesparing in de winter. Het rolluik creëert een isolerende luchtlaag tussen het raam en de lamellen. In de zomer houdt het de warmte buiten.

Solar motoren: gebruiken alleen zonne-energie, geen stroomverbruik.

Tahoma Switch: stel tijdschema's in zodat je zonwering automatisch reageert op de zon. Zo haal je het maximale uit je energiebesparing.
` },

  { cat: 'faq', title: 'Wat is het verschil tussen standaard, trend en RAL-kleuren?', body: `
Standaardkleuren: geen meerprijs, snelle levering (4-6 weken). De meest populaire kleuren zijn standaard beschikbaar.

Trendkleuren: kleine meerprijs, iets langere levertijd. Dit zijn populaire kleuren die net buiten de standaard collectie vallen.

RAL-kleuren: hogere meerprijs, langere levertijd (6-8 weken). Elke kleur uit het RAL-kleurenwaaier is leverbaar. Structuur, metallic en matte afwerkingen op aanvraag.

Tip: kies een standaardkleur als je snel wilt en op budget zit. Kies RAL als je een specifieke kleur wilt die exact bij je gevel past.
` },

];

async function main() {
  const token = await getToken();
  let created = 0, failed = 0;

  for (const art of ARTICLES) {
    const catId = CATS[art.cat];
    const res = await fetch(`https://app.trengo.com/api/v2/help_center/${HC_ID}/categories/${catId}/articles`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        title: art.title,
        content: art.body.trim(),
        locale: 'nl',
        status: 'published',
      })
    });

    if (res.ok) {
      created++;
      process.stdout.write('.');
    } else {
      failed++;
      const err = await res.json().catch(() => ({}));
      console.log('\nFAIL: ' + art.title + ' — ' + res.status + ' ' + JSON.stringify(err).substring(0, 100));
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n\nKlaar: ' + created + ' artikelen aangemaakt, ' + failed + ' mislukt');
}

main().catch(console.error);
