-- =============================================================================
-- Sonty — Migration 001: Initial Reporting Schema
-- =============================================================================

-- Leads (sourced from HubSpot contacts)
CREATE TABLE IF NOT EXISTS leads (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hubspot_contact_id    TEXT UNIQUE NOT NULL,
    first_name            TEXT,
    last_name             TEXT,
    email                 TEXT,
    phone                 TEXT,
    postal_code           TEXT,
    product_interest      TEXT,
    lead_platform         TEXT,
    utm_campaign          TEXT,
    utm_adset             TEXT,
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ
);

-- Deals (sourced from HubSpot deals)
CREATE TABLE IF NOT EXISTS deals (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hubspot_deal_id           TEXT UNIQUE NOT NULL,
    hubspot_contact_id        TEXT REFERENCES leads(hubspot_contact_id),
    stage                     TEXT NOT NULL,
    first_quote_amount        NUMERIC(10,2),
    final_quote_amount        NUMERIC(10,2),
    deposit_amount            NUMERIC(10,2),
    final_invoice_amount      NUMERIC(10,2),
    gripp_quote_id            TEXT,
    gripp_invoice_deposit     TEXT,
    gripp_invoice_final       TEXT,
    created_at                TIMESTAMPTZ NOT NULL,
    won_at                    TIMESTAMPTZ,
    completed_at              TIMESTAMPTZ,
    lost_at                   TIMESTAMPTZ,
    loss_reason               TEXT,
    updated_at                TIMESTAMPTZ
);

-- Funnel events (stage transitions and key actions)
CREATE TABLE IF NOT EXISTS funnel_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id         TEXT NOT NULL,
    contact_id      TEXT NOT NULL,
    stage           TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    metadata        JSONB,
    occurred_at     TIMESTAMPTZ NOT NULL,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue events (invoices and payments)
CREATE TABLE IF NOT EXISTS revenue_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id          TEXT NOT NULL,
    invoice_type     TEXT NOT NULL,
    amount           NUMERIC(10,2) NOT NULL,
    gripp_invoice_id TEXT,
    paid_at          TIMESTAMPTZ,
    recorded_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ad platform performance data
CREATE TABLE IF NOT EXISTS ad_performance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        TEXT NOT NULL,
    campaign_id     TEXT,
    campaign_name   TEXT,
    date            DATE NOT NULL,
    impressions     INTEGER,
    clicks          INTEGER,
    leads           INTEGER,
    spend           NUMERIC(10,2),
    recorded_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (platform, campaign_id, date)
);

-- Daily/weekly/monthly KPI snapshots
CREATE TABLE IF NOT EXISTS kpi_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date       DATE NOT NULL,
    period              TEXT NOT NULL,
    leads_total         INTEGER,
    leads_contacted     INTEGER,
    first_quotes_sent   INTEGER,
    measurements_done   INTEGER,
    deals_won           INTEGER,
    deals_completed     INTEGER,
    revenue_invoiced    NUMERIC(10,2),
    revenue_collected   NUMERIC(10,2),
    conversion_rate     NUMERIC(5,4),
    avg_deal_value      NUMERIC(10,2),
    recorded_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (snapshot_date, period)
);
