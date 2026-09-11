# GEHEUGEN MILAN — opvolging & bellijst

## Daimy-vraag (09-9-2026): Waarom verdween "Open opvolgingen: 60"?
**ANTWOORD gegeven**: Gisteren simpele regel "Open opvolgingen: 60"; vandaag vergat Milan het totaal. Stijging naar 71 omdat aan-zet-watchdog dynamisch alle klanten telt. **ACTIE**: Terug naar format gisteren ("Open opvolgingen: X" als eerste regel onder ## CIJFERS), zodat Daimy dag-op-dag kan vergelijken.

## Lopende opvolgingen (>7 dagen) — 09-9-2026
- **Luuk Post** (sinds 13-8-2026, dus 27 dagen): 2 offerteversies, GEEN getekend. Wacht op "Gripp invullen". ESCALATIE: V#1 gesteld (08-09) — wachten antwoord Daimy (kantoor bellen ja/nee?). STATUS: PENDING DAIMY RESPONSE.
- **Rowie Post** (11 dagen): adres incompleet ("IJmuiden" zonder straat/huisnummer), offerte wacht tot adres compleet. Sunny WhatsApp adres-aanvulling onderweg. STATUS: WACHTEN SUNNY.
- **Husain Kapadia** (sinds 25-4-2026, dus 136+ dagen): ACTIEF traject, inmeting gepland 01-10 om 11:00 (Sjoerd #1343). Geen escalatie nodig. STATUS: CONFIRMED, GEEN ACTIE.

## Systemen — 09-9 (05:08-07:20)
- Snapshot.json: Bijgewerkt 05:08 (17 aanbod(en) gevolgd, 0 nieuwe reacties)
- Aanbod-replies.log: 17 items monitoring, 0 reacties vandaag
- Nanny's dienst (05:00-06): 4 openstaand, 1 gesloten (anoek van der wal), 5 stil-lijst, 4 >5d wachter
- Gripp-invullen.log: Luuk Post STUCK, NO progress sinds 13-8
- Aan-zet-watchdog.log: 71 klanten "wachten op ons" (niet mijn domein, maar parallel)
- Brein-alarmen: wa-luisteraar offline (Techniek), Outlook-Planado 22 FOUTEN (bekend, Techniek handelt af)

## Cadans DAIMY (sinds 07-9-2026) — VASTE OPVOLGSTRUCTUUR
- **1e opvolging**: 2-4 werkdagen na offerte (vriendelijke check "heb je mijn offerte ontvangen?")
- **2e opvolging**: 7-10 dagen (inhoudelijke vraag/toegevoegde waarde: "staat er iets niet helder?")
- **3e opvolging**: 14+ dagen (nette afsluiting: "nog interesse of kunnen we dit afsluiten?")
- Per offerte concrete volgende actie + datum noteren (niet afwachten).
- Bij elke cadans-stap: bellen > mailen (sneller), multi-kanaal als bellen niet lukt.

## Actie (11-9) — VANDAAG AFGEROND
1. **GEDAAN Luuk Post (27d):** Status: ESCALATIE V#1 al gesteld (08-09). WACHTEN op Daimy antwoord. Voorstel: kantoor mag bellen.
2. **GEDAAN Rowie Post (11d):** Status: WACHTEN op Sunny WhatsApp adres-aanvulling. Niets gewijzigd.
3. **GEDAAN Husain Kapadia:** Status: CONFIRMED ACTIEF. Inmeting 01-10 11:00 (Joey/Sjoerd). Geen escalatie.
4. **GEDAAN Cijfers-vraag Daimy:** Gegeven: "Open opvolgingen 71" format terug (was gisteren 60, fluctueert per daemon-run). Actie: Volgende dienst formaat gisteren herhalen.

**Aanbod-replies monitoring:**
- 17 items gevolgd, 0 nieuwe reacties vandaag (snapshot 05:55)
- Open opvolgingen: 71 (bron: aan-zet-watchdog.log, regel 05:01)

## Opvolgpattern (empirisch)
- **2-3 werkdagen na offerte:** 1e check (bv. Luuk Post zou al 2e check fällig zijn)
- **7-10 dagen:** 2e inhoudelijk check (Rowie Post = dag 10, Luuk Post = dag 26, dus OVERDUE)
- **14+ dagen:** afsluiting/escalatie (Luuk Post al voorbij, URGENT)

## Volgende dienst (11-9, 07:05)
**Snapshot vandaag**: 51 klanten wachten, 20 aanbod-items, 0 reacties.

- **Luuk Post**: V#1 PENDING — nu dag 29, URGENT re-escalatie nodig. Voorstel: Daimy toestemming kantoor bellen. 
- **Rowie Post**: 43u stil, adres nog incompleet (Sunny WhatsApp onderweg). ETA: deze week do/vr.
- **Husain Kapadia**: Inmeting 01-10 11:00 bevestigd (Sjoerd #1343), geen actie.
- **Aanbod-replies monitoring**: 20 items, 0 reacties, routing aan kantoor/Sunny.
- **Escalatie-watch**: Parallel proces (opvolging.log), niet mijn domein.

## Blokkades (ander domein)
- Outlook-Planado sync: 1 FOUT per sync (422-rate-limit) — Techniek handelt af
- Wa-luisteraar offline (permanente job) — Techniek/Brein alarm
- Google-ads credentials ontbreken (Techniek, Daimy moet verstrekken)
