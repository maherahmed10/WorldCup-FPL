"use client";

import { useRouter } from "next/navigation";
import { REPLAY_TOUR_KEY } from "@/components/OnboardingTour";

const ONBOARD_KEY = "gaffer_onboarded";

export default function SettingsPage() {
  const router = useRouter();

  function replayTour() {
    try {
      localStorage.setItem(REPLAY_TOUR_KEY, "1");
      localStorage.removeItem(ONBOARD_KEY);
    } catch {}
    router.push("/home");
  }

  async function logout() {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>Settings</h1>
      </div>

      <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        <div style={cardStyle}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>App Tour</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
              Replay the guided walkthrough of all features
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={replayTour}>
            Replay Tour
          </button>
        </div>

        <div style={cardStyle}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Account</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
              Sign out of GAFFER on this device
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={logout}
            style={{ color: "var(--live)", borderColor: "rgba(255,77,94,0.25)" }}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-md)",
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};
