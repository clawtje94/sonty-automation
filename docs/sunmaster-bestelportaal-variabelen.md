# Sunmaster bestelportaal (ISP-Vision): bestelflow en variabelen per product

Gemeten op 2026-09-16 in het demo-portaal "Demo portaal Zonwering Direct" (account Daimy Boot, geen 2FA). Alles is live uit de invoerdialoog van het portaal uitgelezen; niets is opgeslagen of verstuurd.
Volledige keuzelijsten (doekkleuren, RAL-kleuren enz.) staan in `sunmaster-bestelportaal-variabelen-lijsten.md`.

## Bestelflow (zo werkt bestellen)

1. Inloggen op portal.sunmaster.nl (Servoy "Vision"), portaal `cs`, licentiehouder Sunmaster Nederland B.V.
2. Startscherm: knoppen **raadplegen order** (orderportefeuille + nieuwe orders), **offerte aanvraag**, **Documenten** (orderbevestigingen en facturen), **Orderhistorie** (alle orders na 01-04-2021).
3. Nieuwe order/offerte = orderkop + orderregels. Orderkop: *Orderreferentie* (vrije tekst, eigen kenmerk), *Leveringsconditie* (standaard `AFH` = afhalen, keuzelijst), *Totaalbedrag excl. btw* (berekend), vinkje *Vul met vorige ingave-productinfo* (kopieert productkeuzes van de vorige regel), *Aflever adres* (vast op het geregistreerde klantadres, alleen land te kiezen uit NL/BE/DE/… en een vrij veld *Afleveropmerking*).
4. **Artikel toevoegen** opent "Snelzoeken" met de artikellijst (18 artikelen, eenheid M2). Dubbelklik op een artikel opent de dialoog **Productingave**.
5. Productingave is een cascade: velden verschijnen pas nadat het veld ervoor is ingevuld (bijv. *Bedienings kant* verschijnt na *Breedte*; *Type Bediening*, *Bed. optie 1*, *Optie* verschijnen na *Uitval/Arm*). Elke keuzelijst toont max. 50 regels en filtert op "bevat".
6. Maten worden direct gevalideerd: buiten bereik geeft een waarschuwing "Waarde X ligt niet tussen MIN en MAX". *Doeklengte* wordt automatisch berekend uit de uitval (bij Sunbasic uitval 1500 → doeklengte 1620).
7. *Opslaan (Alt-S)* sluit de productingave en opent de orderregel: *Artikel*, *Product wijzig*, *Hoeveelheid*, *Orderregelreferentie*, *Eenheidsprijs* (inkoopprijs), *Korting %*, *Extra korting %*, *Opmerking*; daarna Ok. Grote aantallen: mail naar verkoop@sunmaster voor projectcalculatie.
8. Levertijden (portaalbericht 14-09-2026): zonneschermen 5 wk, rolluiken 5 wk, verandazonwering 5 wk, zipscreens 7-8 wk.

## Meetmethode en bevindingen over het portaal

- **Keuzelijsten tonen max. 50 regels.** Scrollen helpt niet; de lijst stopt bij regel 50. De volledige lijsten zijn opgehaald door per teken (0-9, a-z, recursief) te filteren en de resultaten samen te voegen. Steekproef: doekkleur "31318 | BROOKE" staat niet in de 50 zichtbare regels, maar is via het filter wel te kiezen en blijft in het veld staan.
- **Volledigheid grote lijsten**: de eerste runs lazen bij zware filters (bijv. "r" of "0" op de RAL-lijst) soms te vroeg en misten daardoor kleuren. Daarna is de lezer afgestemd op het gemeten laadgedrag (antwoord na 0,6 tot 0,85 s) en zijn de grote lijsten opnieuw opgehaald; per product wordt de unie van alle runs gebruikt. Per lijst staat hieronder wat elke run vond.
- **Grote lijsten die bij meerdere producten identiek zijn** staan één keer in het lijstenbestand; bijna-identieke lijsten (bijv. kapkleuren per model) worden daar met hun verschillen genoemd.
- **Maatgrenzen** zijn gemeten door 1 mm in te vullen en de waarschuwing van het portaal te lezen. Bij rolluiken gaf het hoogteveld geen directe waarschuwing; die grens wordt vermoedelijk pas bij opslaan gecontroleerd.
- **Variant-runs**: voor elk product is elke keuze bij *Type Bediening* apart doorlopen; per keuze staat wat er in de vervolgvelden verandert (andere motorkabels, extra veld *Bed. optie 2* met draaistang bij handbediening, enz.). In de variant-runs zijn de grote lijsten niet opnieuw volledig opgehaald; daar telt de lijst uit de basisrun.
- **Leveringsconditie** staat in dit demo-account vast op `AFH`; de zoekknop is uitgeschakeld. **Afleveradres** is het geregistreerde klantadres, niet per order te wijzigen (alleen land en afleveropmerking).
- Bij het openen van een productdialoog staan alle velden even zichtbaar (o.a. *Soort doek* bij zonneschermen); na de eerste keuzes verdwijnen afgeleide velden en verschijnen de vervolgvelden. *Soort doek* wordt afgeleid van de gekozen doekkleur en is niet zelf te kiezen.
- **Nieuwe order plaatsen** is in dit demo-account niet zichtbaar (alleen *Nieuwe offerte*); volgens de Sunmaster-handleiding werkt de orderflow identiek aan de offerteflow.
- Ruwe data: `~/sonty/data/sunmaster-portaal-variabelen.json`; screenshots per product in `~/.playwright-mcp/sm-prod-*.png`.

## Artikellijst (Snelzoeken)

- Sunbasic
- Sunbasic Cassette
- SunCube 150
- SunElite
- SunEye
- SunEye XL
- SunProject 100
- Zipscreen 85
- Zipscreen 100
- Zipscreen 130 (Max)
- Zipscreen SunZip Design 110
- Zipscreen Zip Design 110 Veranda
- Bovendak zonwering SunControl 165 ZIP
- Rolluik S-37
- Rolluik S-42
- Rolluik los pantser
- Geconfectioneerd Doek
- Geconfectioneerd Screendoek

## Variabelen per product

### Sunbasic

Vaste waarden (niet te kiezen): *scherm model* = A2 \| Sunbasic, *Garantie* = 99 \| Standaard (CE Klasse 2), *Sunmaster Sticker* = 01 \| Ja

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 1.800 – 5.500 mm | 3000 |
| 2 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 3 | Uitval/Arm | keuzelijst | 1500 \| 1500 ka<br>2000 \| 2000 ka<br>2500 \| 2500 ka | 1500 \| 1500 ka |
| 4 | Type Bediening | keuzelijst | 5 \| Sunea IO motor<br>3 \| WT motor<br>1 \| Hand Bediening | 5 \| Sunea IO motor |
| 5 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 6 | Optie | keuzelijst | xxx \| NVT<br>2 \| Eolis 3D Windsensor io zwart<br>3 \| Eolis 3D Windsensor io wit | xxx \| NVT |
| 7 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>1660 \| AMY 1-kanaals IO Wandzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>654-Pure \| SITUO 1 Pure IO Handzender<br>655-Pure \| SITUO 5 Pure IO Handzender | 100 \| zonder schakelaar |
| 8 | Doeklengte (uitvalricht.) (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 9 | Kleur code doek | keuzelijst | 390 keuzes (unie van 4 runs: std 390, basis 390, check 389, recheck 390), zie lijst **L1** in het lijstenbestand | 0001 \| WIT (T100) |
| 10 | Kleur kap | keuzelijst | 04s \| ANTRAC. ST<br>02 \| Ral 9001 | 04s \| ANTRAC. ST |
| 11 | Verlengde muursteunen | keuzelijst | 05 \| Nee *<br>01 \| Ja, 50 cm 2x<br>02 \| Ja, 50 cm 1x<br>03 \| Ja, 80 cm 2x<br>04 \| Ja, 80 cm 1x | 05 \| Nee * |

Afhankelijkheid breedte → Uitval/Arm:

| Breedte | Keuzes |
|---------|--------|
| 2000 | (geen) |
| 2500 | 1500 \| 1500 ka, 2000 \| 2000 ka |
| 3000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka |
| 3500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 4000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 4500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 5000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 5500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 6000 | ⚠ Waarde 6.000 ligt niet tussen 1.800 en 5.500 ! |
| 6500 | ⚠ Waarde 6.500 ligt niet tussen 1.800 en 5.500 ! |
| 7000 | ⚠ Waarde 7.000 ligt niet tussen 1.800 en 5.500 ! |

Controle volledigheid grote lijsten: *Kleur code doek*: basisrun 390, controlerun (diepte 4) 390 ✔ volledig

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 5 \| Sunea IO motor)

- **3 \| WT motor** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT wit * / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw; vervalt: *Optie*
- **1 \| Hand Bediening** → nieuw veld *Bed. optie 2*: 02 \| Draaistang 180 cm * / 01 \| Draaistang 160 cm / 08 \| Draaistang 140 cm / 09 \| Zonder draaistang; vervalt: *Bed. optie 1*, *Optie*, *Bed. optie 3*

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Bedienings kant (2), Uitval/Arm (3), Bed. optie 1 (5), Optie (3), Bed. optie 3 (5), Kleur code doek (390), Kleur kap (2), Verlengde muursteunen (5)

### Sunbasic Cassette

Vaste waarden (niet te kiezen): *scherm model* = A3 \| Sunbasic Cassette, *Garantie* = 99 \| Standaard (CE Klasse 2), *Sunmaster Sticker* = 01 \| Ja

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 1.800 – 5.518 mm | 3000 |
| 2 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 3 | Uitval/Arm | keuzelijst | 1500 \| 1500 ka<br>2000 \| 2000 ka<br>2500 \| 2500 ka | 1500 \| 1500 ka |
| 4 | Type Bediening | keuzelijst | 5 \| Sunea IO motor<br>3 \| WT motor | 5 \| Sunea IO motor |
| 5 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 6 | Optie | keuzelijst | xxx \| NVT<br>2 \| Eolis 3D Windsensor io zwart<br>3 \| Eolis 3D Windsensor io wit | xxx \| NVT |
| 7 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>1660 \| AMY 1-kanaals IO Wandzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>654-Pure \| SITUO 1 Pure IO Handzender<br>655-Pure \| SITUO 5 Pure IO Handzender | 100 \| zonder schakelaar |
| 8 | Doeklengte (uitvalricht.) (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 9 | Kleur code doek | keuzelijst | 390 keuzes (unie van 3 runs: std 390, basis 390, recheck3 390), zie lijst **L1** in het lijstenbestand | 0001 \| WIT (T100) |
| 10 | Kleur kap | keuzelijst | 04s \| ANTRAC. ST<br>02 \| Ral 9001 | 04s \| ANTRAC. ST |
| 11 | Verlengde muursteunen | keuzelijst | 05 \| Nee *<br>01 \| Ja, 50 cm 2x<br>02 \| Ja, 50 cm 1x<br>03 \| Ja, 80 cm 2x<br>04 \| Ja, 80 cm 1x | 05 \| Nee * |

Afhankelijkheid breedte → Uitval/Arm:

| Breedte | Keuzes |
|---------|--------|
| 2000 | (geen) |
| 2500 | 1500 \| 1500 ka, 2000 \| 2000 ka |
| 3000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka |
| 3500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 4000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 4500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 5000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 5500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 6000 | ⚠ Waarde 6.000 ligt niet tussen 1.800 en 5.518 ! |
| 6500 | ⚠ Waarde 6.500 ligt niet tussen 1.800 en 5.518 ! |
| 7000 | ⚠ Waarde 7.000 ligt niet tussen 1.800 en 5.518 ! |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 5 \| Sunea IO motor)

- **3 \| WT motor** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT wit * / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw; vervalt: *Optie*

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Bedienings kant (2), Uitval/Arm (3), Bed. optie 1 (5), Optie (3), Bed. optie 3 (5), Kleur code doek (390), Kleur kap (2), Verlengde muursteunen (5)

### SunCube 150

Vaste waarden (niet te kiezen): *scherm model* = 8 \| Suncube XL, *Garantie* = 99 \| Standaard (CE Klasse 2), *Sunmaster Sticker* = 01 \| Ja

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 800 – 6.012 mm | 3000 |
| 2 | Type armen | keuzelijst | 2 \| Windvaste armen<br>3 \| Gasveer armen<br>4 \| Hoek- / Balkon armen WVA<br>7 \| Hoek- / Balkon armen WAG | 2 \| Windvaste armen |
| 3 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 4 | Uitval/Arm | keuzelijst | 01 \| 950 uitval<br>02 \| 1150 uitval<br>03 \| 1350 uitval<br>04 \| 1500 uitval | 01 \| 950 uitval |
| 5 | Type Bediening | keuzelijst | 5 \| Sunea IO motor<br>3 \| WT motor<br>1 \| Hand Bediening<br>2 \| LT motor<br>8 \| Solar Motor Brel | 5 \| Sunea IO motor |
| 6 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 7 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>1660 \| AMY 1-kanaals IO Wandzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>654-Pure \| SITUO 1 Pure IO Handzender<br>655-Pure \| SITUO 5 Pure IO Handzender | 100 \| zonder schakelaar |
| 8 | Doek | keuzelijst | 2 \| Uni doek naadloos doorval<br>4 \| Doek in banen met doorval | 2 \| Uni doek naadloos doorval |
| 9 | Doeklengte (uitvalricht.) (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 10 | Kleur code doek | keuzelijst | 38 keuzes, zie lijst **L2** in het lijstenbestand | 0001 \| WIT (T100) |
| 11 | Rol breedte | keuzelijst | 165 \| 165 cm<br>320 \| 320 cm | 165 \| 165 cm |
| 12 | Kleur kap | keuzelijst | 626 keuzes (unie van 3 runs: std 551, basis 551, recheck3 626), zie lijst **L3** in het lijstenbestand | 04s \| ANTRAC. ST |
| 13 | Type steun | keuzelijst | 04 \| Wandsteun Suncube 2 stuks *<br>06 \| Wandsteun Suncube 3 stuks ipv 2 stuks<br>07 \| Kapsteun Suncube | 04 \| Wandsteun Suncube 2 stuks * |
| 14 | Soort Montage | keuzelijst | 1 \| Standaard *<br>2 \| Plafondmontage | 1 \| Standaard * |

Afhankelijkheid breedte → Type armen:

| Breedte | Keuzes |
|---------|--------|
| 2000 | 2 \| Windvaste armen, 3 \| Gasveer armen, 4 \| Hoek- / Balkon armen WVA, 7 \| Hoek- / Balkon armen WAG |
| 2500 | 2 \| Windvaste armen, 3 \| Gasveer armen, 4 \| Hoek- / Balkon armen WVA, 7 \| Hoek- / Balkon armen WAG |
| 3000 | 2 \| Windvaste armen, 3 \| Gasveer armen, 4 \| Hoek- / Balkon armen WVA, 7 \| Hoek- / Balkon armen WAG |
| 3500 | 2 \| Windvaste armen, 3 \| Gasveer armen, 4 \| Hoek- / Balkon armen WVA, 7 \| Hoek- / Balkon armen WAG |
| 4000 | 2 \| Windvaste armen, 3 \| Gasveer armen, 4 \| Hoek- / Balkon armen WVA, 7 \| Hoek- / Balkon armen WAG |
| 4500 | 2 \| Windvaste armen, 3 \| Gasveer armen, 4 \| Hoek- / Balkon armen WVA, 7 \| Hoek- / Balkon armen WAG |
| 5000 | 2 \| Windvaste armen, 3 \| Gasveer armen, 4 \| Hoek- / Balkon armen WVA, 7 \| Hoek- / Balkon armen WAG |
| 5500 | 2 \| Windvaste armen, 3 \| Gasveer armen, 4 \| Hoek- / Balkon armen WVA, 7 \| Hoek- / Balkon armen WAG |
| 6000 | 2 \| Windvaste armen, 3 \| Gasveer armen, 4 \| Hoek- / Balkon armen WVA, 7 \| Hoek- / Balkon armen WAG |
| 6500 | ⚠ Waarde 6.500 ligt niet tussen 800 en 6.012 ! |
| 7000 | ⚠ Waarde 7.000 ligt niet tussen 800 en 6.012 ! |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 5 \| Sunea IO motor)

- **3 \| WT motor** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT wit * / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw
- **1 \| Hand Bediening** → nieuw veld *Hand Bedieningen*: 1 \| Draaistang bediening binnen / 2 \| Draaistang bediening buiten; nieuw veld *Bed. optie 2*: 01 \| Draaistang 160 cm / 02 \| Draaistang 180 cm / 09 \| Zonder draaistang; *Type steun* wordt: 04 \| Wandsteun Suncube 2 stuks * / 06 \| Wandsteun Suncube 3 stuks ipv 2 stuks; vervalt: *Bed. optie 1*, *Bed. optie 3*, *Soort Montage*
- **2 \| LT motor** → nieuw veld *Electrische Bedieningen*: 503 \| Atlas 15/17 Nm / 953 \| Atlas 15/12 Nm / 963 \| Atlas 15/12 Nm + « STEKER; *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT wit * / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw
- **8 \| Solar Motor Brel** → *Bed. optie 3* wordt: 1701 \| Brel 1-kanaals Handzender * / 1770 \| Brel 1-kanaals Wandzender; vervalt: *Bed. optie 1*

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Type armen (4), Bedienings kant (2), Uitval/Arm (4), Bed. optie 1 (5), Bed. optie 3 (5), Doek (2), Kleur code doek (38), Rol breedte (2), Kleur kap (626), Type steun (3), Soort Montage (2)

### SunElite

Breedtebereik: **3010 – 6000 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 4500).

Vaste waarden (niet te kiezen): *scherm model* = 13 \| SunElite, *Garantie* = 99 \| Standaard (CE Klasse 2), *Sunmaster Sticker* = 01 \| Ja

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 3.010 – 6.000 mm | 4500 |
| 2 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 3 | Uitval/Arm | keuzelijst | 2500 \| 2500 ka<br>3000 \| 3000 ka<br>3500 \| 3500 ka | 2500 \| 2500 ka |
| 4 | Type Bediening | keuzelijst | 5 \| Sunea IO motor *<br>3 \| WT motor | 5 \| Sunea IO motor * |
| 5 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 6 | Optie | keuzelijst | xxx \| NVT<br>1 \| LED verlichting io 2 kanalen (kleur en wit)<br>2 \| Eolis 3D Windsensor io zwart<br>3 \| Eolis 3D Windsensor io wit | xxx \| NVT |
| 7 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>1660 \| AMY 1-kanaals IO Wandzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>654-Pure \| SITUO 1 Pure IO Handzender<br>655-Pure \| SITUO 5 Pure IO Handzender<br>656-Pure \| SITUO 5 VAR A/M Pure IO Handzender | 100 \| zonder schakelaar |
| 8 | Doeklengte (uitvalricht.) (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 9 | Kleur code doek | keuzelijst | 390 keuzes (unie van 3 runs: std 390, basis 390, recheck3 390), zie lijst **L1** in het lijstenbestand | 0001 \| WIT (T100) |
| 10 | Kleur kap | keuzelijst | 626 keuzes (unie van 3 runs: std 550, basis 550, recheck3 626), zie lijst **L4** in het lijstenbestand | 06s \| Antraciet Str. |
| 11 | Soort Montage | keuzelijst | 1 \| Standaard *<br>2 \| Plafondmontage | 1 \| Standaard * |

Afhankelijkheid breedte → Uitval/Arm:

| Breedte | Keuzes |
|---------|--------|
| 3010 | (geen) |
| 3500 | 2500 \| 2500 ka (enige keuze, automatisch gevuld) |
| 4000 | 2500 \| 2500 ka, 3000 \| 3000 ka |
| 4500 | 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |
| 5000 | 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |
| 5500 | 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |
| 6000 | 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 5 \| Sunea IO motor *)

- **3 \| WT motor** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT wit * / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Optie* wordt: xxx \| NVT / 1 \| LED verlichting io 2 kanalen (kleur en wit); *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Bedienings kant (2), Uitval/Arm (3), Bed. optie 1 (5), Optie (4), Bed. optie 3 (6), Kleur code doek (390), Kleur kap (626), Soort Montage (2)

### SunEye

Vaste waarden (niet te kiezen): *scherm model* = 2 \| Suneye 2-buis, *Garantie* = 99 \| Standaard (CE Klasse 2), *Sunmaster Sticker* = 01 \| Ja

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 1.690 – 6.000 mm | 3000 |
| 2 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 3 | Uitval/Arm | keuzelijst | 1500 \| 1500 ka<br>2000 \| 2000 ka<br>2500 \| 2500 ka | 1500 \| 1500 ka |
| 4 | Type Bediening | keuzelijst | 5 \| Sunea IO motor<br>3 \| WT motor<br>1 \| Hand Bediening | 5 \| Sunea IO motor |
| 5 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 6 | Optie | keuzelijst | xxx \| NVT<br>2 \| Eolis 3D Windsensor io zwart<br>3 \| Eolis 3D Windsensor io wit | xxx \| NVT |
| 7 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>1660 \| AMY 1-kanaals IO Wandzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>654-Pure \| SITUO 1 Pure IO Handzender<br>655-Pure \| SITUO 5 Pure IO Handzender | 100 \| zonder schakelaar |
| 8 | Doeklengte (uitvalricht.) (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 9 | Kleur code doek | keuzelijst | 390 keuzes (unie van 6 runs: std 390, basis 390, check 389, recheck 390, recheck2 339, recheck3 390), zie lijst **L1** in het lijstenbestand | 0001 \| WIT (T100) |
| 10 | Kleur kap | keuzelijst | 625 keuzes (unie van 6 runs: std 550, basis 550, check 532, recheck 496, recheck2 625, recheck3 625), zie lijst **L5** in het lijstenbestand | 04s \| ANTRAC. ST |
| 11 | Type steun | keuzelijst | 02 \| Lage muursteun 14 cm 2 stuks *<br>01 \| Muursteun 07 cm 2 stuks<br>03 \| Brede muursteun 20 cm 2 stuks | 02 \| Lage muursteun 14 cm 2 stuks * |
| 12 | Soort Montage | keuzelijst | 1 \| Standaard *<br>2 \| Plafondmontage | 1 \| Standaard * |

Afhankelijkheid breedte → Uitval/Arm:

| Breedte | Keuzes |
|---------|--------|
| 2000 | (geen) |
| 2500 | 1500 \| 1500 ka, 2000 \| 2000 ka |
| 3000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka |
| 3500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 4000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 4500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 5000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 5500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 6000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka |
| 6500 | ⚠ Waarde 6.500 ligt niet tussen 1.690 en 6.000 ! |
| 7000 | ⚠ Waarde 7.000 ligt niet tussen 1.690 en 6.000 ! |

Controle volledigheid grote lijsten: *Kleur code doek*: basisrun 390, controlerun (diepte 4) 390 ✔ volledig; *Kleur kap*: basisrun 625, controlerun (diepte 4) 625 ✔ volledig

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 5 \| Sunea IO motor)

- **3 \| WT motor** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT wit * / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw; vervalt: *Optie*
- **1 \| Hand Bediening** → nieuw veld *Bed. optie 2*: 02 \| Draaistang 180 cm * / 01 \| Draaistang 160 cm / 08 \| Draaistang 140 cm / 09 \| Zonder draaistang; vervalt: *Bed. optie 1*, *Optie*, *Bed. optie 3*

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Bedienings kant (2), Uitval/Arm (3), Bed. optie 1 (5), Optie (3), Bed. optie 3 (5), Kleur code doek (390), Kleur kap (625), Type steun (3), Soort Montage (2)

### SunEye XL

Breedtebereik: **1990 – 7450 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *scherm model* = 3 \| Suneye XL, *Garantie* = 99 \| Standaard (CE Klasse 2), *Sunmaster Sticker* = 01 \| Ja

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 1.990 – 7.450 mm | 3000 |
| 2 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 3 | Uitval/Arm | keuzelijst | 1500 \| 1500 ka<br>2000 \| 2000 ka<br>2500 \| 2500 ka | 1500 \| 1500 ka |
| 4 | Type Bediening | keuzelijst | 5 \| Sunea IO motor<br>3 \| WT motor | 5 \| Sunea IO motor |
| 5 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 6 | Optie | keuzelijst | xxx \| NVT<br>2 \| Eolis 3D Windsensor io zwart<br>3 \| Eolis 3D Windsensor io wit | xxx \| NVT |
| 7 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>1660 \| AMY 1-kanaals IO Wandzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>654-Pure \| SITUO 1 Pure IO Handzender<br>655-Pure \| SITUO 5 Pure IO Handzender | 100 \| zonder schakelaar |
| 8 | Doeklengte (uitvalricht.) (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 9 | Kleur code doek | keuzelijst | 390 keuzes (unie van 3 runs: std 390, basis 390, recheck3 390), zie lijst **L1** in het lijstenbestand | 0001 \| WIT (T100) |
| 10 | Kleur kap | keuzelijst | 625 keuzes (unie van 3 runs: std 549, basis 549, recheck3 625), zie lijst **L6** in het lijstenbestand | 02 \| Ral 9001 |
| 11 | Type steun | keuzelijst | Y02 \| 2 muursteunen<br>Y03 \| 3 muursteunen<br>Y04 \| 4 muursteunen<br>Y05 \| 5 muursteunen | Y02 \| 2 muursteunen |
| 12 | Soort Montage | keuzelijst | 1 \| Standaard *<br>2 \| Plafondmontage | 1 \| Standaard * |

Afhankelijkheid breedte → Uitval/Arm:

| Breedte | Keuzes |
|---------|--------|
| 1990 | (geen) |
| 2000 | (geen) |
| 2500 | 1500 \| 1500 ka, 2000 \| 2000 ka |
| 3000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka |
| 3500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 4000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka |
| 4500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |
| 5000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |
| 5500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |
| 6000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |
| 6500 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |
| 7000 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |
| 7450 | 1500 \| 1500 ka, 2000 \| 2000 ka, 2500 \| 2500 ka, 3000 \| 3000 ka, 3500 \| 3500 ka |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 5 \| Sunea IO motor)

- **3 \| WT motor** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT wit * / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw; vervalt: *Optie*

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Bedienings kant (2), Uitval/Arm (3), Bed. optie 1 (5), Optie (3), Bed. optie 3 (5), Kleur code doek (390), Kleur kap (625), Type steun (4), Soort Montage (2)

### SunProject 100

Breedtebereik: **800 – 8000 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *scherm model* = 12 \| Sunproject, *Garantie* = 99 \| Standaard (CE Klasse 2), *Sunmaster Sticker* = 01 \| Ja

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 800 – 8.000 mm | 3000 |
| 2 | Type armen | keuzelijst | 2 \| Windvaste armen<br>3 \| Gasveer armen<br>4 \| Hoek- / Balkon armen WVA<br>7 \| Hoek- / Balkon armen WAG | 2 \| Windvaste armen |
| 3 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 4 | Uitval/Arm | keuzelijst | 01 \| 950 uitval<br>02 \| 1150 uitval<br>03 \| 1350 uitval<br>04 \| 1500 uitval | 01 \| 950 uitval |
| 5 | Type Bediening | keuzelijst | 5 \| Sunea IO motor<br>3 \| WT motor<br>1 \| Hand Bediening<br>2 \| LT motor<br>8 \| Solar Motor Brel | 5 \| Sunea IO motor |
| 6 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 7 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>1660 \| AMY 1-kanaals IO Wandzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>654-Pure \| SITUO 1 Pure IO Handzender<br>655-Pure \| SITUO 5 Pure IO Handzender | 100 \| zonder schakelaar |
| 8 | Doek | keuzelijst | 2 \| Uni doek naadloos doorval<br>4 \| Doek in banen met doorval | 2 \| Uni doek naadloos doorval |
| 9 | Doeklengte (uitvalricht.) (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 10 | Kleur code doek | keuzelijst | 38 keuzes, zie lijst **L2** in het lijstenbestand | 0001 \| WIT (T100) |
| 11 | Rol breedte | keuzelijst | 165 \| 165 cm<br>320 \| 320 cm | 165 \| 165 cm |
| 12 | Kleur kap | keuzelijst | 626 keuzes (unie van 3 runs: std 550, basis 550, recheck3 626), zie lijst **L7** in het lijstenbestand | 02 \| Ral 9001 |
| 13 | Soort Montage | keuzelijst | 1 \| Standaard *<br>2 \| Plafondmontage | 1 \| Standaard * |

Afhankelijkheid breedte → Uitval/Arm:

| Breedte | Keuzes |
|---------|--------|
| 800 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 1000 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 1500 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 2000 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 2500 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 3000 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 3500 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 4000 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 4500 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 5000 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 5500 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 6000 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 6500 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 7000 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 7500 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |
| 8000 | 01 \| 950 uitval, 02 \| 1150 uitval, 03 \| 1350 uitval, 04 \| 1500 uitval |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 5 \| Sunea IO motor)

- **3 \| WT motor** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT wit * / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw
- **1 \| Hand Bediening** → nieuw veld *Hand Bedieningen*: 1 \| Draaistang bediening binnen / 2 \| Draaistang bediening buiten; nieuw veld *Bed. optie 2*: 01 \| Draaistang 160 cm / 02 \| Draaistang 180 cm / 09 \| Zonder draaistang; vervalt: *Bed. optie 1*, *Bed. optie 3*, *Soort Montage*
- **2 \| LT motor** → nieuw veld *Electrische Bedieningen*: 503 \| Atlas 15/17 Nm / 953 \| Atlas 15/12 Nm / 963 \| Atlas 15/12 Nm + « STEKER; *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT wit * / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw
- **8 \| Solar Motor Brel** → *Bed. optie 3* wordt: 1701 \| Brel 1-kanaals Handzender * / 1770 \| Brel 1-kanaals Wandzender; vervalt: *Bed. optie 1*

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Type armen (4), Bedienings kant (2), Uitval/Arm (4), Bed. optie 1 (5), Bed. optie 3 (5), Doek (2), Kleur code doek (38), Rol breedte (2), Kleur kap (626), Soort Montage (2)

### Zipscreen 85

Breedtebereik: **547 – 4100 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *Type screen* = 1 \| Zipscreen 85, *doek kantelen* = 1 \| Nee, *Rol breedte* = 2205 \| 2200, *Garantie* = 99 \| Standaard (CE Klasse 3)

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 547 – 4.100 mm | 3000 |
| 2 | Hoogte (MM) | getal | 300 – 2.000 mm | 2000 |
| 3 | Uitvoering | keuzelijst | 1 \| Afgeschuinde kast<br>2 \| Rechte kast | 1 \| Afgeschuinde kast |
| 4 | Geleider links | keuzelijst | 566 \| Deelbare Zip geleider *<br>563 \| Zip geleider<br>568 \| Deelbare Zip geleider Veranda<br>573 \| LHTF Zip geleider<br>576 \| LHTF Deelbare Zip geleider<br>900 \| Zonder geleider | 566 \| Deelbare Zip geleider * |
| 5 | Geleider rechts | keuzelijst | 566 \| Deelbare Zip geleider *<br>563 \| Zip geleider<br>568 \| Deelbare Zip geleider Veranda<br>573 \| LHTF Zip geleider<br>576 \| LHTF Deelbare Zip geleider<br>900 \| Zonder geleider | 566 \| Deelbare Zip geleider * |
| 6 | Geleiders voorboren | keuzelijst | xxx \| NVT *<br>03 \| Geleiders voorgeboord<br>02 \| Geleiders voorboren in de dag | xxx \| NVT * |
| 7 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 8 | Type Bediening | keuzelijst | 2 \| IO-50 *<br>1 \| LT-50<br>7 \| WT-50 | 2 \| IO-50 * |
| 9 | Electrische Bedieningen | keuzelijst | 982 \| SUNILUS 50 IO 10\17 *<br>992 \| SUNILUS 50 IO 10\17 + « STEKER<br>622 \| Maestria+ IO 10/17<br>625 \| MAESTRIA+ 50 IO 10\32 | 982 \| SUNILUS 50 IO 10\17 * |
| 10 | Montage | keuzelijst | 1 \| standaard<br>2 \| Contra | 1 \| standaard |
| 11 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 12 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>654-Pure \| SITUO 1 Pure IO Handzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>1660 \| AMY 1-kanaals IO Wandzender<br>655-Pure \| SITUO 5 Pure IO Handzender | 100 \| zonder schakelaar |
| 13 | Doorvoer positie | keuzelijst | 13 keuzes, zie lijst **L8** in het lijstenbestand | 20 \| AOL [9] (Standaard Links) * |
| 14 | Kleur code doek | keuzelijst | 76 keuzes (unie van 3 runs: std 76, basis 76, recheck3 76), zie lijst **L9** in het lijstenbestand | 001004 \| Serge Grijs-Oranje |
| 15 | Kleurcode 2 | keuzelijst | 01 \| Standaard *<br>02 \| Grijze zijde buiten | 01 \| Standaard * |
| 16 | Kleur kap | keuzelijst | 624 keuzes (unie van 3 runs: std 50, basis 50, recheck3 624), zie lijst **L10** in het lijstenbestand | 04s \| ANTRAC. ST |
| 17 | Kleur geleider | keuzelijst | 626 keuzes (unie van 3 runs: std 240, basis 240, recheck3 625), zie lijst **L11** in het lijstenbestand | 04s \| ANTRAC. ST * |
| 18 | Kleur onderlijst | keuzelijst | 626 keuzes (unie van 3 runs: std 240, basis 240, recheck3 625), zie lijst **L11** in het lijstenbestand | 04s \| ANTRAC. ST * |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 2 \| IO-50 *)

- **1 \| LT-50** → *Electrische Bedieningen* wordt: 502 \| Jet 10/17 * / 452 \| Jet 10/32; *Montage* wordt: 1 \| standaard / 3 \| Contra (afstelgaten in de achterplaat boren); *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT of LS wit * / 802 \| Hirschmannsteker motordeel LT of WT of LS / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw
- **7 \| WT-50** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT of LS wit * / 802 \| Hirschmannsteker motordeel LT of WT of LS / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw; vervalt: *Electrische Bedieningen*

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Uitvoering (2), Geleider links (6), Geleider rechts (6), Geleiders voorboren (3), Bedienings kant (2), Electrische Bedieningen (4), Montage (2), Bed. optie 1 (5), Bed. optie 3 (5), Doorvoer positie (13), Kleur code doek (76), Kleurcode 2 (2), Kleur kap (624), Kleur geleider (626), Kleur onderlijst (626)

### Zipscreen 100

Breedtebereik: **545 – 4105 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *Type screen* = 2 \| Zipscreen 100, *doek kantelen* = 1 \| Nee, *Rol breedte* = 2205 \| 2200, *Garantie* = 99 \| Standaard (CE Klasse 3)

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 545 – 4.105 mm | 3000 |
| 2 | Hoogte (MM) | getal | 300 – 3.400 mm | 2000 |
| 3 | Uitvoering | keuzelijst | 1 \| Afgeschuinde kast<br>2 \| Rechte kast | 1 \| Afgeschuinde kast |
| 4 | Geleider links | keuzelijst | 566 \| Deelbare Zip geleider *<br>563 \| Zip geleider<br>568 \| Deelbare Zip geleider Veranda<br>573 \| LHTF Zip geleider<br>576 \| LHTF Deelbare Zip geleider<br>900 \| Zonder geleider | 566 \| Deelbare Zip geleider * |
| 5 | Geleider rechts | keuzelijst | 566 \| Deelbare Zip geleider *<br>563 \| Zip geleider<br>568 \| Deelbare Zip geleider Veranda<br>573 \| LHTF Zip geleider<br>576 \| LHTF Deelbare Zip geleider<br>900 \| Zonder geleider | 566 \| Deelbare Zip geleider * |
| 6 | Geleiders voorboren | keuzelijst | xxx \| NVT *<br>03 \| Geleiders voorgeboord<br>02 \| Geleiders voorboren in de dag | xxx \| NVT * |
| 7 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 8 | Type Bediening | keuzelijst | 2 \| IO-50 *<br>1 \| LT-50<br>7 \| WT-50 | 2 \| IO-50 * |
| 9 | Electrische Bedieningen | keuzelijst | 982 \| SUNILUS 50 IO 10\17 *<br>992 \| SUNILUS 50 IO 10\17 + « STEKER<br>622 \| Maestria+ IO 10/17<br>625 \| MAESTRIA+ 50 IO 10\32 | 982 \| SUNILUS 50 IO 10\17 * |
| 10 | Montage | keuzelijst | 1 \| standaard<br>2 \| Contra | 1 \| standaard |
| 11 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 12 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>654-Pure \| SITUO 1 Pure IO Handzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>1660 \| AMY 1-kanaals IO Wandzender<br>655-Pure \| SITUO 5 Pure IO Handzender | 100 \| zonder schakelaar |
| 13 | Doorvoer positie | keuzelijst | 13 keuzes, zie lijst **L8** in het lijstenbestand | 20 \| AOL [9] (Standaard Links) * |
| 14 | Kleur code doek | keuzelijst | 76 keuzes (unie van 3 runs: std 76, basis 76, recheck3 76), zie lijst **L9** in het lijstenbestand | 001004 \| Serge Grijs-Oranje |
| 15 | Kleurcode 2 | keuzelijst | 01 \| Standaard *<br>02 \| Grijze zijde buiten | 01 \| Standaard * |
| 16 | Kleur kap | keuzelijst | 624 keuzes (unie van 3 runs: std 50, basis 50, recheck3 624), zie lijst **L10** in het lijstenbestand | 04s \| ANTRAC. ST |
| 17 | Kleur geleider | keuzelijst | 626 keuzes (unie van 3 runs: std 240, basis 240, recheck3 625), zie lijst **L11** in het lijstenbestand | 04s \| ANTRAC. ST * |
| 18 | Kleur onderlijst | keuzelijst | 626 keuzes (unie van 3 runs: std 240, basis 240, recheck3 625), zie lijst **L11** in het lijstenbestand | 04s \| ANTRAC. ST * |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 2 \| IO-50 *)

- **1 \| LT-50** → *Electrische Bedieningen* wordt: 502 \| Jet 10/17 * / 452 \| Jet 10/32; *Montage* wordt: 1 \| standaard / 3 \| Contra (afstelgaten in de achterplaat boren); *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT of LS wit * / 802 \| Hirschmannsteker motordeel LT of WT of LS / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw
- **7 \| WT-50** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT of LS wit * / 802 \| Hirschmannsteker motordeel LT of WT of LS / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw; vervalt: *Electrische Bedieningen*

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Uitvoering (2), Geleider links (6), Geleider rechts (6), Geleiders voorboren (3), Bedienings kant (2), Electrische Bedieningen (4), Montage (2), Bed. optie 1 (5), Bed. optie 3 (5), Doorvoer positie (13), Kleur code doek (76), Kleurcode 2 (2), Kleur kap (624), Kleur geleider (626), Kleur onderlijst (626)

### Zipscreen 130 (Max)

Breedtebereik: **525 – 5100 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *Type screen* = 4 \| Zipscreen Max, *doek kantelen* = 1 \| Nee, *Rol breedte* = 2505 \| 2500, *Garantie* = 99 \| Standaard (CE Klasse 3)

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 525 – 5.100 mm | 3000 |
| 2 | Hoogte (MM) | getal | 300 – 5.000 mm | 2000 |
| 3 | Geleider links | keuzelijst | 566 \| Deelbare Zip geleider *<br>563 \| Zip geleider<br>568 \| Deelbare Zip geleider Veranda<br>573 \| LHTF Zip geleider<br>576 \| LHTF Deelbare Zip geleider<br>900 \| Zonder geleider | 566 \| Deelbare Zip geleider * |
| 4 | Geleider rechts | keuzelijst | 566 \| Deelbare Zip geleider *<br>563 \| Zip geleider<br>568 \| Deelbare Zip geleider Veranda<br>573 \| LHTF Zip geleider<br>576 \| LHTF Deelbare Zip geleider<br>900 \| Zonder geleider | 566 \| Deelbare Zip geleider * |
| 5 | Geleiders voorboren | keuzelijst | xxx \| NVT *<br>03 \| Geleiders voorgeboord<br>02 \| Geleiders voorboren in de dag | xxx \| NVT * |
| 6 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 7 | Type Bediening | keuzelijst | 2 \| IO-50 *<br>1 \| LT-50<br>7 \| WT-50 | 2 \| IO-50 * |
| 8 | Electrische Bedieningen | keuzelijst | 982 \| SUNILUS 50 IO 10\17 *<br>992 \| SUNILUS 50 IO 10\17 + « STEKER<br>622 \| Maestria+ IO 10/17<br>625 \| MAESTRIA+ 50 IO 10\32 | 982 \| SUNILUS 50 IO 10\17 * |
| 9 | Montage | keuzelijst | 1 \| standaard<br>2 \| Contra | 1 \| standaard |
| 10 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 11 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>654-Pure \| SITUO 1 Pure IO Handzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>1660 \| AMY 1-kanaals IO Wandzender<br>655-Pure \| SITUO 5 Pure IO Handzender | 100 \| zonder schakelaar |
| 12 | Doorvoer positie | keuzelijst | 13 keuzes, zie lijst **L8** in het lijstenbestand | 20 \| AOL [9] (Standaard Links) * |
| 13 | Kleur code doek | keuzelijst | 76 keuzes (unie van 3 runs: std 76, basis 76, recheck3 76), zie lijst **L9** in het lijstenbestand | 001004 \| Serge Grijs-Oranje |
| 14 | Kleurcode 2 | keuzelijst | 01 \| Standaard *<br>02 \| Grijze zijde buiten | 01 \| Standaard * |
| 15 | Kleur kap | keuzelijst | 624 keuzes (unie van 3 runs: std 50, basis 50, recheck3 624), zie lijst **L10** in het lijstenbestand | 04s \| ANTRAC. ST |
| 16 | Kleur geleider | keuzelijst | 626 keuzes (unie van 3 runs: std 240, basis 240, recheck3 625), zie lijst **L11** in het lijstenbestand | 04s \| ANTRAC. ST * |
| 17 | Kleur onderlijst | keuzelijst | 626 keuzes (unie van 3 runs: std 240, basis 240, recheck3 625), zie lijst **L11** in het lijstenbestand | 04s \| ANTRAC. ST * |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 2 \| IO-50 *)

- **1 \| LT-50** → *Electrische Bedieningen* wordt: 502 \| Jet 10/17 * / 452 \| Jet 10/32; *Montage* wordt: 1 \| standaard / 3 \| Contra (afstelgaten in de achterplaat boren); *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT of LS wit * / 802 \| Hirschmannsteker motordeel LT of WT of LS / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw
- **7 \| WT-50** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT of LS wit * / 802 \| Hirschmannsteker motordeel LT of WT of LS / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw; vervalt: *Electrische Bedieningen*

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Geleider links (6), Geleider rechts (6), Geleiders voorboren (3), Bedienings kant (2), Electrische Bedieningen (4), Montage (2), Bed. optie 1 (5), Bed. optie 3 (5), Doorvoer positie (13), Kleur code doek (76), Kleurcode 2 (2), Kleur kap (624), Kleur geleider (626), Kleur onderlijst (626)

### Zipscreen SunZip Design 110

Breedtebereik: **595 – 5000 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *Type screen* = 8 \| Zipscreen Zip Design 110, *Montage* = 1 \| standaard, *doek kantelen* = 1 \| Nee, *Rol breedte* = 2205 \| 2200, *Garantie* = 99 \| Standaard (CE Klasse 3)

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 595 – 5.000 mm | 3000 |
| 2 | Hoogte (MM) | getal | 300 – 2.700 mm | 2000 |
| 3 | Geleider links | keuzelijst | 566 \| Deelbare Zip geleider *<br>563 \| Zip geleider<br>568 \| Deelbare Zip geleider Veranda<br>573 \| LHTF Zip geleider<br>576 \| LHTF Deelbare Zip geleider<br>900 \| Zonder geleider | 566 \| Deelbare Zip geleider * |
| 4 | Geleider rechts | keuzelijst | 566 \| Deelbare Zip geleider *<br>563 \| Zip geleider<br>568 \| Deelbare Zip geleider Veranda<br>573 \| LHTF Zip geleider<br>576 \| LHTF Deelbare Zip geleider<br>900 \| Zonder geleider | 566 \| Deelbare Zip geleider * |
| 5 | Geleiders voorboren | keuzelijst | xxx \| NVT *<br>03 \| Geleiders voorgeboord<br>02 \| Geleiders voorboren in de dag | xxx \| NVT * |
| 6 | Bedienings kant | keuzelijst | 2 \| Rechts *<br>1 \| Links | 2 \| Rechts * |
| 7 | Type Bediening | keuzelijst | 12 \| RS 100 IO Solar *<br>2 \| IO-50<br>1 \| LT-50<br>7 \| WT-50<br>11 \| Solar Motor Brel | 12 \| RS 100 IO Solar * |
| 8 | Bed. optie 1 | keuzelijst | B05 \| Solarpaneel IO Rechts gemonteerd *<br>B04 \| Solarpaneel Rechts los geleverd | B05 \| Solarpaneel IO Rechts gemonteerd * |
| 9 | Bed. optie 3 | keuzelijst | 654-Pure \| SITUO 1 Pure IO Handzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>1660 \| AMY 1-kanaals IO Wandzender<br>655-Pure \| SITUO 5 Pure IO Handzender<br>661 \| SMOOVE RS100 IO Wandzender<br>Y02 \| Combi situo 5 op kanaal .. | 654-Pure \| SITUO 1 Pure IO Handzender |
| 10 | Kleur code doek | keuzelijst | 76 keuzes (unie van 3 runs: std 76, basis 76, recheck3 76), zie lijst **L9** in het lijstenbestand | 001004 \| Serge Grijs-Oranje |
| 11 | Kleurcode 2 | keuzelijst | 01 \| Standaard *<br>02 \| Grijze zijde buiten | 01 \| Standaard * |
| 12 | Kleur kap | keuzelijst | 625 keuzes (unie van 3 runs: std 50, basis 50, recheck3 625), zie lijst **L12** in het lijstenbestand | 04s \| ANTRAC. ST |
| 13 | Kleur geleider | keuzelijst | 626 keuzes (unie van 3 runs: std 240, basis 240, recheck3 625), zie lijst **L11** in het lijstenbestand | 04s \| ANTRAC. ST * |
| 14 | Kleur onderlijst | keuzelijst | 626 keuzes (unie van 3 runs: std 240, basis 240, recheck3 625), zie lijst **L11** in het lijstenbestand | 04s \| ANTRAC. ST * |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 12 \| RS 100 IO Solar *)

- **2 \| IO-50** → nieuw veld *Electrische Bedieningen*: 982 \| SUNILUS 50 IO 10\17 * / 992 \| SUNILUS 50 IO 10\17 + « STEKER; nieuw veld *Montage*: 1 \| standaard / 2 \| Contra; *Bed. optie 1* wordt: 814 \| Motorkabel 05 m. IO wit * / 815 \| Motorkabel 10 m. IO wit / 835 \| Motorkabel 03 m. IO zwart / 836 \| Motorkabel 05 m. IO zwart / 837 \| Motorkabel 10 m. IO zwart; *Bed. optie 3* wordt: 100 \| zonder schakelaar / 654-Pure \| SITUO 1 Pure IO Handzender / 1663 \| AMY 4-kanaals Mode IO Wandzender / 1660 \| AMY 1-kanaals IO Wandzender / 655-Pure \| SITUO 5 Pure IO Handzender; nieuw veld *Doorvoer positie*: 40 \| AOR [9] (Standaard Rechts) * / 13 \| GD (Geen Doorvoer) / 41 \| ABR [9] (Achter - Boven Rechts) / 42 \| VBR [9] (Voor - Boven Rechts) / 44 \| BVR [9] (Boven - Voor Rechts) geen garantie ivm inwateren / 45 \| BAR [9] (Boven - Achter Rechts) geen garantie ivm inwateren / 47 \| DPR (Door Poot Rechts) / 48 \| ZBVR (Zijkant Boven Voor Rechts) / 50 \| ZBAR (Zijkant Boven Achter Rechts) / 51 \| ZOAR (Zijkant Onder Achter Rechts)
- **1 \| LT-50** → nieuw veld *Electrische Bedieningen*: 502 \| Jet 10/17 * / 452 \| Jet 10/32; *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT of LS wit * / 802 \| Hirschmannsteker motordeel LT of WT of LS / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw; nieuw veld *Doorvoer positie*: 40 \| AOR [9] (Standaard Rechts) * / 13 \| GD (Geen Doorvoer) / 41 \| ABR [9] (Achter - Boven Rechts) / 42 \| VBR [9] (Voor - Boven Rechts) / 44 \| BVR [9] (Boven - Voor Rechts) geen garantie ivm inwateren / 45 \| BAR [9] (Boven - Achter Rechts) geen garantie ivm inwateren / 47 \| DPR (Door Poot Rechts) / 48 \| ZBVR (Zijkant Boven Voor Rechts) / 50 \| ZBAR (Zijkant Boven Achter Rechts) / 51 \| ZOAR (Zijkant Onder Achter Rechts)
- **7 \| WT-50** → nieuw veld *Montage*: 1 \| standaard / 2 \| Contra; *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT of LS wit * / 802 \| Hirschmannsteker motordeel LT of WT of LS / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw; nieuw veld *Doorvoer positie*: 40 \| AOR [9] (Standaard Rechts) * / 13 \| GD (Geen Doorvoer) / 41 \| ABR [9] (Achter - Boven Rechts) / 42 \| VBR [9] (Voor - Boven Rechts) / 44 \| BVR [9] (Boven - Voor Rechts) geen garantie ivm inwateren / 45 \| BAR [9] (Boven - Achter Rechts) geen garantie ivm inwateren / 47 \| DPR (Door Poot Rechts) / 48 \| ZBVR (Zijkant Boven Voor Rechts) / 50 \| ZBAR (Zijkant Boven Achter Rechts) / 51 \| ZOAR (Zijkant Onder Achter Rechts)
- **11 \| Solar Motor Brel** → nieuw veld *Montage*: 1 \| standaard / 2 \| Contra; *Bed. optie 1* wordt: B01 \| Solarpaneel Rechts gemonteerd brel * / B04 \| Solarpaneel Rechts los geleverd; *Bed. optie 3* wordt: 1701 \| Brel 1-kanaals Handzender * / 1770 \| Brel 1-kanaals Wandzender

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Geleider links (6), Geleider rechts (6), Geleiders voorboren (3), Bedienings kant (2), Bed. optie 1 (2), Bed. optie 3 (6), Kleur code doek (76), Kleurcode 2 (2), Kleur kap (625), Kleur geleider (626), Kleur onderlijst (626)

### Zipscreen Zip Design 110 Veranda

Breedtebereik: **600 – 6000 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *Type screen* = 9 \| Zipscreen Zip Design 110 Veranda, *Montage* = 1 \| standaard, *Kleurcode 2* = 01 \| Standaard, *doek kantelen* = 1 \| Nee, *Rol breedte* = 2205 \| 2200, *Garantie* = 99 \| Standaard (CE Klasse 3)

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Breedte (MM) | getal | 600 – 6.000 mm | 3000 |
| 2 | Hoogte (MM) | getal | 300 – 2.700 mm | 2000 |
| 3 | Geleider links | keuzelijst | 568 \| Deelbare Zip geleider Veranda *<br>563 \| Zip geleider<br>566 \| Deelbare Zip geleider<br>573 \| LHTF Zip geleider<br>576 \| LHTF Deelbare Zip geleider<br>900 \| Zonder geleider | 568 \| Deelbare Zip geleider Veranda * |
| 4 | Geleider rechts | keuzelijst | 568 \| Deelbare Zip geleider Veranda *<br>563 \| Zip geleider<br>566 \| Deelbare Zip geleider<br>573 \| LHTF Zip geleider<br>576 \| LHTF Deelbare Zip geleider<br>900 \| Zonder geleider | 568 \| Deelbare Zip geleider Veranda * |
| 5 | Geleiders voorboren | keuzelijst | xxx \| NVT *<br>01 \| Geleiders voorboren op de dag<br>02 \| Geleiders voorboren in de dag | xxx \| NVT * |
| 6 | Bedienings kant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 7 | Type Bediening | keuzelijst | 2 \| IO-50 *<br>12 \| RS 100 IO Solar<br>1 \| LT-50<br>7 \| WT-50<br>11 \| Solar Motor Brel | 2 \| IO-50 * |
| 8 | Electrische Bedieningen | keuzelijst | 982 \| SUNILUS 50 IO 10\17 *<br>992 \| SUNILUS 50 IO 10\17 + « STEKER | 982 \| SUNILUS 50 IO 10\17 * |
| 9 | Bed. optie 1 | keuzelijst | 814 \| Motorkabel 05 m. IO wit *<br>815 \| Motorkabel 10 m. IO wit<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart | 814 \| Motorkabel 05 m. IO wit * |
| 10 | Bed. optie 3 | keuzelijst | 100 \| zonder schakelaar<br>654-Pure \| SITUO 1 Pure IO Handzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>1660 \| AMY 1-kanaals IO Wandzender<br>655-Pure \| SITUO 5 Pure IO Handzender | 100 \| zonder schakelaar |
| 11 | Doorvoer positie | keuzelijst | 20 \| AOL [9] (Standaard Links) *<br>13 \| GD (Geen Doorvoer)<br>22 \| VBL [9] (Voor - Boven Links)<br>24 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren<br>25 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren<br>27 \| DPL (Door Poot Links)<br>28 \| ZBVL (Zijkant Boven Voor Links)<br>30 \| ZBAL (Zijkant Boven Achter Links)<br>31 \| ZOAL (Zijkant Onder Achter Links) | 20 \| AOL [9] (Standaard Links) * |
| 12 | Kleur code doek | keuzelijst | 87 keuzes (unie van 3 runs: std 87, basis 87, recheck3 87), zie lijst **L13** in het lijstenbestand | 001001 \| Serge Effen Grijs (HR) |
| 13 | Kleur kap | keuzelijst | 625 keuzes (unie van 3 runs: std 50, basis 50, recheck3 625), zie lijst **L14** in het lijstenbestand | 04s \| ANTRAC. ST |
| 14 | Kleur geleider | keuzelijst | 634 keuzes (unie van 3 runs: std 243, basis 243, recheck3 634), zie lijst **L15** in het lijstenbestand | 04s \| ANTRAC. ST * |
| 15 | Kleur onderlijst | keuzelijst | 635 keuzes (unie van 3 runs: std 226, basis 226, recheck3 635), zie lijst **L16** in het lijstenbestand | 04s \| ANTRAC. ST * |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 2 \| IO-50 *)

- **12 \| RS 100 IO Solar** → *Bed. optie 1* wordt: B07 \| Solarpaneel IO Links gemonteerd / B06 \| Solarpaneel IO Links los geleverd; *Bed. optie 3* wordt: 654-Pure \| SITUO 1 Pure IO Handzender / 1663 \| AMY 4-kanaals Mode IO Wandzender / 1660 \| AMY 1-kanaals IO Wandzender / 655-Pure \| SITUO 5 Pure IO Handzender / 661 \| SMOOVE RS100 IO Wandzender / Y02 \| Combi situo 5 op kanaal ..; vervalt: *Electrische Bedieningen*, *Doorvoer positie*
- **1 \| LT-50** → *Electrische Bedieningen* wordt: 502 \| Jet 10/17 * / 452 \| Jet 10/32; *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT of LS wit * / 802 \| Hirschmannsteker motordeel LT of WT of LS / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw
- **7 \| WT-50** → *Bed. optie 1* wordt: 810 \| Motorkabel 03 m. LT of WT of LS wit * / 802 \| Hirschmannsteker motordeel LT of WT of LS / 811 \| Motorkabel 05 m. LT of WT wit / 812 \| Motorkabel 10 m. LT of WT wit / 825 \| Motorkabel 03 m. LT of WT zwart / 826 \| Motorkabel 05 m. LT of WT zwart / 827 \| Motorkabel 10 m. LT of WT zwart; *Bed. optie 3* wordt: 101 \| schakelaar opbouw * / 100 \| zonder schakelaar / 103 \| schakelaar inbouw; vervalt: *Electrische Bedieningen*
- **11 \| Solar Motor Brel** → *Bed. optie 1* wordt: B03 \| Solarpaneel Links gemonteerd * / B02 \| Solarpaneel Links los geleverd; *Bed. optie 3* wordt: 1701 \| Brel 1-kanaals Handzender * / 1770 \| Brel 1-kanaals Wandzender; vervalt: *Electrische Bedieningen*, *Doorvoer positie*

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Geleider links (6), Geleider rechts (6), Geleiders voorboren (3), Bedienings kant (2), Electrische Bedieningen (2), Bed. optie 1 (5), Bed. optie 3 (5), Doorvoer positie (9), Kleur code doek (87), Kleur kap (625), Kleur geleider (634), Kleur onderlijst (635)

### Bovendak zonwering SunControl 165 ZIP

Vaste waarden (niet te kiezen): *Scherm model* = 03 \| Bovendak zonwering SunControl 165 ZIP, *Electrische Bedieningen* = 0022 \| SUNEA 50 IO 35/17 RH, *Doeksoort* = 04 \| Dickson, *Sunmaster Sticker* = 01 \| Ja

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Bevestigingsmaat=Bestelmaat (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 2 | Uitval (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 3 | Uitvoering | keuzelijst | 1 \| Standaard | 1 \| Standaard |
| 4 | Deelmaat 1 (B1) (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 5 | Bedieningskant | keuzelijst | 1 \| Links<br>2 \| Rechts | 1 \| Links |
| 6 | Type Bediening | keuzelijst | 2 \| IO motor *<br>1 \| WT motor | 2 \| IO motor * |
| 7 | Bed. optie 1 | keuzelijst | 1 \| Motorkabel 01 m. zwart *<br>835 \| Motorkabel 03 m. IO zwart<br>836 \| Motorkabel 05 m. IO zwart<br>837 \| Motorkabel 10 m. IO zwart<br>814 \| Motorkabel 05 m. IO wit<br>815 \| Motorkabel 10 m. IO wit<br>804 \| Hirschmannsteker motordeel IO | 1 \| Motorkabel 01 m. zwart * |
| 8 | Bed. optie 3 | keuzelijst | 100 \| Zonder schakelaar<br>654-Pure \| SITUO 1 Pure IO Handzender<br>655-Pure \| SITUO 5 Pure IO Handzender<br>656-Pure \| SITUO 5 VAR A/M Pure IO Handzender + Zon & Wind automaat<br>1660 \| AMY 1-kanaals IO Wandzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender | 100 \| Zonder schakelaar |
| 9 | Kleur code doek | keuzelijst | 168 keuzes (unie van 3 runs: std 168, basis 168, recheck3 168), zie lijst **L17** in het lijstenbestand | 0001 \| WIT (T100) |
| 10 | Kleur frame | keuzelijst | 627 keuzes (unie van 3 runs: std 52, basis 52, recheck3 627), zie lijst **L18** in het lijstenbestand | 04s \| ANTRAC. ST |
| 11 | Soort montage | keuzelijst | 01 \| Standaard<br>07 \| Standaard + hoek<br>09 \| Geleider montagevoet 150 mm<br>10 \| Geleider montagevoet 200 mm<br>11 \| Geleider montagevoet 300 mm<br>12 \| Geleider montagevoet 150 mm + hoek<br>13 \| Geleider montagevoet 200 mm + hoek<br>14 \| Geleider montagevoet 300 mm + hoek | 01 \| Standaard |
| 12 | Doekondersteuning | keuzelijst | xxx \| NVT *<br>2 \| Tussenrol onder de geleider | xxx \| NVT * |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 2 \| IO motor *)

- **1 \| WT motor** → *Uitval (MM)* bereik wordt: Waarde 1 ligt niet tussen 1.000 en 4.500 !; *Bed. optie 1* wordt: 1 \| Motorkabel 01 m. zwart * / 825 \| Motorkabel 03 m. WT zwart / 826 \| Motorkabel 05 m. WT zwart / 827 \| Motorkabel 10 m. WT zwart / 810 \| Motorkabel 03 m. WT wit / 811 \| Motorkabel 05 m. WT wit / 812 \| Motorkabel 10 m. WT wit / 802 \| Hirschmannsteker motordeel WT; *Bed. optie 3* wordt: 101 \| Schakelaar opbouw * / 100 \| Zonder schakelaar / 103 \| Schakelaar inbouw; vervalt: *Uitvoering*; vaste waarde *Electrische Bedieningen* wordt 0012 \| OREA 50 WT 35/17 RH

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Bedieningskant (2), Bed. optie 1 (7), Bed. optie 3 (6), Kleur code doek (168), Kleur frame (627), Soort montage (8), Doekondersteuning (2)

### Rolluik S-37

Breedtebereik: **363 – 3000 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *Soort lamellen* = 8 \| RS37, *Montage* = 1 \| gewoon, *Soort onderlijst* = 2 \| 45 mm hoog Met Rubber, *Bedieningen* = 167 \| RS 100 IO SOLAR 15/12, *Garantie* = 99 \| Standaard

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Uitvoering | keuzelijst | 1 \| Rolluik<br>3 \| Rolluik gekoppeld | 1 \| Rolluik |
| 2 | Breedte (MM) | getal | 363 – 3.000 mm | 3000 |
| 3 | Hoogte (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | 2000 |
| 4 | Geleider links | keuzelijst | 503 \| A3 HTF<br>575 \| DB HTF BASIS + DEKSEL<br>514 \| A4 LHTF<br>505 \| A5 HF<br>516 \| A6 LHF<br>812 \| A8-12 F-HTF<br>820 \| A8-20 F-HTF<br>513 \| A13 HTF (68 mm) | 503 \| A3 HTF |
| 5 | Geleider rechts | keuzelijst | 503 \| A3 HTF *<br>514 \| A4 LHTF<br>505 \| A5 HF<br>516 \| A6 LHF<br>812 \| A8-12 F-HTF<br>820 \| A8-20 F-HTF<br>513 \| A13 HTF (68 mm)<br>575 \| DB HTF BASIS + DEKSEL | 503 \| A3 HTF * |
| 6 | Geleiders voorboren | keuzelijst | xxx \| NVT *<br>01 \| Geleiders voorboren | xxx \| NVT * |
| 7 | Bedieningskant | keuzelijst | 2 \| Links<br>1 \| Rechts | 2 \| Links |
| 8 | Kapsoort | keuzelijst | 1 \| Schuin Rolvorm 45°<br>2 \| Rond Rolvorm | 1 \| Schuin Rolvorm 45° |
| 9 | Type Bediening | keuzelijst | 9 \| RS 100 IO Solar<br>4 \| RS 100 IO<br>1 \| Ilmo WT<br>2 \| Oximo IO<br>5 \| LT 50 Motor<br>8 \| Hand Bediening<br>7 \| Solar Motor Brel<br>xxx \| Zonder motor | 9 \| RS 100 IO Solar |
| 10 | Bed. optie 1 | keuzelijst | B01 \| Solarpaneel Links gemonteerd *<br>B02 \| Solarpaneel los geleverd | B01 \| Solarpaneel Links gemonteerd * |
| 11 | Bed. optie 3 | keuzelijst | 654-Pure \| SITUO 1 Pure IO Handzender *<br>1660 \| AMY 1-kanaals IO Wandzender<br>1661 \| AMY 1-kanaals RS100 IO Wandzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>655-Pure \| SITUO 5 Pure IO Handzender<br>661 \| SMOOVE RS100 IO Wandzender<br>Y02 \| Situo 5 op kanaal .. | 654-Pure \| SITUO 1 Pure IO Handzender * |
| 12 | Kapmaat | keuzelijst | 16 \| 165<br>18 \| 180<br>20 \| 205 | 16 \| 165 |
| 13 | Kleur kap | keuzelijst | 13 keuzes, zie lijst **L19** in het lijstenbestand | 53 \| R53 Antraciet |
| 14 | Kleur lamellen | keuzelijst | 53 \| R53 Antraciet *<br>71 \| R71 Cremewit<br>86 \| R86 Ral 9010<br>66 \| R66 Kwartsgrijs<br>44 \| R44 Ral 9005<br>20 \| R20 Naturel<br>10 \| R10 Ral 9007<br>70 \| R70 DB703<br>49 \| R49 Dennengroen<br>72 \| R72 Ral 7021 | 53 \| R53 Antraciet * |
| 15 | Kleur onderlijst | keuzelijst | 13 keuzes, zie lijst **L20** in het lijstenbestand | 53 \| R53 Antraciet * |
| 16 | Kleur geleiders | keuzelijst | 13 keuzes, zie lijst **L20** in het lijstenbestand | 53 \| R53 Antraciet * |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 9 \| RS 100 IO Solar)

- **4 \| RS 100 IO** → *Bed. optie 1* wordt: 819 \| 05 m. RS 100 wit * / 820 \| 10 m. RS 100 wit; nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 03 \| KABEL DOOR DE POOT / 04 \| ABL [9] (Achter - Boven Links) / 06 \| VBL [9] (Voor - Boven LInks) / 08 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren / 10 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren / 12 \| ZBVL (Zijkant Boven Voor Links) / 14 \| ZOVL (Zijkant Onder Voor Links) / 16 \| ZBAL (Zijkant Boven Achter Links) / 18 \| ZOAL (Zijkant Onder Achter Links); *Bed. optie 3* wordt: Y01 \| zonder-schakelaar * / 654-Pure \| SITUO 1 Pure IO Handzender / 1660 \| AMY 1-kanaals IO Wandzender / 1661 \| AMY 1-kanaals RS100 IO Wandzender / 1663 \| AMY 4-kanaals Mode IO Wandzender / 655-Pure \| SITUO 5 Pure IO Handzender / 661 \| SMOOVE RS100 IO Wandzender; *Kapmaat* wordt: 15 \| 150 / 16 \| 165 / 18 \| 180 / 20 \| 205; vaste waarde *Bedieningen* wordt 063 \| RS100 IO 15/17
- **1 \| Ilmo WT** → *Bed. optie 1* wordt: 810 \| 03 m. LT wit * / 802 \| Hirschmannsteker motordeel LT of WT / 811 \| 05 m. LT wit / 812 \| 10 m. LT wit / 825 \| 03 m. LT zwart / 826 \| 05 m. LT zwart / 827 \| 10 m. LT zwart; nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 03 \| KABEL DOOR DE POOT / 04 \| ABL [9] (Achter - Boven Links) / 06 \| VBL [9] (Voor - Boven LInks) / 08 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren / 10 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren / 12 \| ZBVL (Zijkant Boven Voor Links) / 14 \| ZOVL (Zijkant Onder Voor Links) / 16 \| ZBAL (Zijkant Boven Achter Links) / 18 \| ZOAL (Zijkant Onder Achter Links); *Bed. optie 3* wordt: 1 \| schakelaar opbouw / 2 \| schakelaar inbouw / Y01 \| zonder-schakelaar; *Kapmaat* wordt: 15 \| 150 / 16 \| 165 / 18 \| 180 / 20 \| 205; vaste waarde *Bedieningen* wordt 003 \| Ilmo WT 15/17
- **2 \| Oximo IO** → *Bed. optie 1* wordt: 814 \| 05 m. IO wit * / 804 \| Hirschmannsteker motordeel IO / 815 \| 10 m. IO wit / 835 \| 03 m. IO zwart / 836 \| 05 m. IO zwart / 837 \| 10 m. IO zwart; nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 03 \| KABEL DOOR DE POOT / 04 \| ABL [9] (Achter - Boven Links) / 06 \| VBL [9] (Voor - Boven LInks) / 08 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren / 10 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren / 12 \| ZBVL (Zijkant Boven Voor Links) / 14 \| ZOVL (Zijkant Onder Voor Links) / 16 \| ZBAL (Zijkant Boven Achter Links) / 18 \| ZOAL (Zijkant Onder Achter Links); *Bed. optie 3* wordt: Y01 \| zonder-schakelaar * / 654-Pure \| SITUO 1 Pure IO Handzender / 1660 \| AMY 1-kanaals IO Wandzender / 1661 \| AMY 1-kanaals RS100 IO Wandzender / 1663 \| AMY 4-kanaals Mode IO Wandzender / 655-Pure \| SITUO 5 Pure IO Handzender / 661 \| SMOOVE RS100 IO Wandzender; *Kapmaat* wordt: 15 \| 150 / 16 \| 165 / 18 \| 180 / 20 \| 205; vaste waarde *Bedieningen* wordt 053 \| Oximo IO 15/17
- **5 \| LT 50 Motor** → nieuw veld *Bedieningen*: 503 \| Atlas 15/17 Somfy LT / 953 \| Atlas 15/12; *Bed. optie 1* wordt: 810 \| 03 m. LT wit * / 802 \| Hirschmannsteker motordeel LT of WT / 811 \| 05 m. LT wit / 812 \| 10 m. LT wit / 825 \| 03 m. LT zwart / 826 \| 05 m. LT zwart / 827 \| 10 m. LT zwart; nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 03 \| KABEL DOOR DE POOT / 04 \| ABL [9] (Achter - Boven Links) / 06 \| VBL [9] (Voor - Boven LInks) / 08 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren / 10 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren / 12 \| ZBVL (Zijkant Boven Voor Links) / 14 \| ZOVL (Zijkant Onder Voor Links) / 16 \| ZBAL (Zijkant Boven Achter Links) / 18 \| ZOAL (Zijkant Onder Achter Links); *Bed. optie 3* wordt: 1 \| schakelaar opbouw / 2 \| schakelaar inbouw / Y01 \| zonder-schakelaar; *Kapmaat* wordt: 15 \| 150 / 16 \| 165 / 18 \| 180 / 20 \| 205
- **8 \| Hand Bediening** → nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 06 \| VBL [9] (Voor - Boven LInks); *Bed. optie 3* wordt: 5 \| Bandopwinder groot / 99 \| Zonder band- / koordopwinder; *Kapmaat* wordt: 15 \| 150 / 16 \| 165 / 18 \| 180 / 20 \| 205; vervalt: *Bed. optie 1*; vaste waarde *Bedieningen* wordt 02 \| Bandvertrager 1 : 2 9 Nm
- **7 \| Solar Motor Brel** → *Bed. optie 3* wordt: 1701 \| Brel 1-kanaals Handzender * / 1770 \| Brel 1-kanaals Wandzender; *Kapmaat* wordt: 15 \| 150 / 16 \| 165 / 18 \| 180 / 20 \| 205; vaste waarde *Bedieningen* wordt 1874 \| Solar Brel 45 motor 20 Nm
- **xxx \| Zonder motor** → nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 03 \| KABEL DOOR DE POOT / 04 \| ABL [9] (Achter - Boven Links) / 06 \| VBL [9] (Voor - Boven LInks) / 08 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren / 10 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren / 12 \| ZBVL (Zijkant Boven Voor Links) / 14 \| ZOVL (Zijkant Onder Voor Links) / 16 \| ZBAL (Zijkant Boven Achter Links) / 18 \| ZOAL (Zijkant Onder Achter Links); *Kapmaat* wordt: 15 \| 150 / 16 \| 165 / 18 \| 180 / 20 \| 205; vervalt: *Bed. optie 1*, *Bed. optie 3*; vaste waarde *Bedieningen* wordt xxx \| Geen

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Uitvoering (2), Geleider links (8), Geleider rechts (8), Geleiders voorboren (2), Bedieningskant (2), Kapsoort (2), Bed. optie 1 (2), Bed. optie 3 (7), Kapmaat (3), Kleur kap (13), Kleur lamellen (10), Kleur onderlijst (13), Kleur geleiders (13)

### Rolluik S-42

Breedtebereik: **363 – 4000 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *Soort lamellen* = 9 \| RS42, *Montage* = 1 \| gewoon, *Soort onderlijst* = 4 \| 60 mm Hoog Met Rubber RS42, *Bedieningen* = 167 \| RS 100 IO SOLAR 15/12, *Garantie* = 99 \| Standaard

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Uitvoering | keuzelijst | 1 \| Rolluik<br>3 \| Rolluik gekoppeld | 1 \| Rolluik |
| 2 | Breedte (MM) | getal | 363 – 4.000 mm | 3000 |
| 3 | Hoogte (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | 2000 |
| 4 | Geleider links | keuzelijst | 503 \| A3 HTF<br>575 \| DB HTF BASIS + DEKSEL<br>514 \| A4 LHTF<br>505 \| A5 HF<br>516 \| A6 LHF<br>812 \| A8-12 F-HTF<br>820 \| A8-20 F-HTF<br>513 \| A13 HTF (68 mm) | 503 \| A3 HTF |
| 5 | Geleider rechts | keuzelijst | 503 \| A3 HTF *<br>514 \| A4 LHTF<br>505 \| A5 HF<br>516 \| A6 LHF<br>812 \| A8-12 F-HTF<br>820 \| A8-20 F-HTF<br>513 \| A13 HTF (68 mm)<br>575 \| DB HTF BASIS + DEKSEL | 503 \| A3 HTF * |
| 6 | Geleiders voorboren | keuzelijst | xxx \| NVT *<br>01 \| Geleiders voorboren | xxx \| NVT * |
| 7 | Bedieningskant | keuzelijst | 2 \| Links<br>1 \| Rechts | 2 \| Links |
| 8 | Kapsoort | keuzelijst | 1 \| Schuin Rolvorm 45°<br>2 \| Rond Rolvorm | 1 \| Schuin Rolvorm 45° |
| 9 | Type Bediening | keuzelijst | 9 \| RS 100 IO Solar<br>4 \| RS 100 IO<br>1 \| Ilmo WT<br>2 \| Oximo IO<br>5 \| LT 50 Motor<br>8 \| Hand Bediening<br>7 \| Solar Motor Brel<br>xxx \| Zonder motor | 9 \| RS 100 IO Solar |
| 10 | Bed. optie 1 | keuzelijst | B01 \| Solarpaneel Links gemonteerd *<br>B02 \| Solarpaneel los geleverd | B01 \| Solarpaneel Links gemonteerd * |
| 11 | Bed. optie 3 | keuzelijst | 654-Pure \| SITUO 1 Pure IO Handzender *<br>1660 \| AMY 1-kanaals IO Wandzender<br>1661 \| AMY 1-kanaals RS100 IO Wandzender<br>1663 \| AMY 4-kanaals Mode IO Wandzender<br>655-Pure \| SITUO 5 Pure IO Handzender<br>661 \| SMOOVE RS100 IO Wandzender<br>Y02 \| Situo 5 op kanaal .. | 654-Pure \| SITUO 1 Pure IO Handzender * |
| 12 | Kapmaat | keuzelijst | 18 \| 180<br>20 \| 205 | 18 \| 180 |
| 13 | Kleur kap | keuzelijst | 13 keuzes, zie lijst **L19** in het lijstenbestand | 53 \| R53 Antraciet |
| 14 | Kleur lamellen | keuzelijst | 53 \| R53 Antraciet *<br>71 \| R71 Cremewit<br>86 \| R86 Ral 9010<br>66 \| R66 Kwartsgrijs<br>44 \| R44 Ral 9005<br>20 \| R20 Naturel<br>10 \| R10 Ral 9007<br>70 \| R70 DB703<br>49 \| R49 Dennengroen<br>72 \| R72 Ral 7021 | 53 \| R53 Antraciet * |
| 15 | Kleur onderlijst | keuzelijst | 13 keuzes, zie lijst **L20** in het lijstenbestand | 53 \| R53 Antraciet * |
| 16 | Kleur geleiders | keuzelijst | 13 keuzes, zie lijst **L20** in het lijstenbestand | 53 \| R53 Antraciet * |

**Varianten: wat verandert er in de vervolgvelden bij een andere keuze**

*Type Bediening* (basis: 9 \| RS 100 IO Solar)

- **4 \| RS 100 IO** → *Bed. optie 1* wordt: 819 \| 05 m. RS 100 wit * / 820 \| 10 m. RS 100 wit; nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 03 \| KABEL DOOR DE POOT / 04 \| ABL [9] (Achter - Boven Links) / 06 \| VBL [9] (Voor - Boven LInks) / 08 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren / 10 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren / 12 \| ZBVL (Zijkant Boven Voor Links) / 14 \| ZOVL (Zijkant Onder Voor Links) / 16 \| ZBAL (Zijkant Boven Achter Links) / 18 \| ZOAL (Zijkant Onder Achter Links); *Bed. optie 3* wordt: Y01 \| zonder-schakelaar * / 654-Pure \| SITUO 1 Pure IO Handzender / 1660 \| AMY 1-kanaals IO Wandzender / 1661 \| AMY 1-kanaals RS100 IO Wandzender / 1663 \| AMY 4-kanaals Mode IO Wandzender / 655-Pure \| SITUO 5 Pure IO Handzender / 661 \| SMOOVE RS100 IO Wandzender; vaste waarde *Bedieningen* wordt 063 \| RS100 IO 15/17
- **1 \| Ilmo WT** → *Bed. optie 1* wordt: 810 \| 03 m. LT wit * / 802 \| Hirschmannsteker motordeel LT of WT / 811 \| 05 m. LT wit / 812 \| 10 m. LT wit / 825 \| 03 m. LT zwart / 826 \| 05 m. LT zwart / 827 \| 10 m. LT zwart; nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 03 \| KABEL DOOR DE POOT / 04 \| ABL [9] (Achter - Boven Links) / 06 \| VBL [9] (Voor - Boven LInks) / 08 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren / 10 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren / 12 \| ZBVL (Zijkant Boven Voor Links) / 14 \| ZOVL (Zijkant Onder Voor Links) / 16 \| ZBAL (Zijkant Boven Achter Links) / 18 \| ZOAL (Zijkant Onder Achter Links); *Bed. optie 3* wordt: 1 \| schakelaar opbouw / 2 \| schakelaar inbouw / Y01 \| zonder-schakelaar; vaste waarde *Bedieningen* wordt 003 \| Ilmo WT 15/17
- **2 \| Oximo IO** → *Bed. optie 1* wordt: 814 \| 05 m. IO wit * / 804 \| Hirschmannsteker motordeel IO / 815 \| 10 m. IO wit / 835 \| 03 m. IO zwart / 836 \| 05 m. IO zwart / 837 \| 10 m. IO zwart; nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 03 \| KABEL DOOR DE POOT / 04 \| ABL [9] (Achter - Boven Links) / 06 \| VBL [9] (Voor - Boven LInks) / 08 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren / 10 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren / 12 \| ZBVL (Zijkant Boven Voor Links) / 14 \| ZOVL (Zijkant Onder Voor Links) / 16 \| ZBAL (Zijkant Boven Achter Links) / 18 \| ZOAL (Zijkant Onder Achter Links); *Bed. optie 3* wordt: Y01 \| zonder-schakelaar * / 654-Pure \| SITUO 1 Pure IO Handzender / 1660 \| AMY 1-kanaals IO Wandzender / 1661 \| AMY 1-kanaals RS100 IO Wandzender / 1663 \| AMY 4-kanaals Mode IO Wandzender / 655-Pure \| SITUO 5 Pure IO Handzender / 661 \| SMOOVE RS100 IO Wandzender; vaste waarde *Bedieningen* wordt 053 \| Oximo IO 15/17
- **5 \| LT 50 Motor** → nieuw veld *Bedieningen*: 503 \| Atlas 15/17 Somfy LT / 953 \| Atlas 15/12; *Bed. optie 1* wordt: 810 \| 03 m. LT wit * / 802 \| Hirschmannsteker motordeel LT of WT / 811 \| 05 m. LT wit / 812 \| 10 m. LT wit / 825 \| 03 m. LT zwart / 826 \| 05 m. LT zwart / 827 \| 10 m. LT zwart; nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 03 \| KABEL DOOR DE POOT / 04 \| ABL [9] (Achter - Boven Links) / 06 \| VBL [9] (Voor - Boven LInks) / 08 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren / 10 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren / 12 \| ZBVL (Zijkant Boven Voor Links) / 14 \| ZOVL (Zijkant Onder Voor Links) / 16 \| ZBAL (Zijkant Boven Achter Links) / 18 \| ZOAL (Zijkant Onder Achter Links); *Bed. optie 3* wordt: 1 \| schakelaar opbouw / 2 \| schakelaar inbouw / Y01 \| zonder-schakelaar
- **8 \| Hand Bediening** → nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 06 \| VBL [9] (Voor - Boven LInks); *Bed. optie 3* wordt: 5 \| Bandopwinder groot / 99 \| Zonder band- / koordopwinder; vervalt: *Bed. optie 1*; vaste waarde *Bedieningen* wordt 02 \| Bandvertrager 1 : 2 9 Nm
- **7 \| Solar Motor Brel** → *Bed. optie 3* wordt: 1701 \| Brel 1-kanaals Handzender * / 1770 \| Brel 1-kanaals Wandzender; vaste waarde *Bedieningen* wordt 1874 \| Solar Brel 45 motor 20 Nm
- **xxx \| Zonder motor** → nieuw veld *Bed. optie 2*: 01 \| AOL [9] (Standaard Links) / 03 \| KABEL DOOR DE POOT / 04 \| ABL [9] (Achter - Boven Links) / 06 \| VBL [9] (Voor - Boven LInks) / 08 \| BVL [9] (Boven - Voor Links) geen garantie ivm inwateren / 10 \| BAL [9] (Boven - Achter Links) geen garantie ivm inwateren / 12 \| ZBVL (Zijkant Boven Voor Links) / 14 \| ZOVL (Zijkant Onder Voor Links) / 16 \| ZBAL (Zijkant Boven Achter Links) / 18 \| ZOAL (Zijkant Onder Achter Links); vervalt: *Bed. optie 1*, *Bed. optie 3*; vaste waarde *Bedieningen* wordt xxx \| Geen

Dekking varianten: doorlopen voor *Type Bediening*. Niet apart doorlopen (alleen eerste keuze): Uitvoering (2), Geleider links (8), Geleider rechts (8), Geleiders voorboren (2), Bedieningskant (2), Kapsoort (2), Bed. optie 1 (2), Bed. optie 3 (7), Kapmaat (2), Kleur kap (13), Kleur lamellen (10), Kleur onderlijst (13), Kleur geleiders (13)

### Rolluik los pantser

Breedtebereik: **562 – 4000 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *Soort lamellen* = 9 \| RS42, *Montage* = 1 \| gewoon, *Soort onderlijst* = 4 \| 60 mm Hoog Met Rubber RS42, *Type Bediening* = xxx \| Zonder motor, *Bedieningen* = xxx \| Geen, *Bed. optie 1* = XXX \| Geen, *Bed. optie 3* = xxx \| NVT, *Kapmaat* = 10 \| Zonder Kap, *Kleur kap* = xxx \| NVT, *Kleur geleiders* = xxx \| NVT, *Garantie* = 99 \| Standaard

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Soort uitvoering | keuzelijst | 01 \| Rolluik S-42<br>02 \| Rolluik S-37 | 01 \| Rolluik S-42 |
| 2 | Uitvoering | keuzelijst | 2 \| Los Pantser (Rolluikmaat) ⚠ Info Let op : LET OP ROLLUIKMATEN INVULLEN GEEN PANTSERMAAT !! OOK GELEIDERTYPE INVOEREN !! | 2 \| Los Pantser (Rolluikmaat) |
| 3 | Breedte (MM) | getal | 562 – 4.000 mm | 3000 |
| 4 | Hoogte (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | 2000 |
| 5 | Geleider links | keuzelijst | 821 \| HTF / LHTF *<br>822 \| HF / LHF | 821 \| HTF / LHTF * |
| 6 | Geleider rechts | keuzelijst | 821 \| HTF / LHTF *<br>822 \| HF / LHF | 821 \| HTF / LHTF * |
| 7 | Kleur lamellen | keuzelijst | 53 \| R53 Antraciet<br>71 \| R71 Cremewit<br>86 \| R86 Ral 9010<br>66 \| R66 Kwartsgrijs<br>44 \| R44 Ral 9005<br>20 \| R20 Naturel<br>10 \| R10 Ral 9007<br>70 \| R70 DB703<br>49 \| R49 Dennengroen<br>72 \| R72 Ral 7021 | 53 \| R53 Antraciet |
| 8 | Kleur onderlijst | keuzelijst | 13 keuzes, zie lijst **L20** in het lijstenbestand | 53 \| R53 Antraciet * |

### Geconfectioneerd Doek

Breedtebereik: **50 – 9300 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *Uitval/Arm* = xxx \| NVT, *Bed. optie 3* = xxx \| NVT, *Garantie* = xxx \| NVT, *Sunmaster Sticker* = 01 \| Ja

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | scherm model | keuzelijst | Y01 \| Geconfectioneerd Uitvaldoek in banen<br>Y02 \| Geconfectioneerd Uitvaldoek Naadloos<br>Y03 \| Volant in banen Grote Golf<br>Y04 \| Volant in banen Recht Model<br>Y05 \| Volant in banen Kleine Golf<br>Y06 \| Geconfectioneerd Uitvaldoek in banen met klikpees bovenlangs<br>Y07 \| Geconfectioneerd Uitvaldoek in banen met klikpees onderlangs | Y01 \| Geconfectioneerd Uitvaldoek in banen |
| 2 | Breedte (MM) | getal | 50 – 9.300 mm | 3000 |
| 3 | Uitval (MM) | getal | 100 – 4.200 mm | 2000 |
| 4 | Doeklengte (uitvalricht.) (MM) | getal | vrije invoer (mm), geen directe grenscontrole gezien | (automatisch berekend / leeg) |
| 5 | Kleur code doek | keuzelijst | 390 keuzes (unie van 3 runs: std 390, basis 390, recheck3 390), zie lijst **L1** in het lijstenbestand | 0001 \| WIT (T100) |

### Geconfectioneerd Screendoek

Breedtebereik: **200 – 6000 mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte 3000).

Vaste waarden (niet te kiezen): *Montage* = xxx \| NVT, *Bed. optie 1* = xxx \| NVT, *Kleur kap* = xxx \| NVT, *Kleur geleider* = xxx \| NVT, *Kleur onderlijst* = xxx \| NVT, *doek kantelen* = 1 \| Nee, *Rol breedte* = 2205 \| 2200, *Garantie* = xxx \| NVT

| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |
|---|------|------|-----------------|----------------------|
| 1 | Type screen | keuzelijst | 90001 \| Doek zoom boven en onder<br>90002 \| Doek Zip zoom boven en onder<br>90011 \| Doek klikpees boven en zoom onder<br>90012 \| Doek Zip klikpees boven en zoom onder<br>90067 \| Doek zoom 27 mm onder\| Rits boven<br>90070 \| Doek lasband rondom<br>90071 \| Doek zoom rondom | 90001 \| Doek zoom boven en onder |
| 2 | Breedte (MM) | getal | 200 – 6.000 mm | 3000 |
| 3 | Hoogte (MM) | getal | 175 – 5.500 mm | 2000 |
| 4 | Kleur code doek | keuzelijst | 76 keuzes (unie van 2 runs: std 76, recheck3 76), zie lijst **L9** in het lijstenbestand | 001004 \| Serge Grijs-Oranje |
| 5 | Kleurcode 2 | keuzelijst | 01 \| Standaard *<br>02 \| Grijze zijde buiten | 01 \| Standaard * |
| 6 | Lasband | keuzelijst | 2 \| Zonder lasband *<br>1 \| Met lasband | 2 \| Zonder lasband * |
