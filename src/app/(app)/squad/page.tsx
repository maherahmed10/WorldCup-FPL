// Squad picker page — ported from design/screens_squad.jsx.
// Server component: loads the full player pool + any existing squad, hands them
// to the interactive client picker.
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getCurrentGameweek, getActiveSquad } from "@/lib/squad-data";
import { SquadPicker, type PickerPlayer } from "./SquadPicker";

export default async function SquadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Full pool — 1,248 players. Light projection (the picker only needs these).
  const players = await db.player.findMany({
    include: { team: true },
    orderBy: [{ price: "desc" }, { name: "asc" }],
  });

  const pool: PickerPlayer[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    price: p.price,
    country: p.team.country,
  }));

  const gameweek = await getCurrentGameweek();
  const existing = gameweek ? await getActiveSquad(user.id, gameweek.id) : null;

  return (
    <SquadPicker
      pool={pool}
      gameweekLabel={gameweek?.label ?? ""}
      initialStarterIds={existing?.players.filter((p) => p.isStarting).map((p) => p.id) ?? []}
      initialBenchIds={existing?.players.filter((p) => !p.isStarting).map((p) => p.id) ?? []}
      initialCaptainId={existing?.captainId ?? null}
    />
  );
}
