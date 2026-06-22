# Blank Screen Fix

If the app opens as a blank page, use this checklist.

## 1. Do not open the source `index.html` directly

This is a Vite + React project. The source `index.html` needs the Vite development server.

Use:

```bash
npm install
npm run dev
```

Then open the URL shown in terminal, usually:

```text
http://localhost:5173
```

## 2. For a production preview

```bash
npm run build
npm run preview
```

Then open:

```text
http://localhost:4173
```

## 3. For GitHub Pages

This repo includes `.github/workflows/deploy-github-pages.yml`.

After pushing to GitHub:

1. Go to the repository settings.
2. Open **Pages**.
3. Set source to **GitHub Actions**.
4. Push to `main`.

The app uses Vite `base: './'`, so assets load correctly from the GitHub Pages subpath.

## 4. Supabase is optional for the first demo

The app starts in mock-data mode by default. You do not need Supabase or OpenAI to see the UI.

Only set Supabase variables when you are ready:

```env
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_USE_MOCK_DATA=false
```

## 5. Internal ML only

No OpenAI key is required. The analytics engine is internal scoring logic.
