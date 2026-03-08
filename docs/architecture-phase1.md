# Sonty — Phase 1 Architecture (Low Maintenance)

> Status: Active design direction
> Last updated: 2026-03-08
> Approach: HubSpot + Zapier — no self-hosted infrastructure

---

## Design Philosophy

The previous architecture assumed a self-hosted n8n stack on a VPS. This redesign
prioritizes:

- **Zero server management** in phase 1
- **Proven SaaS tools** with existing HubSpot and Gripp connectors
- **Fast time to working system** — days, not weeks
- **Upgrade path preserved** — a VPS can be added later if justified

The rule for phase 1: **only add complexity when a simpler option doesn't exist.**

---

## 1. The Simplest Working Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     LEAD ACQUISITION                            │
│          Meta Ads · Google Ads · Pinterest · Organic            │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Zapier: lead form → HubSpot
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   HubSpot CRM  (Central)                        │
│                                                                 │
│  Contacts · Deals · Pipeline · Sequences · Tasks · Notes        │
│                                                                 │
│  Native workflows handle:                                       │
│  · Task creation for call attempts                              │
│  · Internal sales rep notifications                             │
│  · Email sequences (follow-ups)                                 │
│  · Deal stage automation                                        │
└──────┬──────────────────────────────────────────┬──────────────┘
       │  HubSpot deal stage change triggers       │
       ▼                                           ▼
┌─────────────┐                          ┌─────────────────────┐
│   Zapier    │◄─────────────────────────│   HubSpot webhook   │
│ (Automation │                          └─────────────────────┘
│   Layer)    │
└──┬──┬──┬───┘
   │  │  │
   ▼  ▼  ▼
┌──────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐
│Gripp │ │Reuzen-   │ │  MS Bookings │ │  WhatsApp    │
│      │ │panda     │ │  (via Graph  │ │  (via Twilio │
│      │ │          │ │   API)       │ │   or 360d)   │
└──────┘ └──────────┘ └──────────────┘ └──────────────┘
```

**No VPS. No Docker. No server maintenance.**

Everything runs on managed SaaS infrastructure. If Zapier goes down, HubSpot
keeps working. If HubSpot goes down, Zapier pauses. There is no server to patch,
restart, or monitor.

---

## 2. System Roles (Phase 1)

| System | Role | Managed by |
|---|---|---|
| **HubSpot** | CRM, pipeline, email sequences, tasks, deal data | HubSpot SaaS |
| **Zapier** | Cross-system automation triggers and actions | Zapier SaaS |
| **Reuzenpanda** | Product config + first quote PDF | Reuzenpanda SaaS |
| **Gripp** | Final quote, invoices, payment tracking | Gripp SaaS |
| **MS Bookings** | Measurement + installation appointments | Microsoft 365 |
| **Outlook** | Email (via HubSpot native sync or Zapier) | Microsoft 365 |
| **WhatsApp** | Follow-up messages (via Twilio or 360dialog) | Twilio / 360d SaaS |
| **Meta / Google / Pinterest** | Lead acquisition | Ad platform SaaS |

No self-hosted components in phase 1.

---

## 3. Workflows Zapier Should Handle

Zapier handles anything that crosses system boundaries and cannot be done natively
in HubSpot.

### ZAP-01: Lead Intake from Ad Platforms

```
TRIGGER:  Meta Lead Ads / Google Lead Form submission
ACTION 1: Search HubSpot contacts by email — check for duplicate
ACTION 2: Create or update HubSpot contact
ACTION 3: Create HubSpot deal (stage: New Lead)
ACTION 4: Set custom properties (platform, UTM, product interest)
```

Why Zapier and not native: HubSpot's native Meta/Google lead sync exists but
has limited field mapping. Zapier gives full control over deduplication and
custom property population.

---

### ZAP-02: First Quote via Reuzenpanda

```
TRIGGER:  HubSpot deal moves to stage "First Quote Triggered"
          (set by HubSpot workflow after 2 failed call attempts)
ACTION 1: Call Reuzenpanda API — generate quote for product + postal code
ACTION 2: Update HubSpot deal with quote amount + PDF link
ACTION 3: Send email via HubSpot (using HubSpot's send email action)
          OR send via Outlook using Microsoft Graph
```

Why Zapier and not native: Reuzenpanda has no native HubSpot integration.
Zapier bridges the gap via Reuzenpanda's API using a Zapier webhook or
Code step.

---

### ZAP-03: Schedule Measurement (Microsoft Bookings)

```
TRIGGER:  HubSpot deal moves to stage "Measurement Scheduled"
ACTION 1: Create appointment in Microsoft Bookings via Graph API
          (Zapier Code step or Webhooks by Zapier)
ACTION 2: Update HubSpot deal with appointment date/ID
ACTION 3: Send confirmation email via HubSpot or Outlook
ACTION 4: Send WhatsApp confirmation (if opt-in)
```

Why Zapier and not native: No native HubSpot ↔ Bookings connector.

---

### ZAP-04: Create Final Quote in Gripp

```
TRIGGER:  HubSpot deal moves to stage "Final Quote"
ACTION 1: Create quote in Gripp via Gripp API
ACTION 2: Fetch quote PDF URL from Gripp
ACTION 3: Update HubSpot deal with Gripp quote ID + amount
ACTION 4: Send final quote email (HubSpot or Outlook)
```

---

### ZAP-05: Create Deposit Invoice (Deal Won)

```
TRIGGER:  HubSpot deal moves to stage "Won"
ACTION 1: Create deposit invoice in Gripp (50% of deal amount)
ACTION 2: Update HubSpot deal with invoice ID
ACTION 3: Send deposit invoice email via HubSpot
```

---

### ZAP-06: Payment Confirmed → Notify Operations

```
TRIGGER:  Gripp invoice status changes to "Paid"
          (Zapier polls Gripp API every 15 min, or webhook if available)
ACTION 1: Update HubSpot deal stage to "Deposit Received"
ACTION 2: Create HubSpot task: "Order products"
ACTION 3: Send internal WhatsApp or email to operations team
```

---

### ZAP-07: Schedule Installation

```
TRIGGER:  HubSpot deal moves to stage "Products Arrived"
ACTION 1: Create installation appointment in Microsoft Bookings
ACTION 2: Update HubSpot deal with installation date
ACTION 3: Send installation confirmation to customer (email + WhatsApp)
```

---

### ZAP-08: Post-Installation Wrap-up

```
TRIGGER:  HubSpot deal moves to stage "Installation Done"
ACTION 1: Create final invoice in Gripp
ACTION 2: Update HubSpot deal with final invoice ID
ACTION 3: Send final invoice email
ACTION 4: Queue review request (24h delay via Zapier Delay step)
          → Send WhatsApp review request
```

---

### ZAP-09: WhatsApp Quote Follow-up

```
TRIGGER:  HubSpot deal remains in "First Quote Sent" for 3 days
          (HubSpot workflow sets a date property → Zapier filter checks it)
ACTION 1: Check WhatsApp opt-in property on contact
ACTION 2: Send WhatsApp follow-up via Twilio / 360dialog
ACTION 3: Log message as note in HubSpot
```

---

### Total Zapier Task Estimate (per month)

| Zap | Triggers/month | Tasks/trigger | Tasks/month |
|---|---|---|---|
| ZAP-01 Lead intake | 1,000 | 4 | 4,000 |
| ZAP-02 First quote | 600 | 3 | 1,800 |
| ZAP-03 Measurement | 150 | 4 | 600 |
| ZAP-04 Final quote | 130 | 4 | 520 |
| ZAP-05 Deposit invoice | 100 | 3 | 300 |
| ZAP-06 Payment confirmed | 100 | 3 | 300 |
| ZAP-07 Installation | 95 | 3 | 285 |
| ZAP-08 Post-installation | 90 | 4 | 360 |
| ZAP-09 WhatsApp follow-up | 400 | 3 | 1,200 |
| **Total** | | | **~9,400** |

Required Zapier plan: **Professional** (~$79/month for 10,000 tasks/month) or
**Team** (~$99/month) for multi-user access.

---

## 4. Workflows That Stay Native in HubSpot

HubSpot Workflows (available in Sales Hub Professional) handle everything that
stays within HubSpot — no external system calls needed.

### HS-WF-01: Call Attempt Task Creation

```
TRIGGER:  Deal created (stage: New Lead)
DELAY:    1 business hour
ACTION:   Create task "Bel [Firstname] – Poging 1" → assign to deal owner
DELAY:    24 business hours (if deal still in same stage)
ACTION:   Create task "Bel [Firstname] – Poging 2"
DELAY:    4 hours (if deal still in same stage)
ACTION:   Set deal property "First Quote Triggered" = true
          → This triggers ZAP-02
```

### HS-WF-02: Internal Notifications

```
TRIGGER:  Deal stage changes (any stage)
ACTION:   Send internal email notification to deal owner
          e.g. "Deal [Name] moved to [Stage] — action required"
```

### HS-WF-03: Email Sequences (Follow-up)

HubSpot Sequences (available in Sales Hub Professional) send automated
1:1 emails from the sales rep's mailbox:

- Sequence 1: Post-first-quote nurture (3 emails over 7 days)
- Sequence 2: Post-measurement follow-up (if no final quote in 3 days)
- Sequence 3: Post-won onboarding (confirmation, what to expect)

These are personal, reply-aware emails — they stop automatically when the
customer replies. This is better handled by HubSpot than Zapier.

### HS-WF-04: Deal Stage Automation

```
TRIGGER:  Contact replies to email (HubSpot email activity)
ACTION:   Move deal to "In Contact" if currently in call-attempt stage
          Notify deal owner
```

### HS-WF-05: Lost Deal Cleanup

```
TRIGGER:  Deal marked "Lost"
ACTION:   Set close date
          Log loss reason
          Remove from active sequences
          Create re-engagement task for 90 days later
```

### HS-WF-06: Stale Deal Alert

```
TRIGGER:  Deal has not changed stage in 7 days
ACTION:   Create task for owner: "Follow up — deal stalled"
          Send internal alert email
```

---

## 5. Parts That May Need Custom API Work Later

These are not needed in phase 1 but become relevant as the system matures.

| Feature | Why native/Zapier is limited | Custom solution |
|---|---|---|
| **Reuzenpanda quote generation** | Zapier Code step works but is fragile for complex payloads | Lightweight API wrapper script or Make.com HTTP module |
| **Gripp payment polling** | Zapier polls on a schedule — 15-min delay is acceptable but not instant | Gripp webhook → direct n8n or VPS listener |
| **Reporting / KPI dashboard** | HubSpot reports are good but can't easily combine Gripp revenue + ad spend | Postgres + Grafana (VPS justified here) |
| **Microsoft Bookings via Graph API** | Zapier has no native Bookings connector — requires Webhooks by Zapier + Code step | Could use Make.com which has better Graph API support |
| **WhatsApp template management** | WhatsApp Business templates must be pre-approved by Meta; Twilio/360dialog abstracts this | If volume grows, direct Meta Business Cloud API is cheaper |
| **Bi-directional HubSpot ↔ Gripp sync** | Zapier handles one-way well; complex two-way sync (e.g. quote edits) needs logic | Dedicated sync script or n8n |
| **Multi-step error handling** | Zapier has basic error paths; complex retry logic with fallback tasks is limited | n8n handles this much better |

**Rule:** Move something to custom API work only when Zapier's limitations are
causing real operational problems — not before.

---

## 6. When a VPS Becomes Justified

A VPS (running n8n or similar) earns its maintenance cost when **at least two**
of these conditions are true:

| Condition | Signal |
|---|---|
| Zapier task volume exceeds 20,000/month | Monthly Zapier cost approaches €150+ |
| Reporting needs cross-system data (Gripp + HubSpot + Ads) | Owner asks for revenue dashboards that HubSpot can't produce |
| Gripp payment delays cause ops problems | 15-minute polling is too slow; real-time webhook needed |
| Reuzenpanda integration breaks regularly | Zapier Code steps become fragile; a proper API client is needed |
| WhatsApp message volume grows significantly | Per-message cost via Twilio becomes meaningful vs. direct Meta API |
| Complex multi-branch workflow logic needed | More than 3 conditional paths in a single Zap |

**Estimated trigger point:** ~18–24 months after go-live, if the business hits
~2,000+ leads/month or conversion improves significantly.

Until then, the VPS architecture is documented (`docs/vps-architecture.md`) and
ready to implement — but not running.

---

## 7. Cost and Complexity Comparison

### Option A: HubSpot + Zapier (Phase 1 Recommendation)

| Item | Cost/month | Notes |
|---|---|---|
| HubSpot Sales Hub Professional | ~€90–100 | 2 users; required for Sequences + Workflows |
| HubSpot Marketing Hub Starter | ~€18 | Optional; for ad platform native sync |
| Zapier Professional | ~€75–85 | ~10,000 tasks/month |
| Twilio / 360dialog (WhatsApp) | ~€10–30 | Depends on message volume |
| Microsoft 365 (Outlook + Bookings) | ~€12/user | Already in use |
| **Total** | **~€205–250/month** | |

**Complexity:**
- Setup time: **1–3 weeks** for a non-developer with basic Zapier knowledge
- Maintenance: **~1–2 hours/month** — monitoring Zap errors, updating field mappings
- Failure mode: Zap fails → email alert → fix mapping → re-run. No server down.
- Skills required: HubSpot admin, Zapier builder. No DevOps.

---

### Option B: HubSpot + Self-hosted n8n on VPS

| Item | Cost/month | Notes |
|---|---|---|
| HubSpot Sales Hub Professional | ~€90–100 | Same as above |
| Hetzner VPS (CPX21) | ~€8–12 | 4 vCPU / 8 GB |
| n8n (self-hosted, free) | €0 | But requires setup and maintenance |
| Hetzner Object Storage (backups) | ~€3–5 | |
| Domain + SSL | ~€1–2 | Let's Encrypt = free; domain ~€1 |
| **Total** | **~€102–120/month** | |

**Complexity:**
- Setup time: **2–6 weeks** for a developer familiar with Docker, Linux, Nginx
- Maintenance: **3–6 hours/month** — updates, monitoring, SSL renewal checks,
  backup verification, debugging failed workflows
- Failure mode: Container crashes / disk full / SSL expires → system goes down
  until someone fixes the server
- Skills required: HubSpot admin, n8n builder, Linux/Docker, basic DevOps.

---

### Side-by-side Summary

| Dimension | HubSpot + Zapier | HubSpot + n8n VPS |
|---|---|---|
| Monthly cost | ~€205–250 | ~€102–120 |
| Setup time | 1–3 weeks | 3–6 weeks |
| Maintenance | Low (1–2 h/month) | Medium (3–6 h/month) |
| Server management | None | Required |
| Failure risk | Zap errors (recoverable) | Server down (blocks all workflows) |
| Custom logic capability | Limited (Zapier Code) | High (full code in n8n) |
| Reporting/dashboards | HubSpot reports only | Postgres + Grafana (custom) |
| Multi-step error handling | Basic | Advanced |
| Scalability | Limited by task pricing | Unlimited (fixed server cost) |
| DevOps skills needed | No | Yes |
| Best for | Phase 1 — fast, stable, low risk | Phase 2 — high volume, custom logic |

---

### Cost Crossover Point

Zapier becomes more expensive than a VPS around **15,000–20,000 tasks/month**.

At 1,000 leads/month with current conversion: ~9,400 tasks (see section 3).
At 2,000 leads/month: ~18,000 tasks → approaching the crossover.
At 2,000+ leads/month or meaningful conversion improvement: **re-evaluate VPS.**

---

## 8. Recommended Tool Choices for Phase 1

| Need | Recommended tool | Why |
|---|---|---|
| CRM | HubSpot Sales Hub Professional | Full workflows, sequences, pipeline |
| Automation | Zapier Professional | Native HubSpot + Gripp connectors |
| Bookings | Microsoft Bookings | Already in Microsoft 365 |
| Email | Outlook via HubSpot sync | Native, no extra config |
| WhatsApp | 360dialog + Zapier | Best HubSpot-compatible WhatsApp provider |
| Invoicing | Gripp | As-is |
| Product config | Reuzenpanda | As-is — via Zapier webhook/Code |
| Reporting | HubSpot Reports + Gripp | Sufficient for phase 1 |
| VPS / n8n | Not yet | Document in place, deploy when justified |

---

## 9. Phase 1 Implementation Order

```
Week 1
  □ Configure HubSpot pipeline with correct stage names
  □ Create all custom contact + deal properties
  □ Connect HubSpot to Outlook (native sync)
  □ Connect Meta + Google lead forms → HubSpot (native or ZAP-01)

Week 2
  □ Build HubSpot native workflows (HS-WF-01 through HS-WF-06)
  □ Build HubSpot email sequences
  □ Test full call-attempt + first-quote flow with test leads

Week 3
  □ Build ZAP-02 (Reuzenpanda first quote)
  □ Build ZAP-03 (Bookings measurement)
  □ Build ZAP-04 + ZAP-05 (Gripp quote + deposit invoice)
  □ Test end-to-end: New Lead → Won → Deposit Invoice

Week 4
  □ Build ZAP-06 + ZAP-07 + ZAP-08 (payment → installation → wrap-up)
  □ Set up WhatsApp via 360dialog + ZAP-09
  □ Full pipeline test with synthetic leads
  □ Train staff on HubSpot pipeline usage
  □ Go live
```

---

## 10. What This Architecture Does Not Include (Phase 1)

| Feature | Status | When to add |
|---|---|---|
| Postgres reporting database | Not included | When owner needs cross-system revenue dashboards |
| Grafana dashboards | Not included | With Postgres |
| Real-time payment webhooks | Not included | If 15-min polling causes ops problems |
| n8n on VPS | Not included | When Zapier costs or limitations justify it |
| Custom API integrations | Not included | When Zapier Code steps prove too fragile |
| Automated ad spend reporting | Not included | HubSpot's ad reporting is sufficient for phase 1 |
