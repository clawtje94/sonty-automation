# Gameplan e-mailmarketing Sonty

Opgesteld 27 juli 2026. Alle cijfers zijn gemeten uit de offerte-sheet, Reuzenpanda en de
AI-klantenservice-log, niet geschat. Dit is een plan, er is nog niets gebouwd of verstuurd.

---

## 1. Waar we nu staan

Er is nog **geen** e-mailmarketing. Wat er wel is:

| Wat | Wat het doet | Waarom het geen marketing is |
|---|---|---|
| Opvolging-daemon | Stuurt 1-op-1 een follow-up na 3 tot 4,5 dagen stilte | Reageert op één gesprek, kent geen campagnes of segmenten |
| Vacaturemail | 150 per dag in batches naar 1.744 adressen | Eenmalige werving, geen terugkerende flow, geen meting |
| Trengo-mailkanalen | aanvragen@ en info@ | Klantcontactkanaal; bulk hierover zet het hele domein op spam |

Dat laatste is het belangrijkste risico van "gewoon beginnen": als sonty.nl als spam wordt
gemarkeerd, komen ook de **offertemails** niet meer aan. Dat raakt direct de omzet.

## 2. Wat we hebben om mee te werken

| Bron | Aantal | Toelichting |
|---|---|---|
| Unieke e-mailadressen in Reuzenpanda | **15.976** | uit 18.008 dossiers; 87% consumentenadres (gmail/hotmail/ziggo) |
| Offertes in 2026 (t/m 27 juli) | **10.083** | |
| Daarvan akkoord | **885** (8,8%) | dus ruim **9.100 offertes dit jaar zonder akkoord** |
| Klanten met minstens één factuur | 2.780 | bestaande klanten, geschikt voor cross-sell |
| Gemiddelde orderwaarde | € 3.969 incl btw | mediaan € 3.060 |
| Bruto marge per klant | € 1.551 | mediaan € 1.195, 47,2% van de verkoop |
| Advertentiekosten 2026 | € 368.288 | = **€ 416 per gewonnen klant** |
| Doorlooptijd tot akkoord | mediaan 24 dagen | 66% binnen 30 dagen, 93% binnen 60 dagen |

### De business case in één zin

Een offerte die na 60 dagen niets heeft gedaan is praktisch dood (93% van alle akkoorden valt
binnen 60 dagen). Er liggen dit jaar ruim 9.100 van die offertes. **Elke procent die we daarvan
alsnog binnenhalen is ongeveer 91 klanten × € 1.551 marge = € 141.000.** Via advertenties zou
diezelfde 91 klanten € 37.856 aan advertentiekosten kosten. E-mail kost bij dit volume enkele
tientjes per maand.

Dit is geen belofte dat we 1% halen; het laat zien dat de hefboom groot genoeg is om het goed te
doen in plaats van half.

## 3. De zes bouwstenen

### 3.1 Datalaag: één klantprofiel

Nu staat klantdata verspreid over Reuzenpanda (e-mail, product, offerte), de offerte-sheet
(akkoord, bedrag, marge) en Gripp (facturen). Er is geen plek waar per e-mailadres staat wat
iemand heeft aangevraagd, of hij akkoord ging en of hij klant is.

**Nodig:** één tabel per e-mailadres met minimaal:
naam, adres, aanvraagdatum, product(categorie), offertebedrag, offertestatus, akkoord ja/nee,
akkoorddatum, klant ja/nee, laatste factuurdatum, bron (Google/Instagram/winkel), showroombezoek
ja/nee, laatste contactmoment, afgemeld ja/nee.

Koppelen gebeurt op **e-mailadres en Gripp-nummer**, nooit op naam (spelling verschilt
structureel tussen de bronnen, dat is eerder al fout gegaan).

### 3.2 Verzendplatform en deliverability

**Advies: een echte e-mailprovider voor de verzending, de logica en data houden we zelf.**

Niet alles zelf bouwen. Deliverability is een vak apart: bounce-afhandeling,
klachtafhandeling, IP-reputatie, feedback loops bij Microsoft en Google. Dat zelf bouwen kost
maanden en één fout kost je het hele domein.

Niet alles uitbesteden. De segmentatie, de timing en de meting houden we in eigen huis, precies
zoals bij het eigen CRM. De provider is een verzendbuis met een API, geen tweede systeem waar
kennis in verdwijnt.

**Harde eisen aan de inrichting:**

1. **Apart subdomein**, bijvoorbeeld `mail.sonty.nl`. Marketing mag de reputatie van het
   hoofddomein nooit kunnen beschadigen, want daar gaan de offertes en facturen overheen.
2. **SPF, DKIM en DMARC** correct ingericht op dat subdomein.
3. **Opwarmen**: beginnen met een paar honderd mails per dag en in vier tot zes weken opbouwen.
   Vanaf dag één 16.000 mails versturen is de snelste weg naar de spamfolder.
4. **Afmeldlink in elke mail**, plus een verwerkt afmeldregister dat álle systemen respecteren
   (nu is dat één tekstbestand met één regel).
5. **Bounce-opruiming**: harde bounces direct uit de lijst.

### 3.3 Designs

Eén sjabloonsysteem, geen losse mails. Merk: oranje #FF6B00, zwart #0a0a0a, Figtree.

Vier basisvormen zijn genoeg om alles mee te maken:

| Sjabloon | Waarvoor |
|---|---|
| Herinnering | offerte-opvolging: kort, één knop, prijs en link |
| Verhaal | seizoen en inspiratie: foto's, drie producten, showroom-uitnodiging |
| Uitnodiging | showroom en afspraak: één sterke call to action |
| Service | na montage: reviewverzoek, onderhoudstips, garantie |

Eisen: leesbaar zonder afbeeldingen (veel clients blokkeren die), mobiel eerst (het meeste
verkeer is mobiel), geen bijlagen, alt-teksten, donkere modus getest, en een tekstversie naast
de html-versie. Elke mail wordt vóór verzending gerenderd en visueel gecontroleerd, net zoals we
dat nu met de offertes doen.

### 3.4 De campagnes

Volgorde op verwachte opbrengst. De eerste twee zijn waar het geld zit.

**A. Reactivering koude offertes** (grootste pot: ruim 9.100 dit jaar)
Reeks van drie mails vanaf 60 dagen na de offerte. Mail 1: is het er nooit van gekomen?
Mail 2: wat het oplevert, met een klantverhaal. Mail 3: laatste kans met een concrete reden om nu
te beslissen. Bij het aanbieden van korting: alleen binnen het bestaande kortingsmandaat, nooit
ruimer dan wat de bot al mag.

**B. Showroom-uitnodiging** (hoogste conversie per contact)
Wie de showroom bezoekt gaat volgens de eigen cijfers in ongeveer 75% van de gevallen akkoord.
Dat is verreweg de sterkste hefboom die we hebben. Doelgroep: iedereen met een openstaande
offerte binnen 60 dagen én iedereen die in de reactiveringsreeks klikt maar niet boekt.

**C. Offerte-opvolging per mail** (aanvulling op wat de bot al doet via WhatsApp)
Nu volgt de bot op na 3 tot 4,5 dagen. Gezien de mediaan van 24 dagen tot akkoord is er ruimte
voor momenten op dag 10, 21 en 45. Belangrijk: dit moet samenwerken met de WhatsApp-opvolging,
niet dubbelop. Eén afstemmingsregel: heeft de klant de laatste 48 uur al iets van ons gehad, dan
schuift de mail door.

**D. Cross-sell bestaande klanten** (2.780 adressen)
Wie buitenzonwering kocht, heeft binnen nog niets. Raamdecoratie, horren, shutters. Dit is ook de
manier om het jaar rond te maken: zonwering piekt in het voorjaar, binnen juist in het najaar.

**E. Seizoenscampagne**
Twee tot vier keer per jaar, aangehaakt op het seizoen. Dit is de campagne die de lijst warm
houdt zodat de andere campagnes blijven aankomen.

**F. Na montage: review en nazorg**
Reviewverzoek op het goede moment, plus onderhoudstips. Voedt tegelijk de Google-reviews.

### 3.5 Meten en testen

**Meet op omzet, niet op opens.** Een open zegt sinds Apple Mail Privacy Protection weinig. De
keten die telt: mail → klik → offerte → akkoord → marge. Dat kunnen we sluiten omdat we het
e-mailadres aan het Reuzenpanda-dossier en aan de akkoordregel in de sheet kunnen koppelen.

**Vaste testdiscipline** (les uit de lopende WhatsApp-test, waar 4 offertes per groep
niets bewezen):

1. Eén ding tegelijk testen: onderwerpregel óf knop óf verzendmoment, nooit alles tegelijk.
2. Vooraf vastleggen hoeveel ontvangers er per groep nodig zijn voordat een verschil betekenis
   heeft. Bij de verwachte percentages is dat enkele honderden per variant, niet tientallen.
3. Gelijk verdelen (round robin), niet op toeval, anders meet je groepsgroottes.
4. **Holdout van 10%**: een deel krijgt bewust niets. Zonder die groep weet je nooit of de omzet
   door de mail kwam of toch was gekomen. Dit is de enige eerlijke manier om de waarde te meten.

### 3.6 Zichzelf verbeteren

Een wekelijkse cyclus, met de mens erbij:

1. Zondagnacht: resultaten per campagne en variant ophalen, doorgerekend tot akkoord en marge.
2. Heeft een variant de vooraf bepaalde drempel gehaald, dan wordt die de nieuwe standaard en
   gaat er een nieuwe uitdager tegenaan. Is de drempel niet gehaald, dan blijft de test lopen en
   wordt er niets veranderd.
3. Maandagochtend een rapport op Telegram: wat won, wat verloor, wat er deze week getest wordt.
4. Onderwerpregels en teksten voor nieuwe uitdagers worden voorgesteld op basis van wat eerder
   won, maar gaan pas mee na akkoord. Geen tekst naar 16.000 mensen die niemand heeft gelezen.

Bewaking, in dezelfde vorm als de bestaande diensten: een kill-switch per campagne, alarm bij een
afwijkend bounce- of afmeldpercentage, en een harde bovengrens per dag zodat een fout nooit de
hele lijst kan raken. Dat laatste is precies wat er in juli misging toen er 102 WhatsApps
tegelijk uitgingen.

## 4. Juridisch (AVG en spamregels)

Dit moet vóór de eerste verzending kloppen, niet erna.

- **Bestaande klanten en offerte-aanvragers** mogen benaderd worden over eigen, gelijksoortige
  producten. Daar valt het grootste deel van de 15.976 adressen onder.
- **Elke mail** heeft een zichtbare afmeldlink, en afmelden werkt direct en overal.
- **Afmeldingen zijn heilig**: één centraal register dat álle systemen raadplegen, inclusief de
  bestaande uitschrijvingen die de bot al verwerkt (29 dit jaar).
- **Bewaartermijn** afspreken voor adressen die jaren niets meer hebben gedaan.
- **Verwerkersovereenkomst** met de gekozen provider.

## 5. Fasering

| Fase | Wat | Resultaat |
|---|---|---|
| 1 | Datalaag bouwen en opschonen: 15.976 adressen ontdubbelen, bounces eruit, afmeldregister centraliseren | Betrouwbare lijst met segmenten |
| 2 | Subdomein, SPF/DKIM/DMARC, provider koppelen, opwarmen starten | Kunnen versturen zonder het hoofddomein te riskeren |
| 3 | Vier sjablonen bouwen en visueel controleren | Elke campagne kan er meteen goed uitzien |
| 4 | Campagne A (reactivering) live op een kleine groep, mét holdout | Eerste echte meting van waarde |
| 5 | Campagne B (showroom) erbij, A/B op onderwerpregel | Hoogste conversie aanboren |
| 6 | Wekelijkse leercyclus aanzetten, campagnes C tot F toevoegen | Draait en verbetert zichzelf |

Fase 1 tot 3 is voorbereiding waar niets van naar buiten gaat. Pas in fase 4 gaat de eerste mail
de deur uit, en dan bewust klein.

## 6. Wat ik van Daimy nodig heb

Beslissingen die ik niet voor hem kan nemen:

1. **Provider**: mag ik een externe verzendprovider kiezen (advies), of wil je dat we ook de
   verzending zelf bouwen? Dit bepaalt alles daarna.
2. **Subdomein**: akkoord op een apart afzenderdomein zoals mail.sonty.nl, en welke naam.
3. **Afzender**: vanuit welk adres en welke naam gaan de campagnes (Sonty, of een persoon)?
4. **Kortingsmandaat in mail**: mag de reactiveringscampagne korting aanbieden, en zo ja hoeveel?
5. **Toon**: dezelfde persoonlijke toon als de bot, of duidelijk zakelijker voor campagnes?
6. **Startgroep**: met welke groep gaan we in fase 4 beginnen, en hoe groot mag die zijn?

Zodra 1 tot 3 beslist zijn kan fase 1 en 2 beginnen; de rest kan onderweg.
