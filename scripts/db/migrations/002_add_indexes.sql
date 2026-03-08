-- =============================================================================
-- Sonty — Migration 002: Indexes for reporting queries
-- =============================================================================

-- leads
CREATE INDEX IF NOT EXISTS idx_leads_created_at        ON leads (created_at);
CREATE INDEX IF NOT EXISTS idx_leads_lead_platform     ON leads (lead_platform);
CREATE INDEX IF NOT EXISTS idx_leads_product_interest  ON leads (product_interest);

-- deals
CREATE INDEX IF NOT EXISTS idx_deals_stage             ON deals (stage);
CREATE INDEX IF NOT EXISTS idx_deals_created_at        ON deals (created_at);
CREATE INDEX IF NOT EXISTS idx_deals_won_at            ON deals (won_at);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id        ON deals (hubspot_contact_id);

-- funnel_events
CREATE INDEX IF NOT EXISTS idx_funnel_events_deal_id      ON funnel_events (deal_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_stage        ON funnel_events (stage);
CREATE INDEX IF NOT EXISTS idx_funnel_events_occurred_at  ON funnel_events (occurred_at);

-- revenue_events
CREATE INDEX IF NOT EXISTS idx_revenue_deal_id            ON revenue_events (deal_id);
CREATE INDEX IF NOT EXISTS idx_revenue_paid_at            ON revenue_events (paid_at);

-- ad_performance
CREATE INDEX IF NOT EXISTS idx_ad_platform_date           ON ad_performance (platform, date);

-- kpi_snapshots
CREATE INDEX IF NOT EXISTS idx_kpi_date_period            ON kpi_snapshots (snapshot_date, period);
