export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getCurrentGameweek } from "@/lib/squad-data";
import { isTransferWindowOpen, type Position } from "@/lib/squad-rules";
import { Icon } from "@/components/Icon";
import { TransfersClient, type TransferPlayer, type PoolPlayer } from "./TransfersClient";

export default async function TransfersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const gameweek = await getCurrentGameweek();

  if (!gameweek || !isTransferWindowOpen(gameweek)) {
    return (
      <div className="screen">
        <div className="screen-head">
          <h1>Transfers</h1>
        </div>
        <div className="empty">
          <div className="empty-ico">
            <Icon name="lock" size={28} />
          </div>
          <h3>Transfer window closed</h3>
          <p>
            Transfer windows open at the start of each knockout round — Round of
            32, R16, Quarter-finals, Semi-finals, and Final.
          </p>
        </div>
      </div>
    );
  }

  // Load the user's most recent squad. Prefer the current GW squad if one
  // exists (previous transfer this window), else fall back to last GW.
  const rawSquad = await db.squad.findFirst({
    where: { userId: user.id },
    orderBy: { gameweek: { startsAt: "desc" } },
    include: {
      players: {
        include: { player: { include: { team: true } } },
      },
    },
  });

  if (!rawSquad) {
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
          <p>Pick your 15-player squad before making transfers.</p>
          <Link className="btn btn-primary" href="/squad">
            <Icon name="plus" size={17} />
            Pick Your Team
          </Link>
        </div>
      </div>
    );
  }

  type RawSP = {
    isStarting: boolean;
    player: {
      id: string;
      name: string;
      position: string;
      price: number;
      team: { country: string; eliminated: boolean };
    };
  };

  const squadPlayers: TransferPlayer[] = (rawSquad.players as unknown as RawSP[]).map(
    (sp) => ({
      id: sp.player.id,
      name: sp.player.name,
      position: sp.player.position as Position,
      price: sp.player.price,
      country: sp.player.team.country,
      isStarting: sp.isStarting,
      eliminated: sp.player.team.eliminated,
    }),
  );

  const allPlayers = await db.player.findMany({
    include: { team: true },
    orderBy: [{ price: "desc" }, { name: "asc" }],
  });

  type RawPlayer = {
    id: string;
    name: string;
    position: string;
    price: number;
    team: { country: string; eliminated: boolean };
  };

  const pool: PoolPlayer[] = (allPlayers as unknown as RawPlayer[]).map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position as Position,
    price: p.price,
    country: p.team.country,
    eliminated: p.team.eliminated,
  }));

  return (
    <TransfersClient
      squadPlayers={squadPlayers}
      pool={pool}
      gameweekLabel={gameweek.label}
    />
  );
}
