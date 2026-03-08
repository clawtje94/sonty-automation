# Sonty — System Diagram

> Status: Design phase. No live systems connected.
> Last updated: 2026-03-08

---

## Full System Map

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                          LEAD ACQUISITION                                    ║
║                                                                              ║
║   ┌────────────┐   ┌─────────────┐   ┌───────────────┐   ┌──────────────┐   ║
║   │ Meta Ads   │   │ Google Ads  │   │ Pinterest Ads │   │ Organic /    │   ║
║   │ Lead Forms │   │ Lead Forms  │   │               │   │ Direct       │   ║
║   └─────┬──────┘   └──────┬──────┘   └───────┬───────┘   └──────┬───────┘   ║
╚═════════╪═════════════════╪═══════════════════╪══════════════════╪═══════════╝
          │                 │                   │                  │
          └─────────────────┴───────────────────┴──────────────────┘
                                      │
                              Webhook / API push
                                      │
                                      ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                        HubSpot CRM  (Central)                                ║
║                                                                              ║
║   ┌─────────────────────────────────────────────────────────────────────┐   ║
║   │  Contacts   │   Deals    │  Pipeline   │  Activities  │   Notes     │   ║
║   └─────────────────────────────────────────────────────────────────────┘   ║
║                                                                              ║
║   ┌─────────────────────────────────────────────────────────────────────┐   ║
║   │  Sequences (email)  │  Tasks  │  Call log  │  Deal associations      │   ║
║   └─────────────────────────────────────────────────────────────────────┘   ║
╚══════════╤════════════════════════════════════════════════════════╤══════════╝
           │  HubSpot webhooks (deal stage changes, contact events) │
           ▼                                                        │
╔══════════════════════════════════════════════════════════════════════════════╗
║                     n8n AUTOMATION ENGINE  (VPS)                             ║
║                                                                              ║
║   ┌──────────────────────┐    ┌──────────────────────────────────────────┐  ║
║   │ Workflow Triggers     │    │ Workflow Logic                           │  ║
║   │  · HubSpot webhooks  │    │  · Call attempt timers                   │  ║
║   │  · Scheduled crons   │    │  · Quote send logic                      │  ║
║   │  · Inbound webhooks  │    │  · Stage progression rules               │  ║
║   │  · Manual triggers   │    │  · Follow-up sequencing                  │  ║
║   └──────────────────────┘    └──────────────────────────────────────────┘  ║
╚═══╤════════════╤═══════════════╤══════════════╤══════════════╤══════════════╝
    │            │               │              │              │
    ▼            ▼               ▼              ▼              ▼
┌────────┐  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐
│Outlook │  │WhatsApp │  │Reuzen-   │  │Microsoft  │  │    Gripp       │
│  API   │  │Business │  │panda API │  │Bookings   │  │ Quotes/Invoice │
│        │  │  API    │  │          │  │   API     │  │    API         │
└────────┘  └─────────┘  └──────────┘  └───────────┘  └───────────────┘
                                                                │
                                                    Payment confirmed
                                                                │
                                                                ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                     Postgres REPORTING DATABASE  (VPS)                       ║
║                                                                              ║
║   leads  │  deals  │  funnel_events  │  revenue  │  kpi_snapshots           ║
╚══════════════════════════════════════════════════════╤═══════════════════════╝
                                                       │
                                                       ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                          DASHBOARD LAYER                                     ║
║                                                                              ║
║   ┌───────────────────┐  ┌────────────────────┐  ┌───────────────────────┐  ║
║   │  Conversion Funnel │  │  Revenue Tracker   │  │  Lead Source Report   │  ║
║   └───────────────────┘  └────────────────────┘  └───────────────────────┘  ║
║   ┌───────────────────┐  ┌────────────────────┐                             ║
║   │  Pipeline Overview │  │  Follow-up Status  │                             ║
║   └───────────────────┘  └────────────────────┘                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Communication Channels per Stage

| Stage | Channel | System |
|---|---|---|
| Lead created | — | HubSpot (auto) |
| Call attempt 1 & 2 | Phone (logged manually or via VoIP) | HubSpot task |
| First quote | Email | Outlook → HubSpot |
| Quote follow-up | WhatsApp | WhatsApp Business API |
| Measurement booking | Email + booking link | Microsoft Bookings |
| Final quote | Email + PDF | Gripp → Outlook |
| Deposit invoice | Email + PDF | Gripp → Outlook |
| Installation scheduling | Email | Microsoft Bookings |
| Final invoice | Email + PDF | Gripp → Outlook |
| Review request | Email + WhatsApp | Outlook / WhatsApp |

---

## External API Surface

| System | Integration Type | Direction |
|---|---|---|
| HubSpot | REST API + Webhooks | Bidirectional |
| Reuzenpanda | REST API | Read (quote data) |
| Microsoft Bookings | Graph API | Write (create bookings), Read (status) |
| Gripp | REST API | Write (create quotes/invoices), Read (payment status) |
| Outlook | Microsoft Graph API | Write (send email), Read (replies) |
| WhatsApp | WhatsApp Business Cloud API | Write (send messages) |
| Meta Ads | Meta Marketing API | Read (lead form data, campaign stats) |
| Google Ads | Google Ads API | Read (lead form data, campaign stats) |
| Pinterest | Pinterest API | Read (campaign stats) |
| Postgres | Direct connection (internal VPS) | Write (ETL from all systems) |
