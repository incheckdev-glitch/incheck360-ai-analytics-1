# InCheck360 AI Analytics 1

Standalone operations-execution and compliance platform prototype for multi-location businesses.

This repository is **not the ERP**. It is a fresh platform concept similar in category to digital operations tools: checklist execution, audits, SOP/reference materials, incidents, corrective actions, location performance, and AI analytics.

## What is included

- React + TypeScript + Vite web app
- Responsive dashboard UI
- Mock data mode for instant local preview
- Supabase-ready database migrations
- Supabase Edge Functions for AI insight generation and AI ops chat
- Backend-only OpenAI integration pattern
- AI prompts and product documentation

## Main modules

- Executive Dashboard
- Locations
- Checklist Templates
- Task Execution
- Incidents
- Corrective Actions
- Reference Materials
- AI Analytics
- Admin Settings

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

The app runs with built-in mock data first. You can connect Supabase later by adding your project URL and anon key in `.env`.

## Environment variables

Frontend:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_USE_MOCK_DATA=true
```

Supabase Edge Function secrets:

```bash
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Important security rule

The frontend must never call OpenAI directly. All AI requests must go through Supabase Edge Functions.

## Suggested GitHub repo name

```text
incheck360-ai-analytics-1
```

## Current status

This is a production-style starter codebase. It is ready to push to GitHub and run locally, but it still needs your real Supabase project, authentication policies, and production deployment configuration before going live.
