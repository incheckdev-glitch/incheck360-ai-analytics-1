# InCheck360 AI Analytics 1

Standalone operations-execution and compliance platform prototype for multi-location businesses.

This repository is **not the ERP**. It is a fresh platform concept similar to Zenput / Crunchtime Ops Execution: checklist execution, audits, SOP/reference materials, incidents, corrective actions, location performance, and internal ML analytics.

## Important change

This version uses **internal ML** only.

- No OpenAI API key required
- No external AI API required
- AI Analytics is generated using local feature engineering, rule scoring, risk weights, and Supabase Edge Functions
- The app can run in mock mode first, then connect to Supabase later

## What is included

- React + TypeScript + Vite web app
- Responsive dashboard UI
- Mock data mode for instant local preview
- Supabase-ready database migrations
- Internal ML scoring tables
- Supabase Edge Function: `ai-generate-insights`
- Internal location risk scoring
- Internal compliance / evidence risk detection
- Docs for setup, security, and ML roadmap

## Main modules

- Executive Dashboard
- Locations
- Checklist Templates
- Task Execution
- Incidents
- Corrective Actions
- Reference Materials
- AI Analytics / Internal ML
- Admin Settings

## Quick start

Do not double-click the source `index.html`. This is a Vite + React app and must run through Vite.

```bash
npm install
cp .env.example .env
npm run dev
```

Open the URL shown in terminal, usually:

```text
http://localhost:5173
```

The app runs with built-in mock data first. You can test the internal ML from the AI Analytics page by clicking **Run Internal ML**.

## Production preview

```bash
npm run build
npm run preview
```

Open:

```text
http://localhost:4173
```

## Blank screen note

If you see a blank screen, you are probably opening `index.html` directly or deploying without building the app. See `docs/BLANK_SCREEN_FIX.md`.

## Environment variables

Frontend:

```bash
VITE_APP_NAME="InCheck360 AI Analytics 1"
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""
VITE_USE_MOCK_DATA="true"
```

Supabase Edge Function secrets when you connect the backend:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

There is intentionally no `OPENAI_API_KEY` in this project.

## Suggested GitHub repo name

```text
incheck360-ai-analytics-1
```

## Current status

This is a production-style starter codebase. It is ready to push to GitHub and run locally, but it still needs your real Supabase project, authentication policies, and production deployment configuration before going live.
