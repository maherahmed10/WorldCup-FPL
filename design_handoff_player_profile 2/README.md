# Handoff: Player Profile widget (GAFFER / WorldCup-FPL)

## Overview
A click-to-open **player profile** for the GAFFER World Cup 2026 fantasy app, modeled on
the API-Football player widget. Clicking any player anywhere in the app (Players market
list + cards, the My-Team pitch/bench/top-performers, and the squad picker's action sheet)
opens a modal showing: header (photo, flag, nationality, club, position, fit status, price),
bio vitals, season statistics, GAFFER fantasy returns + form, a match-by-match breakdown,
and the player's nation's upcoming fixtures with difficulty ratings.

## About the design files
The files in `reference/` are a **design prototype written in plain-React + HTML/CSS**
(loaded via Babel-in-browser, no build step). They are a **visual + behavioral spec, not
code to ship**. Your job is to **recreate this in the real Next.js app** at
`src/` using its existing patterns — server components reading Prisma, the
`PlayerView` view-model, the existing `Flag` / `Spark` / `Jersey` / `Icon` components, and
the CSS tokens already in `src/styles/`. **Do not** port the Babel/`React.createElement`
style or `window.*` globals; rewrite as a typed `.tsx` client component.

Critically: the prototype's enrichment file (`reference/playerdata.jsx`) **fabricates**
bio/stats/match data deterministically because the prototype has no DB. In the real app
**all of that data already exists on the `Player` and `PlayerMatchStat` tables** — read it,
do not synthesize it. `playerdata.jsx` is included only so you can see the exact shape and
which fields map where.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions. Recreate
pixel-for-pixel using the existing design tokens (`reference/theme.css` —
already present in your repo as the token source). The profile-specific CSS lives in
`reference/playercard.css`; fold these rules into `src/styles/components.css` (they use only
existing CSS variables, no new tokens).

---

## Data mapping — read from the DB, do not invent

Everything maps to your Prisma schema (`prisma/schema.prisma`). Load with one query:

```ts
const player = await db.player.findUnique({
  where: { id },
  include: {
    team: true,
    matchStats: {
      include: { fixture: { include: { homeTeam: true, awayTeam: true, gameweek: true } } },
      orderBy: { fixture: { kickoff: "asc" } },
    },
  },
});
```

| Profile UI element | DB source | Notes |
|---|---|---|
| Headshot | `Player.photoUrl` | `media.api-sports.io/football/players/<apiPlayerId>.png`. **All 1,248 populated.** Render with an `onError` fallback to the `<Jersey country>` placeholder + initials (see prototype `PlayerPhoto`). |
| Name / position / price | `Player.name` / `position` / `price` | `price` is tenths (130 → £13.0m). |
| Flag + nationality | `Player.team.country` (flag) + `Player.nationality` | `<Flag country={team.country} />`. |
| Club | *(not in DB)* | The prototype shows a club line; your schema has no club field. **Either omit the club line, or add a `club String?` column.** Recommend omitting for v1. |
| Fit status | `Player.injured` (bool) | `true` → "Injured" (red pill). No "doubt" tier exists in DB — collapse to fit/injured (drop the gold "doubt" state, or add an enum if desired). |
| Vitals: Age / Height / Weight | `Player.age` / `heightCm` / `weightKg` | All nullable — render "—" when null. |
| Season: Rating | `Player.seasonRating` (0–10) | Drives the 0–10 bar. Bar fill % = `(rating-5)/5*100`, clamped 0–100. |
| Season: Apps / Minutes / Goals / Assists | `Player.seasonAppearances` / `seasonMinutes` / `seasonGoals` / `seasonAssists` | Nullable. |
| Season: Clean sheets | **derive** from `matchStats` | DB stores no clean-sheet flag. Clean sheet = `minutes >= 60 && goalsConceded === 0` per match (per schema comment). Count for GK/DEF only; hide the stat for MID/FWD. |
| Fantasy: Total pts / PPG / form | use `PlayerView` (`src/lib/players.ts`) | `toPlayerView()` already derives `pts`, `ppg`, `form[]` from settled `matchStats.fantasyPoints`. Reuse it. |
| Fantasy: % selected | *(not in DB)* | Prototype shows `selBy%`. No ownership column exists. **Omit, or compute** from `SquadPlayer` counts (`COUNT(squadPlayers where playerId) / total active squads`). Recommend omit for v1. |
| Matches tab rows | `Player.matchStats` joined to `fixture` | One row per settled match. Columns below. |
| Fixtures tab | upcoming `Fixture` rows for `player.teamId` | `Fixture.status === SCHEDULED`, ordered by `kickoff`. Difficulty = opponent strength (see FDR below). |

### Match row (Matches tab) — per `PlayerMatchStat`
- **Round**: `fixture.gameweek.label` (e.g. "Round of 32") — abbreviate for the column.
- **Opponent**: the team in `fixture` that isn't `player.teamId`; H/A from whether player's team is `homeTeam`. Flag + 3-letter code.
- **Score + result (W/D/L)**: `fixture.homeScore`–`awayScore` from the player's team's perspective.
- **Min / G / A**: `minutes` / `goals` / `assists`. If `minutes === 0` render the row dimmed with "—".
- **Cards**: yellow dot if `yellowCards > 0`, red dot if `redCards > 0`.
- **Rating**: `rating` (nullable → "—"). Tone: ≥7.5 green, ≥6.5 default, else muted.
- **Pts**: `fantasyPoints`. Pill: ≥8 = accent-filled "hot", ≤1 = muted "cold".

### Fixtures tab — Fixture Difficulty Rating (FDR)
The prototype hardcodes a `STRENGTH` map (1 easy … 5 hard) keyed by country (see
`playerdata.jsx`). Reuse the same map, or derive difficulty from FIFA ranking / seeding if you
have it. Render rounds: next `SCHEDULED` fixture(s) for the team. Show H/A, opponent flag +
name, kickoff, and an FDR pill colored `fdr-1`…`fdr-5` (green→red, see `playercard.css`).

---

## Component structure (recreate as .tsx)

`PlayerProfileModal` (client component, `"use client"`), opened by a parent that holds
`const [selected, setSelected] = useState<PlayerView | null>(null)`. Sections, top→bottom:

1. **Hero** (`.pp-hero`, position-tinted radial glow via `--pp-glow`): circular photo (104px)
   with a position-colored conic ring + flag badge; position chip + status pill; name (Archivo
   900, 30px); sub-line `flag · nationality · club`; price block.
2. **Vitals strip** (`.pp-vitals`): 4-cell grid — Age, Height (cm), Weight (kg), Nation.
3. **Tabs** (`Segmented`, size `sm`): Statistics / Matches / Fixtures.
4. **Statistics**: rating bar card + 4–5 stat tiles, then a fantasy block (Total pts / PPG /
   Selected / Last-5 sparkline). Reuse `<Spark data={form} />`.
5. **Matches**: 7-col grid table (Round, Opponent, Min, G, A, Rtg, Pts).
6. **Fixtures**: list of upcoming fixtures with FDR pills.

Reuse the existing **`Modal`** primitive (`wide` variant) from the prototype's
`components.jsx` — your repo's equivalent should exist or be added to `src/components/`. Esc
to close, click-outside to close.

### Wiring (the 4 entry points)
- **Players market** (`src/app/(app)/.../players` client): make each `PlayerRow` /
  player card clickable → `setSelected(p)`. In the prototype these are
  `screens_market.jsx` `.mrow` and `.pcard` (now `role="button"`, keyboard-accessible).
- **My Team pitch + bench + top performers** (`Pitch.tsx` tokens / dashboard): clicking a
  filled token opens the profile.
- **Squad picker action sheet**: add a "View full profile" item (icon `eye`) above the
  captain/vice/remove actions.

Make the row/token/card hover affordance match `.mrow.clickable` / `.pcard.clickable` in
`playercard.css`.

---

## Squad picker integration — opening the profile WITHOUT breaking add / swap

On the Players market page a row tap has no other job, so tap = open profile. On the **Pick
Your Team** page the same players appear where tap is already taken:
- **Pitch & bench tokens** — tap/drag drives select-then-swap (drag-and-drop substitution).
- **Add-player side sheet rows** — tap = add that player to the squad.

Key fact: **drag and tap are different gestures and coexist on one element.** A drag is
`pointerdown → move → pointerup`; a tap is `pointerdown → pointerup` with negligible
movement. You are not blocked from adding a tap handler — you only have to stop the drag
sensor's *synthetic click* from firing after a drag ends.

### Picker rows → split into two hit-zones (implemented in `reference/playerlist.jsx`)
Don't add an extra ⓘ icon. Split the existing row:
- **Identity zone** (`.prow-id-btn`: flag + name + position + stats + price) → **tap opens the
  profile**. A faint `eye` glyph (`.prow-hint`) fades in on hover (`opacity 0 → .75`, slides
  3px) as the discoverability cue.
- **`+` button** (`.prow-action`, the existing accent circle) → **tap adds to squad.** Hover
  `background:#2BE998; transform:scale(1.06)`; active `translateY(1px)`.
- The identity zone is **never disabled** — you can VIEW any player (even ineligible ones);
  only the `+` is disabled (lock icon / "In" pill). Both zones ≥ 36px (pad to 44px on mobile).

`reference/playerlist.jsx` is the working reference. Wiring (from `screens_squad.jsx`): the
owning screen holds `const [selected, setSelected] = useState(null)`, passes
`onProfile={(p) => setSelected(p)}` and `onPick={(p) => addToSquad(p)}` to each `PlayerRow`,
and renders `<PlayerProfileModal player={selected} onClose={…} />` — it layers over the open
side-sheet, and closing returns you to the picker.

### Pitch / bench tokens → tap opens a contextual action menu
Do **not** use long-press (undiscoverable, fights drag-start timing). A plain tap opens a
small menu anchored to the token with **View profile** (`eye`), Make Captain (`star`), Make
Vice (`user`), Substitute (`swap`), Remove (`swap`, `--live` tone). Drag still swaps. Items
44px tall, `icon 19px` + `15px/700` label, popover on `--surface-2` / `1px var(--line-2)` /
`--r` / `--sh-3`. (The prototype's squad action sheet is this menu — see `screens_squad.jsx`
`PlayerActions`.)

### The drag/tap disambiguation (the part to wire in your real DnD code)
Taps and drags coexist by (a) requiring a small movement before a drag starts and (b)
swallowing the click a drag emits on release. With **dnd-kit**:

```ts
// (a) a real drag only begins after ~6px of movement → short taps stay clicks
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
);

// (b) eat the synthetic click that fires after a drag ends
const draggedRef = useRef(false);
<DndContext
  sensors={sensors}
  onDragStart={() => { draggedRef.current = true; }}
  onDragEnd={(e) => { handleSwap(e); /* leave flag set through the click */ }}
/>;

function onTokenClick(player) {
  if (draggedRef.current) { draggedRef.current = false; return; } // was a drag → ignore
  openActionMenu(player); // genuine tap → menu (profile lives here)
}
```

`activationConstraint.distance` is the crucial line. For native HTML5 DnD, set a flag in
`dragstart` and bail out of the click handler if it's set. Net result:
**tap = menu (profile), drag = swap, both on the same token.**

---

## Interactions & behavior
- **Open**: click or Enter/Space on any player row, card, or pitch token.
- **Tabs**: instant client-side switch (no fetch — all data loaded with the modal).
- **Close**: Esc, the × button, or click on the overlay backdrop.
- **Photo fallback**: `<img onError>` swaps to the `Jersey` + initials placeholder.
- **Null handling**: any nullable bio/stat field renders "—". Deep-squad players
  (~158 of 1,248) have name/position/photo/price only — the profile must look intentional
  with everything else blank.
- **Animation**: modal uses `popIn` (0.2s). Respect `prefers-reduced-motion`.

## State management
- One piece of local state per owning screen: `selected: PlayerView | null`.
- The modal itself holds only the active tab (`"stats" | "matches" | "fixtures"`).
- No global store needed. Data is server-loaded; pass the full enriched player object (or
  fetch by id in a route handler / RSC and pass down).

## Design tokens (all already in your repo — `src/styles` / `theme.css`)
- Accent `#18E08A`, gold `#FFC53D`, blue `#3DA5FF`, purple `#9D7BFF`, live `#FF4D5E`.
- Position colors: GK gold, DEF blue, MID accent, FWD purple (see `.pos-*`).
- Surfaces `#121925` / `#19212F` / `#222C3D` / `#2A3649`; radii `--r-sm…--r-xl`.
- Fonts: Archivo (display/numbers, `.num` = tabular), Hanken Grotesk (body).

## Assets
- Headshots: `Player.photoUrl` (api-sports CDN). No new assets needed.
- Flags & jerseys: existing `Flag.tsx` / `Jersey.tsx` components.

## Files in this bundle
- `reference/playercard.jsx` — the profile component (structure + section logic to recreate).
- `reference/playercard.css` — profile styles + the split-row (`.prow-id-btn` / `.prow-action`) styles (fold into `src/styles/components.css`).
- `reference/playerlist.jsx` — the squad-picker `PlayerRow`, split into identity (profile) and action (add) hit-zones. Reference for the "open profile without breaking add" pattern.
- `reference/playerdata.jsx` — **shape/mapping reference only**; the real app reads these
  fields from Prisma instead of generating them. Note the `STRENGTH` (FDR) map here.
- `reference/theme.css`, `reference/components.css` — token + base-component context.

### Corresponding real-codebase files to touch
- `src/components/PlayerProfileModal.tsx` *(new)* — the widget.
- `src/lib/players.ts` — extend `PlayerView` (or add a `PlayerProfileView`) with the bio +
  season fields and the match/fixture arrays; add a `toPlayerProfile()` mapper.
- `src/components/PlayerRow.tsx`, `src/components/Pitch.tsx` — add the click → open behavior
  (lift selection into the owning client screen).
- `src/styles/components.css` — add the `.pp-*` rules.
