// Squad picker page — ported from design/screens_squad.jsx.
// Server component: loads the full player pool + any existing squad, hands them
// to the interactive client picker.
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getUpcomingDeadlineGameweek, getSquadForEdit, getPickForEdit } from "@/lib/squad-data";
import { getMaxPerCountry, type PerkLike } from "@/lib/store";
import { SquadPicker, type PickerPlayer } from "./SquadPicker";

export default async function SquadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [players, rawPerks, gameweek, appUser, favouriteRows] = await Promise.all([
    db.player.findMany({
      include: { team: true },
      orderBy: [{ price: "desc" }, { name: "asc" }],
    }),
    db.userPerk.findMany({
      where: { userId: user.id },
      select: { storeItemId: true, gameweekId: true, usedAt: true },
    }),
    // Edit the NEXT-deadline gameweek (the editable one), not the playing one —
    // so editing after MD1's deadline targets MD2 and leaves the locked MD1 alone.
    getUpcomingDeadlineGameweek(),
    db.user.findUnique({ where: { id: user.id }, select: { bettingBalance: true, squadBudgetBonus: true } }),
    db.playerFavourite.findMany({ where: { userId: user.id }, select: { playerId: true } }),
  ]);

  const pool: PickerPlayer[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    price: p.price,
    country: p.team.country,
  }));

  const perks = rawPerks as PerkLike[];
  const maxPerCountry = getMaxPerCountry(perks);
  const isGroupStage = !(gameweek?.isKnockout ?? false);
  const initialFavouriteIds = favouriteRows.map((f) => f.playerId);

  // Seed the picker from the upcoming-GW squad if it exists, else carry forward
  // the most recent squad. The 15 are LOCKED whenever a prior squad exists (only
  // the first-ever pick is unlocked); the 15 change only via /transfers.
  const { squad: existing, sourceGameweekId } = gameweek
    ? await getSquadForEdit(user.id, gameweek.id)
    : { squad: null, sourceGameweekId: null };
  const lockRoster = existing !== null;
  const budgetBonus = appUser?.squadBudgetBonus ?? 0;
  const pick = await getPickForEdit(user.id, sourceGameweekId);

  return (
    <>
<SquadPicker
        pool={pool}
        gameweekLabel={gameweek?.label ?? ""}
        initialStarterIds={existing?.players.filter((p) => p.isStarting).map((p) => p.id) ?? []}
        initialBenchIds={existing?.players.filter((p) => !p.isStarting).map((p) => p.id) ?? []}
        initialCaptainId={pick?.captainId ?? existing?.captainId ?? null}
        initialViceId={pick?.viceId ?? null}
        maxPerCountry={maxPerCountry}
        balance={appUser?.bettingBalance ?? 1000}
        budgetBonus={budgetBonus}
        ownedPerks={perks}
        isGroupStage={isGroupStage}
        lockRoster={lockRoster}
        initialFavouriteIds={initialFavouriteIds}
      />
    </>
  );
}
