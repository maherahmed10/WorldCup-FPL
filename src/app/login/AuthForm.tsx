"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";

export function AuthForm() {
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="auth-card">
      <div className="brand auth-card-brand">
        <div className="brand-mark" style={{ background: "transparent", boxShadow: "none" }}>
          <Image src="/TheLogo.png" alt="TapIn" width={34} height={34} style={{ objectFit: "contain", mixBlendMode: "screen" }} />
        </div>
        <div className="brand-name">TapIn</div>
      </div>
      <h2 className="auth-h2">Welcome to TapIn</h2>
      <p className="auth-p">Sign in to pick your World Cup squad.</p>

      <div className="social">
        <button className="social-btn" onClick={handleGoogle} type="button">
          <Icon name="google" size={18} />
          Continue with Google
        </button>
      </div>

      {error && (
        <div className="vmsg err" style={{ marginTop: 14 }}>
          <span className="ic">
            <Icon name="info" size={16} />
          </span>
          {error}
        </div>
      )}

      <p className="auth-legal">
        Virtual points only — no real-money gambling. By continuing you agree to
        the Terms &amp; Legal Disclosure Policy.
      </p>
    </div>
  );
}
