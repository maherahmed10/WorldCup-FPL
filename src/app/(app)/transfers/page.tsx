// Transfers now live in the squad editor (My Team → Edit Your Team): in
// knockout rounds you sell/buy players right on the pitch, paid for from your
// betting bank. This route stays only so old links keep working.
import { redirect } from "next/navigation";

export default function TransfersPage() {
  redirect("/squad");
}
