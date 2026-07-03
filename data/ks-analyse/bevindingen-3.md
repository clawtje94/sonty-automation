## Telling
- totaal_gelezen: 195
- intents (één gesprek kan meerdere hebben):
  - productvraag: 58
  - service_reparatie_garantie: 27
  - offerte_aanpassen_of_nieuwe_offerte: 28
  - prijsvraag_of_korting: 26
  - te_duur_bezwaar: 24
  - overig: 24 (incl. buiten werkgebied 7x, spam/vendor-pitches ~8x)
  - inmeet_afspraak_plannen: 38
  - status_levering_montage: 16
  - akkoord_geven: 10
  - planning_verzetten: 9
  - showroom: 7
  - factuur_betaling: 1 (het merendeel van "factuur"-achtige mail was een phishing-aanmaning, geen echte klant)
- sonty_stelde_inmeet_voor: 22 (16x via het vaste WA-sluitbericht "Bij akkoord komen we..." na het versturen van de prijsindicatie, ~6x organisch doordat een medewerker zelf het vervolgtraject/inmeten voorstelde, bv. Shaun/Mike/Michael)
- gemiste_inmeet_kans: 11
- onbeantwoorde_gesprekken_met_koopintentie: 12 (van de 53 onbeantwoorde gesprekken totaal)

Let op: veel WA-berichten in deze dataset zijn afgeknipt door een lengtelimiet in de bron (bv. bericht 961254461 eindigt letterlijk midden in de zin op "Bij akkoord komen we"). Dit is een data-artefact van de export, niet van Sonty zelf — de vaste tekst is elders wel compleet te lezen en gaat verder met een verwijzing naar het inmeten.

## Gemiste sales-kansen (max 10, meest sprekende)
1. **961210007** (Mickey, EN) — klant vraagt expliciet of iemand thuis kan langskomen om alles te laten zien ("Can you come to our location to show us everything?"), Sonty verwijst alleen door naar de showroom, geen inmeetafspraak aangeboden of gepland.
2. **959988495** (Richard, B2B) — bestaande klant wil 2 extra screens op kantoor en vraagt expliciet: "Kan je een keer langskomen?" — gesprek is onbeantwoord.
3. **960661895** (Loic) — "I'm urgently seeking a solution to install a plissé hordeur... Could you tell me how fast you can go to install this kind of product and the price?" — onbeantwoord, terwijl klant al bestaande klant is en urgentie aangeeft.
4. **961030776** (Silvia) — "Ik ga ondertussen ook andere bedrijven benaderen want ik ben al te lang bezig met aanvragen en wil nu dat er dingen doorgepakt worden." — onbeantwoord, expliciete dreiging om elders te kopen.
5. **960305223** (naam onbekend) — klant geeft gedetailleerde, serieuze reactie op offerte (maten, wind/watervaste cassette, leesbaarheid offerte) — onbeantwoord, ondanks duidelijke koopintentie en concrete vragen.
6. **960168190** (Sandra vd Meer) — "We twijfelen echter of het op deze constructie past en willen graag advies. Hebben jullie iemand op de weg die ons kan adviseren?" — onbeantwoord.
7. **960811654** (Nikkie Rijs) — formulier: "Graag even Bellen en informatie over een zonnescherm" — onbeantwoord.
8. **961169067** (WA, "Joey") — klant vraagt drie keer expliciet "kan iemand mij bellen?" — geen zichtbare opvolging, gesprek sluit met generiek sjabloon.
9. **960616455** (Margret) — "Ik heb niets meer gehoord op onderstaande e-mail. Is dit in behandeling of moet ik nog wat doen?" — opvolgvraag zelf ook onbeantwoord.
10. **961261943** (Joost) — reageert vanuit vakantie met extra koopintentie ("ik bedenk nu dat ik ook een screen nodig heb... als ik ga verbouwen dan doen we de zonwering ook") — onbeantwoord.

## Offerte-aanpassingsverzoeken
Concrete aanpassingen die klanten vragen:
- **Maten/afmetingen corrigeren**: 960985160 (Joanna — dakkapelraam en 1e-verdieping raam met verkeerde maten in offerte), 960548529 (John Kranendonk — scherm moet 6m breed zijn i.p.v. standaard 5m), 960123350 (Marcel Bruggers — nieuw tuinontwerp, andere breedte/diepte), 960798309 (Ron — 10cm extra naar voren i.v.m. regenafvoer, onbeantwoord).
- **Product wisselen** (rolluik ↔ screen, markies ↔ screen): 960334157 (Sander — rolluiken vervangen door screens, 2 offertes samenvoegen), 960922505 (Joram — markies vervangen door screen omdat COA geen vergoeding geeft voor markiezen, onbeantwoord), 961264391 (Vivian — Sonty stelt zelf goedkoper alternatief SunBasic voor, klant haakt alsnog af).
- **Bediening/motor wijzigen**: 953347639 (kleur/bediening + vraag waarom 50% duurder door SunEyeXL 3-buis-systeem bij grote breedte/uitval), 960491028 (Marcel Kleijn — solar i.p.v. bedraad omdat kabels niet netjes weg te werken zijn), 959757565 (Wim — Tahoma Switch-koppeling niet mogelijk bij Carré-schermen, alleen Brel-motor mogelijk, dus alternatief voorgesteld).
- **Kleur wijzigen**: 957932740 (Arjen — RAL 9010 i.p.v. standaardkleur, geen meerprijs).
- **Extra producten toevoegen**: 956682208 (Frank — hordeur van €576 toevoegen aan bestaande offerte), 958065604 (Heiko — 3x Velux-rolluik + 1x kleiner raam toevoegen), 960875560 (Mathijs — 4-stuks VS4 Duo Plissé met specifieke glasmaten i.p.v. eerdere versie), 960214100 (Peter — 3 zonsensoren + 3 groepsafstandsbedieningen toevoegen), 959885934 (Nick de Ruiter — vraag of rolluik echt schuin moet zijn, wil dit telefonisch bespreken).
- **Aantal ramen**: 960497822 (Meriel — offerte was voor 1 raam, moet voor 2 ramen; Sonty bevestigt verdubbeling), 961173457 (Jeanette — 2 dakkapellen i.p.v. 1, bevestigt verdubbeling + legt motor/montagekosten-verwarring uit als "foutje in ons voordeel").

**Afhandeling**: bijna altijd binnen dezelfde e-mailwisseling opgelost door de aangepaste offerte gewoon opnieuw te versturen ("Ik heb je zojuist de aangepaste offerte toegestuurd"), vaak zonder nieuwe vraag te stellen over vervolgstap (inmeten). Doorlooptijd varieert sterk: sommige nog dezelfde dag (960491028: 213 min), andere pas na 20-50 uur (960334157: 1606 min, 961173457: 1423 min) — reactiesnelheid hangt sterk af van drukte, niet van complexiteit van de wijziging.

## Veelgestelde vragen top-10
1. **"Wat is jullie levertijd?"** → "Op dit moment hebben we een levertijd tussen de 8 en 10 weken" (na inmeten en aanbetaling; bij storm/mooi weer kan dit oplopen tot 10 weken).
2. **"Ik zie online 15% korting, maar zie deze niet terug in de offerte."** → "De 15% staat wel netjes op de offerte! Op de tweede pagina." (960549711)
3. **"Waarom is een screen duurder dan een rolluik?"** → "het is gek maar screens zijn duurder als rolluiken" — zip-screens hebben het doek vastgeklemd in een soort rits (meer techniek), een niet-windvaste variant zonder zip scheelt 300-400 euro per screen maar is gevoeliger voor wind (961169443).
4. **"Ik heb voor 1 raam aangevraagd, is het bedrag voor 2 ramen dan het dubbele?"** → Ja, bevestigd (960497822, 961173457).
5. **"Hoe groot is de cassette/kastmaat?"** → Screen: 11cm hoog; rolluik: 16,5cm hoog — "deze ga je dus wel voor het raam iets zien" (960938978, 959892629).
6. **"Heeft de kleur van het doek invloed op lichtdoorlatendheid?"** → "Een kleur doek heeft geen invloed op de lichtdoorlatendheid. Wel adviseren we een donker doek te nemen, omdat dit het fijnste is om doorheen te kijken." (960569663)
7. **"Kost het inmeten iets als ik niet doorga?"** → "€75, waarvan €25 gedoneerd wordt aan het Maxima Kinderziekenhuis; dit vervalt als je met ons verder gaat." (herhaald in minstens 7 gesprekken)
8. **"Leveren jullie ook buiten [plaats X]?"** → "Helaas moeten we je laten weten dat jouw locatie buiten ons werkgebied valt." (7x, o.a. Middelburg, Brabant, diverse randgemeentes)
9. **"Kunnen jullie mijn zonwering repareren?"** → "Helaas wegens drukte doen wij niet meer aan reparaties/vervangingen. Stuur een mailtje naar info@service-nodi.nl" (16x letterlijk herhaald)
10. **"Wat is het verschil tussen screen en rolluik qua verduistering/isolatie?"** → "Screens hebben een doek van sergé 5%, wat neerkomt op een lichtdoorlatendheid van 5%... Rolluiken zijn meer lichtdicht en werken isolerender dan screens." (959892629)

## Toon en stijl van het team
WhatsApp is informeel, kort, veel emoji en uitroeptekens; e-mail (kanaal "Aanvragen") is formeler met vaste openings-/sluitzinnen. Opvallend: op WhatsApp ondertekent iedereen (Daimy, Tanya, Jorren) het vaste sluitbericht met de naam **"Jaimy"** ("Jaimy hier van Sonty 👋") — een gedeelde chatbot/merk-persona, los van wie er intern typt.

Voorbeeldzinnen (letterlijk):
1. Daimy Boot (WA): "Hi Rajelle, Jaimy hier van Sonty 👋 Leuk dat ik je mag helpen!"
2. Daimy Boot (WA, informeel/typo's): "als er nog vragen zijn let us knowww" / "genieeettennn" / "vanplan"
3. Tanya Plugge (WA): "Hi Susie, goed nieuws! We kunnen ze maandag 13 juli tussen 08.30u -09.30u bij je zijn."
4. Jorren Plugge (WA): "Wat leuk dat je een inmeetafspraak wilt! Zou je voor mij de offerte kunnen accorderen? Je zit dan nog nergens aan vast..."
5. E-mail sign-off (vast formaat): "Met vriendelijke groet, TEAM SONTY / Frijdastraat 8F 2288 EX Rijswijk | T 085 006 9681 | E aanvragen@sonty.nl... U bent van harte welkom op dinsdag t/m vrijdag van 09:00-17:00 en op zaterdag van 09:00-16:00"

Opvallend risico: één gesprek (960646835, Jan Kooreman) bevat een ongebruikelijk bot/sarcastisch antwoord: "Ben 1800 aanvragen per maand weten wij precies hoe we zaken moeten doen en denk ik als u niet akkoord bent dat we geen match zijn. Fijne dag!" — dit wijkt sterk af van de verder klantvriendelijke toon en is een voorbeeld van hoe het NIET moet.

## €75-regel en verwachtingen
De €75-regel wordt letterlijk en herhaaldelijk gecommuniceerd, bijna altijd met dezelfde formulering:
- "Mocht je na inmeten niet met ons verder gaan, dan sturen we daar een rekening voor van 75€, waarvan we 25€ doneren aan het Maxima Kinderziekenhuis. Dit doen wij, omdat niet 'zomaar' overal langs kunnen gaan wegens drukte. Uiteraard vervalt de 75€ als je met ons verder gaat." (o.a. 960929076, 961187489, 961136728, 959867853, 959282197)
- Bij een klant die zonder voorafgaande offerte direct wil laten inmeten wordt dezelfde regel proactief vermeld: "Mocht je gelijk een inmeetafspraak willen, zonder prijs van te voren [...] weet dan wel [...] sturen we daar een rekening voor van 75€" (960158500, Hein).
- Eén klant (Jan Kooreman, 960646835) kreeg de vraag expliciet voorgelegd: "Wij kunnen zeker bij u langsrijden voor advies, wel geld het als u niet akkoord gaat met de offerte dat wij €75,00,-p in rekening brengen. Gaat u hier mee akkoord?" — klant weigerde akkoord ("Nee, ga ik niet mee accoord"), waarna Sonty het contact vrij bot afsloot.
- Eén klant (958065604, Heiko) kreeg een uitzondering/geruststelling: als tijdens het inmeten blijkt dat iets (bv. een dakraam bij de zonnepanelen) niet gemonteerd kan worden, "hoef je hier niet voor te betalen, ook al staat d[it in de voorwaarden]".
- Verwachting die medewerkers scheppen: inmeten is standaard vrijblijvend qua offerte-akkoord ("je zit dan nog nergens aan vast"), maar het niet-doorgaan na een geplande afspraak kost geld tenzij het product technisch niet haalbaar blijkt. Dit wordt consequent en transparant uitgelegd, vrijwel altijd vóórdat de afspraak definitief wordt gepland.

## Rode vlaggen voor AI-autonomie
- **Schade-/aansprakelijkheidsklachten**: 960785843 (Arno Klomp — beweert schade aan dakgoten/airco-leidingen door montage; Sonty betwist dit en wijst naar "prutser"), 960893048 (Rens — verkeerde kleur vensterbank geleverd, geen werkbon ontvangen, weken vertraging). Dit vraagt juridische/feitelijke afweging, geen geautomatiseerd antwoord.
- **Kwaliteitsklachten op reeds geplaatst werk**: 959987412 (Jasper — scherm hangt scheef na 3 maanden), 960403539 (Frank van Bueren — gordijnen te lang, slepen op de grond).
- **Boze/gefrustreerde klant met dreiging**: 961030776 (Silvia — dreigt naar concurrent te gaan wegens gebrek aan opvolging), 960646835 (Jan Kooreman — discussie over €75-regel escaleert, Sonty reageert kortaf).
- **Urgente schade/storm-situaties**: 960128607 (Santosh — "zonnekap kon niet sluiten in de storm... nu half kapot", vraagt dringende hulp), 961073614 (Maurice — arm losgebroken met harde knal).
- **Complexe technische/bouwkundige afwegingen**: 960391648 (Santiago — VVE-reglement bepaalt kleur/type, moet expliciet geverifieerd worden), 960168190 (Sandra vd Meer — glas-in-lood raam met voorzetraam, twijfel of constructie het toelaat), 961173457 (Jeanette — conflict tussen rolluik-in-koof en reeds aanwezige zonnepanelen), 960140762 (Fary — risico op gevelschade bij montage tegen nieuwe uitbouw, verlengde muursteunen nodig).
- **Phishing/spam die op een echte klantvraag lijkt**: 960437597 (nepaanmaning "GGN" met dreiging van deurwaarder/beslag) — een AI-systeem moet dit herkennen en niet als klantvraag behandelen of erop reageren.
- **Reputatiegevoelige verwachtingsmismatch**: 961101302 (Els) en 960498271 (Ruth) — beiden wijzen erop dat een advertentie/eerdere communicatie een kortere levertijd beloofde (2 weken / 3 weken) dan wat in de praktijk (8-10 weken) wordt gecommuniceerd. Dit soort discrepanties tussen marketing en praktijk moet naar een mens, niet automatisch worden gladgestreken.
- **B2B/zakelijke aanvragen met andere voorwaarden**: 960985192 (Het Restauratiehuis BV), 959988495 (Litech/Inregelservice) — vragen soms om aparte facturatie/artikelvermelding die buiten het standaardproces vallen.

KLAAR: bevindingen-3.md geschreven, 195 gesprekken gelezen
productvraag: 58, service_reparatie_garantie: 27, offerte_aanpassen_of_nieuwe_offerte: 28, prijsvraag_of_korting: 26, te_duur_bezwaar: 24, overig: 24, inmeet_afspraak_plannen: 38, status_levering_montage: 16, akkoord_geven: 10, planning_verzetten: 9, showroom: 7, factuur_betaling: 1
