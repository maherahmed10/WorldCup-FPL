// Home screen (design handoff: home/app.jsx). Lives inside the app shell:
// a compact athletic hero band + the "How to play" click-through guide.
// Reached from the "Home" nav item and by clicking the GAFFER brand.
import Image from "next/image";
import { Flag } from "@/components/Flag";
import { HowToPlayDeck } from "@/components/HowToPlayDeck";

const HERO_TEAMS = [
  "Brazil", "France", "Argentina", "Spain", "England", "Germany", "Portugal",
  "Netherlands", "Mexico", "USA", "Morocco", "Japan", "Croatia", "Senegal",
];

export default function HomePage() {
  return (
    <div className="screen">
      <section className="home-hero">
        <div className="hh-brand">
          <div className="brand-mark" style={{ background: "transparent", boxShadow: "none" }}>
            <Image src="/TheLogo.png" alt="TapIn" width={34} height={34} style={{ objectFit: "contain", mixBlendMode: "screen" }} />
          </div>
          <div className="brand-name">TapIn</div>
        </div>
        <div className="hh-kicker">
          <span className="live-dot" style={{ background: "var(--accent)" }} /> World Cup 2026
        </div>
        <h1 className="hh-headline">
          Pick your squad.
          <br />
          Predict. <span className="g">Compete.</span>
        </h1>
        <p className="hh-lede">
          Your home base for the World Cup fantasy game — build a squad of the
          world&apos;s best, captain your stars, stake points on match markets and
          climb mini-leagues with friends.
        </p>
        <div className="hh-flags">
          {HERO_TEAMS.map((c) => (
            <Flag key={c} country={c} size={22} round />
          ))}
        </div>
        <div className="hh-stats">
          <div className="hh-stat">
            <span className="n">48</span>
            <span className="l">Nations</span>
          </div>
          <div className="hh-stat">
            <span className="n">104</span>
            <span className="l">Matches</span>
          </div>
        </div>
      </section>

      <div style={{ marginTop: 22 }}>
        <HowToPlayDeck finalCta={{ label: "Enter the game", href: "/team" }} />
      </div>
    </div>
  );
}
