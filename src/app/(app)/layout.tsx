// Layout for all authed app routes. Checks the Supabase session server-side,
// redirects to /login if signed out, and wraps children in the app shell.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { WelcomeModal } from "@/components/WelcomeModal";
import { db } from "@/lib/db";
import { getCurrentGameweek, getViewSquad } from "@/lib/squad-data";
import { totalPrice } from "@/lib/squad-rules";
import { ensureKnockoutBudgetMerged, knockoutFunds } from "@/lib/budget-merge";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Ensure a matching app User row exists (created on first authed visit).
  const [appUser, gameweek] = await Promise.all([
    db.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email ?? `${user.id}@unknown.local`,
        name:
          (user.user_metadata?.full_name as string) ??
          (user.user_metadata?.name as string) ??
          user.email?.split("@")[0] ??
          "Manager",
      },
    }),
    getCurrentGameweek(),
  ]);

  // Knockouts: one money pool. Lazily fold any leftover group-stage budget into
  // the bank on first knockout load (idempotent), so the bank reflects every £.
  const isKnockout = gameweek?.isKnockout ?? false;
  if (isKnockout) await ensureKnockoutBudgetMerged(user.id);
  // Re-read the bank if the merge may have changed it.
  const bettingBalance = isKnockout
    ? (await db.user.findUnique({ where: { id: user.id }, select: { bettingBalance: true } }))?.bettingBalance ??
      appUser.bettingBalance
    : appUser.bettingBalance;

  // Carry forward the most recent squad (a user keeps their team across gameweeks).
  const view = gameweek ? await getViewSquad(user.id, gameweek.startsAt) : null;
  const squadSpent = view ? totalPrice(view.squad.players) : 0;
  const funds = knockoutFunds({
    isKnockout,
    bettingBalance,
    squadSpentTenths: squadSpent,
    squadBudgetBonus: appUser.squadBudgetBonus ?? 0,
  });
  const budgetRemaining = funds.squadCapTenths - squadSpent; // tenths of a million
  const budgetTotal = funds.squadCapTenths; // tenths

  return (
    <>
      <AppShell
        user={{ name: appUser.teamName ?? appUser.name, handle: appUser.email }}
        budgetRemaining={budgetRemaining}
        budgetTotal={budgetTotal}
      >
        {children}
      </AppShell>
      {/* First-login onboarding — shows once per account (User.onboardedAt). */}
      <WelcomeModal firstLogin={!appUser.onboardedAt} />
    </>
  );
}
