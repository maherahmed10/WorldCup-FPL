import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGameweek } from "@/lib/squad-data";
import { getNationStats, getNationMembersData } from "@/lib/nations";
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

  // Pre-load user's own nation members so the hero card expands instantly
  const preloadedMembers = payload.myNation
    ? await getNationMembersData(payload.myNation, user.id, gameweek.id)
    : [];

  return (
    <NationsClient
      payload={payload}
      preloadedMembers={preloadedMembers}
      gameweekId={gameweek.id}
      userId={user.id}
    />
  );
}
