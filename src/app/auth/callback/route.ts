// OAuth / email-confirmation callback. Supabase redirects here with a `code`
// we exchange for a session, then bounce to the app.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/team";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Something went wrong — back to login with a flag.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
