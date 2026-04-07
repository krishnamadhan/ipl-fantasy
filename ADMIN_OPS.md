# IPL Fantasy — Admin Operations Guide

## Cricbuzz API Endpoints Used

| Endpoint | When Called | What It Returns |
|---|---|---|
| `GET /matches/v1/upcoming` | Sync Schedule, Sync Squads | All upcoming matches with team1/team2 names + IDs, seriesId, startDate |
| `GET /matches/v1/live` | Sync Schedule, Sync Squads | Same structure for in-progress matches |
| `GET /matches/v1/recent` | Sync Squads | Recently completed matches |
| `GET /teams/v1/{teamId}/players` | Sync Squads (primary) | Full squad with playerRole, batStyle, bowlStyle |
| `GET /teams/v1/{teamId}/squad` | Sync Squads (fallback) | Same, alternate field names |
| `GET /mcenter/v1/{matchId}` | Sync Playing XI (post-toss), Force Sync | Match centre: toss result, Players.{teamId}.playing11 array, status |
| `GET /mcenter/v1/{matchId}/scard` | Sync Playing XI (post-start), Sync Live | Scorecard: innings → batsmen, bowlers, wickets arrays |

---

## Match Status Lifecycle

```
scheduled → open → locked → live → in_review → completed
                                 ↘ abandoned
```

| Status | Meaning | Who Changes It |
|---|---|---|
| `scheduled` | Registered, not yet open for entries | Sync Schedule, or auto via Enforce Deadlines |
| `open` | Players can build teams & join contests | Manual "Open Lineups" button, or auto (24h before start) |
| `locked` | Teams frozen, no new entries | Auto at scheduled start time (Enforce Deadlines cron) |
| `live` | Match in progress, scoring active | **Manual "Go Live" button only** |
| `in_review` | Match ended, scores finalised, pending payout | Auto when sync-live detects match complete |
| `completed` | Prizes paid | Manual "Finalize & Pay" button |
| `abandoned` | Match cancelled, all entry fees refunded | Manual "Abandon" button |

---

## Complete Sequence of Events (per IPL match)

### Once per season (or when squad changes)
1. **Sync Schedule** — fetches all 74 IPL matches from Cricbuzz upcoming/live feeds, upserts into `f11_matches` with correct team names and status.
2. **Sync Squads** — uses team IDs from those matches to fetch each team's full squad via `/teams/v1/{teamId}/players`. Upserts ~250 players into `f11_players` with correct `ipl_team`, `role`, and `credit_value`.

> Run Sync Schedule before Sync Squads. Squads uses the match data to build the team ID→name map.

---

### Per match day

#### ~24 hours before
- Status auto-changes `scheduled → open` (Enforce Deadlines cron, runs every 5 min)
- Users can now build teams and join contests

#### After toss (~7:00 PM for 7:30 PM matches)
3. **Sync Playing XI** — must be done **after toss but before the first ball**. During this window, Cricbuzz's mcenter has `Players.{teamId}.playing11` for both teams. Marks each player `is_playing_xi = true/false` in `f11_match_players`. Users see "Playing" badges in team builder.

> **Critical timing**: once the match starts (first ball bowled), Cricbuzz drops the Players object from the mcenter response. You can only get the batting team's full XI from the scorecard. The fielding team's players will be collected as they bowl/field, but the full XI won't be known until they bat in innings 2.
>
> **If you missed the pre-match window**: sync playing XI partway through innings 1 (gets batting team's 11 + some fielders), then sync again at innings break (gets both teams' full 11 after they've both batted).

#### At scheduled start time
- Status auto-changes `open → locked` (Enforce Deadlines cron)
- No new team entries or edits allowed

#### When match starts (1st ball)
4. **Go Live** (manual button on match detail) — changes status `locked → live`. **This is required before any scoring starts.** The sync-live cron only processes matches with `status = 'live'`.

> ⚠️ The match will show "not started" to users until you click Go Live, even if Cricbuzz already has live data.

#### Every 60 seconds while live
- **sync-live cron** (auto) — fetches `/mcenter/v1/{matchId}/scard`, parses batsmen/bowlers/wickets, calculates fantasy points, upserts `f11_player_stats`, updates `live_score_summary` on the match, recalculates all team totals and ranks.
- Auto-transitions to `in_review` when it detects the match is complete.

> You can also click "Sync Live Scores" on the admin dashboard to force an immediate update.

#### After match ends
- Status auto-changes `live → in_review` (sync-live cron)
- Points are final; leaderboard is locked

5. **Finalize & Pay** — changes status `in_review → completed`, distributes prizes to winners via wallet credits.

---

## What "Sync Playing XI" Actually Does

- **Source 1 (tried first):** `/mcenter/v1/{matchId}` — available after toss, before first ball. Returns `Players.{teamId}.playing11[]` for both teams. **This is the only source that gives both teams simultaneously.**
- **Source 2 (fallback):** `/mcenter/v1/{matchId}/scard` — once match starts. Gives: batting team's full 11 (pre-loaded), fielding team's bowlers as they bowl, fielders from wicket events (catches/stumpings/run-outs). Full fielding team XI only available after innings 2 starts.

**Cricbuzz limitation**: The mcenter drops player data once the match goes live. There is no API endpoint that returns both teams' playing XI for a live match.
- Matches Cricbuzz player IDs to local `f11_players` rows via `cricapi_player_id`.
- Upserts `f11_match_players` with `is_playing_xi = true` for players found, `false` for all others on those teams.
- Does **not** change match status.

---

## What "Go Live" Does

- Sets `f11_matches.status = 'live'`
- This is the gate that enables the sync-live cron to process the match
- Also sets all contests for that match to show the live leaderboard (no longer hidden)

---

## Admin Quick Reference

| Button | When to Use | Effect |
|---|---|---|
| Sync Schedule | Start of season or any time | Upserts all IPL matches |
| Sync Squads | After Sync Schedule, or squad changes | Upserts all ~250 IPL players with correct teams |
| Open Lineups | If auto-open hasn't fired | `scheduled → open` |
| Sync Playing XI | After toss announcement (~7 PM) | Marks playing XI in DB |
| Go Live | When match actually starts | `locked → live`, enables scoring |
| Sync Live Scores | Manual force during live match | Immediate score update (cron does this automatically) |
| Enforce Deadlines | If auto transitions seem stuck | Runs open/lock logic for all matches |
| Force Sync | Any time for a specific match | Re-fetches match status/toss/result from Cricbuzz |
| Force Rescore | If points look wrong | Recalculates all fantasy points from stored raw stats |
| Finalize & Pay | After match ends (in_review) | Pays prizes, `in_review → completed` |
| Abandon | Rain/cancelled match | Refunds all entry fees, cancels all contests |

---

## Why "Not Started" Shows After Match Begins

1. Status is still `locked` — **you need to click "Go Live" manually**
2. The sync-live cron only runs on `status = 'live'` matches
3. Even if Cricbuzz has ball-by-ball data, scores will not update until Go Live is clicked

**Correct flow:** Toss happens → Sync Playing XI → Match starts → **Go Live** → scores update automatically
