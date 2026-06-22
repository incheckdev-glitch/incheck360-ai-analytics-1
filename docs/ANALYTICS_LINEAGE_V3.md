# InCheck360 Analytics Lineage v3

## Rule

Imported SQL/report files must insert raw report data only. They must not insert analytics, scores, insights, predictions, or management report outputs.

## Flow

1. Raw reports are imported into source tables:
   - `audit_reports`
   - `audit_report_sections`
   - `audit_report_items`
   - `completion_rate_reports`
   - `completion_rate_checklists`
   - `completion_rate_daily`

2. The frontend calls `run_advanced_report_ml_v3(...)` from the AI Analytics page.

3. The ML function analyzes raw rows and generates analytics.

4. Generated rows are stamped with lineage fields:
   - `source_type = generated_analytics`
   - `generated_by = advanced_ml_v3`
   - `model_version = advanced_report_ml_v3`
   - `calculation_run_id = <uuid>` / `generation_run_id = <uuid>`

5. The Data Lineage section reads `v_analytics_data_lineage` to prove which rows are imported and which are generated.

## Verification

Before running ML, generated analytics should be zero:

```sql
select *
from public.verify_raw_vs_generated_analytics(
  '10000000-0000-0000-0000-000000000001'
);
```

Then run the ML:

```sql
select *
from public.run_advanced_report_ml_v3(
  '10000000-0000-0000-0000-000000000001',
  '2026-02-01',
  '2026-02-28',
  'manual-test'
);
```

After ML, generated analytics rows will have `generated_by = advanced_ml_v3` and a calculation run ID.
