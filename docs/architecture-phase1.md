# Sonty — Phase 1 Architecture

> Status: Active design direction
> Last updated: 2026-03-10
> Approach: HubSpot + Zapier + Reuzenpanda + Planado + Gripp + Trengo

---

## Design Philosophy

Phase 1 uses fully managed SaaS tools. The guiding rule:

**Only add complexity when a simpler option does not exist.**

---

## 1. Customer Flow (18 Steps)

```
 1. Lead enters Reuzenpanda configurator (via Meta/Google/Pinterest ads)
 2. Lead + deal created in HubSpot
 3. Sales performs call attempts
 4. Price indication sent by email
 5. WhatsApp message sent via Trengo (randomized templates)
 6. Customer responds via WhatsApp
 7. Customer agrees → measurement scheduled in Planado
 8. Measurement completed
 9. Final quote created in Gripp
10. Customer approves final quote
11. Deposit invoice sent
12. Products ordered from supplier
13. Supplier sends order confirmation to orders@sonty.nl
14. HubSpot deal updated
15. Installation scheduled in Planado
16. Installation completed
17. Final invoice sent via Gripp
18. Review request sent via Trengo
```

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     LEAD ACQUISITION                            │
│          Meta Ads · Google Ads · Pinterest Ads                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Ads link to configurator
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Reuzenpanda Configurator                            │
│              Lead enters config → first price indication         │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Zapier: new lead → HubSpot
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   HubSpot CRM  (Central)                        │
│                                                                 │
│  Contacts · Deals · Pipeline · Tasks · Notes                    │
│                                                                 │
│  Native workflows handle:                                       │
│  · Task creation for call attempts                              │
│  · Internal notifications                                       │
│  · Deal stage automation                                        │
└──────┬──────────────────────────────────┬───────────────────────┘
       │  Deal stage changes               │ Planado webhooks
       ▼                                   ▼
┌─────────────┐                  ┌─────────────────────────────┐
│   Zapier    │◄─────────────────│  Planado (field operations)  │
│ (Automation │                  │                              │
│   Layer)    │────────────────► │  · Measurement jobs          │
└──┬──┬──┬───┘                  │  · Installation jobs          │
   │  │  │                      │  · Dispatcher interface       │
   ▼  ▼  ▼                      │  · Field worker mobile app    │
┌──────┐ ┌──────────┐           └──────────────────────────────┘
│Gripp │ │ Trengo   │
│      │ │(WhatsApp)│
└──────┘ └──────────┘

Email: orders@sonty.nl → Zapier (order confirmation trigger)
```

**No VPS. No Docker. No server maintenance.**

---

## 3. System Roles

| System | Role |
|---|---|
| **Reuzenpanda** | Product configurator + first price indication (entry point) |
| **HubSpot** | Central CRM — contacts, deals, pipeline, tasks, deal data |
| **Zapier** | Cross-system automation triggers and actions |
| **Planado** | Field operations: measurement + installation jobs |
| **Gripp** | Final quotes, invoices, payment tracking |
| **Trengo** | WhatsApp messaging (follow-up + review requests) |
| **Meta / Google / Pinterest** | Lead acquisition (ads → Reuzenpanda configurator) |
| **Outlook** | Email (orders@sonty.nl for supplier confirmations) |

---

## 4. HubSpot Pipeline Stages

| # | Stage | Trigger |
|---|---|---|
| 1 | Nieuwe Lead | Reuzenpanda lead arrives via Zapier |
| 2 | Bel Poging 1 | HubSpot workflow creates call task |
| 3 | Bel Poging 2 | HubSpot workflow creates 2nd call task |
| 4 | Prijsindicatie Verstuurd | Price indication emailed |
| 5 | WhatsApp Verstuurd | Trengo sends WhatsApp follow-up |
| 6 | In Contact | Customer responds |
| 7 | Opmeting Ingepland | Measurement scheduled in Planado |
| 8 | Opmeting Afgerond | Planado job_finished webhook |
| 9 | Definitieve Offerte Verstuurd | Final quote created in Gripp |
| 10 | Offerte Akkoord | Customer approves quote |
| 11 | Aanbetaling Verstuurd | Deposit invoice sent via Gripp |
| 12 | Aanbetaling Ontvangen | Payment confirmed |
| 13 | Producten Besteld | Products ordered from supplier |
| 14 | Orderbevestiging Ontvangen | Supplier confirms via orders@sonty.nl |
| 15 | Installatie Ingepland | Installation scheduled in Planado |
| 16 | Installatie Afgerond | Planado job_finished webhook |
| 17 | Eindfactuur Verstuurd | Final invoice via Gripp |
| 18 | Afgerond | Review request sent, deal closed |

---

## 5. Zapier Workflow List

### ZAP-01: Lead Intake from Reuzenpanda

```
TRIGGER:  Reuzenpanda — new lead/configuration completed
ACTION 1: Search HubSpot contacts by email (duplicate check)
ACTION 2: Create or update HubSpot contact
ACTION 3: Create HubSpot deal (stage: Nieuwe Lead)
ACTION 4: Set properties (product interest, postal code, price indication, source)
```

---

### ZAP-02: WhatsApp Follow-up via Trengo

```
TRIGGER:  HubSpot deal moves to stage "Prijsindicatie Verstuurd"
          (after price indication email sent)
ACTION 1: Select randomized WhatsApp template
ACTION 2: Send WhatsApp message via Trengo
ACTION 3: Update HubSpot deal stage: "WhatsApp Verstuurd"
ACTION 4: Log message as note in HubSpot
```

---

### ZAP-03: Create Measurement Job in Planado

```
TRIGGER:  HubSpot deal moves to stage "Opmeting Ingepland"
ACTION 1: Create job in Planado
          · Job type: Opmeting
          · Client: contact name, phone, email, address
          · External ID: HubSpot deal ID
ACTION 2: Update HubSpot deal with Planado job ID
ACTION 3: Send confirmation email to customer
```

---

### ZAP-04: Measurement Completed

```
TRIGGER:  Planado webhook — job_finished (type: Opmeting)
ACTION 1: Update HubSpot deal stage: "Opmeting Afgerond"
ACTION 2: Create HubSpot task: "Maak definitieve offerte in Gripp"
```

---

### ZAP-05: Final Quote via Gripp

```
TRIGGER:  HubSpot deal moves to stage "Definitieve Offerte Verstuurd"
ACTION 1: Create quote in Gripp
ACTION 2: Update HubSpot deal with Gripp quote ID + amount
ACTION 3: Send final quote email to customer
```

---

### ZAP-06: Deposit Invoice

```
TRIGGER:  HubSpot deal moves to stage "Offerte Akkoord"
ACTION 1: Create deposit invoice in Gripp (50% of deal amount)
ACTION 2: Update HubSpot deal with invoice ID
ACTION 3: Send deposit invoice email
ACTION 4: Update deal stage: "Aanbetaling Verstuurd"
```

---

### ZAP-07: Order Confirmation from Supplier

```
TRIGGER:  Email received at orders@sonty.nl (Zapier Email Parser or Outlook trigger)
ACTION 1: Parse order confirmation (deal reference, product details)
ACTION 2: Update HubSpot deal stage: "Orderbevestiging Ontvangen"
ACTION 3: Create HubSpot task: "Plan installatie"
```

---

### ZAP-08: Create Installation Job in Planado

```
TRIGGER:  HubSpot deal moves to stage "Installatie Ingepland"
ACTION 1: Create job in Planado
          · Job type: Installatie
          · Client: contact name, phone, email, address
          · External ID: HubSpot deal ID
ACTION 2: Update HubSpot deal with Planado job ID + installation date
ACTION 3: Send installation confirmation email to customer
```

---

### ZAP-09: Installation Completed

```
TRIGGER:  Planado webhook — job_finished (type: Installatie)
ACTION 1: Update HubSpot deal stage: "Installatie Afgerond"
ACTION 2: Create HubSpot task: "Stuur eindfactuur"
```

---

### ZAP-10: Final Invoice via Gripp

```
TRIGGER:  HubSpot deal moves to stage "Eindfactuur Verstuurd"
ACTION 1: Create final invoice in Gripp (remaining 50%)
ACTION 2: Update HubSpot deal with invoice ID
ACTION 3: Send final invoice email to customer
```

---

### ZAP-11: Review Request via Trengo

```
TRIGGER:  HubSpot deal moves to stage "Eindfactuur Verstuurd"
          (with 24-hour delay)
ACTION 1: Send review request via Trengo (WhatsApp)
ACTION 2: Update HubSpot deal stage: "Afgerond"
ACTION 3: Log in HubSpot
```

---

### Total: 11 Zapier Zaps

---

## 6. HubSpot Native Workflows

These stay inside HubSpot — no external calls needed.

| ID | Workflow | Description |
|---|---|---|
| WF-01 | Call Attempt Tasks | Nieuwe Lead → create "Bel Poging 1" task (1h delay) → "Bel Poging 2" (24h) |
| WF-02 | Internal Notifications | Deal stage changes → notify deal owner |
| WF-03 | Stale Deal Alert | No stage change in 7 days → create task + alert |
| WF-04 | Lost Deal Cleanup | Mark lost → set close date, log reason |

---

## 7. Minimum Tools (Phase 1)

| Tool | Purpose | Required |
|---|---|---|
| Reuzenpanda | Product configurator + first price indication | Yes |
| HubSpot | CRM + pipeline + workflows | Yes |
| Zapier | Cross-system automation | Yes |
| Planado | Measurements + installations (field ops) | Yes |
| Gripp | Final quotes + invoices | Yes |
| Trengo | WhatsApp messaging | Yes |
| Outlook | Email (incl. orders@sonty.nl) | Yes |
| Meta / Google / Pinterest | Lead acquisition | Yes |

**7 tools + 3 ad platforms.**

---

## 8. Implementation Order

```
Week 1
  □ Update HubSpot pipeline stages (18 stages per new flow)
  □ Update custom properties
  □ Set up HubSpot native workflows (WF-01 to WF-04)
  □ Connect Reuzenpanda to Zapier (ZAP-01)
  □ Connect Trengo to Zapier

Week 2
  □ Build ZAP-02 (WhatsApp follow-up via Trengo)
  □ Build ZAP-03 + ZAP-04 (Planado measurement)
  □ Build ZAP-05 + ZAP-06 (Gripp quotes + deposit)
  □ Test: lead → price indication → measurement flow

Week 3
  □ Build ZAP-07 (order confirmation email parsing)
  □ Build ZAP-08 + ZAP-09 (Planado installation)
  □ Build ZAP-10 + ZAP-11 (final invoice + review request)
  □ Full pipeline test with synthetic leads
  □ Go live
```
