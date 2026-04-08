# Dream11 UI Replication Spec

> **Purpose**: Step-by-step guide to replicating Dream11's exact UI patterns in ipl11.  
> Previous attempts failed because changes were cosmetic tweaks on a fundamentally different layout.  
> This spec describes **structural rebuilds**, not styling patches.

---

## 1. Design System — Establish First

All screen rewrites depend on getting these right first. Do not touch individual screens until the design tokens are locked.

### 1.1 Color Palette

| Token | Current | Dream11 Target | Usage |
|-------|---------|----------------|-------|
| `--bg-primary` | `#080d1a` (dark navy) | `#FAFAFA` (near-white) | Page background |
| `--bg-card` | `#111827` (dark slate) | `#FFFFFF` | Card backgrounds |
| `--bg-header` | `rgba(8,13,26,0.97)` | `#1C1C1E` (near-black) | Top nav, sticky headers |
| `--accent` | `#F5A623` (amber/gold) | `#D4380D` (Dream11 red) | CTAs, badges, highlights |
| `--accent-alt` | — | `#1C9B4B` (green) | Success, "joined", fill bars |
| `--text-primary` | `text-white` | `#1A1A1A` | Body text on light bg |
| `--text-muted` | `text-slate-500` | `#8A8A8E` | Secondary labels |
| `--border` | `rgba(255,255,255,0.06)` | `#E8E8E8` | Card borders |

**Decision point**: Dream11 uses a **light theme** (`#FAFAFA` background, white cards, dark text).  
Our current app is full dark. The two options are:

- **Option A (Recommended)**: Keep dark theme but adopt Dream11's *layout and component structure* exactly — swap the layout, not the colors. This is lower risk and consistent with IPL apps like MyTeam11 which are also dark.
- **Option B**: Full light-theme port. Requires changing every text, border, background color across 50+ files. Very high risk of missed spots.

**→ This spec follows Option A: Dream11 structure + our dark color palette.**

### 1.2 Typography

```
Font stack: 'Inter', system-ui, -apple-system, sans-serif  (already in use ✓)

Prize/score numbers:  font-weight: 900, letter-spacing: -0.02em
Section headers:      font-weight: 700, font-size: 11px, letter-spacing: 0.08em, uppercase
Player names:         font-weight: 600, font-size: 14px
Labels:               font-weight: 500, font-size: 11px
```

### 1.3 Spacing Grid

Dream11 uses 8px base grid with specific padding conventions:
- Screen horizontal padding: `16px`
- Card inner padding: `16px` (not 12px or 20px)
- Between cards: `8px` gap
- Section header to first card: `12px`
- Bottom nav height: `56px` + `env(safe-area-inset-bottom)`

### 1.4 Border Radius

| Element | Dream11 | Current |
|---------|---------|---------|
| Contest card | `12px` | `16px` (too round) |
| CTA button | `8px` | `16px` (too round) |
| Bottom sheet | `16px` top corners | `24px` (close) |
| Player chip | `8px` | varies |
| Filter pills | `100px` (fully round) | ✓ already round |

### 1.5 Shadow System

Dream11 cards have subtle elevation, not borders:
```css
/* Card shadow — use instead of border on cards */
box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);

/* CTA button shadow */
box-shadow: 0 4px 12px rgba(212,56,13,0.30);  /* red glow on CTA */

/* Bottom nav shadow */
box-shadow: 0 -1px 0 rgba(0,0,0,0.10);
```

---

## 2. Screen-by-Screen Rebuild Plan

### Priority order (highest impact first):
1. Contest Browse page — highest traffic, most broken vs Dream11
2. Team Builder — core game action
3. Dashboard — first impression
4. Contest Detail / Leaderboard — live game experience
5. Bottom Nav — persistent across all screens
6. My Teams page

---

## Screen 1: Contest Browse (`/contests/browse/[matchId]`)

**Current file**: `src/app/(game)/contests/browse/[matchId]/ContestBrowseClient.tsx`

### What Dream11 actually looks like (contest browse):

```
┌─────────────────────────────────┐
│ ← [MI logo] MI vs RR [RR logo] │  ← sticky, black header
│    Wankhede · 07:30 PM          │
│    ⏱ 2h 30m left  + Create Team│
├─────────────────────────────────┤
│ [All] [Mega] [Small] [H2H] [P] │  ← filter pills
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ ✅ GUARANTEED               │ │  ← green strip (conditional)
│ │ Prize Pool    Entry         │ │
│ │ ₹1 Crore    ₹49            │ │  ← prize LEFT, entry fee RIGHT
│ │ Top 20% win                 │ │
│ │ ────────────────────────── │ │
│ │ ████████░░░░  1200 spots   │ │  ← fill bar + spots left
│ │               [Join →]     │ │  ← button bottom right
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Exact changes needed:

**A. Match header strip** (sticky top):
- Team logos: use actual PNG from `/public/teams/{teamCode}.png` — create these files (square 64px PNGs or SVGs per team). Until then, use the colored circle but make it **40px** not 24px.
- Show match number + venue below team names: `Match 42 · Wankhede Stadium`
- Countdown: move to be **below** the team names, centered, more prominent (not in a corner)
- "+ Create Team" button: top-right, outlined, 32px height, 8px radius

**B. Filter tabs** — already close to Dream11. Changes:
- Remove the count `(3)` in tabs — Dream11 doesn't show count in tab pills
- Make tabs scroll horizontally without showing scrollbar: `overflow-x: auto; scrollbar-width: none`
- Tab active state: solid red/brand background (current amber ✓), 36px height

**C. Contest card** — biggest structural change:
```
Current layout:
  [TYPE badge]  [NAME]         [PRIZE POOL]
  [Win %]
  [Prize tiers row]
  [Fill bar]
  [Entry fee]   [CTA button]

Dream11 layout:
  [GUARANTEED strip — full width, if applicable]
  [PRIZE POOL (large, left)]   [ENTRY FEE (right)]
  [Top X% win (small, below prize)]
  [Fill bar — full width]
  [spots joined (left)]  [spots left (right)]
  [CTA button — full width OR right-aligned]
```

Key visual differences:
- Prize pool is the DOMINANT element (48px+ font, top-left)
- Entry fee is right-aligned at SAME level as prize pool (not below)
- "Top X% win" is a small secondary line under prize pool
- The join button in Dream11 is at the **bottom-right**, small (not full-width) for unjoined; full-width green for already joined
- When joined: show team name in a green pill at top of card (not a separate row)

**D. "Create Private Contest" button** — fixed at bottom above tab bar:
```
[+ Create Private Contest]  ← full-width outlined button, always visible
```

**Implementation steps**:

1. Restructure card JSX to: `prize+entry row → win% → fill bar → spots → button`
2. Make prize font `text-3xl font-black` (was `text-2xl`)
3. Move entry fee to flex-row with prize: `justify-between` on a single div
4. Change button to be right-aligned, smaller: `px-5 py-2 text-sm rounded-lg`
5. When joined: add joined team chip at card TOP (above prize row), full-width green
6. Remove prize tiers row from card (put them in the contest detail page instead)
7. Add fixed bottom "Create Private Contest" button outside the scroll area

---

## Screen 2: Team Builder (`/team-builder/[matchId]`)

**Current file**: `src/components/team-builder/TeamBuilderClient.tsx`

### What Dream11 team builder looks like:

```
┌────────────────────────────────┐
│ [←] Create Team   [Preview ▶] │
├────────────────────────────────┤
│ Credits Left: 83.5  Players: 8│  ← sticky info bar
│ ████████████████░░░░           │  ← credit bar (green fill)
├────────────────────────────────┤
│  Max 7 from one team           │  ← rule reminder
│ [WK] [BAT] [AR] [BOWL]        │  ← role tabs (filter)
├────────────────────────────────┤
│ Wicket-Keepers (1-4)           │  ← section header
│ ┌──────────────────────────┐   │
│ │[logo] KL Rahul    MI  9.5│   │  ← player row
│ │       C: 68%      + Add  │   │
│ └──────────────────────────┘   │
├────────────────────────────────┤
│         [Next: Pick C & VC]    │  ← sticky CTA
└────────────────────────────────┘
```

### Key differences from current:

**A. Credit bar placement**: Dream11 puts the credit bar + player count at the **very top** as a sticky strip, not inside each section. Make it:
```
[ Credits Left: 83.5 ]  [ 8/11 Players ]
[██████████████░░░░░░░░░  83.5/100 credits]
```
Color: green when comfortable, amber when < 15 credits left, red when < 5.

**B. Role tabs**: Dream11 shows ALL roles at once with horizontal scroll + count per role:
```
[ALL] [WK · 1] [BAT · 3] [AR · 2] [BOWL · 2]
```
The number is how many you've SELECTED from that role (not total available).

**C. Player row design** — current uses a custom card layout. Dream11 player row:
```
┌─────────────────────────────────────────┐
│ [team]  Player Name           Credits   │
│ [logo]  Role · Selected by X%  [+ / ✓] │
└─────────────────────────────────────────┘
```
- Team mini-logo left (24px colored circle, already done ✓)
- "Selected by X%" is KEY — this comes from our player.credit_value or a selection_pct field. If we don't have this yet, show credit value instead.
- Add/remove button: Dream11 uses a `+` circle that turns into a `-` circle (green fill) when selected. Not a text button.
- Greyed out when: team limit reached (7 from one team) or credit limit

**D. Section dividers**: Dream11 clearly separates WK / BAT / ALL-ROUNDER / BOWLER sections with a full-width gray header even in ALL view.

**E. Bottom sticky CTA**: Dream11 has a persistent bottom bar showing:
```
[ Preview Team  (8/11 selected) ] [Next →]
```
The "Next" button only becomes active when exactly 11 are selected.

**F. Pitch preview** (Captain picker page): Dream11 shows a realistic cricket pitch background with players positioned by role. Our `SelectedTeamPitch.tsx` already does this — **keep it but improve the jersey styling**:
- Each player node: 44px circle, team color, player last name (truncated to 8 chars)
- C badge: red circle top-right of player node
- VC badge: darker red circle top-right

**Implementation steps**:

1. Extract sticky top bar into its own component `<TeamBuilderHeader credits remaining players selected />`
2. Rewrite role tabs to show selected count: `WK · {wkCount}`
3. Rewrite player row: left = team circle, center = name + role + "X% picked", right = +/- circle button
4. Add section headers (WK / BAT / ALL-ROUNDER / BOWLER) as `h3` dividers in the list
5. Make bottom CTA sticky with player count: `{count}/11 selected · Continue →`
6. Disable Continue until count === 11

---

## Screen 3: Dashboard (`/dashboard`)

**Current file**: `src/app/(game)/dashboard/page.tsx`

### What Dream11 dashboard looks like:

```
┌────────────────────────────────┐
│ [D11 logo]           [🔔] [👤] │  ← header (no wallet here)
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │ LIVE · RR vs MI            │ │  ← LIVE card (red pill)
│ │ 150/3 (11 ov)  22/2 (2.2) │ │
│ │ MI need 128 off 52 balls   │ │
│ │ [View Scorecard]           │ │
│ └────────────────────────────┘ │
├────────────────────────────────┤
│ UPCOMING MATCHES               │  ← section label
│ ┌────────────────────────────┐ │
│ │ [MI]  MI  vs  CSK  [CSK]  │ │
│ │  Mumbai Indians · Today    │ │
│ │  7:30 PM  ·  ⏱ 2h 30m    │ │
│ │ [View Contests] [My Teams] │ │
│ └────────────────────────────┘ │
├────────────────────────────────┤
│ MY CONTESTS                    │
│ ┌────────────────────────────┐ │
│ │ Mega Contest     #124      │ │
│ │ MI vs CSK · 450 pts        │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

### Key differences from current:

**A. Header**: Dream11 header does NOT show wallet balance inline. The balance is a separate section (top-right avatar → profile). Our header currently shows wallet balance prominently — move it to profile page or a notification bar.

**B. Match card** — Dream11 uses a simpler, flatter card:
- Two team logos (PNG, 56px) with team name below
- Venue + time in small text
- Countdown timer prominent (HH:MM:SS or Xh Ym)
- Bottom row: `[View Contests N]` left, `[Build Team]` right
- **No gradient top bar** — just white card with subtle shadow

**C. "My Contests" section** — Dream11 shows rank prominently:
```
Contest Name                    Rank: #42
MI vs CSK · LIVE               450 pts  ↑
```
- Arrow indicator if rank changed vs last sync (up/down)
- "LIVE" badge pulsing red when match is live

**D. Promotional banners**: Dream11 shows horizontal-scroll promo banners ("Refer & Earn", "Featured Contest") between sections. We can skip these.

**Implementation steps**:

1. Remove wallet balance from header — add a small `₹ 2,450` text as a clickable chip below user name (or in top-right icon area)
2. Simplify match card: remove gradient bar, reduce rounded to `rounded-xl`, use flat design
3. Team logos: create `<TeamLogo team="MI" size={56} />` component that renders a colored circle with the 2-letter abbreviation until real PNG logos are added
4. Countdown: make it more prominent — show `2h 30m` in large text, not small text
5. Replace "Join Contests" + "Build Team" buttons with a single `View Contests (5)` button and a small link `+ Team`
6. My Contests section: show rank with rank change arrow (up/down from last sync)

---

## Screen 4: Contest Detail / Leaderboard (`/contests/[id]`)

**Current file**: `src/app/(game)/contests/[id]/ContestDetailClient.tsx`

### What Dream11 leaderboard looks like:

```
┌────────────────────────────────┐
│ ← Mega Contest · MI vs CSK    │
│ Prize Pool: ₹1 Cr · 1200 teams│
├────────────────────────────────┤
│ MY RANK                        │
│ ┌──────────────────────────┐  │
│ │ #42 / 1200              │  │  ← YOUR rank card (always visible)
│ │ 450 pts  |  Team 1       │  │
│ │ Captain: Kohli (2x)      │  │
│ └──────────────────────────┘  │
├────────────────────────────────┤
│ WINNER ZONE  ·  Top 20% win   │  ← green divider
│ #1  Rahul's Team      612 pts  │
│ #2  Player B's Team   580 pts  │
│ ... (paginated)               │
├────────────────────────────────┤
│ ─────  YOU ARE HERE  ─────     │  ← separator at rank position
│ #42 Krish's Team 1    450 pts  │
└────────────────────────────────┘
```

### Key differences from current:

**A. Sticky "My Rank" card**: Dream11 pins YOUR rank card at the top of the leaderboard (below the contest header), always visible even when scrolling through other teams.

**B. "Winner zone" divider**: A green horizontal rule shows where the prize cutoff is. Teams above = in the money. Teams below = out of prizes.

**C. Team preview inline**: Clicking any team row expands it to show:
- Captain + VC names
- The 11 players (horizontal scrolling chips)
- Total points breakdown by player

**D. Rank change**: `+3 ↑` or `-2 ↓` shown next to each team's rank if we have previous rank stored.

**E. Tabs**: Dream11 shows tabs for `Leaderboard | Prize Breakup` within the contest page.

**Implementation steps**:

1. Add sticky "My Rank" banner below contest header — always stays on screen
2. Calculate winner cutoff rank (`winners_count` exists) and render a `WINNER ZONE` divider row at that position in the list
3. Add expandable team row — click to show player list
4. Add `Prize Breakup` tab showing prize tiers table
5. Show your team's rank relative to cutoff: "X spots from winning" or "You're winning ₹500"

---

## Screen 5: Bottom Navigation

**Current file**: `src/components/ui/BottomNav.tsx`

### Dream11's bottom nav:

```
[🏠 My Matches] [🏆 Contests] [👤 More]
```

Dream11 only has **3 tabs** (vs our 5). The "More" tab opens a side drawer.

Our 5 tabs: Home | Matches | Contests | My Teams | Wallet

### Recommendation: Keep 5 tabs but redesign the visual:

**Dream11 tab style**:
- Active tab: icon + label in the brand color, NO background pill or top bar indicator
- Inactive: gray icon + label
- No top-bar indicator (remove the top orange line we currently have)
- Height: 56px (not 64px)
- Background: pure black (`#000`) with a thin top border

**Implementation steps**:

1. Remove the active pill background (`inset-x-2 inset-y-1` div)
2. Remove the top orange line indicator
3. Reduce height from `h-16` (64px) to `h-14` (56px)
4. Change active state to: icon in brand color, label in brand color (already done ✓), no background
5. Change nav background to `#0A0A0A` (closer to black than current navy)

---

## Screen 6: Live Match Page (`/matches/[id]/live`)

**Current file**: `src/app/(game)/matches/[id]/live/page.tsx`

### Dream11 live scoring screen:

```
┌────────────────────────────────┐
│ LIVE  RR vs MI                 │  ← header with LIVE pill
│ 150/3 (11 ov) | 22/2 (2.2 ov) │
│ MI need 128 off 52 balls       │
├────────────────────────────────┤
│ MY POINTS  ·  Team 1           │
│ 📊 312 pts   Rank: #42         │  ← large points + rank
│ [Switch Team ▾]                │  ← if multiple teams
├────────────────────────────────┤
│ PLAYING  ·  sorted by pts      │
│ ┌──────────────────────────┐   │
│ │[C] Virat Kohli · BAT     │   │
│ │    68 runs · 3×2=6pts    │   │
│ │    ▓▓▓▓▓░░░░  45.5 pts  │   │
│ └──────────────────────────┘   │
└────────────────────────────────┘
```

### Key differences:

**A. Points breakdown per player**: Dream11 shows a mini breakdown `68 runs (34pts) + 4s×4 (4pts) + 6s×1 (2pts)` when you tap a player row.

**B. Sort options**: `Sorted by Points | By Role | By Team`

**C. "Not in Playing XI" section**: Players benched (not in XI) are shown separately with `-4 pts` (absent penalty) or 0.

**Implementation steps**:

1. Add sort tabs (points/role/team) to the live player list
2. Add expandable player rows with point breakdown
3. Separate "In XI" and "Not in XI" sections
4. Show captain's points multiplied: `(C) 45.5 × 2 = 91 pts`

---

## Screen 7: My Teams Page (`/my-teams`)

**Current file**: `src/app/(game)/my-teams/page.tsx`

### Dream11 My Teams:

```
[ALL MATCHES ▾]  ← dropdown to filter by match

┌─────────────────────────────┐
│ Team 1           ✏️ Edit    │
│ RR vs MI  ·  7 APR          │
│ C: Rohit Sharma             │
│ VC: Sanju Samson            │
│ ┌──────────────────────┐   │
│ │WK BAT BAT BAT AR ... │   │  ← horizontal role chips
│ └──────────────────────┘   │
│ Contest Status: 2 joined    │
└─────────────────────────────┘
```

### Key differences:

**A. Match filter dropdown** at top to filter teams by match — important when multiple upcoming matches have teams.

**B. Show contests joined** on each team card (`Joined in 2 contests`).

**C. Horizontal player chips** showing the 11 players by role abbreviation.

---

## 3. Component Library — New Shared Components to Build

These are reusable pieces needed across screens:

### `<TeamLogo team="MI" size={56} />`
Renders a colored circle with 2-letter team abbreviation. Later replace with `<img src="/teams/MI.png" />`.
File: `src/components/ui/TeamLogo.tsx`

### `<ContestCard contest={c} match={m} myEntries={[]} onJoin={fn} />`
The unified contest card used in browse + dashboard.
File: `src/components/contests/ContestCard.tsx`

### `<MatchCard match={m} compact={false} />`
The unified match card used in dashboard + matches list.
File: `src/components/matches/MatchCard.tsx`

### `<PlayerRow player={p} selected={bool} onToggle={fn} />`
Used in team builder player list.
File: `src/components/team-builder/PlayerRow.tsx`

### `<RankBadge rank={42} total={1200} />`
Shows `#42 / 1,200` with medal emoji for top 3.
File: `src/components/ui/RankBadge.tsx`

---

## 4. Implementation Order (with Risk Assessment)

| Priority | Screen | Risk | Estimated Complexity |
|----------|--------|------|---------------------|
| 1 | Design tokens (tailwind.config) | Low | Low — just config |
| 2 | ContestCard component | Medium | Medium |
| 3 | Contest Browse page | Medium | High — full restructure |
| 4 | Bottom Nav simplification | Low | Low |
| 5 | Team Builder player row | Medium | Medium |
| 6 | Dashboard match card | Low | Medium |
| 7 | Contest Detail leaderboard | Low | Medium |
| 8 | Live match player list | Low | Medium |
| 9 | My Teams page | Low | Low |

---

## 5. What NOT to Change

These are already close enough to Dream11 and changing them creates regression risk:

- The bottom sheet (join/switch team) — Dream11 also uses bottom sheets, ours is correct
- Filter pill style (horizontal scroll, rounded) — already Dream11-like
- Countdown timer component — Dream11 uses very similar display
- Toast notifications — Dream11 uses very similar top-center toasts
- Supabase Realtime subscription architecture — not a UI concern

---

## 6. Assets Needed

To fully match Dream11, these assets need to be created or sourced:

```
/public/teams/
  MI.png   (Mumbai Indians — blue logo)
  CSK.png  (Chennai — yellow logo)
  RCB.png  (Bangalore — red/black)
  KKR.png  (Kolkata — purple/gold)
  DC.png   (Delhi — navy/red)
  PBKS.png (Punjab — red)
  RR.png   (Rajasthan — pink)
  SRH.png  (Hyderabad — orange)
  GT.png   (Gujarat — navy/gold)
  LSG.png  (Lucknow — teal)
```

Until real logos exist, `<TeamLogo>` component uses the colored circle fallback. The component interface stays the same so swapping in real images later is a single-line change.

---

## 7. Quick Win Changes (Do These First, < 1 hour each)

These can be done immediately and make a noticeable difference without risk:

1. **Contest card: make prize pool the largest text** — change `text-2xl` → `text-3xl font-black` on prize pool
2. **Contest card: reorganize to prize LEFT, entry RIGHT on same row** — restructure the `<div>` layout
3. **Contest card: show "Top X% win" below prize** — move win% to be right below prize pool
4. **Bottom nav: reduce height** — `h-16` → `h-14`
5. **Bottom nav: remove background pill + top bar** — delete those two `active && (...)` divs
6. **Team builder: show role count in tabs** — `WK · {selected}` instead of just `WK`
7. **Dashboard: move wallet balance** to a small chip in the top-right instead of a large bordered box
8. **Contest browse header: increase team circle size** — `w-6 h-6` → `w-10 h-10` in the sticky header

---

## 8. The Winning Changes (Do These After, highest Dream11 parity)

In order of user-visible impact:

### A. Sticky "My Rank" card in Contest Detail
This is the single most Dream11-feeling feature. When you're in a live contest, seeing your rank pinned to the top as you scroll through the leaderboard is iconic to Dream11.

### B. Winner Zone divider in leaderboard
The green divider line showing "win above this line" gives users instant clarity on their position.

### C. Player "Selected by X%" in team builder
This social proof number drives selection decisions. Store selection percentage in `f11_players.selection_pct` (percentage of all teams for this match that include this player). Update it when teams are saved.

### D. Full-width join button when not joined → small icon when joined
Dream11 contest cards change shape dramatically after you join. Before: big full-width "Join" button. After: card shows your team name prominently, small "+ Add" link to add another team.

---

*Last updated: 2026-04-08*
*Status: Pending implementation*
