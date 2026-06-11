# ZAP-11: Review Request — Setup Guide

> Na de eindfactuur → 24h wachten → WhatsApp review verzoek via Trengo

---

## Overzicht

| Eigenschap | Waarde |
|---|---|
| **Trigger** | HubSpot deal bereikt stage "Eindfactuur Verstuurd" (ID: 5003032771) |
| **Vertraging** | 24 uur |
| **Actie** | Trengo WhatsApp bericht met Google Review link |
| **Resultaat** | Deal wordt verplaatst naar "Afgerond" (ID: 4999295194) |
| **Template** | WA-04 (review verzoek) |

---

## Zapier Setup (5 stappen)

### Stap 1: Trigger
- **App**: HubSpot
- **Event**: Deal property change
- **Property**: `dealstage`
- **Value**: `5003032771` (Eindfactuur Verstuurd)
- **Account**: daimy@sonty.nl

### Stap 2: Delay
- **App**: Delay by Zapier
- **Event**: Delay For
- **Duration**: 24 hours

### Stap 3: HubSpot — Get Contact
- **App**: HubSpot
- **Event**: Get Associated Contact
- **Deal ID**: van stap 1
- **Properties ophalen**: firstname, phone, product_categorie

### Stap 4: Trengo — Send WhatsApp
- **App**: Trengo
- **Event**: Send Message
- **Channel**: WhatsApp
- **To**: telefoon van contact (stap 3)
- **Message**:
```
Hoi {{firstname}}! Hoe bevalt je nieuwe {{product_categorie}}? 😊

We zouden het super waarderen als je een korte review wilt achterlaten. Het kost maar 1 minuutje:

⭐ https://g.page/r/sonty/review

Bedankt! 🙏
```

### Stap 5: HubSpot — Update Deal
- **App**: HubSpot
- **Event**: Update Deal
- **Deal ID**: van stap 1
- **Property**: `dealstage` → `4999295194` (Afgerond)
- **Property**: `review_verstuurd` → `true`

---

## Google Review Link

`https://share.google/PJvRglQb3phyKVwP3`

---

## Test Flow

1. Maak een test deal aan in HubSpot
2. Verplaats naar "Eindfactuur Verstuurd"
3. Wacht 24 uur (of pas delay aan naar 5 min voor test)
4. Check of WhatsApp bericht is verstuurd via Trengo
5. Check of deal is verplaatst naar "Afgerond"
