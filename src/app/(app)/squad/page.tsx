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

  const [players, rawPerks, gameweek] = await Promise.all([
    db.player.findMany({
      include: { team: true },
      orderBy: [{ price: "desc" }, { name: "asc" }],
    }),
    db.userPerk.findMany({
      where: { userId: user.id },
      select: { storeItemId: true, gameweekId: true, usedAt: true },
    }),
    getCurrentGameweek(),
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

  const existing = gameweek ? await getActiveSquad(user.id, gameweek.id) : null;

  return (
    <SquadPicker
      pool={pool}
      gameweekLabel={gameweek?.label ?? ""}
      initialStarterIds={existing?.players.filter((p) => p.isStarting).map((p) => p.id) ?? []}
      initialBenchIds={existing?.players.filter((p) => !p.isStarting).map((p) => p.id) ?? []}
      initialCaptainId={existing?.captainId ?? null}
      maxPerCountry={maxPerCountry}
    />
  );
}
