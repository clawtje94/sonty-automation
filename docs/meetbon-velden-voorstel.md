# Meetbon-velden per producttype (voorstel)

Doel: de inmeter vult in Planado per product een meetbon in waarvan de velden 1-op-1
aansluiten op het bestelformulier van de leverancier. De besteller kan dan direct
bestellen zonder terugbelronde, en op termijn kunnen we het formulier zelfs
automatisch voorvullen. Bronnen: de 6 aangeleverde bestelformulieren (Unilux PHD,
Unilux Rolhor 2.0, Unilux Vaste Raamhor, RollBasic, ZipScreens Solar, Uitvalschermen).
ROMA gebruikt dezelfde logica als Sunmaster (Daimy 31-07). Velden met [CHECK] zijn
aannames buiten de formulieren om en moeten door Daimy/het team bevestigd worden.

## Algemeen blok (elke meetbon, 1x per inmeet-job)
- Gripp-nummer + klantnaam (automatisch uit de job, niet handmatig)
- Afwijking t.o.v. de offerte? ja/nee + toelichting (ander product, andere maat,
  extra werk). Dit veld triggert een melding zodat de offerte wordt aangepast VOOR er besteld wordt.
- Elektra: aanwezig / aan te leggen door Sonty / aan te leggen door klant / n.v.t.
- Ondergrond en montagevlak: steen / hout / kunststof / beton / anders + boorbaar ja/nee
- Bereikbaarheid: trap / ladder / steiger of hoogwerker nodig
- Foto's verplicht: totaalbeeld gevel of raam, detail montagevlak, obstakels
- Opmerkingen voor de besteller en opmerkingen voor de monteur (twee aparte velden)

## Per product een regel/blok met een producttype-keuze, daarna de velden van dat type

### 1. Plisséhordeur (Unilux PHD / PlisséFIT)
- Aantal
- Breedte mm en hoogte mm (dagmaat)
- Enkel of dubbel (formulier kent maatgrenzen 1100 / 1450 / 1800; boven de grens dubbel) [CHECK grenswaarden]
- Plaatsing: links / rechts
- Montage: in de dag / op de dag
- Borstel: in / op
- Kunststof strip: S1 standaard / V2 schuine dorpel / A3 asymmetrisch (ODD-plaatsing)
- Kleur strip: grijs / zwart
- AluStrip: S1 / V2
- Hoeklijn: ja/nee; Tussenstop: ja/nee
- RAL: 9001 / 9010 / 7016 STR / 9006 / 9005 STR standaard, anders afwijkend RAL (meerprijs)
- Foto verplicht: onderdorpel (bepaalt stripkeuze bij schuine of oneffen dorpel)

### 2. Rolhor (Unilux Rolhor Super+ / 2.0)
- Aantal, breedte mm, hoogte mm
- Montage: IDD (in de dag) / ODD (op de dag)
- Bedieningslijst: normaal / contra
- RAL: 9001 / 9010 / 7016 STR / 9006 / 9005 STR standaard, anders afwijkend
- Referentie (welk raam of deur), bijzonderheden
- Foto: kozijn met zichtbare inbouwdiepte bij IDD

### 3. Vaste raamhor / inklemhor (Unilux)
- Aantal, breedte mm, hoogte mm
- Type: vast / inklem
- Houten kozijn: ja/nee
- Alu onderstrip: ja/nee
- RAL: 9001 / 9010 / 7016 STR / 9006 / 9005 STR / 8019 / 6009 / 5011 / 9016 standaard, anders afwijkend
- Referentie, opmerkingen
- Foto: kozijn (bij inklem: draairichting raam zichtbaar) [CHECK: inklem alleen bij naar binnen draaiend raam?]

### 4. Rolluik (RollBasic / RollBasic XS; ROMA rolluiken zelfde velden)
- Positie/referentie per stuk (zoals A t/m F op het formulier)
- Aantal, breedte mm, hoogte mm [CHECK meetwijze: dagmaat, en of kast binnen of buiten de hoogte valt]
- Type: RollBasic / RollBasic XS
- Kastuitvoering: 45 graden afgeschuind / rond
- Kastkleur, lamelkleur (pantser), zijgeleidertype + kleur, hoekprofiel
- Bediening: type (elektrisch / solar / anders) + zijde links/rechts
- Let op uit formulier: RS 100 io Solar wordt 1 kastmaat groter (externe batterij)
- Elektrisch: kabeluitvoer door achterkap (standaard) / door poot
- Foto's: bovenzijde kozijn (ruimte voor kast), beide zijden (geleiders), elektra-punt

### 5. Zipscreen (Sunmaster zip en solar-variant; ROMA zipQUADRO zelfde velden)
- Positie/referentie, aantal, breedte mm, hoogte mm
- Type kast (let op uit formulier: Zip Design 105 niet bestelbaar in TNA)
- Kastkleur, doekkleur
- Zijgeleiding: LHTF profiel / ZIP geleider / deelbare ZIPgeleider (niet in TNA) / verandageleider in de dag
- Bediening: zijde ALTIJD van buitenaf gezien (staat letterlijk op het formulier), links/rechts
- Solar-uitvoering: solar paneel + solar oplader; anders elektrisch (motorsnoer 2,5 m standaard)
- Extra verlengkabel per 50 cm: aantal
- Extra wandmontagebeugels: ja + aantal / nee
- Foto's: gevel totaal, montagevlak boven, beide zijden, elektra-punt

### 6. Uitvalscherm (SunCube 150 / SunProject 100)
- Type: SunCube 150 / SunProject 100
- Armtype: windvaste veerarmen (standaard) / windvaste gasveerarmen / balkonuitvoering
- Per scherm: breedte mm, uitval mm, aantal, bedieningszijde links/rechts
- Gekoppelde uitvoering: deelmaten van links naar rechts (deel 1 / 2 / 3)
- Bediening: staaldraad windwerk / draaistangbediening buiten / draaistangbediening binnen /
  elektrisch / Brel Solar (formulier: niet mogelijk bij gekoppelde uitvoering)
- Type motor: Somfy LT (alleen SunProject) / Orea WT (alleen SunCube) / Sunea IO
- Plaats van buiten gezien: naar binnen / naar buiten
- Kastkleur: RAL 9001 / 7016 structuur / TNA / 7016 / 9007 structuur / 9005 structuur /
  DB 703 structuur / 9010 structuur / 7021 structuur / afwijkend RAL
- Doekkleur (code), doekbreedte mm, doorval ja/nee
- Foto's: gevel, montagevlak, zijaanzicht (uitval-ruimte)

### 7. Knikarmscherm, SunEye en pergola (Sunmaster; ROMA zelfde logica)
Geen formulier aangeleverd; velden gebaseerd op onze configurator- en V4-kennis, [CHECK] tegen
het Sunmaster-portaal in de testfase:
- Type (knikarm / SunEye / SunEye XL / pergola), breedte mm (+ deelmaten bij gekoppeld), uitval mm
- Montage: muur / dak / plafond, montagehoogte onderzijde
- Bediening: afstandsbediening / solar / draaischakelaar + zijde
- Framekleur/kastkleur, doekkleur, volant ja/nee + tekst
- Windsensor / zonsensor ja/nee, elektra-punt
- Foto's: gevel breed, montagevlak, obstakels (dakgoot, lampen, kraan)

### 8. Binnenzonwering en gordijnen (Toppoint en gordijnenleverancier)
Geen formulier beschikbaar; onderstaand is een startvoorstel [CHECK]: graag de echte
bestelformulieren of portaal-velden aanleveren, dan maak ik dit net zo exact als 1 t/m 6:
- Per raam: producttype (rolgordijn / duo / plissé / jaloezie / lamellen / gordijn / vitrage)
- Breedte mm, hoogte mm, in de dag / op de dag, montage: wand / plafond / in kozijn
- Bediening: zijde + kettinglengte / handgreep / elektrisch
- Stof of kleur + collectienummer, transparantie
- Gordijnen: railtype of roede, plooisoort, zoomhoogte, wasbaar [CHECK]
- Obstakels: radiator, vensterbank, kraan, deurklink
- Foto per raam

### 9. Nog niet gedekt (formulieren of instructies nodig)
Deze producten bestellen we ook (ze zitten in de planning-daemon als leverancier) maar
hiervoor is geen formulier aangeleverd, dus hiervoor kan ik nog geen exacte velden maken:
- Markiezen (Markiezen Nederland): vermoedelijk breedte, hoogte klep, uitval, kap ja/nee,
  doek, frame-kleur, montage [CHECK, formulier nodig]
- Velux dakramen en dakraam-zonwering: raamcode staat op het typeplaatje van het raam
  (bv. SK08); veld: typeplaatje-code + foto typeplaatje [CHECK]
- Arte behang: aantal m2 of banen, wandmaten per wand [CHECK, alleen als we dit inmeten]

## Meetprincipe
De meetbon legt DAGMATEN en de montagesituatie vast (wat de inmeter ziet en meet).
De omrekening naar bestelmaat (aftrekmaten per leverancier en montagewijze) is een
vaste regel per leverancier en hoort bij de besteller of later in de automatisering,
niet bij de inmeter. Zo meet iedereen hetzelfde en zit de leverancierslogica op 1 plek.

## Werking van de flow (na akkoord op de velden)
1. Inmeet-job in Planado bevat de meetbon; verplichte velden per gekozen producttype.
2. Inmeter rondt af; job kan niet af zonder complete bon.
3. Webhook job afgerond -> rapportdata ophalen -> nette Sonty-meetbon (PDF) genereren
   met veldnamen die het leveranciersformulier volgen -> automatisch naar de besteller (V1 open:
   orders@, persoon of bestel-sheet) met Gripp-nummer.
4. Afwijking-t.o.v.-offerte ingevuld -> aparte melding, bestellen wacht tot dat is beoordeeld.
5. Fouten of onvolledig: Telegram-melding, nooit stil falen.
