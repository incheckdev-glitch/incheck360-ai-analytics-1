# Security

## No external AI provider

This internal ML version does not use OpenAI or any external AI API.

The frontend should never hold backend secrets. The only frontend variables are the Supabase URL and anon key.

## Backend secrets

When deploying Supabase Edge Functions, set only:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Keep the service role key only inside Supabase secrets or a backend environment. Never place it in `.env` used by the browser.

## Recommended access

- Admin: full access
- Operations Manager: all operational insights
- Area Manager: assigned regions/locations
- Store Manager: own location
- Auditor: checklist/audit modules
- Viewer: read-only access

Add RLS policies before production launch.
