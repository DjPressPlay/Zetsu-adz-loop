# Zetsu ADs Loop v3.0

**Autonomous Advertising Command Center** — Deploy AI-driven ad pipelines that read your website, generate ad copy and visuals, and post to social media on autopilot.

## What It Does

Zetsu ADs Loop connects your website to your social channels through autonomous ad pipelines. You provide a URL, a social media handle, a platform, and an API token. The system then:

1. **Reads your website** to understand your product and messaging.
2. **Generates ad variants** (headlines, body copy, hashtags) using Google Gemini AI.
3. **Synthesizes ad images** from AI-generated prompts.
4. **Posts directly to social media** via Instagram Graph API, Twitter/X API v2, or LinkedIn Marketing API.
5. **Tracks all activity** in a real-time live feed.

Pipelines run continuously on a configurable schedule (1–24 posts per day).

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend:** Netlify Functions (serverless)
- **Database:** Supabase (PostgreSQL)
- **AI:** Google Gemini AI (ad generation + image synthesis)
- **Security:** AES-256-CBC encryption for stored API tokens

## Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with `pipelines` and `activity_log` tables
- A [Google Gemini API key](https://ai.google.dev/)

### Environment Variables

Set these in Netlify (Site settings > Environment variables) or in a local `.env` file:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for ad generation |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `CRYPTO_KEY` | 32-character key for AES-256-CBC token encryption |




## Project Structure

```
index.html                     HTML entry point
src/
  main.tsx                     React app entry
  App.tsx                      Dashboard UI — pipeline CRUD, live feed, demo mode
  index.css                    Tailwind CSS theme (gold/red/black branding)
  services/geminiService.ts    Gemini AI integration
  lib/supabase.ts              Supabase client
netlify/
  functions/
    pipelines.ts               GET/POST /api/pipelines
    pipeline-by-id.ts          PATCH/DELETE /api/pipelines/:id
    activity.ts                GET/POST /api/activity
    utils/supabase.ts          Shared Supabase client
    utils/crypto.ts            AES-256-CBC encrypt/decrypt helpers
netlify.toml                   Build + redirect configuration
```

## Security

Social media API tokens are encrypted with AES-256-CBC before storage in Supabase. Tokens are masked in all API responses and only decrypted server-side inside Netlify Functions when posting to platforms. The encryption key is configured via the `CRYPTO_KEY` environment variable.

## Supported Platforms

- **Instagram** — via Graph API (requires Facebook Developer account)
- **Twitter/X** — via API v2 (requires Developer Portal access)
- **LinkedIn** — via Marketing API (requires company page verification)

The app includes setup guides for each platform's API token generation.
