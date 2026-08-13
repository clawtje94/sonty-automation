# Offerte-opvolgflow, mailteksten (concept v1)

Status: CONCEPT, nog niet in Klaviyo (wacht op key + akkoord Daimy + scenario-lab + afstemming met bestaande herinnerings-cron zodat er nooit dubbel gemaild wordt).
Trigger: Offerte Online Verzonden. Stoppen zodra: status akkoord, of klant heeft gereageerd.
Afzender: aanvragen@sonty.nl. Personalisatie: voornaam + product + plaats (echte CRM-velden, anders weglaten).
Stijl: SONTY-MAILSTIJLGIDS.md. Geen emoji, geen opmaaktekens, geen gedachtestreepjes, geen callcenter-frasen.

---

## Mail 1, dag 2 na offerte (doel: 100-140 woorden, drempel weghalen)

Onderwerp: Nog vragen over je prijsindicatie?

Hoi {{voornaam}},

Je hebt eergisteren een prijsindicatie van ons gekregen voor {{product}}. Goed mogelijk dat je nog even wilt nadenken of overleggen, helemaal prima natuurlijk.

Zit je ergens mee, over de maten, kleuren of de bediening bijvoorbeeld, stel je vraag gewoon door op deze mail te reageren. Ik denk graag met je mee.

Liever even echt kijken en voelen? Op dinsdag en donderdag kun je zonder afspraak binnenlopen in onze showroom aan de Frijdastraat 8F in Rijswijk. Navigatie? Stel in op Frijdastraat 6E, rij het hofje in, eerste rechts, wij zitten op de hoek.

Laat maar weten als ik nog wat voor je kan doen!

Groet,
Jaimy van Sonty

## Mail 2, dag 5 (doel: 200-300 woorden, bezwaren en proces uitleggen)

Onderwerp: Zo werkt het bij Sonty, van indicatie tot montage

Hoi {{voornaam}},

Veel mensen vragen ons hoe het nou precies werkt na de prijsindicatie. Daarom zet ik het even voor je op een rij.

Ga je akkoord met de indicatie, dan belt onze planning je binnen 5 werkdagen om een inmeetafspraak te maken. Onze monteur meet alles op de millimeter in en neemt de kleuren en opties met je door. Daarna krijg je de definitieve offerte. Als de doorgegeven maten kloppen blijft die vrijwel altijd gelijk aan de indicatie, we werken met staffels van 20 centimeter.

Het inmeten is vrijblijvend zolang je bij ons afneemt. Neem je niks af, dan brengen we 75 euro in rekening. Dat is puur omdat het inmeten veel tijd kost en we willen voorkomen dat de maten daarna ergens anders gebruikt worden.

Na de aanbetaling van 40 procent is de lever- en montagetijd 8 tot 10 weken. Alles wat eerder kan, monteren we met liefde eerder. De overige 60 procent betaal je pas na de montage.

En je zit goed qua zekerheid: 3 jaar garantie op de montage, 5 jaar op het product en 7 jaar op de motor.

Zal ik hem voor je in gang zetten? Reageer gewoon op deze mail, dan regel ik het.

Groet,
Jaimy van Sonty

## Mail 3, dag 10 (doel: 100-140 woorden, prijs vastzetten, eerlijk over vervaldatum)

Onderwerp: Je prijsindicatie loopt binnenkort af

Hoi {{voornaam}},

Kleine herinnering: de prijsindicatie voor {{product}} heeft een vervaldatum, daarna kunnen prijzen wijzigen.

Komt het er nu even niet van, bijvoorbeeld omdat de verbouwing nog loopt of je later pas de sleutel krijgt? Dan kun je nu alvast tekenen. Daarmee staat deze prijs vast en plannen we de inmeetafspraak gewoon later in overleg met de planning.

Twijfel je nog ergens over, reageer dan even op deze mail. Goed dat je het dan even vraagt, daar is dit voor.

Groet,
Jaimy van Sonty

---

## Checks vóór livegang

- [ ] Feiten gecheckt tegen stijlgids (garantie 3/5/7, 8-10 weken, 5 werkdagen, 75 euro, 40/60)
- [ ] Geen dubbele mails met offerte-herinneringen-cron van sonty-website
- [ ] Scenario-lab-run (0x FOUT-STIL)
- [ ] /oplevercheck
- [ ] Akkoord Daimy op copy en timing
