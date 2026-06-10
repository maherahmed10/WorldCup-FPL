import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGameweek } from "@/lib/squad-data";
import { getNationStats, getNationMembersData, getCountryTeamData } from "@/lib/nations";
import type { CountryTeamData } from "@/lib/nations";
import { NationsClient } from "./NationsClient";

export const dynamic = "force-dynamic";

export default async function NationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const gameweek = await getCurrentGameweek();
  if (!gameweek) {
    return (
      <div className="screen">
        <div className="screen-head"><h1>Nations</h1></div>
        <p style={{ color: "var(--text-2)", fontSize: 14 }}>No active gameweek.</p>
      </div>
    );
  }

  const payload = await getNationStats(user.id, gameweek.id);

  // Fan-out parallel fetches now that we know the user's nation
  const [preloadedMembers, countryData] = await Promise.all([
    payload.myNation
      ? getNationMembersData(payload.myNation, user.id, gameweek.id)
      : Promise.resolve<[]>([]),
    payload.myNation
      ? getCountryTeamData(payload.myNation)
      : Promise.resolve<CountryTeamData | null>(null),
  ]);

  return (
    <NationsClient
      payload={payload}
      preloadedMembers={preloadedMembers}
      countryData={countryData}
      gameweekId={gameweek.id}
      userId={user.id}
    />
  );
}
