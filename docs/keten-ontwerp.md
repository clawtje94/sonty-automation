# Ketenontwerp: van lead tot gemonteerd

Vastgesteld 2026-08-04 met Daimy. Planado blijft (app + monteur-tracking).
Eis Daimy: alles moet goed samenwerken vóórdat het live gaat.

## 1. Rolverdeling — één waarheid per systeem

| Systeem | Waarheid voor | Mag NIET |
|---|---|---|
| RP (Reuzenpanda) | leadstatus, startsein "inmeten inplannen" | wij schrijven er niets in (alleen lezen) |
| Planado | wie / waar / wanneer, tracking, afmelden | géén meetgegevens |
| Eigen meetbon | maten, productkeuzes, foto's | geen planning, geen geld |
| Gripp | offerte, handtekening, factuur | geen maten-invoer |
| Planning-sheet | besteld / geleverd | blijft ongewijzigd |

**Consequentie:** het Planado Inmeet-sjabloon moet LEEG (nu vraagt het nog om
breedte/hoogte/diepte/foto's). Anders vult de inmeter dezelfde maat twee keer in
en is niet meer vast te stellen welke besteld is.

Reden dat de meetbon niet in Planado kan: rapportvelden zijn niet via de API te
zetten (`/v2/custom_fields` bestaat niet) en worden bij aanmaak uit het sjabloon
gekopieerd en dan losgekoppeld — een sjabloonwijziging raakt bestaande jobs niet.

## 2. De sleutel

**Het Gripp-offertenummer, overal.**
- Planado-job: `external_id = gripp-<nr>` + vaste regel `Gripp: <nr>` in de omschrijving
- Meetbon: `/admin/meetbon/<nr>`
- Outlook-afspraak: `Gripp: <nr>` in het onderwerp

Zonder deze sleutel kan geen enkele schakel de andere vinden. Dit is stap 1 van
de bouw; al het andere is zinloos zolang dit er niet ligt.

De RP→Gripp-koppeling bestaat al: `cron-gripp-invullen.js` maakt de Gripp-offerte
uit de RP-deal. Die mapping wegschrijven naar `data/rp-gripp-map.json`.

## 3. De stappen

### Stap 1 — startsein uit RP
Poller elke 10-15 min op de RP-backlog, clientside filteren op status_id
`2e9819bd-26f0-4082-8f18-32bb48f87f54` ("inmeten inplannen").
RP heeft geen webhook; `?status_id` wordt genegeerd, dus `?limit=200` + zelf filteren
(0,6 s per call, dekt >24 u historie).
Dedupe-state in `data/inmeten-planner-state.json`.

### Stap 2 — inplannen als VOORSTEL, niet blind boeken
De bot berekent inmeter + tijdslot uit de Bookings-agenda en zet het als voorstel
klaar (Telegram / belscherm). Een mens keurt goed met één klik.

Waarom voorstel en niet direct boeken:
- de inmeetduur is nog niet vastgesteld (wacht op de hoofdinmeter)
- de AI-klantenservice belooft de klant letterlijk "de planning neemt binnen
  3 werkdagen contact op" — een afspraak die de klant nooit bevestigd heeft, botst daarmee
- vrije-tekstwensen ("liefst zaterdag", "pas na 28 juli bellen") kan een bot nu niet lezen

Zodra de tijdenlijst er is en het bevalt, kan de goedkeuringsstap eruit.

### Stap 3 — afspraak wegschrijven
Bij goedkeuring in één transactie:
1. Planado-job (sjabloon Inmeet, `external_id = gripp-<nr>`, assignee = de inmeter)
2. Outlook-afspraak in SontyMontage1 (dubbelboek-check vóór aanmaken)
3. Meetbon aanmaken en voorvullen uit Gripp

Mislukt er één, dan rollen we de andere twee terug — anders ontstaat een afspraak
die maar in één agenda staat.

### Stap 4 — meetbon voorvullen met de JUISTE producten
Nu start `bon.producten` altijd leeg en kiest de inmeter alles met de hand.
Mapping bouwen op `offerline.product.id` → de 13 typen in `lib/meetbon/producten.ts`.
(De productnaam zit in `offerline.product.searchname`, bv. "Rolluik (RollSUPER) (20064)";
de code leest nu alleen `l.description`, waar het type niet in staat.)

Ook meenemen: `offerline.amount` als aantal (nu hardcoded 1), e-mail, postcode,
afleveradres, interne notitie.

Accessoires (bv. "Smoove RS100 IO wandschakelaar") zijn geen meetbaar product en
komen niet als meetbon-product terug.

### Stap 5 — inmeter vult in
Planado-app → job → knop → meetbon in de browser, al voorgevuld.
Product toevoegen kan altijd, ook als het niet in de offerte staat.

Twee poorten die dicht moeten:
- **"Advies / weet nog niet" verdwijnt als eindantwoord** op beslissende velden
  (type, model, bediening). In plaats daarvan een aparte vlag "advies nodig van
  kantoor" — zo'n bon gaat NIET naar de besteller maar naar een wachtlijst met melding.
- **Validatie server-side.** Nu wordt alleen in de browser gecontroleerd; de PUT
  accepteert een lege bon als "compleet".

Ook nodig vóór live: de bon verliest ingevuld werk zonder bereik (`dirty` wordt op
false gezet vóór het versturen, geen retry). Eerst try/catch + retry +
localStorage-mirror; volledige offline-modus daarna.

### Stap 6 — eindofferte naar Gripp (de knop die Daimy vraagt)
Knop "Eindofferte maken" op de afgeronde bon:
1. definitieve regels bouwen uit de meetbon (echte maten) + prijs uit de centrale engine
2. `offer.create` in Gripp (draait al in productie, met `signingenabled: true`)
3. de offerte openen op de telefoon van de inmeter

**Rem tegen de duurste fout van de keten** (klant tekent ter plekke een verkeerde prijs):
- de inmeter ziet eerst het verschil met de oorspronkelijke offerte
- boven een afgesproken drempel, of als er een product bij zit dat de prijsengine
  niet kent, kan er ter plekke NIET getekend worden — die gaat naar kantoor

Niet alle 13 typen zijn door de prijsengine te prijzen (horren/gordijnen/velux
waarschijnlijk niet). Voor die producten: prijs uit de oorspronkelijke offerte
overnemen en markeren als "controleren", nooit stil een bedrag verzinnen.

**Openstaand: `offer.update` bestaat niet in onze codebase.** Wijzigen kan alleen
via delete + create, wat offertenummer én historie wist. Daarom wordt de eindofferte
een NIEUWE offerte die in de omschrijving naar de oorspronkelijke verwijst.
→ Eén vraag aan Gripp-support maakt dit definitief.

### Stap 7 — ondertekenen
Twee routes, allebei technisch aanwezig:

A. **Gripp-viewer** (`viewonlineurl`) — heeft een echt krabbelformulier
   (`signature_pad.js`). Onzeker: via de API aangemaakte offertes komen binnen als
   **Concept**, en of het formulier bij Concept al accepteert is niet getest.
B. **Eigen ondertekenpagina** — draait live sinds 8 juli (krabbel + IP + tijdstempel)
   en stuurt al automatisch de akkoord-bevestiging naar de klant.

**Advies: B**, want bewezen en al gekoppeld aan de akkoordmail. A kan er later bij
zodra vaststaat of Concept ondertekenbaar is.

### Stap 8 — aanbetalingsfactuur automatisch
Trigger = getekend (uit onze eigen sign-route, want in Gripp kunnen we de status
niet zetten zolang `offer.update` niet bestaat).
Dan: `invoice.create` 40% → op verzonden → mail vanuit **aanvragen@sonty.nl**
(Trengo 1363384, nooit joey@) met template `05-aanbetaling-factuur.html`.

Dit bestaat nog helemaal niet; `invoice.create` komt nergens in de code voor. Dat
`invoice.create` in dit abonnement werkt is aannemelijk maar niet bewezen — eerst
testen op één offerte, met de hand gecontroleerd, vóór het automatisch gaat.

### Stap 9 — betaald → naar de besteller
Uurcron (draait al). Betaling staat mediaan binnen een halve dag in Gripp, altijd
dezelfde kalenderdag, dus binnen een uur zichtbaar.
Factuursleutel is 2026-08-04 gefixt (matchte eerder facturen van andere klanten).

Verbeteren: geen losse mail in een postvak met ~15 leveranciersmails per dag, maar
een **bestellijst die blijft staan** tot hij afgevinkt is, met per product de
leverancier en alle velden die dat portaal vraagt.

### Stap 10 — bestellen
Blijft mensenwerk: de besteller neemt de lijst over in het leveranciersportaal.
Automatisch bestellen is een apart traject per leverancier en nu niet aan de orde.
De orderbevestiging komt als mail binnen en wordt al door `planning-mail-daemon.js`
in de planning-sheet gezet.

Toevoegen: alarm als een bestelling na X dagen geen orderbevestiging heeft — nu
merkt geen enkel systeem dat er iets blijft liggen.

### Stap 11 — levering binnen → montage inplannen
Montage-job in Planado (sjabloon "Montage afspraak particulier", bestaat al) met:
- dezelfde sleutel `gripp-<nr>`
- de meetbon-link in monteursweergave: per product de maten, montagewijze, bevestiging,
  ondergrond, boorbaarheid, bereikbaarheid, aantal monteurs, elektra en de situatiefoto's

Dat is precies de informatie die de inmeter al vastlegt en die de monteur vandaag
niet krijgt. Het Planado-veld "Meetgegevens (van inmeet)" bestaat al en wordt nu
door geen enkele regel code gevuld.

**De bon moet bevroren zijn** zodra de eindofferte getekend is — nu kan
"Toch nog wijzigen" hem terugzetten naar concept terwijl de monteur al onderweg is.

### Stap 12 — afmelden
In de Planado-app: KLAAR / KLAAR MET RESTPUNT / NIET GELUKT, met verplichte foto's
achteraf en handtekening van de klant.
Webhook `job_finished` → sonty-website → status terug in de keten + facturatie.

Nu: 0 van 82 opdrachten is ooit afgemeld, de 2 bestaande webhooks staan allebei op
`job_finished` en hebben dus nog nooit gevuurd, en het montage-sjabloon heeft geen
handtekeningveld en geen verplichte foto's.
De facturatiecontrole draait vandaag op "montagedatum ligt in het verleden" in een
handmatige export.

## 4. Bouwvolgorde

| # | Wat | Waarom nu |
|---|---|---|
| 1 | Sleutel `gripp-<nr>` overal + RP↔Gripp-mapping | zonder dit vindt niets elkaar |
| 2 | Outlook→Planado-sync in launchd | Planado loopt 7 augustus leeg |
| 3 | Inmeet-sjabloon leegmaken (browser) | anders dubbele maten |
| 4 | Meetbon voorvullen met juiste producttypen | inmeter hoeft niets meer te raden |
| 5 | Poorten dicht: advies-vlag + server-side validatie + opslag-retry | halve bonnen mogen niet door |
| 6 | Eindofferte-knop → Gripp + ondertekenen | de stap die Daimy vraagt |
| 7 | Aanbetalingsfactuur automatisch | eerst handmatig testen |
| 8 | Bestellijst i.p.v. losse mail + wacht-alarm | bestelling mag niet blijven liggen |
| 9 | Montage-job met monteursweergave | monteur weet wat hij moet doen |
| 10 | Afmelden + webhook | bewijs bij klachten, einde van de keten |

Stap 1 t/m 5 is de basis; daarna pas is het zinvol om de keten echt te gaan gebruiken.

## 5. Nog te beslissen / uit te zoeken

- **V2 (Daimy)**: welke 2 inmeters starten?
- Bestaat `offer.update` in Gripp API3? (één supportvraag — bepaalt of de eindofferte
  het offertenummer kan behouden)
- Werkt `invoice.create` op dit abonnement, en kan de factuur via de API gemaild worden?
- Is een Gripp-offerte in status Concept al ondertekenbaar?
- Welke prijsdrempel mag de inmeter ter plekke zelf laten tekenen?
