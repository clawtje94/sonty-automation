# Bouwinstructie flows in Klaviyo

Alle sjablonen staan klaar in Klaviyo. Dit document beschrijft per flow hoe hij in elkaar hoort te
zitten.

**UPDATE 16-08 (opdracht Daimy):** alle flows hieronder staan nu als **DRAFT** in Klaviyo,
via de flows-API aangemaakt (revision 2024-10-15.pre met temporary_id + entry_action_id;
de aanpak is inmiddels bewezen met de live Tekenbonus-flows). Namen: "Sonty A | Offerte-
opvolging" t/m "Sonty W3 | Donkere dagen". Onderwerpen/previews zijn nette voorzetten en
horen bij de review van Daimy+Joey. Twee dingen kunnen alleen in de UI en staan als
notitie in de flow-naam/mail-naam: de C1-productvarianten-split en de C2/C3-voorwaarden
(geopend/geklikt).

**Er staat niets aan. Zet een flow pas live als Daimy dat per flow zegt** (volgorde
onderaan dit document). De triggers voor RP1/RP4/RP5 zijn nieuwe metrics ("RP: offerte
verstuurd/geaccepteerd/afgewezen") die ons systeem nog moet gaan afvuren zodra deze
flows de Reuzenpanda-mails overnemen.

## Vaste instellingen voor elke flow

| Instelling | Waarde | Waarom |
|---|---|---|
| Smart sending | aan, 2 dagen | voorkomt dat iemand twee Sonty-mails vlak achter elkaar krijgt |
| Verzendvenster | 09:00 tot 20:00 | zelfde grens als de WhatsApp-bot |
| Uitstappen bij | akkoord of afspraak geboekt | niemand blijft een verkoopreeks krijgen nadat hij ja zei |
| Afzender | Jaimy van Sonty | zoals de bot ook tekent |
| Antwoordadres | aanvragen@sonty.nl | daar kijkt het team al |

## De flows

### A. Offerte-opvolging (trigger: segment "1. Offerte vers")

| Stap | Wacht | Sjabloon |
|---|---|---|
| A1 | 2 dagen | Sonty \| A1 Offerte staat klaar |
| A2 | +5 dagen | Sonty \| RP2 Herinnering dag 6 |
| A3 | +7 dagen | Sonty \| A3 Showroom-uitnodiging |
| A4 | +14 dagen | Sonty \| RP3 Herinnering dag 10 |
| A5 | +17 dagen | Sonty \| A5 Laatste mail in de reeks |

Samen bestrijkt dit dag 2 tot 45, wat aansluit op de gemeten doorlooptijd: mediaan 24 dagen,
93% binnen 60 dagen.

### C. Reactivering (trigger: segment "3. Offerte koud")

**Productrelevantie (13-08)**: C1 heeft vier varianten; kies in de flow met een conditional
split op profieleigenschap `sonty_product_kort`:
- bevat "screens" → Sonty | C1 Reactivering (screens)
- bevat "rolluiken" → Sonty | C1 Reactivering (rolluiken)
- bevat "knikarm" → Sonty | C1 Reactivering (knikarm)
- bevat "pergola" → Sonty | C1 Reactivering (pergola)
- bevat "markies" → Sonty | C1 Reactivering (markies)
- `sonty_categorie` = binnen → Sonty | C1 Reactivering (binnen)
- anders (uitvalscherm, horren, overig) → Sonty | C1 Reactivering (basis)

| Stap | Wacht | Sjabloon | Voorwaarde |
|---|---|---|---|
| C1 | direct | Sonty \| C1 Reactivering (variant, zie boven) | |
| C2 | 7 dagen | Sonty \| C2 Wat er veranderd is | alleen als C1 geopend is |
| C3 | 14 dagen | Sonty \| A3 Showroom-uitnodiging | alleen als er geklikt is |

Begin klein: 200 per keer. Hier vallen de meeste afmeldingen, dus dit is de flow om voorzichtig
mee te zijn.

### D. Cross-sell (trigger: segment "6. Klant met buitenzonwering")
Eén mail: Sonty | D1 Cross-sell naar binnen. Wachttijd 3 maanden na akkoord.

### E. Service (trigger: metric "Montage afgerond" — LIVE sinds 04-09, flow XQH9i2)

**Fout tot 04-09:** de flow stond op segment "5. Klant (akkoord gegeven)", dus 7/14 dagen na het
AKKOORD (= dag van de aanbetalingsfactuur), weken vóór de montage. 12 klanten kregen zo een
reviewverzoek (2 t/m 4 sept). Daimy 04-09: "een reviewmail stuur je alleen na montage". Oude flow
RSKdNg staat op draft. Het event komt uit `montage-events.js` (Planado montage finished + werkbon
niet "niet gereed", e-mail via Planado → telefoon/RP → Gripp), dagelijks in dagelijks.sh stap 5.

| Stap | Wacht | Sjabloon |
|---|---|---|
| E1 | 7 dagen na montage (event) | Sonty \| E1 Service en nazorg |
| E2 | 14 dagen na montage (event) | Sonty \| E2 Reviewverzoek |

### G. Welkom (trigger: nieuwe aanvraag)
Sonty | G1 Welkom na aanvraag, direct. Vervangt de bedankmail van Reuzenpanda.

### RP. De vervangers van Reuzenpanda

Deze vier vervangen wat Reuzenpanda nu doet, zodat het daar uit kan:

| Sjabloon | Vervangt | Trigger |
|---|---|---|
| RP1 Offerte verstuurd | "Offerte versturen" | offerte krijgt status verstuurd |
| RP2 Herinnering dag 6 | "Herinnering na 6 en 10 dagen" | zit in flow A |
| RP3 Herinnering dag 10 | idem | zit in flow A |
| RP4 Na akkoord | "Mail en melding na akkoord" | offerte geaccepteerd |
| RP5 Na afwijzing | "Mail en melding na afwijzing" | offerte afgewezen |

**Belangrijk**: de herinneringsflow in Reuzenpanda staat niet bewust uit, hij is stuk. In de
interface staat "Er is iets misgegaan met de automatisering". Er gaat dus al langere tijd geen
enkele opvolgmail uit.

### S. Seizoenscampagnes (eenmalig, geen flow)

**S1 Na de bouwvak** (Sonty | S1, klaar in Klaviyo): eind aug/begin sep naar zomerse offertes
zonder akkoord (fase lopend + koud tot ~120 dagen, engaged, mag_mail=ja). Details eerst met
Daimy bevestigen (in andere terminal besproken); verzenden in blokken, nooit de hele lijst.

### W. Weerflows (trigger: segment "W1/W2/W3")

De weermotor zet dagelijks de markering; het segment vult zich dan vanzelf. Eén mail per flow,
direct bij binnenkomst in het segment. De markering vervalt na drie dagen, dus wie te laat
binnenkomt krijgt niets meer.

| Segment | Sjabloon |
|---|---|
| W1. Weermoment hitte | Sonty \| W1 Weer, hitte op komst |
| W2. Weermoment eerste lentedag | Sonty \| W2 Weer, eerste lentedag |
| W3. Weermoment donkere dagen | Sonty \| W3 Weer, donkere dagen |

## Volgorde van aanzetten

1. **G1 Welkom** en **RP1 Offerte verstuurd**: laagste risico, want die verwachten mensen.
2. **Flow A** op het verse segment (588 mensen).
3. **W1 Hitte**, want die is direct relevant.
4. **E1 en E2** service.
5. Pas daarna **C** reactivering, en dan in blokken van 200.

Zet nooit twee nieuwe flows tegelijk aan: dan weet je bij een probleem niet welke het was.
