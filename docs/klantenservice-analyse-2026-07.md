# Klantenservice-analyse Sonty — juli 2026

> Bron: 4.163 Trengo-gesprekken (maart t/m juni 2026), waarvan 1.168 echte klantgesprekken
> op WhatsApp + Aanvragen/Klantenservice-mail integraal gelezen en geanalyseerd
> (details: `data/ks-analyse/bevindingen-1..6.md`, metrics: `data/ks-analyse/stats.json`).
> Doel: fundament voor de autonome AI-klantenservice (sales-gedreven, doel = inmeetafspraak).

## 1. De harde cijfers

| Metric | Waarde |
|---|---|
| Klantgesprekken met inkomend bericht | 1.651 |
| **Nooit beantwoord** | **671 (41%)** |
| Eindigt met onbeantwoord klantbericht | 1.207 (73%) |
| Mediane eerste reactietijd WhatsApp | 39 min |
| Mediane eerste reactietijd e-mail (Aanvragen) | **20 uur** (p90: 3 dagen) |
| Onbeantwoorde gesprekken mét koopintentie | ±96 |
| Gemiste inmeetkansen (koopintentie, geen inmeet-voorstel/reactie) | ±84 |
| Gesprekken waarin Sonty actief inmeten voorstelde | ±99 |
| Wie beantwoordt: Daimy | 2.888 gesprekken (≈88% van alles) |

**Conclusie:** het probleem is niet de kwaliteit van de antwoorden (die is goed — zie §4),
maar de **capaciteit en snelheid**. Vier van de tien klanten krijgen nooit antwoord, en
warme leads die expliciet vragen "wanneer komen jullie inmeten?" blijven dagen of voorgoed
liggen. Voorbeelden: klant die al akkoord gaf en om de afspraak vroeg (onbeantwoord),
klant die voorkeursdagen voor het inmeten doorgaf (onbeantwoord), terugkerende klant die
5 extra producten wilde (2x gevraagd, nooit beantwoord). Dit is de businesscase voor de AI.

## 2. Wat klanten vragen (intent-verdeling over 1.168 gesprekken)

| Intent | Aantal | AI-afhandelbaar? |
|---|---|---|
| Productvragen (specs, verschil rolluik/screen, solar, doeken, kleuren) | 243 | ✅ volledig |
| **Offerte aanpassen / nieuwe offerte** (maten, aantal, kleur, bediening, model) | **179** | ✅ volledig (grootste kans!) |
| Inmeetafspraak plannen | 150 | ✅ volledig |
| Te duur / prijsbezwaar | 132 | ✅ met waarde-script + alternatief; korting → mens |
| Prijsvraag / korting | 128 | ✅ prijzen via v4-engine; korting → mens |
| Service / reparatie / garantie | 101 | ⚠️ deels (eigen product → mens; niet-eigen → service-nodi verwijzing) |
| Status levering/montage | 67 | ⚠️ vereist orderdata-koppeling; anders → mens |
| Akkoord geven | 52 | ✅ (bevestigen + €75-regel + planning-proces) |
| Planning verzetten | 42 | ⚠️ → planning/mens |
| Showroom | 39 | ✅ volledig |
| Factuur/betaling | 16 | ❌ → mens |

±75 "gesprekken" zijn automatische Reuzenpanda-notificaties (geen echte dialoog).

## 3. De grootste structurele lekken

1. **E-mailkanaal Aanvragen is een zwart gat.** Batchverwerking in de vroege ochtend,
   mediane reactietijd 20 uur, veel verzoeken (ook kant-en-klare kopers) verdwijnen.
2. **WhatsApp 24-uursvenster.** Buiten het venster kan alleen het automatische
   "chat opnieuw openen"-bericht verstuurd worden; tientallen warme leads kregen
   daardoor nooit een inhoudelijk antwoord. Een AI die BINNEN het venster direct
   antwoordt lost dit structureel op.
3. **Prijsopgave zonder vervolgstap.** Team stuurt vaak een nette prijs/offerte maar
   sluit niet af met een inmeet-voorstel ("Ik hoop je voldoende te hebben geïnformeerd").
   De AI sluit ELKE reactie af met een concrete volgende stap.
4. **Offerte-aanpassingen blijven liggen.** Grootste intentcategorie na productvragen;
   afhandeling wisselt van minuten tot dagen tot nooit. Klanten die verkoopklaar zijn
   ("pas de bediening aan, dan teken ik") haken hierdoor af.
5. **Verouderde offertes (2025) per ongeluk verstuurd** ("we waren aan het tijdreizen") —
   AI moet offertedatum/versie checken vóór verzending.

## 4. Wat goed werkt (en de AI overneemt)

- **De "Jaimy"-persona**: het hele team schrijft op WhatsApp als "Jaimy van Sonty 👋" —
  de AI gebruikt exact deze persona en openingszin.
- **Het €75-script** (letterlijk, tientallen keren identiek gebruikt en effectief):
  "Mocht je na het inmeten toch niet met ons verder gaan, dan brengen wij daar €75 voor
  in rekening, waarvan we €25 doneren aan het Prinses Máxima Kinderziekenhuis. Uiteraard
  vervalt die €75 als je met ons verder gaat." — pas noemen ná interesse in de afspraak;
  vervalt als montage technisch onmogelijk blijkt. **Let op:** er bestaat een tweede €75
  (demontage/afvoer oud scherm) — ander ding, niet verwarren.
- **Waarde-verkopen bij prijsbezwaar**: aluminiumdikte/Sunmaster, Somfy standaard,
  eigen monteurs, 600+ reviews 4,9/5, "geen Audi voor de prijs van een Skoda", en
  actief een goedkoper alternatief doorrekenen (SunBasic, bedraad i.p.v. solar).
- **Proces-transparantie**: akkoord op indicatie = vrijblijvend startsein → planning
  belt binnen 3 werkdagen → inmeten 2-3 weken → definitieve offerte → 40% aanbetaling →
  8-10 weken → montage → 60%. Staffel-uitleg (20cm, ±€50) neemt inmeet-angst weg.
- Vaste antwoorden op de top-10 FAQ (levertijd, garantie 3/5/7, solar, Sergé 5%,
  hoogwerker €650, kabelgoot, service-nodi-verwijzing, etc.) — allemaal in de
  AI-systeemprompt overgenomen uit letterlijke teamcitaten.

## 5. Rode vlaggen — wat de AI NIET zelf afhandelt

Schade/aansprakelijkheid, klachten over uitgevoerd werk, boze klanten en gebroken
beloftes, veiligheid (spanning op motor, losgekomen schermen, storm), juridisch/AVG,
betalingsgeschillen, kortingsonderhandeling, B2B-maatwerk, VvE-/constructietwijfels
(→ wel de inmeetafspraak aanbieden, beoordeling ter plekke), klanten die automatisering
wantrouwen, phishing, opt-outs. → allemaal `escaleren_naar_mens` + Telegram-alert.

## 6. Beleidsvragen voor Daimy (inconsistenties in de data)

1. **Levertijd-communicatie** wisselt per medewerker: 6-8 / 7-9 / 8-10 weken.
   → één canonieke range kiezen (AI gebruikt nu 8-10, de meest gebruikte).
2. **Burenkorting**: soms "minimaal 5 buren", soms 20% bij samen tekenen/meten/monteren
   op dezelfde dag. → regel vaststellen.
3. **Kortingsmandaat**: medewerkers geven ad-hoc 2,5%, €50, €75 of "matchen". AI geeft
   nu 0 korting en escaleert — akkoord, of krijgt de AI een klein mandaat (bv. tot €50)?
4. **Garantie**: WhatsApp-team zegt 3 jr montage / 5 jr product / 7 jr motor; in
   v4-offertes staat "2 jaar montage | 3 jaar product". → welke klopt? (AI gebruikt 3/5/7.)
5. **service-nodi.nl-verwijzing**: bevestigen dat dit nog de juiste partner is.
6. **Status-vragen**: mag de AI ordersstatus uit Gripp/Planado lezen om "wanneer wordt
   er gemonteerd?" te beantwoorden? (Fase 3 in de roadmap.)
