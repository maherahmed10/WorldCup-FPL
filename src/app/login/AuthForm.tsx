"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";

export function AuthForm() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function handleGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (signup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback`,
            data: { full_name: email.split("@")[0] },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/team");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="brand auth-card-brand">
        <div className="brand-mark" style={{ background: "transparent", boxShadow: "none" }}>
          <Image src="/TheLogo.png" alt="TapIn" width={34} height={34} style={{ objectFit: "contain", mixBlendMode: "screen" }} />
        </div>
        <div className="brand-name">TapIn</div>
      </div>
      <h2 className="auth-h2">{signup ? "Create your account" : "Welcome back"}</h2>
      <p className="auth-p">
        {signup
          ? "Join free and pick your World Cup squad."
          : "Log in to manage your squad."}
      </p>

      <div className="social">
        <button className="social-btn" onClick={handleGoogle} type="button">
          <Icon name="google" size={18} />
          Continue with Google
        </button>
      </div>

      <div className="auth-or">
        <span>or</span>
      </div>

      <form className="fields" onSubmit={handleEmail}>
        <div>
          <label className="fld-label">Email</label>
          <input
            className="fld"
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="fld-label">Password</label>
          <input
            className="fld"
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="vmsg err" style={{ marginTop: 4 }}>
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
          disabled={busy}
        >
          {busy ? "…" : signup ? "Create Account" : "Log In"}
        </button>
      </form>

      <p className="auth-switch">
        {signup ? "Already have an account? " : "New to TapIn? "}
        <button onClick={() => setMode(signup ? "login" : "signup")} type="button">
          {signup ? "Log in" : "Sign up"}
        </button>
      </p>
      <p className="auth-legal">
        Virtual points only — no real-money gambling. By continuing you agree to
        the Terms &amp; Legal Disclosure Policy.
      </p>
    </div>
  );
}
