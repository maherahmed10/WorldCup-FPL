// Store page — spend your betting bank on squad/scoring perks.
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { StoreClient, type OwnedPerk } from "./StoreClient";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const rawPerks = await db.userPerk.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      storeItemId: true,
      gameweekId: true,
      usedAt: true,
      createdAt: true,
    },
  });

  const ownedPerks: OwnedPerk[] = rawPerks.map((p) => ({
    id: p.id,
    storeItemId: p.storeItemId,
    gameweekId: p.gameweekId,
    usedAt: p.usedAt,
    createdAt: p.createdAt,
  }));

  return <StoreClient balance={user.bettingBalance} ownedPerks={ownedPerks} />;
}
