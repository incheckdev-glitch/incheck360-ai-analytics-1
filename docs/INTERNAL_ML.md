# Internal ML Engine

The internal ML engine is implemented in two places:

1. Frontend mock mode: `src/lib/internalMl.ts`
2. Supabase production mode: `supabase/functions/ai-generate-insights/index.ts`

## How it works

For each location, the model calculates features from operational data:

```text
overdue tasks
blocked tasks
open incidents
critical incidents
overdue corrective actions
evidence-required actions
checklist/compliance score gap
```

Then it applies risk weights and produces:

```text
risk_score: 0-100
health_score: 100-risk_score
predicted_risk_level: low | medium | high | critical
confidence: 0-1
top_drivers: explanation of why the score was generated
```

## Why this is better for the first version

- No paid AI API required
- No data leaves your Supabase/backend
- Every insight is explainable
- Easier to test with real operations teams
- Later you can replace the scoring formula with a trained model

## Production function

Deploy:

```bash
supabase functions deploy ai-generate-insights
```

Set secrets:

```bash
supabase secrets set SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Invoke payload:

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000001",
  "run_type": "manual"
}
```
