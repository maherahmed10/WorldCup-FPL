# Player detail — available data (for the player modal/widget)

All of this is **in our DB** (the `Player` table) — no API call needed at render
time. Build a player-detail modal/card reading these via Prisma (`db.player`).
Synced by `npm run sync -- profiles` (~96 requests/day; refresh as the tournament
plays so season stats stay current).

## Fields on `Player`

| Field | Type | Notes |
|---|---|---|
| `name` | string | e.g. "L. Messi" |
| `position` | GK/DEF/MID/FWD | |
| `price` | int | tenths of a million (130 = £13.0m) |
| `photoUrl` | string | api-sports headshot, e.g. `media.api-sports.io/football/players/<id>.png` — **all 1,248 populated** |
| `age` | int? | |
| `nationality` | string? | |
| `heightCm` | int? | e.g. 170 |
| `weightKg` | int? | e.g. 67 |
| `injured` | bool | injury flag |
| `seasonAppearances` | int? | season apps |
| `seasonMinutes` | int? | minutes played |
| `seasonGoals` | int? | season goals |
| `seasonAssists` | int? | season assists |
| `seasonRating` | float? | avg 0–10 |
| `team.country` | string | nation (drives the flag — use `<Flag country={...} />`) |
| `team.name` | string | |

> ~1,090 / 1,248 players have full bio+stats; the rest (deep-squad backups with no
> recorded apps) have name/position/photo/price only — handle nulls gracefully.

## Per-match stats (after games are played)

`PlayerMatchStat` rows hold per-fixture detail (minutes, goals, assists, cards,
saves, rating, computed `fantasyPoints`). Join `Player.matchStats` for a
match-by-match breakdown / fantasy points history once the tournament is underway.

## Suggested card layout (reference: API-Sports player widget)

- Header: photo + name + flag + position chip + price
- Bio row: age · height · weight · nationality
- Stats row: rating · apps · goals · assists (· minutes)
- (later) fantasy points earned in our game, form sparkline from PlayerMatchStat

## How to build it (architecture rule)

Read from our DB — never call API-Football per user request. A player-detail
page/modal is a server component (or server-loaded data passed to a client
modal) querying `db.player.findUnique({ where:{id}, include:{ team:true }})`.
