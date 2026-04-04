# IPL Fantasy — Runbook

**Production URL**: https://ipl11.vercel.app  
**Supabase Project**: ipl-fantasy (login at supabase.com)  
**GitHub**: https://github.com/krishnamadhan/ipl-fantasy  
**API**: Cricbuzz via RapidAPI (`cricbuzz-cricket.p.rapidapi.com`)

---

## Match Lifecycle (Admin Flow)

Every IPL match goes through this state machine:

```
scheduled → open → locked → live → in_review → completed
                                 ↘ abandoned / no_result
```

### Step 1 — Before the Match (Day of match, ~2 hours before)

1. Go to **Admin → Matches**
2. Click **"Open"** on the match → status becomes `open`
   - Users can now build and save teams
   - Contests are visible and joinable
3. ~30 mins before toss: click **"Lock"** → status becomes `locked`
   - No new teams can be saved
   - No new contest entries
   - Run **Admin → Players → Sync Squads** if lineup news broke (updates player pool)

### Step 2 — Match Starts

4. Click **"Go Live"** → status becomes `live`
   - The live sync edge function starts pulling Cricbuzz scorecards every 2 minutes
   - Fantasy points update in real time on the leaderboard

### Step 3 — Match Ends

The sync function auto-detects match completion and moves status to `in_review`.  
OR the admin can click **"Mark In Review"** manually.

5. Go to **Admin → Matches → [match]**
6. Verify stats look correct (check top scorers, wicket-takers)
7. Click **"Finalize"** → status becomes `completed`
   - Contest rankings are locked
   - Prize pool distributed (if applicable)
   - Season leaderboard updated

### Emergency Actions

- **Pause scoring**: Toggle "Pause Scoring" on the match detail page (stops sync without changing status)
- **Reopen match**: Change status back to `live` from `in_review` if sync ended prematurely
- **Abandon match**: Use "Abandon" button — refunds contest entry fees (not yet implemented, use manual wallet credits)

---

## Live Sync — How It Works

**Two sync paths exist. Both have identical time guards and staleness checks.**

### Path 1 — Supabase Edge Function (primary)
- File: `supabase/functions/sync-live/index.ts`
- Triggered by Supabase Cron: set to **every 2 minutes**
- Time guard: only runs **10:00–18:30 UTC (3:30 PM–midnight IST)** — covers both afternoon and evening slots
- Staleness check: if a match has been `live` for >5.5 hours since `scheduled_at`, auto-moves it to `in_review`

### Path 2 — Next.js API Route (fallback / manual trigger)
- File: `src/app/api/cron/sync-live/route.ts`
- URL: `GET /api/cron/sync-live` (requires `Authorization: Bearer <CRON_SECRET>`)
- Same time guard (10:00–18:30 UTC) and staleness check as Path 1
- Can be triggered manually from admin or via Vercel Cron (not configured — Hobby plan limitation)

### Changing the Supabase Cron Schedule

1. Go to **Supabase Dashboard → Edge Functions → sync-live**
2. Under "Schedules", edit the cron expression
3. To run every 2 minutes: `*/2 * * * *`
4. To disable outside season: delete the schedule temporarily

### Protecting RapidAPI Credits

The sync function has **three layers of protection**:

| Layer | Mechanism | Detail |
|-------|-----------|--------|
| Time window | Hard stop outside 7:30 PM–midnight IST | Returns early, no API call |
| DB check | Only runs if status = `live` | No live matches → instant return |
| Staleness | Auto-closes matches >5.5 hrs old | Prevents forgotten live matches from burning credits |

**Current RapidAPI limits**: Check your plan at rapidapi.com → My Apps → cricbuzz-cricket.

---

## Syncing Squads (Player Pool)

Run this when:
- Season starts (populate all IPL players)
- A player is traded/injured and the role changes
- You see wrong team names in the player picker

**How to sync:**

1. Admin → Players → "Sync Squads" button
2. The route calls `POST /api/admin/sync-squads`
3. It fetches `cricbuzz-cricket.p.rapidapi.com/series/v1/{seriesId}/squads`
4. Cricbuzz team names come from the `squadType` field (e.g. `"Chennai Super Kings"`)
5. Players are upserted by `cricapi_player_id` — safe to re-run

**Series ID**: Stored in `f11_settings` table under key `cricbuzz_series_id`. Default: `9241` (IPL 2026).  
To change: `UPDATE f11_settings SET value = 'NEW_ID' WHERE key = 'cricbuzz_series_id';`

---

## User Flow (What a Player Does)

1. **Register** at `/register` → wallet starts at ₹10,000
2. **Browse matches** at `/matches` → click a match with status `open`
3. **Build team** at `/matches/[id]/build-team`:
   - Pick 11 players (100 credits budget)
   - Rules: 1 WK, 1–4 BOWL, 1–4 BAT, 1–3 AR; max 7 from one IPL team
   - Pick Captain (2× points) and Vice-Captain (1.5× points)
   - Save up to 6 teams per match
4. **Join contest** at `/contests/browse/[matchId]`:
   - Pick a saved team → choose contest → confirm & join
   - Entry fee deducted from wallet
5. **Watch live scores** during the match (auto-refreshes)
6. **Check results** after match is finalized

---

## Scoring System (TATA IPL Official)

### Batting Points

| Event | Points |
|-------|--------|
| Each run | +1 |
| Four (boundary bonus) | +1 |
| Six bonus | +2 |
| Half-century (50–99) | +8 |
| Century (100+) | +16 |
| Duck (WK/BAT/AR only) | −2 |

**Strike Rate Penalties** (min 10 balls, WK/BAT/AR only — bowlers exempt):

| SR | Penalty |
|----|---------|
| < 50 | −6 |
| 50–59.99 | −4 |
| 60–70 | −2 |
| > 70 | 0 (no bonus in TATA IPL) |

### Bowling Points

| Event | Points |
|-------|--------|
| Each wicket | +25 |
| 4-wicket haul | +8 bonus |
| 5-wicket haul | +16 bonus |
| Maiden over | +8 |

**Economy Rate Bonuses** (min 2 overs / 12 balls):

| Economy (RPO) | Bonus |
|---------------|-------|
| < 5 | +4 |
| 5–6 | +2 |
| > 6 | 0 (no penalties in TATA IPL) |

### Fielding Points

| Event | Points |
|-------|--------|
| Catch | +8 |
| Stumping | +12 |
| Direct run-out | +12 |
| Run-out assist (relay) | +6 |
| Caught & Bowled | +8 (bowler gets wicket +25 AND catch +8) |

### Playing XI Bonus

| Event | Points |
|-------|--------|
| In playing XI | +4 |

### Captain / VC Multiplier

- **Captain**: 2× total base points
- **Vice-Captain**: 1.5× total base points

---

## Wallet System

- Starting balance: ₹10,000
- Entry fees deducted on contest join
- Prizes credited after finalization
- All transactions logged in `f11_transactions` (append-only ledger)

To manually credit a user wallet:
```sql
SELECT f11_credit_wallet(
  'USER_UUID_HERE',
  500.00,
  'Admin credit — IPL promo',
  NULL
);
```

---

## Contests

| Type | Description |
|------|-------------|
| `mega` | Large pool, many participants |
| `small` | Small pool |
| `h2h` | Head-to-head (2 players) |
| `private` | Invite-code only |

Statuses: `open` → `locked` (when match locks) → `completed` (after finalization)

Prize pool types: `winner_takes_all` or `tiered`

---

## Common Issues & Fixes

### "No players showing for a team"
- Squads haven't been synced yet. Run Admin → Sync Squads.
- Check `f11_players` table: `SELECT ipl_team, count(*) FROM f11_players GROUP BY ipl_team;`

### "Team shows wrong team name (squ / response)"
- Cricbuzz API changed format. Check `squadType` field in debug output.
- The sync route now reads: `sq.squadName ?? sq.teamName ?? sq.name ?? sq.squadType`

### "Live sync not running"
- Check time: must be 7:30 PM–midnight IST (14:00–18:30 UTC)
- Check Supabase Edge Function logs (Dashboard → Edge Functions → sync-live → Logs)
- Confirm match status is `live` in DB
- Verify `RAPIDAPI_KEY` env var is set in Supabase Edge Function secrets

### "Match stuck in live after match ended"
- Staleness check auto-fixes this after 5.5 hours from `scheduled_at`
- Or: Admin → Matches → [match] → Mark In Review

### "Contest join button not working"
- Match must be `open` status
- User must have a saved team for this match
- If button is obscured, check mobile z-index (BottomNav is z-50, sheet must be z-[60]+)
