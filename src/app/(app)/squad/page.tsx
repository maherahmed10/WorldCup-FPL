// Squad picker page — ported from design/screens_squad.jsx.
// Server component: loads the full player pool + any existing squad, hands them
// to the interactive client picker.
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  getUpcomingDeadlineGameweek,
  getSquadForEdit,
  getPickForEdit,
  getKnockoutTransferAllowance,
} from "@/lib/squad-data";
import { getMaxPerCountry, type PerkLike } from "@/lib/store";
import { BUDGET, totalPrice } from "@/lib/squad-rules";
import { ensureKnockoutBudgetMerged, knockoutFunds } from "@/lib/budget-merge";
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

  // Knockouts: lazily fold any leftover group budget into the bank (one pool).
  if (!isGroupStage) await ensureKnockoutBudgetMerged(user.id);
  const bettingBalance = !isGroupStage
    ? (await db.user.findUnique({ where: { id: user.id }, select: { bettingBalance: true } }))?.bettingBalance ??
      appUser?.bettingBalance ?? 0
    : appUser?.bettingBalance ?? 0;

  // Seed the picker from the upcoming-GW squad if it exists, else carry forward
  // the most recent squad. The 15 are LOCKED whenever a prior squad exists (only
  // the first-ever pick is unlocked); the 15 change only via /transfers.
  const { squad: existing, sourceGameweekId } = gameweek
    ? await getSquadForEdit(user.id, gameweek.id)
    : { squad: null, sourceGameweekId: null };
  const lockRoster = existing !== null;
  const pick = await getPickForEdit(user.id, sourceGameweekId);

  // One-pool budget: in the knockouts the squad cap = current squad spend + the
  // whole bank, so budgetBonus is derived (cap − £100M) rather than a stored
  // conversion. In the group stage it's the flat £100M (legacy bonus honoured).
  const squadSpentTenths = existing ? totalPrice(existing.players) : 0;
  const funds = knockoutFunds({
    isKnockout: !isGroupStage,
    bettingBalance,
    squadSpentTenths,
    squadBudgetBonus: appUser?.squadBudgetBonus ?? 0,
  });
  const budgetBonus = funds.squadCapTenths - BUDGET;

  // Knockouts: transfers happen right here in the editor. Each round grants
  // 3 transfers; UNUSED ones carry over to the next knockout round (+ unused
  // Extra Transfer perks). See getKnockoutTransferAllowance.
  const transferMode = !isGroupStage && lockRoster;
  let transfersUsed = 0;
  let transferLimit = 0;
  if (transferMode && gameweek) {
    const allowance = await getKnockoutTransferAllowance(user.id, gameweek);
    transfersUsed = allowance.used;
    transferLimit = allowance.limit;
  }

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
        balance={bettingBalance}
        budgetBonus={budgetBonus}
        ownedPerks={perks}
        isGroupStage={isGroupStage}
        lockRoster={lockRoster}
        transferMode={transferMode}
        transfersUsed={transfersUsed}
        transferLimit={transferLimit}
        initialFavouriteIds={initialFavouriteIds}
      />
    </>
  );
}
