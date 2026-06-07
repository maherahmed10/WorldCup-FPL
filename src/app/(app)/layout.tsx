// Layout for all authed app routes. Checks the Supabase session server-side,
// redirects to /login if signed out, and wraps children in the app shell.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { db } from "@/lib/db";

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
  const appUser = await db.user.upsert({
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
  });

  return (
    <AppShell
      user={{ name: appUser.teamName ?? appUser.name, handle: appUser.email }}
    >
      {children}
    </AppShell>
  );
}
