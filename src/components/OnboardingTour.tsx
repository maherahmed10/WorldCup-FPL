"use client";

// Polished first-login tour using Driver.js (v1.x).
// Spotlights real nav elements, runs once per account (User.onboardedAt),
// and can be replayed by setting localStorage REPLAY_KEY from the settings page.
import "driver.js/dist/driver.css";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setOnboarded } from "@/app/(app)/home/actions";

const ONBOARD_KEY = "gaffer_onboarded";
export const REPLAY_TOUR_KEY = "gaffer_replay_tour";

export function OnboardingTour({ firstLogin }: { firstLogin: boolean }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;

    let seen = false;
    let replay = false;
    try {
      seen = localStorage.getItem(ONBOARD_KEY) === "1";
      replay = localStorage.getItem(REPLAY_TOUR_KEY) === "1";
      if (replay) localStorage.removeItem(REPLAY_TOUR_KEY);
    } catch {}

    if (!replay && (!firstLogin || seen)) return;

    started.current = true;
    // Let the page fully paint before the spotlight appears
    const t = setTimeout(() => launchTour({ push: (p) => router.push(p) }), 700);
    return () => clearTimeout(t);
  }, [firstLogin, router]);

  return null;
}

async function launchTour(nav: { push: (path: string) => void }) {
  const { driver } = await import("driver.js");

  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  const prefix = isDesktop ? "tour-nav" : "tour-tab";

  let completedFully = false;

  const driverObj = driver({
    animate: true,
    smoothScroll: false,
    allowClose: true,
    overlayColor: "rgba(4,6,11,0.80)",
    stagePadding: 8,
    stageRadius: 12,
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next →",
    prevBtnText: "← Back",
    doneBtnText: "Pick my squad →",

    steps: [
      {
        popover: {
          title: "Welcome to GAFFER ⚽",
          description:
            "World Cup fantasy meets a virtual betting bank. This quick tour covers all the essentials.",
        },
      },
      {
        element: `#${prefix}-team`,
        popover: {
          title: "Your Squad",
          description:
            "Pick 15 players within a £100M budget. Set your starting XI and crown a captain — your captain earns double points.",
          side: isDesktop ? "right" : "top",
          align: "start",
        },
      },
      {
        element: `#${prefix}-players`,
        popover: {
          title: "Player Market",
          description:
            "Browse every World Cup player. Filter by position, nation, or form to find the sharpest picks.",
          side: isDesktop ? "right" : "top",
          align: "start",
        },
      },
      {
        element: `#${prefix}-predict`,
        popover: {
          title: "Bet on Matches",
          description:
            "Stake from your virtual £5M bank on match outcomes — result, goals, scorers, cards. Challenge rivals to head-to-head duels.",
          side: isDesktop ? "right" : "top",
          align: "start",
        },
      },
      {
        element: `#${prefix}-leagues`,
        popover: {
          title: "Leagues",
          description:
            "Create a private league, share a join code, and battle friends all tournament long.",
          side: isDesktop ? "right" : "top",
          align: "start",
        },
      },
      {
        element: `#${prefix}-nations`,
        popover: {
          title: "Nations",
          description:
            "Pick the country you support. Your fanbase's combined bankroll competes against every other nation.",
          side: isDesktop ? "right" : "top",
          align: "start",
        },
      },
      ...(isDesktop
        ? [
            {
              element: "#tour-budget",
              popover: {
                title: "Squad Budget",
                description:
                  "You have £100M to sign 15 players. Every signing chips away at it — balance star quality with value.",
                side: "top" as const,
                align: "center" as const,
              },
            },
          ]
        : [
            {
              element: "#tour-budget-mobile",
              popover: {
                title: "Squad Budget",
                description:
                  "Your remaining squad budget — tap My Team to start building your 15.",
                side: "bottom" as const,
                align: "end" as const,
              },
            },
          ]),
      {
        popover: {
          title: "You're all set! 🎉",
          description:
            "Start by drafting your squad. Good luck out there — may your captain score a hat-trick.",
        },
      },
    ],

    onDestroyStarted: (_el, _step, { driver: d }) => {
      completedFully = d.isLastStep();
      d.destroy();
    },

    onDestroyed: () => {
      try {
        localStorage.setItem(ONBOARD_KEY, "1");
      } catch {}
      setOnboarded();
      if (completedFully) nav.push("/squad");
    },
  });

  driverObj.drive();
}
