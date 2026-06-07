"use client";

// One-time "Name your team" modal, shown on the dashboard when the user hasn't
// set a fantasy team name yet (works for Google + email logins alike).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { setTeamName } from "./actions";

export function TeamNamePrompt({ suggestion }: { suggestion: string }) {
  const router = useRouter();
  const [value, setValue] = useState(suggestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await setTeamName(value);
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError(res.error ?? "Could not save.");
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Name your team</h3>
        </div>
        <form onSubmit={submit} style={{ padding: 18 }}>
          <p className="auth-p" style={{ marginTop: 0 }}>
            Pick a name for your World Cup fantasy team. You can change it later.
          </p>
          <label className="fld-label">Team name</label>
          <input
            className="fld"
            placeholder="Gaffer FC"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={30}
            autoFocus
          />
          {error && (
            <div className="vmsg err" style={{ marginTop: 12 }}>
              <span className="ic">
                <Icon name="info" size={16} />
              </span>
              {error}
            </div>
          )}
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 18 }}
            type="submit"
            disabled={busy || value.trim().length < 2}
          >
            {busy ? "Saving…" : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
