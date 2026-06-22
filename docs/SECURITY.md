# Security Notes

- Keep OpenAI keys in Supabase Edge Function secrets only.
- Keep Supabase service-role key in backend only.
- Enable RLS before production.
- Create role-based policies by organization_id.
- Store evidence files in private Supabase Storage buckets.
- Use signed URLs for temporary access.
- Keep audit logs for important state changes.
- Do not allow staff to edit submitted checklist answers after approval.
