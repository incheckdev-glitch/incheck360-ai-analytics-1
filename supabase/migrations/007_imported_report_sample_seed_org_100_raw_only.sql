-- Raw-only sample seed marker for InCheck360 Advanced ML v3.
-- Use /mnt/data/imported_report_sample_seed_org_100_raw_only.sql for the full sample data insert.
-- Important rule: this seed must NOT call run_internal_ml_from_imported_reports, run_advanced_report_ml, or run_advanced_report_ml_v3.
-- Raw tables only:
--   audit_reports
--   audit_report_sections
--   audit_report_items
--   completion_rate_reports
--   completion_rate_checklists
--   completion_rate_daily
-- Generated analytics must be created only after clicking AI Analytics -> Run Advanced ML v3.

-- Verification after raw import:
select 'RAW IMPORTED DATA' as layer, 'audit_reports' as table_name, count(*) from public.audit_reports where organization_id = '10000000-0000-0000-0000-000000000001'
union all select 'RAW IMPORTED DATA', 'audit_report_items', count(*) from public.audit_report_items where organization_id = '10000000-0000-0000-0000-000000000001'
union all select 'RAW IMPORTED DATA', 'completion_rate_reports', count(*) from public.completion_rate_reports where organization_id = '10000000-0000-0000-0000-000000000001'
union all select 'RAW IMPORTED DATA', 'completion_rate_checklists', count(*) from public.completion_rate_checklists where organization_id = '10000000-0000-0000-0000-000000000001'
union all select 'GENERATED ANALYTICS', 'ml_location_report_features', count(*) from public.ml_location_report_features where organization_id = '10000000-0000-0000-0000-000000000001'
union all select 'GENERATED ANALYTICS', 'internal_ml_location_scores', count(*) from public.internal_ml_location_scores where organization_id = '10000000-0000-0000-0000-000000000001'
union all select 'GENERATED ANALYTICS', 'ai_insights', count(*) from public.ai_insights where organization_id = '10000000-0000-0000-0000-000000000001';
