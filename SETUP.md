# IPL Fantasy — Setup Guide

## 1. Supabase Project

1. Create a project at https://supabase.com
2. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Run the migrations in order:
   - SQL Editor → paste `supabase/migrations/001_initial_schema.sql` → Run
   - SQL Editor → paste `supabase/migrations/002_leaderboard_fn.sql` → Run
4. Enable **Google OAuth** (optional) under Auth → Providers

## 2. CricAPI

1. Sign up at https://cricketdata.org
2. Copy your API key → `CRICAPI_KEY`
3. Find the IPL 2025 series ID (use `/series` endpoint or browse the site)
4. After the app is running: go to `/admin` → Settings row in `settings` table → set `cricapi_series_id`

## 3. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in real values:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CRICAPI_KEY=your_key_here
CRICAPI_SERIES_ID=   # fill after finding IPL series ID
```

## 4. Deploy Edge Functions

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy sync-schedule
npx supabase functions deploy sync-squads
npx supabase functions deploy sync-live
npx supabase functions deploy credit-update
```

Set Edge Function secrets:
```bash
npx supabase secrets set CRICAPI_KEY=your_key
```

## 5. Schedule Cron Jobs (Supabase Dashboard → Edge Functions → Schedules)

| Function | Cron | Purpose |
|---|---|---|
| `sync-schedule` | `0 6 * * *` | Daily at 6am — sync upcoming matches |
| `sync-live` | `* * * * *` | Every 60s — update live scores |

`sync-squads` and `credit-update` are triggered manually (or after match completes).

## 6. Make Yourself Admin

After registering via `/register`, run in Supabase SQL Editor:

```sql
UPDATE profiles SET is_admin = true WHERE username = 'your_username';
```

## 7. Run Locally

```bash
npm install
npm run dev
```

App runs at http://localhost:3000

## 8. First Use Flow

1. Admin: go to `/admin` → **Sync Squads** (populates players)
2. Admin: go to `/admin` → **Sync Schedule** (populates matches)
3. Admin: go to `/admin/matches` → set a match to "Open Lineups"
4. Users: register → build team → browse contests → join/create
5. Admin: go to `/admin/matches` → **Go Live** when match starts
6. `sync-live` Edge Function updates points every 60s automatically
7. Admin: **Complete** match → prizes distributed, credits updated

## Architecture Notes

- **Wallet**: virtual credits only. ₹10,000 signup bonus. Entry fees deducted atomically.
- **Team lock**: when admin sets match to "live", all open contests lock (no team changes).
- **Leaderboard**: Supabase Realtime subscription during live matches.
- **Other teams hidden** until match goes live (RLS enforced).
- **Credit algorithm**: runs post-match via `credit-update` Edge Function.
