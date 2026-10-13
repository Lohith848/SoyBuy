-- ============================================================================
-- 0005_series_catalog_verified.sql — Phase 2.2
-- Records which sources have been CONFIRMED against a live call / real snapshot,
-- and which remain [VERIFY]. See docs/data-sources.md for the evidence.
-- ============================================================================

-- CONFIRMED 2026-10-12: live call returned 395 real Soyabean rows (one publish day).
update series_catalog set
  source_name = 'data.gov.in Agmarknet "Current Daily Price" resource 9ef84268-d588-465a-a308-a864a43d0070',
  verified_on = '2026-10-12',
  notes = 'CONFIRMED: real, but publishes ONLY the current day (no history). Filter value is "Soyabean". domain: INR/quintal, canonical INR/t.'
where series_id = 'DOM_SOY_MANDI';

-- CONFIRMED 2026-10-12: derived median of the real DOM_SOY_MANDI observations.
update series_catalog set
  source_name = 'derived: per-day median of DOM_SOY_MANDI (real data only)',
  verified_on = '2026-10-12',
  notes = 'Rebuilt after ingest. Depth is limited to whatever real mandi history exists.'
where series_id = 'DOM_SOY_BENCH';

-- CONFIRMED 2026-10-11: real snapshot soybean_futures.csv (Yahoo Finance ZS=F), ~11y daily.
update series_catalog set
  source_name = 'snapshot: soybean_futures.csv (Yahoo Finance ZS=F)',
  verified_on = '2026-10-11',
  notes = 'Real dated snapshot stored in repo. Near-month roll treatment still [VERIFY] for production.'
where series_id = 'INT_FUT_SOY';

-- CONFIRMED 2026-10-11: real snapshot usd_inr.csv (Yahoo Finance INR=X), ~11y daily.
update series_catalog set
  source_name = 'snapshot: usd_inr.csv (Yahoo Finance INR=X)',
  verified_on = '2026-10-11',
  notes = 'Real dated snapshot stored in repo. RBI reference rate is the intended production source [VERIFY].'
where series_id = 'FX_USDINR';

-- NOT YET INGESTED — stays [VERIFY].
update series_catalog set
  notes = '[VERIFY] World Bank Pink Sheet has not been ingested yet; no rows seeded.'
where series_id = 'INT_WB_SOY';

-- NOT YET INGESTED — stays [VERIFY]. Only the current day is available from the live feed.
update series_catalog set
  notes = '[VERIFY] Arrival quantities not yet ingested; the current Agmarknet resource is price-only.'
where series_id = 'DOM_SOY_ARRIVAL';
