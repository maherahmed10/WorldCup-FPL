import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getCurrentGameweek } from "@/lib/squad-data";
import { getGlobalLeaderboard } from "@/lib/leaderboard";
import { LeaderboardClient } from "./LeaderboardClient";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const gameweek = await getCurrentGameweek();
  if (!gameweek) {
    return (
      <div className="screen">
        <div className="screen-head">
          <h1>Leaderboard</h1>
        </div>
        <p style={{ color: "var(--text-2)", fontSize: 14 }}>No active gameweek.</p>
      </div>
    );
  }

  const appUser = await db.user.findUnique({
    where: { id: user.id },
    select: { teamName: true },
  });

  const data = await getGlobalLeaderboard({ userId: user.id, gameweekId: gameweek.id });

  return <LeaderboardClient data={data} teamName={appUser?.teamName ?? data.teamName} />;
}
