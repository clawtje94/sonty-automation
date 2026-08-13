# Sonty Klaviyo flow-plan

Opgesteld 2026-08-13. Sonty is lead-gen (aanvraag → prijsindicatie → akkoord → inmeten → offerte → 40% aanbetaling → montage → 60%), geen webshop. Flows volgen dus de offerte-funnel, niet een checkout-funnel. Alle copy volgens SONTY-MAILSTIJLGIDS.md.

## Beschikbare triggers (pusht sonty-website al naar Klaviyo)

- `Lead Aangemaakt` (lib/klaviyo.ts via createLead)
- `Lead Status Gewijzigd` (bord/pipeline-statuswissels)
- `Offerte Online Verzonden` (shareOfferte; LET OP: liep nooit omdat KLAVIYO_PRIVATE_KEY in prod ontbreekt)

## WAARSCHUWINGEN vóór er iets live gaat

1. **Key-blocker**: KLAVIYO_PRIVATE_KEY ontbreekt in prod; events komen dus nu niet binnen. Eerst key (V2 aan Daimy), dan events verifiëren, dan pas flows.
2. **Dubbele mails**: sonty-website heeft eigen offerte-herinneringen-cron en verzendcentrum-mails; Klaviyo-automation "offerte-mail-bij-delen" moet UIT als het verzendcentrum mailt (HANDOFF-regel). Vóór elke nieuwe flow: inventariseren wat er al mailt op dat moment in de funnel, anders krijgt de klant twee mails over hetzelfde.
3. **Bestaand Sonty-Klaviyo-account eerst uitlezen** (klaviyo-stand-script staat klaar in ~/olivida/email-marketing/scripts, werkt op elke key) voordat er iets wordt aangepast.
4. Nieuw automatisch gedrag = eerst scenario-lab-run (0x FOUT-STIL) + /oplevercheck.

## Flows in prioriteitsvolgorde

### 1. Offerte-opvolgflow (DE geldflow, eerste bouwkandidaat)
Trigger: `Offerte Online Verzonden`. Stop-conditie: status akkoord of klant heeft gereageerd.
- Mail 1 (dag 2): korte check, is alles duidelijk, uitnodiging om vragen te stellen of de showroom binnen te lopen (di/do vrije inloop).
- Mail 2 (dag 5): grootste twijfels wegnemen: proces (planning belt binnen 5 werkdagen na akkoord), €75-regel eerlijk uitleggen, garantie 3/5/7 noemen.
- Mail 3 (dag 10-12): vervaldatum benoemen plus de regel: nu tekenen zet de prijs vast, inmeten plannen we later in overleg. Geen kunstmatige druk, geen verzonnen korting.
- Afstemmen met bestaande offerte-herinneringen-cron: één van beide stuurt, nooit allebei.

### 2. Nieuwe-leadflow (welkom + vertrouwen)
Trigger: `Lead Aangemaakt`, filter: nog geen offerte verzonden.
- Mail 1 (direct): bevestiging aanvraag, wat de klant kan verwachten, wie Sonty is.
- Mail 2 (dag 2-3): vertrouwen: echte reviews (nooit verzonnen), showroom-uitnodiging met routetip.
- Mail 3 (dag 6): keuzehulp-insteek: waarom minimaal draaischakelaar (gaten in de muur-uitleg), solar als alternatief zonder stroom.

### 3. Statusflows (trigger: `Lead Status Gewijzigd`)
- **Akkoord**: verwachtingsmail: planning belt binnen 5 werkdagen voor de inmeetafspraak, daarna definitieve offerte en 40% aanbetaling, montage 8 tot 10 weken na aanbetaling.
- **Afgerond (montage klaar)**: bedankmail + reviewverzoek (Google), na ~5 dagen. Garantie 3/5/7 nog eens bevestigen als naslagmail.

### 4. Winback en seizoen (later, campagnelaag)
- Oud-leads zonder akkoord: voorjaarscampagne zonwering, najaarscampagne rolluiken/isolatie.
- Oud-klanten: cross-sell (screens erbij, horren, binnenzonwering) via segment 365 dagen na montage.

### 5. Lijsthygiëne en sunset (deliverability)
- Engaged-segmenten opzetten (90/180 dagen), campagnes alleen naar engaged.
- Sunset: 180 dagen nooit engaged → onderdrukken; spam rate onder 0,1% houden (harde Gmail-grens 0,3%).

## Wekelijkse datasturing (de bot)

Wekelijks rapport (script klaviyo-week-rapport.js, werkt op elke Klaviyo-key): per flow en campagne ontvangers, click rate, conversies, omzet, RPR, unsub- en spamrate, afgezet tegen de benchmarks in KENNISBANK.md (zelfde map). Conversie-kant: koppelen aan de Sonty-conversiemeting (akkoord = inkoopbedrag in sheet, per tabblad geteld) en de mijlpalen-tijdlijn. Op basis daarvan wekelijks: welke flow-mail onderpresteert (herschrijven), welke flow ontbreekt (bijbouwen via Create Flow API, GA sinds revision 2026-07-15), welke campagne-insteek werkt (herhalen).
