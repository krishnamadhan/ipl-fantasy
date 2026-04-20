# IPL Fantasy — Claude Code Context

This file is for future Claude Code sessions. It documents every technical decision, architecture choice, and known quirk so you can dive in without re-deriving context.

---

## Project Overview

Dream11-style fantasy cricket platform for IPL. Users build teams, join contests, and earn points based on real match stats fetched from Cricbuzz via RapidAPI.

**Stack**: Next.js 15 App Router · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + Edge Functions) · Vercel (Hobby plan)

**Production**: https://ipl11.vercel.app  
**Supabase**: ipl-fantasy project  
**GitHub**: https://github.com/krishnamadhan/ipl-fantasy  

---

## Directory Structure

```
ipl-fantasy/
├── src/
│   ├── app/
│   │   ├── (auth)/           # login, register pages
│   │   ├── (game)/           # main game UI (has shared layout with BottomNav)
│   │   │   ├── matches/      # match list + build-team
│   │   │   ├── contests/     # browse + join contests
│   │   │   │   └── browse/[matchId]/  # ContestBrowseClient.tsx — join flow
│   │   │   ├── my-teams/     # user's saved teams
│   │   │   └── leaderboard/
│   │   └── admin/            # admin panel (no shared game layout)
│   │       ├── matches/      # AdminMatchActions, AdminMatchDetailClient
│   │       ├── players/      # AdminPlayersClient
│   │       └── contests/
│   ├── api/
│   │   ├── teams/route.ts          # GET (list user teams), POST (save team)
│   │   ├── contests/join/route.ts  # join contest
│   │   ├── admin/sync-squads/route.ts  # sync player pool from Cricbuzz
│   │   └── cron/sync-live/route.ts     # live score sync (manual/cron)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts    # browser client (anon key)
│   │   │   └── server.ts    # server client — exports createClient() + createServiceClient()
│   │   └── fantasy/
│   │       ├── scoring.ts         # calcFantasyPoints() — source of truth for points
│   │       ├── validate-team.ts   # validateTeam() — 11-player rules
│   │       └── dismissal-parser.ts # parseDismissal() — caught/stumped/run-out detection
│   └── types/
│       └── player.ts   # PlayerMatchStats interface
└── supabase/
    ├── functions/
    │   └── sync-live/index.ts   # Deno edge function — called every 2 mins by Supabase Cron
    └── migrations/
        ├── 001_initial_schema.sql
        ├── 002_leaderboard_fn.sql  # f11_update_leaderboard() stored proc
        ├── 003_teams_and_playing_xi.sql
        └── 004_state_machine.sql   # expanded status enum, added in_review, points_breakdown
```

---

## Database Schema

All tables are prefixed `f11_`.

### Core Tables

| Table | Purpose |
|-------|---------|
| `f11_profiles` | Extends auth.users. Has `is_admin`, `wallet_balance` |
| `f11_players` | IPL players. Key: `cricapi_player_id` (Cricbuzz numeric ID as text) |
| `f11_matches` | Matches with status state machine |
| `f11_player_stats` | Per-match stats, UNIQUE(match_id, player_id) |
| `f11_teams` | User-saved fantasy teams (up to 6 per user per match) |
| `f11_contests` | Contest definitions |
| `f11_entries` | Contest entries — UNIQUE(contest_id, user_id) |
| `f11_transactions` | Append-only wallet ledger |
| `f11_settings` | Key-value config (cricbuzz_series_id, ipl_season) |
| `f11_sync_log` | API sync audit log |

### Match Status Flow

```
scheduled → open → locked → live → in_review → completed
                                 ↘ abandoned / no_result
```

- `scheduled`: created, not accepting teams
- `open`: team building + contest joining allowed
- `locked`: deadline passed, no changes
- `live`: match in progress, sync running
- `in_review`: match ended, admin reviewing before finalize
- `completed`: finalized, prizes distributed

### Known Schema Quirks

- `f11_teams.captain_id` and `f11_teams.vc_id` are UUID columns with NO foreign key constraint to `f11_players`. Do NOT use Supabase FK join syntax (`f11_players!captain_id`) — it will fail. Always do a separate `.select().in("id", playerIds)` query.
- `f11_player_stats.overs_bowled` stores cricket notation (3.4 = 3 overs 4 balls), NOT decimal overs. Always use `cricketOversToDecimal()` or ball arithmetic before computing economy rate.
- `f11_entries` has `UNIQUE(contest_id, user_id)` — one entry per user per contest.

---

## Supabase Client Usage

Two clients in `src/lib/supabase/server.ts`:

```typescript
// Uses anon key + user's session — respects RLS
const supabase = await createClient();

// Uses service role key — bypasses RLS entirely
const admin = await createServiceClient();
```

**Rule**: Admin API routes use `createServiceClient()`. All user-facing queries use `createClient()` so RLS policies apply.

---

## Authentication

Supabase Auth. Email + password only.  
Profile auto-created by `f11_handle_new_user` trigger on `auth.users` insert.  
Starting wallet: ₹10,000.

Auth redirect URL in Supabase must include production domain:
- `https://ipl11.vercel.app/**`
- `http://localhost:3000/**`

Admin access: `UPDATE f11_profiles SET is_admin = true WHERE id = 'USER_UUID';`

---

## Cricbuzz API (RapidAPI)

Host: `cricbuzz-cricket.p.rapidapi.com`  
Key env var: `RAPIDAPI_KEY`

### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /series/v1/{seriesId}/squads` | List all team squads for a series |
| `GET /series/v1/{seriesId}/squads/{squadId}` | Players in one squad |
| `GET /mcenter/v1/{matchId}/scard` | Live/completed scorecard |
| `GET /mcenter/v1/{matchId}` | Match info, team IDs |
| `GET /teams/v1/{teamId}/players` | Team player list |

### Series ID

IPL 2026 series ID: `9241`. Stored in `f11_settings` table under key `cricbuzz_series_id`.

### Cricbuzz API Response Quirks (hard-won knowledge)

**Squad endpoint:**
- Team name is in the `squadType` field (NOT `squadName`/`teamName`/`name`)
- First element has `isHeader: true` — skip it
- Example: `{ squadId: 99705, squadType: "Chennai Super Kings", imageId: 860038, teamId: 58 }`

**Scorecard (scard) endpoint:**
- Innings array: `data.scorecard` or `data.Scorecard` or `data.Innings`
- Batsmen: `innings.batsmen` (array) or `innings.batsmenData` (object with numeric keys)
- Bowlers: `innings.bowlers` (array) or `innings.bowlersData` (object with numeric keys)
- Player ID field: `b.id` (confirmed), fallback `b.batId`/`b.playerId`
- Batsman runs: `b.r` (confirmed), fallback `b.runs`
- Batsman balls: `b.b`, fallback `b.balls`
- Fours: `b['4s']`, fallback `b.fours`
- Sixes: `b['6s']`, fallback `b.sixes`
- Dismissed: check `b.out_desc` or `b.outDesc` (non-empty = dismissed)
- Bowler overs: `bw.o` (cricket notation), fallback `bw.overs`
- Bowler wickets: `bw.w`, fallback `bw.wickets`
- Bowler runs: `bw.r`, fallback `bw.runs`
- Match ended: `data.matchHeader.state === 'complete'` or `data.matchHeader.complete === true`

**Player ID mapping:**
The Cricbuzz player ID (numeric, stored as text in `cricapi_player_id`) is used to look up our internal UUIDs. Always: Cricbuzz ID → `f11_players.id` via `cricapi_player_id`.

---

## Live Sync Architecture

### Two sync paths (kept in sync manually):

1. **`supabase/functions/sync-live/index.ts`** — Deno edge function
   - Triggered by Supabase Cron every 2 minutes
   - Uses simpler `calcPoints()` inline (not imported — Deno can't import from src/)
   - Runs only during **14:00–18:30 UTC (7:30 PM–midnight IST)**
   - Auto-closes stale matches (>5.5 hrs since scheduled_at → `in_review`)

2. **`src/app/api/cron/sync-live/route.ts`** — Next.js API route
   - Can be triggered manually or via Vercel Cron (not configured — Hobby plan)
   - Uses `calcFantasyPoints()` from `src/lib/fantasy/scoring.ts`
   - Parses fielding credits from wicket objects (catches, stumpings, run-outs)
   - Same time guard and staleness check as the edge function

### Keeping scoring in sync

The edge function has a **duplicate inline** `calcPoints()` (different from the server route's `calcFantasyPoints()`). The two implementations may drift. The authoritative scoring rules are in `src/lib/fantasy/scoring.ts`. If you change scoring rules, update BOTH files.

### Leaderboard update

After upserting stats, both sync paths call:
```sql
SELECT f11_update_leaderboard(p_match_id := 'UUID');
```
This stored function recalculates all `f11_entries.total_points` for the match and updates `rank`.

---

## Fantasy Scoring (TATA IPL Official)

See `src/lib/fantasy/scoring.ts` for the canonical implementation.

Key differences from older/naive implementations:
- **Strike rate**: TATA IPL has ONLY penalties (SR < 70), NO positive bonus
- **3-wicket haul**: NO bonus in TATA IPL (common misconception)
- **Economy**: TATA IPL has ONLY bonuses (eco ≤ 6 gets points), NO penalties  
- **Overs notation**: 3.4 means 3 overs + 4 balls = 22 balls, NOT 3.67 overs — must convert before computing economy
- **Duck penalty**: Only for WK, BAT, AR — BOWL players are exempt
- **Caught & Bowled**: Bowler gets BOTH wicket (+25) AND catch (+8)
- **Milestone**: Century REPLACES half-century (not cumulative) — 100 runs = +16, NOT +8+16

---

## Team Validation Rules

See `src/lib/fantasy/validate-team.ts`.

- Exactly 11 players
- Budget ≤ 100 credits
- Roles: 1–4 WK, 1–4 BAT, 1–4 BOWL, 1–3 AR (at least 1 of each)
- Actually enforced: exactly 1 WK; batters include WK for role logic
- Max 7 players from the same IPL team
- Captain and VC must be in the selected 11
- Captain ≠ VC

---

## Next.js Caching Notes

**Critical**: Many pages broke because Next.js caches server component data.

Pages that show user-specific or frequently-changing data MUST use:
```typescript
export const dynamic = "force-dynamic";
```

Do NOT use `export const revalidate = N` on pages that read Supabase RLS-protected data — the cache ignores auth cookies and may serve stale data to the wrong user.

Affected pages (already fixed):
- `src/app/(game)/contests/browse/[matchId]/page.tsx`
- `src/app/(game)/my-teams/page.tsx`

After saves that redirect to another page, use `window.location.href` instead of `router.push()` to bypass the Next.js Router Cache. Example: TeamBuilderClient.tsx post-save redirect.

---

## Vercel Deployment

**Plan**: Hobby (free)  
**Auto-deploy**: Pushes to `main` branch auto-deploy  
**Custom domain**: ipl11.vercel.app

### Hobby Plan Limitations
- Crons only support daily schedule (`0 0 * * *`) — no minute-level crons
- This is why live sync runs via **Supabase Edge Function** cron instead
- `vercel.json` has `"crons": []` — do not add minute-level crons

### Required Environment Variables (set via `vercel env add` or dashboard)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RAPIDAPI_KEY
CRON_SECRET          # optional, secures the /api/cron/sync-live endpoint
BOT_GROUP_ID         # WhatsApp group JID — contest join notifications sent here
BOT_SECRET           # must match FANTASY_BOT_SECRET in banteragent/.env
```

---

## Admin Panel

Route: `/admin` — protected by `is_admin` check on `f11_profiles`.

### Admin helpers (NOT in a shared lib — inline in each route)

Admin API routes import `createServiceClient()` directly and check `is_admin`:
```typescript
const admin = await createServiceClient();
const { data: profile } = await admin.from("f11_profiles").select("is_admin").eq("id", user.id).single();
if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

### Key Admin Actions

| Action | Endpoint | Notes |
|--------|----------|-------|
| Sync squads | `POST /api/admin/sync-squads` | Fetches all IPL players from Cricbuzz |
| Open match | `POST /api/admin/matches/[id]/open` | scheduled → open |
| Lock match | `POST /api/admin/matches/[id]/lock` | open → locked |
| Go live | `POST /api/admin/matches/[id]/live` | locked → live |
| Finalize | `POST /api/admin/matches/[id]/finalize` | in_review → completed |
| Manual sync | `GET /api/cron/sync-live` | Trigger live score pull now |
| Pause scoring | toggle on match detail | Sets is_scoring_paused = true |

---

## BottomNav Z-Index

`src/app/(game)/layout.tsx` renders `<BottomNav>` at `z-50`.

Any modal, bottom sheet, or overlay in game pages must use `z-[60]` or higher to appear above the nav bar. The contest join sheet uses `z-[60]`.

---

## Known Issues / Watch Out For

1. **Scoring divergence**: Edge function `calcPoints()` and cron route `calcFantasyPoints()` are separate implementations. If you update scoring, update both.

2. **No FK on captain_id/vc_id**: `f11_teams` columns `captain_id` and `vc_id` have no FK constraint. Never use Supabase's `!column_name` join syntax on these. Always do a second query.

3. **Cricket overs notation**: `3.4` means 3 overs 4 balls (not 3.4 decimal). The `f11_player_stats.overs_bowled` column stores cricket notation. Convert to decimal before economy math.

4. **Cricbuzz team name field**: `squadType` is the actual team name. `squadName` / `teamName` are usually empty or contain generic labels. This took significant debugging to discover.

5. **Match windows**: Time guard covers 10:00–18:30 UTC (3:30 PM–midnight IST), which handles both afternoon (3:30 PM IST) and evening (7:30 PM IST) slots. The staleness check (5.5 hrs) protects against forgotten matches in either window.

6. **Next.js `.next` cache**: If you see stale data in server components after code changes, run `rm -rf .next && npm run dev` to clear build artifacts.
