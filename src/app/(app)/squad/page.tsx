// Squad picker page — ported from design/screens_squad.jsx.
// Server component: loads the full player pool + any existing squad, hands them
// to the interactive client picker.
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getCurrentGameweek, getActiveSquad } from "@/lib/squad-data";
import { getMaxPerCountry, type PerkLike } from "@/lib/store";
import { SquadPicker, type PickerPlayer } from "./SquadPicker";

export default async function SquadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [players, rawPerks, gameweek, appUser] = await Promise.all([
    db.player.findMany({
      include: { team: true },
      orderBy: [{ price: "desc" }, { name: "asc" }],
    }),
    db.userPerk.findMany({
      where: { userId: user.id },
      select: { storeItemId: true, gameweekId: true, usedAt: true },
    }),
    getCurrentGameweek(),
    db.user.findUnique({ where: { id: user.id }, select: { bettingBalance: true } }),
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

  const existing = gameweek ? await getActiveSquad(user.id, gameweek.id) : null;
  // The per-gameweek captain/vice pick (separate from Squad.captainId).
  const pick = gameweek
    ? await db.gameweekPick.findUnique({
        where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek.id } },
        select: { captainId: true, viceId: true },
      })
    : null;

  return (
    <SquadPicker
      pool={pool}
      gameweekLabel={gameweek?.label ?? ""}
      initialStarterIds={existing?.players.filter((p) => p.isStarting).map((p) => p.id) ?? []}
      initialBenchIds={existing?.players.filter((p) => !p.isStarting).map((p) => p.id) ?? []}
      initialCaptainId={pick?.captainId ?? existing?.captainId ?? null}
      initialViceId={pick?.viceId ?? null}
      maxPerCountry={maxPerCountry}
      balance={appUser?.bettingBalance ?? 1000}
      ownedPerks={perks}
      isGroupStage={isGroupStage}
    />
  );
}
