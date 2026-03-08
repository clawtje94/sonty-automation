# Sonty — Integrations Reference

> Status: Design phase. No live systems connected.
> Last updated: 2026-03-08

---

## Integration Status

| System | Role | Auth Method | Status |
|---|---|---|---|
| HubSpot | Central CRM | Private App Token | Design |
| Reuzenpanda | Product configurator / first quote | API Key | Design |
| Microsoft Bookings | Appointment scheduling | Microsoft Graph API (OAuth) | Design |
| Gripp | Quotes and invoices | API Key | Design |
| Outlook | Email communication | Microsoft Graph API (OAuth) | Design |
| WhatsApp Business | Customer messaging | Meta Business Cloud API | Design |
| Meta Ads | Lead acquisition | OAuth + Lead Ads Webhook | Design |
| Google Ads | Lead acquisition | OAuth + Lead Form API | Design |
| Pinterest Ads | Lead acquisition | OAuth | Design |
| Postgres | Reporting database | Direct connection (internal) | Design |

---

## HubSpot

- **Purpose**: Central CRM — contacts, deals, pipeline, activities, sequences
- **Auth**: Private App Token (scopes: contacts, deals, activities, notes, owners)
- **Config key**: `HUBSPOT_API_TOKEN`
- **Sandbox**: HubSpot Developer Sandbox portal
- **Docs**: https://developers.hubspot.com/docs/api/overview
- **Folder**: `integrations/hubspot/`
- **Used by workflows**: WF-01 through WF-14

---

## Reuzenpanda

- **Purpose**: Product configurator — generates first quote based on product interest and postal code
- **Auth**: API Key (TBC — confirm with Reuzenpanda)
- **Config key**: `REUZENPANDA_API_KEY`, `REUZENPANDA_BASE_URL`
- **Sandbox**: Confirm test environment availability with Reuzenpanda
- **Folder**: `integrations/reuzenpanda/`
- **Used by workflows**: WF-04

---

## Microsoft Bookings

- **Purpose**: Scheduling measurement and installation appointments
- **Auth**: Microsoft Graph API via OAuth 2.0 (app registration in Azure AD)
- **Config keys**: `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_BOOKINGS_BUSINESS_ID`
- **Sandbox**: Separate Microsoft 365 dev tenant
- **Docs**: https://learn.microsoft.com/en-us/graph/api/resources/booking-api-overview
- **Folder**: `integrations/planning/`
- **Used by workflows**: WF-06, WF-07, WF-11, WF-12
- **Services to configure**:
  - "Opmeting" (60 min, assigned to measurement team)
  - "Installatie" (variable duration, assigned to installation team)

---

## Gripp

- **Purpose**: Create and manage quotes and invoices; read payment status
- **Auth**: API Key
- **Config key**: `GRIPP_API_KEY`, `GRIPP_BASE_URL`
- **Sandbox**: Confirm test environment with Gripp support
- **Docs**: https://developers.gripp.nl/
- **Folder**: `integrations/gripp/`
- **Used by workflows**: WF-08, WF-09, WF-10, WF-12, WF-13

---

## Outlook (Microsoft Graph)

- **Purpose**: Send transactional emails (quotes, invoices, confirmations); read replies
- **Auth**: Microsoft Graph API via OAuth 2.0 (same app registration as Bookings)
- **Config keys**: `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_SENDER_EMAIL`
- **Sandbox**: Test mailbox in dev tenant
- **Docs**: https://learn.microsoft.com/en-us/graph/api/user-sendmail
- **Folder**: `integrations/hubspot/` (email activity logged back to HubSpot)
- **Used by workflows**: WF-04, WF-06, WF-08, WF-09, WF-11, WF-12

---

## WhatsApp Business

- **Purpose**: Send follow-up messages and confirmations to customers who have opted in
- **Auth**: Meta Business Cloud API — access token per phone number
- **Config keys**: `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- **Sandbox**: Meta Developer test phone number
- **Docs**: https://developers.facebook.com/docs/whatsapp/cloud-api
- **Folder**: `integrations/hubspot/` (messages logged as notes in HubSpot)
- **Used by workflows**: WF-05, WF-06, WF-11, WF-12
- **Note**: All templates must be pre-approved by Meta before use in production

---

## Meta Ads

- **Purpose**: Receive lead form submissions; read campaign performance data
- **Auth**: OAuth 2.0 — Meta Business access token
- **Config keys**: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PIXEL_ID`
- **Sandbox**: Meta Business test ad account with test leads
- **Docs**: https://developers.facebook.com/docs/marketing-api/
- **Folder**: `integrations/ads/`
- **Used by workflows**: WF-01, WF-13

---

## Google Ads

- **Purpose**: Receive lead form submissions; read campaign performance data
- **Auth**: OAuth 2.0 — Google Ads API
- **Config keys**: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`
- **Sandbox**: Google Ads test account
- **Docs**: https://developers.google.com/google-ads/api/docs/start
- **Folder**: `integrations/ads/`
- **Used by workflows**: WF-01, WF-13

---

## Pinterest Ads

- **Purpose**: Read campaign performance data (lead volumes, spend)
- **Auth**: OAuth 2.0
- **Config keys**: `PINTEREST_ACCESS_TOKEN`, `PINTEREST_AD_ACCOUNT_ID`
- **Sandbox**: Pinterest developer app
- **Docs**: https://developers.pinterest.com/docs/api/v5/
- **Folder**: `integrations/ads/`
- **Used by workflows**: WF-13

---

## Postgres (Reporting Database)

- **Purpose**: Normalized reporting data for dashboards
- **Auth**: Username + password (internal VPS only, not exposed externally)
- **Config keys**: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- **Schema**: Defined in `docs/crm-data-model.md`
- **Folder**: `integrations/` (ETL logic in n8n workflows)
- **Used by workflows**: WF-01 through WF-14
