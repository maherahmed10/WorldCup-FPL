// Maps to design: screens_leagues.jsx (LeaguesScreen)
// Owner: Teammate C (Lane 3)
export const dynamic = "force-dynamic"; // standings change after every settlement run

import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { LeaguesClient, type LeagueData } from "@/components/LeaguesClient";

// Local shape for the nested Prisma query result. Keeps callback params typed
// without depending on Prisma-generated types at the call site.
interface MatchStatRow { fantasyPoints: number | null }
interface SquadPlayerRow {
  playerId: string;
  player: { matchStats: MatchStatRow[] };
}
interface SquadRow {
  captainId: string | null;
  players: SquadPlayerRow[];
}
interface MemberUserRow { name: string; squads: SquadRow[] }
interface MemberRow { userId: string; user: MemberUserRow }
interface LeagueRow {
  id: string;
  name: string;
  joinCode: string;
  ownerId: string;
  members: MemberRow[];
}

function computePoints(squads: SquadRow[], gwOnly = false): number {
  const target = gwOnly ? squads.slice(-1) : squads;
  return target.reduce((total: number, squad: SquadRow) => {
    return (
      total +
      squad.players.reduce((sum: number, sp: SquadPlayerRow) => {
        const allStats = gwOnly
          ? sp.player.matchStats.slice(-1)
          : sp.player.matchStats;
        const pts = allStats.reduce(
          (s: number, stat: MatchStatRow) => s + (stat.fantasyPoints ?? 0),
          0,
        );
        return sum + (sp.playerId === squad.captainId ? pts * 2 : pts);
      }, 0)
    );
  }, 0);
}

export default async function LeaguesPage() {
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // Supabase env not configured — render unauthenticated.
  }

  let leagues: LeagueData[] = [];
  if (userId) {
    try {
      const raw = await db.league.findMany({
        where: { members: { some: { userId } } },
        orderBy: { createdAt: "asc" },
        include: {
          members: {
            include: {
              user: {
                include: {
                  squads: {
                    include: {
                      players: {
                        where: { isStarting: true },
                        include: {
                          player: {
                            include: {
                              matchStats: { select: { fantasyPoints: true } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Cast to local types — shape matches the include above.
      const rows = raw as unknown as LeagueRow[];

      leagues = rows.map((league: LeagueRow) => ({
        id: league.id,
        name: league.name,
        joinCode: league.joinCode,
        memberCount: league.members.length,
        isOwner: league.ownerId === userId,
        members: league.members.map((m: MemberRow) => ({
          userId: m.userId,
          name: m.user.name,
          totalPoints: computePoints(m.user.squads),
          gwPoints: computePoints(m.user.squads, true),
        })),
      }));
    } catch {
      // DB not reachable — render empty state.
    }
  }

  return <LeaguesClient leagues={leagues} userId={userId} />;
}
