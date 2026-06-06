import { Placeholder } from "@/components/Placeholder";

// Maps to design: screens_predict.jsx (PredictScreen)
export default function PredictPage() {
  return (
    <Placeholder title="Predictions" owner="Teammate B" designRef="design/screens_predict.jsx">
      Points-only betting: match markets (1X2, O/U, BTTS) + our own player props
      (scorer/assist/card). Stake balance, bet slip, open + settled bets. Writes
      Bet rows; settled by the post-match job.
    </Placeholder>
  );
}
