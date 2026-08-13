# Sonty Klaviyo flow-plan

LET OP (2026-08-13): het echte, uitvoerende systeem staat in `~/sonty/scripts/email/` en bestond al (gebouwd 27-28 juli, oplevercheck gedraaid, akkoord-mail 6 aug bijgewerkt). DIT document is de strategielaag; de bouwinstructie per flow staat in `scripts/email/FLOWS.md` en de schrijfstijl in `scripts/email/STIJL.md` plus `SONTY-MAILSTIJLGIDS.md` hier.

## Wat er al staat (niet opnieuw bouwen)

- Dagelijkse datasync 06:30 (launchd nl.sonty.email-sync): RP-export → opt-outs → Klaviyo-profielen met sonty_fase (vers/lopend/koud/zeer_koud/klant), sonty_offerte_link, bedrag, product, weermoment. Ruim 12.000 profielen in segmenten Sonty | 1 t/m 9 + W1-3.
- 18 templates in Klaviyo (A-serie offerte-opvolging, C reactivering, D cross-sell, E service/review, G welkom, RP1-5 Reuzenpanda-vervangers, W1-3 weerflows), gebouwd met eigen foto's, echte reviews, garantie 3/5/7.
- Veiligheidsprincipes uit dat systeem: profielen NOOIT aan lijsten toevoegen (live 2024-flow triggert op lijst!), segmenten kunnen geen flow starten, sync verstuurt niets, flows handmatig in de UI bouwen en pas aan na expliciet akkoord Daimy per flow, aanzetvolgorde in FLOWS.md (G1 en RP1 eerst, reactivering als laatste in blokken van 200).

## Status akkoorden Daimy

- 2026-08-13: key gegeven; backfill akkoord (bleek al gedaan); NIETS versturen; eerst mail-voor-mail controle door Claude (visueel, UX/UI, spelling, stijl, links) en daarna checkt Daimy elke mail zelf.

## Wekelijkse datasturing (de bot, nog te bouwen)

Wekelijks rapport (script scripts/klaviyo-week-rapport.js in deze map, default Sonty-key): per flow-mail en campagne ontvangers, clicks, conversies, omzet, RPR, unsub- en spamrate, afgezet tegen de benchmarks in KENNISBANK.md. Koppelen aan de Sonty-conversiemeting (akkoord = inkoopbedrag in sheet, per tabblad) en de mijlpalen-tijdlijn. Output wekelijks via Telegram met voorstellen; wijzigingen pas na akkoord.
