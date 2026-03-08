# Integrations Reference

> Status: Staging — connectors not yet implemented.

---

## HubSpot CRM

- **Purpose**: Contact management, deal pipeline, sales automation
- **Auth**: Private App Token (OAuth available)
- **Config key**: `HUBSPOT_API_TOKEN`
- **Docs**: https://developers.hubspot.com/docs/api/overview
- **Folder**: `integrations/hubspot/`

---

## Reuzenpanda

- **Purpose**: TBD — operations/logistics
- **Auth**: TBD
- **Config key**: `REUZENPANDA_API_KEY`
- **Folder**: `integrations/reuzenpanda/`

---

## Planning Software

- **Purpose**: Project scheduling, resource planning, capacity management
- **Auth**: TBD (depends on specific tool)
- **Config key**: `PLANNING_API_KEY`
- **Folder**: `integrations/planning/`

---

## Gripp

- **Purpose**: Invoicing, time tracking, project administration
- **Auth**: API key
- **Config key**: `GRIPP_API_KEY`
- **Docs**: https://developers.gripp.nl/
- **Folder**: `integrations/gripp/`

---

## Advertising Platforms

- **Purpose**: Campaign management, performance data (Meta, Google Ads, etc.)
- **Auth**: OAuth per platform
- **Config keys**: `META_ACCESS_TOKEN`, `GOOGLE_ADS_TOKEN`
- **Folder**: `integrations/ads/`

---

## Dashboards

- **Purpose**: Aggregated reporting across all systems
- **Folder**: `dashboards/`
- **Notes**: Data sourced from normalized outputs of the above integrations
