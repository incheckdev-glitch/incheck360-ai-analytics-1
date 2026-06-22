# Setup Guide

## 1. Install dependencies

```bash
npm install
```

## 2. Run locally

```bash
cp .env.example .env
npm run dev
```

The app uses mock data by default.

## 3. Connect Supabase later

Create a Supabase project, then run migrations:

```bash
supabase db push
```

Add frontend values to `.env`:

```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
VITE_USE_MOCK_DATA="false"
```

## 4. Deploy Edge Functions

```bash
supabase functions deploy ai-generate-insights
supabase functions deploy ai-chat-ops
supabase functions deploy ai-embed-knowledge
```

Set secrets:

```bash
supabase secrets set OPENAI_API_KEY="your-openai-key"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set SUPABASE_URL="https://your-project.supabase.co"
```

## 5. Security

Never expose `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
