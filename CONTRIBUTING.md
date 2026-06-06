# Contributing — how the 3 of us work

Small team, weekend sprint. The rules are deliberately light. The one thing we
care about: **`main` always builds.** If `npm run build` fails on `main`, that's
the only real emergency.

## Branch workflow

We use **feature branches → merge to `main` when the feature is stable.**

```bash
git checkout main
git pull                      # always start from latest main
git checkout -b feat/<area>-<short-desc>     # e.g. feat/squad-picker
# ...work, commit as you go...
git push -u origin feat/squad-picker
```

When the feature is stable (it builds + works):

- Open a PR into `main` on GitHub, **or** merge it yourself if it's clean.
- Before merging, **pull main and merge it into your branch** so conflicts
  surface on your branch, not on main:
  ```bash
  git checkout feat/squad-picker
  git merge main                # resolve any conflicts here
  npm run build                 # must pass
  ```

### Branch naming

| Prefix | For |
|---|---|
| `feat/` | new feature (`feat/predict-betslip`) |
| `fix/` | bug fix (`fix/budget-overcount`) |
| `chore/` | tooling / deps / docs |

## Before you push — the checklist

```bash
npm run build      # must pass (this is the rule for main)
npm test           # if you touched scoring or other tested logic
npm run lint       # keep it clean
```

## Avoiding conflicts (we mostly own separate folders)

The app is split so we rarely edit the same files — see [`TASKS.md`](TASKS.md)
for who owns what. Rules of thumb:

- **Stay in your route folder** (`src/app/<area>/`) and your components.
- **Shared files** (`prisma/schema.prisma`, `src/app/globals.css`,
  `src/app/layout.tsx`, shared components in `src/components/`): post in the
  group chat *before* editing, and keep edits small + additive.
- **Schema changes** affect everyone — agree in chat first, then one person
  makes the change and others `git pull` + `npm run db:generate`.

## Got a merge conflict you can't untangle?

That's fine — push your branch and ask Claude (or a teammate) to resolve it.
Don't force-push over `main`.

## Database

We share **one Supabase database**, so everyone sees the same data (needed for
leaderboards/leagues). Don't run destructive migrations without telling the
group. For risky schema experiments, branch the DB in Supabase or use the local
Docker fallback (see [`README.md`](README.md)).

## Design reference

The clickable design lives in [`design/`](design/) — open `design/index.html` in
a browser. It's a prototype (React-via-CDN), **not** code we ship. We port its
look (already wired into `globals.css`) and screens into real Next.js components.
Match it by eye; don't copy the `window.*` globals pattern.
