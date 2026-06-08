// Transfers page — open during knockout rounds only; 3 transfers per window.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getCurrentGameweek, getActiveSquad } from "@/lib/squad-data";
import { Icon } from "@/components/Icon";
import {
  TransfersClient,
  type TransferPlayer,
  type TransferSquadState,
} from "./TransfersClient";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const gameweek = await getCurrentGameweek();

  // Transfer window only opens for knockout rounds
  if (!gameweek?.isKnockout) {
    return (
      <div className="screen">
        <div className="screen-head">
          <h1>Transfers</h1>
        </div>
        <div className="empty">
          <div className="empty-ico">
            <Icon name="swap" size={28} />
          </div>
          <h3>Transfer window closed</h3>
          <p>Transfers open at the start of each knockout round (R32, R16, QF, SF, Final).</p>
          <Link className="btn btn-ghost" href="/team">
            Back to My Team
          </Link>
        </div>
      </div>
    );
  }

  const [squad, players, rawPerks] = await Promise.all([
    getActiveSquad(user.id, gameweek.id),
    db.player.findMany({
      include: { team: true },
      orderBy: [{ price: "desc" }, { name: "asc" }],
    }),
    db.userPerk.findMany({
      where: { userId: user.id, storeItemId: "perk_extra_transfer", usedAt: null },
    }),
  ]);

  if (!squad) {
    return (
      <div className="screen">
        <div className="screen-head">
          <h1>Transfers</h1>
        </div>
        <div className="empty">
          <div className="empty-ico">
            <Icon name="team" size={28} />
          </div>
          <h3>No squad yet</h3>
          <p>Pick your squad before making transfers.</p>
          <Link className="btn btn-primary" href="/squad">
            <Icon name="plus" size={17} />
            Pick Your Team
          </Link>
        </div>
      </div>
    );
  }

  // Load transfersUsed from the DB squad row
  const dbSquad = await db.squad.findUnique({
    where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek.id } },
    select: { transfersUsed: true },
  });

  const pool: TransferPlayer[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position as "GK" | "DEF" | "MID" | "FWD",
    price: p.price,
    country: p.team.country,
  }));

  const initialSquad: TransferSquadState[] = squad.players.map((p) => ({
    playerId: p.id,
    isStarting: p.isStarting,
  }));

  return (
    <TransfersClient
      pool={pool}
      initialSquad={initialSquad}
      captainId={squad.captainId}
      transfersUsed={dbSquad?.transfersUsed ?? 0}
      extraTransferCount={rawPerks.length}
      gameweekLabel={gameweek.label}
    />
  );
}
