# Internal ML Strategy

This project does **not** require OpenAI or any external AI provider.

The first version uses internal ML-style analytics:

1. Collect operational data from locations, tasks, incidents, checklists, and corrective actions.
2. Convert the data into numeric features.
3. Apply configurable risk weights.
4. Generate a risk score from 0 to 100.
5. Convert the score into severity: low, medium, high, critical.
6. Save the result as an AI insight.
7. Collect manager feedback to improve the scoring model later.

## First internal model

Model name:

```text
ops_risk_v1
```

Main features:

- Overdue tasks
- Blocked tasks
- Critical open tasks
- Open incidents
- Critical incidents
- High incidents
- Food safety incidents
- Overdue corrective actions
- Blocked corrective actions
- Evidence-required open actions
- Checklist score gap below 90
- Audit gap over 7 days

## Future true ML model

After the platform collects enough real history, train internal models for:

- Failed audit probability
- Overdue corrective action probability
- Location compliance forecast
- Incident recurrence probability
- Staff training risk

Possible later stack:

- Python training job
- scikit-learn / XGBoost
- Scheduled model training
- Model registry table in Supabase
- Prediction API from Supabase Edge Function or a private backend service

For now, the project intentionally starts with transparent internal scoring so managers can understand why every risk was generated.
