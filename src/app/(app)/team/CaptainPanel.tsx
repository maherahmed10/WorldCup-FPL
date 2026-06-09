"use client";

// Dashboard captain/vice panel — set them for the UPCOMING gameweek (FPL: change
// every week). Editable until the gameweek deadline (first kickoff). Captain
// scores ×2; vice takes over the ×2 if the captain plays 0 minutes.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Flag } from "@/components/Flag";
import { setGameweekCaptain } from "./actions";

interface Starter {
  id: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  country: string;
}
const lastName = (n: string) => n.split(" ").slice(-1)[0];

export function CaptainPanel({
  gameweekId,
  gameweekLabel,
  starters,
  captainId,
  viceId,
  deadlinePassed,
}: {
  gameweekId: string;
  gameweekLabel: string;
  starters: Starter[];
  captainId: string | null;
  viceId: string | null;
  deadlinePassed: boolean;
}) {
  const router = useRouter();
  const [cap, setCap] = useState<string | null>(captainId);
  const [vice, setVice] = useState<string | null>(viceId);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty = cap !== captainId || vice !== viceId;
  const valid = !!cap && !!vice && cap !== vice;

  async function save() {
    if (!valid || !cap || !vice) return;
    setSaving(true);
    setMsg(null);
    const res = await setGameweekCaptain(gameweekId, cap, vice);
    setSaving(false);
    if (res.ok) {
      router.refresh();
      setMsg("Saved");
    } else {
      setMsg(res.error ?? "Could not save.");
    }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="sum-title" style={{ marginBottom: 4 }}>Captain · {gameweekLabel}</div>
      {deadlinePassed ? (
        <p className="sum-hint" style={{ marginTop: 4 }}>
          The deadline for this gameweek has passed — captaincy is locked.
        </p>
      ) : (
        <p className="sum-hint" style={{ marginTop: 4 }}>
          Pick a captain (×2) and a vice. Change them before the deadline; the vice
          scores ×2 if your captain doesn&apos;t play.
        </p>
      )}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <Picker
          label="Captain (×2)"
          starters={starters}
          selected={cap}
          disabledId={vice}
          onSelect={setCap}
          locked={deadlinePassed}
        />
        <Picker
          label="Vice-captain"
          starters={starters}
          selected={vice}
          disabledId={cap}
          onSelect={setVice}
          locked={deadlinePassed}
        />
      </div>

      {!deadlinePassed && (
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 14 }}
          disabled={!valid || !dirty || saving}
          onClick={save}
        >
          {saving ? "Saving…" : dirty ? "Save captain & vice" : "Saved"}
        </button>
      )}
      {msg && msg !== "Saved" && (
        <div className="vmsg err" style={{ marginTop: 10 }}>
          <span className="ic"><Icon name="info" size={16} /></span>
          {msg}
        </div>
      )}
    </div>
  );
}

function Picker({
  label,
  starters,
  selected,
  disabledId,
  onSelect,
  locked,
}: {
  label: string;
  starters: Starter[];
  selected: string | null;
  disabledId: string | null;
  onSelect: (id: string) => void;
  locked: boolean;
}) {
  return (
    <div>
      <div className="bench-label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="quota">
        {starters.map((p) => {
          const isSel = selected === p.id;
          const isOther = disabledId === p.id;
          return (
            <button
              key={p.id}
              className={"quota-item" + (isSel ? " full" : "")}
              disabled={locked || isOther}
              style={isOther ? { opacity: 0.35 } : undefined}
              onClick={() => !locked && !isOther && onSelect(p.id)}
              title={isOther ? "Already the other role" : p.name}
            >
              <Flag country={p.country} size={15} round />
              <span className="qn">{lastName(p.name)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
