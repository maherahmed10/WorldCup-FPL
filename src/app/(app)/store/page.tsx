// Store page — spend your betting bank on squad/scoring perks.
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getCurrentGameweek } from "@/lib/squad-data";
import { StoreClient, type OwnedPerk } from "./StoreClient";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [rawPerks, gameweek] = await Promise.all([
    db.userPerk.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        storeItemId: true,
        gameweekId: true,
        usedAt: true,
        createdAt: true,
      },
    }),
    getCurrentGameweek(),
  ]);

  const ownedPerks: OwnedPerk[] = rawPerks.map((p) => ({
    id: p.id,
    storeItemId: p.storeItemId,
    gameweekId: p.gameweekId,
    usedAt: p.usedAt,
    createdAt: p.createdAt,
  }));

  // Bench Boost is only purchasable after the group stage
  const isGroupStage = !(gameweek?.isKnockout ?? false);

  return (
    <StoreClient
      balance={user.bettingBalance}
      ownedPerks={ownedPerks}
      isGroupStage={isGroupStage}
    />
  );
}
