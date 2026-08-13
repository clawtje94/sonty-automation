# Sonty mailmarketing-masterplan

Opgesteld 2026-08-13. Doel (Daimy): een mailmarketing-machine die op onderzoek en data draait, waarbij elke klant relevante mails krijgt, en een bot die wekelijks meet en verbetert. Onderbouwing: KENNISBANK.md (zelfde map). Uitvoering: ~/sonty/scripts/email/ (FLOWS.md + STIJL.md).

## 1. Waarom dit werkt (uit het onderzoek)

- Flows leveren ~41% van e-mailomzet uit ~5% van de sends; gedragstriggers verslaan kalendermails.
- Top-performers segmenteren op productaffiniteit, fase en engagement; personalisatie werkt alleen met echte CRM-details.
- Lead-gen benchmark: 5 mails over ~14 dagen converteert 18-27% van verse leads naar een afspraak.
- Sturen op clicks/CTOR/RPR (opens zijn opgeblazen door Mail Privacy Protection); spam onder 0,1% is de gezondheidsgrens.

## 2. Relevantielagen (zo krijgt iedereen een passende mail)

1. **Fase** (sync berekent dagelijks): vers 0-14d → opvolgreeks A; lopend 15-60d → herinneringen; koud 60-365d → reactivering C; zeer koud 1jr+ → alleen seizoensmomenten; klant → service/review/cross-sell.
2. **Product**: offertekaart is altijd klant-specifiek (product, bedrag, nummer, geldigheid). Reactivering heeft nu 4 varianten met geverifieerde foto en productspecifieke echte review: screens (foto screen-tuindeuren, review Rick Kapper), rolluiken (rolluik-raam, Sidney van der Zwart), binnen (showroom-ramen, Bas Komies), basis/overig (knikarm-resultaat, Menno Vinos). De flow kiest de variant via conditional split op sonty_product_kort/sonty_categorie; segmenten 8/9 (koud buiten / koud raamdecoratie) bestaan al.
3. **Moment**: weermotor (hitte/lente/donkere dagen) + seizoenskalender hieronder.
4. **Persoon**: aanhef sonty_aanhef uit de sync ("Hoi Marleen," of "Hoi,"), nooit kapotte fallbacks.
- **Uitbreiden zodra data het toelaat**: varianten voor knikarm/pergola/markies (foto's zijn er al: pergola-tuin-1, knikarm-resultaat, markiezen-woonhuis), productspecifieke USP-blokken in de A-reeks, en op termijn AI-gekozen productaanbevelingen.

## 3. Seizoenskalender (campagnelaag naast de flows)

- **S1 Na de bouwvak** (eind aug/begin sep): zomerse offertes reactiveren; template staat klaar (Sonty | S1). Eerlijke belofte: 8-10 wk na aanbetaling = nog dit najaar hangen. DETAILS NOG BEVESTIGEN MET DAIMY (V8, besproken in andere terminal).
- **Donkere dagen** (okt): W3 breed op koud-binnen + rolluik-kanshebbers.
- **Eerste lentedag** (mrt): W2. **Hittegolven** (adhoc): W1 via weermotor.
- Elke campagne alleen naar engaged + passend segment, nooit de hele lijst.

## 4. Volgorde livegang (na akkoord Daimy per mail)

Uit FLOWS.md: 1) G1 welkom + RP1 offerte verstuurd (laagste risico, verwacht), 2) opvolgreeks A op vers segment, 3) W1, 4) E1/E2 service en review, 5) C-reactivering als laatste, in blokken van 200, met de productvarianten. Nooit twee flows tegelijk aan. LET OP: RP1/G1 triggeren direct op events; offertekaart-velden komen uit de nachtsync, dus verzendmoment na de sync leggen of event-properties gebruiken.

## 5. De wekelijkse bot (sluit de verbeterlus)

Elke week, automatisch:
1. **Meten**: klaviyo-week-rapport.js (per flow-mail en campagne: ontvangers, clicks, conversies, omzet, RPR, unsub, spam) + conversiesheet (akkoord = inkoopbedrag, per tabblad) + mijlpalen-tijdlijn.
2. **Vergelijken**: tegen de benchmarks uit KENNISBANK.md en tegen vorige weken.
3. **Bewaken**: spam > 0,1% of unsub-piek → alarm + voorstel om te dempen; lijsthygiëne (sunset 180d).
4. **Voorstellen**: welke mail onderpresteert (herschrijfvoorstel), welke flow of variant ontbreekt (bouwvoorstel; Create Flow API is GA), welk campagnemoment eraan komt.
5. **Rapporteren**: kort weekbericht op Telegram; wijzigingen pas na akkoord Daimy; elke wijziging door stijlcheck + previews + oplevercheck vóór livegang.

## 6. KPI-doelen (health & beauty/lead-gen benchmarks als lat)

- Flows: click > 4,6% (top 10%: 11,5%), conversie richting 5%+ op cart/offerte-achtige flows.
- Campagnes: click > 1,2%, unsub < 0,3% per send, spam < 0,1%.
- Programmadoel: flows leveren binnen een half jaar 30-50% van de e-mailomzet; e-mail aantoonbaar terug te zien in de wekelijkse conversiemeting.

## Openstaande punten

- V4-V7 bij Daimy (cijferclaims, 24-uursbelofte, officiële reviewlink, voorraadclaim) + V8 bouwvak-details.
- Akkoord per mail (18 + 4 nieuwe varianten/bouwvak), daarna flows bouwen.
- Bot-cron bouwen (weekrapport + sheet + Telegram), daarna wekelijks ritme.
