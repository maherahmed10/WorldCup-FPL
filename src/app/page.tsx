// Root — bounce into the app. The (app) layout handles the auth gate
// (redirects to /login if signed out).
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/team");
}
