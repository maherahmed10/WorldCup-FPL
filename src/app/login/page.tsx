// Login / signup page (public). Ported from design/screens_auth.jsx.
// Server component: if already signed in, bounce to /team.
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "./AuthForm";
import { Flag } from "@/components/Flag";

const HERO_TEAMS = ["Brazil", "France", "Argentina", "Spain", "England", "Germany", "Portugal", "Netherlands", "Mexico", "USA", "Morocco", "Japan"];

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/team");

  return (
    <div className="auth">
      {/* ---- hero (desktop) ---- */}
      <div className="auth-hero">
        <div className="auth-hero-content">
          {/* Full TapIn Fantasy badge — login page only. Drop the artwork at
              public/tapin-fantasy.png (square-ish PNG, transparent bg). */}
          <div style={{ marginBottom: 28 }}>
            <Image
              src="/tapin-fantasy.png"
              alt="TapIn Fantasy — World Cup"
              width={260}
              height={260}
              priority
              // Badge has a solid black bg; `screen` drops it so only the logo
              // shows over the dark hero gradient (no visible square seam).
              style={{ objectFit: "contain", width: "auto", height: "clamp(150px, 24vh, 240px)", mixBlendMode: "screen" }}
            />
          </div>
          <h1 className="auth-title">
            Pick your squad.
            <br />
            Predict. <span style={{ color: "var(--accent)" }}>Compete.</span>
          </h1>
          <p className="auth-lede">
            The fantasy game for World Cup 2026. Build a squad of the world&apos;s
            best within budget, captain your stars, stake points on match markets,
            and climb mini-leagues with friends.
          </p>
          <div className="auth-flags">
            {HERO_TEAMS.map((c) => (
              <Flag key={c} country={c} size={22} round />
            ))}
          </div>
          <div className="auth-stats">
            <div>
              <div className="as-num num">48</div>
              <div className="as-lab">Nations</div>
            </div>
            <div>
              <div className="as-num num">104</div>
              <div className="as-lab">Matches</div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- auth card ---- */}
      <div className="auth-panel">
        <AuthForm />
      </div>
    </div>
  );
}
