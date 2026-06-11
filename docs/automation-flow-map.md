# Sonty — Automation Flow Map

> Status: Active design
> Last updated: 2026-03-10

---

## Customer Journey (18 Steps)

```
┌──────────────────────────────────────────────────────────────────┐
│  1. Lead enters Reuzenpanda configurator                         │
│     (via Meta / Google / Pinterest ad)                           │
│                                                                  │
│  2. Reuzenpanda generates first price indication                 │
│     → ZAP-01: Lead + deal created in HubSpot                    │
│                                                                  │
│  3. Sales performs call attempts                                  │
│     → WF-01: HubSpot creates call tasks                         │
│                                                                  │
│  4. Price indication sent by email                               │
│     → Sales sends from HubSpot                                  │
│                                                                  │
│  5. WhatsApp follow-up via Trengo                                │
│     → ZAP-02: randomized templates                              │
│                                                                  │
│  6. Customer responds via WhatsApp                               │
│     → Handled in Trengo                                         │
│                                                                  │
│  7. Customer agrees → measurement scheduled in Planado           │
│     → ZAP-03: HubSpot stage change → Planado job                │
│                                                                  │
│  8. Measurement completed                                        │
│     → ZAP-04: Planado webhook → HubSpot update                  │
│                                                                  │
│  9. Final quote created in Gripp                                 │
│     → ZAP-05: HubSpot → Gripp quote                            │
│                                                                  │
│ 10. Customer approves final quote                                │
│     → Sales marks in HubSpot                                    │
│                                                                  │
│ 11. Deposit invoice sent                                         │
│     → ZAP-06: HubSpot → Gripp invoice                          │
│                                                                  │
│ 12. Products ordered from supplier                               │
│     → Manual by operations                                      │
│                                                                  │
│ 13. Supplier sends order confirmation to orders@sonty.nl         │
│     → ZAP-07: Email → HubSpot update                           │
│                                                                  │
│ 14. HubSpot deal updated (via ZAP-07)                            │
│                                                                  │
│ 15. Installation scheduled in Planado                            │
│     → ZAP-08: HubSpot stage change → Planado job                │
│                                                                  │
│ 16. Installation completed                                       │
│     → ZAP-09: Planado webhook → HubSpot update                  │
│                                                                  │
│ 17. Final invoice sent via Gripp                                 │
│     → ZAP-10: HubSpot → Gripp invoice                          │
│                                                                  │
│ 18. Review request sent via Trengo                               │
│     → ZAP-11: WhatsApp review request → deal closed             │
└──────────────────────────────────────────────────────────────────┘
```

---

## Automation Responsibility Matrix

| Step | System | Automation | Manual? |
|---|---|---|---|
| 1 | Reuzenpanda | Customer self-service | — |
| 2 | Zapier → HubSpot | ZAP-01 | — |
| 3 | HubSpot | WF-01 (call tasks) | Sales makes calls |
| 4 | HubSpot | — | Sales sends email |
| 5 | Zapier → Trengo | ZAP-02 | — |
| 6 | Trengo | — | Sales handles response |
| 7 | Zapier → Planado | ZAP-03 | Sales sets stage |
| 8 | Planado → Zapier → HubSpot | ZAP-04 | — |
| 9 | Zapier → Gripp | ZAP-05 | Sales triggers |
| 10 | HubSpot | — | Sales marks approval |
| 11 | Zapier → Gripp | ZAP-06 | — |
| 12 | — | — | Operations orders |
| 13 | Email → Zapier → HubSpot | ZAP-07 | — |
| 14 | HubSpot | Via ZAP-07 | — |
| 15 | Zapier → Planado | ZAP-08 | Dispatcher sets date |
| 16 | Planado → Zapier → HubSpot | ZAP-09 | — |
| 17 | Zapier → Gripp | ZAP-10 | — |
| 18 | Zapier → Trengo | ZAP-11 | — |

---

## Zapier Zaps Summary

| ID | Name | Trigger | Action |
|---|---|---|---|
| ZAP-01 | Lead Intake | Reuzenpanda new lead | Create HubSpot contact + deal |
| ZAP-02 | WhatsApp Follow-up | HubSpot stage: Prijsindicatie Verstuurd | Trengo WhatsApp (random template) |
| ZAP-03 | Schedule Measurement | HubSpot stage: Opmeting Ingepland | Planado create job (Opmeting) |
| ZAP-04 | Measurement Done | Planado job_finished (Opmeting) | HubSpot stage update + task |
| ZAP-05 | Final Quote | HubSpot stage: Definitieve Offerte | Gripp create quote |
| ZAP-06 | Deposit Invoice | HubSpot stage: Offerte Akkoord | Gripp create invoice (50%) |
| ZAP-07 | Order Confirmation | Email at orders@sonty.nl | HubSpot stage update |
| ZAP-08 | Schedule Installation | HubSpot stage: Installatie Ingepland | Planado create job (Installatie) |
| ZAP-09 | Installation Done | Planado job_finished (Installatie) | HubSpot stage update + task |
| ZAP-10 | Final Invoice | HubSpot stage: Eindfactuur | Gripp create invoice (50%) |
| ZAP-11 | Review Request | HubSpot stage: Eindfactuur (24h delay) | Trengo WhatsApp review |

---

## HubSpot Native Workflows

| ID | Name | Trigger | Action |
|---|---|---|---|
| WF-01 | Call Attempt Tasks | New deal (Nieuwe Lead) | Create call tasks (1h + 24h delay) |
| WF-02 | Internal Notifications | Any stage change | Notify deal owner |
| WF-03 | Stale Deal Alert | No change 7 days | Create task + alert |
| WF-04 | Lost Deal Cleanup | Deal marked lost | Close date + log reason |

---

## Business Hours

- **Monday–Friday: 08:30–18:00**
- **Saturday: 09:00–13:00**
- **Sunday + public holidays: no automated outreach**
