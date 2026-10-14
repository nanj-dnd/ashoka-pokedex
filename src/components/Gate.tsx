"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "./Shell";
import { SfxToggle } from "./Bits";
import { api, sfx } from "@/lib/client";

type Mode = "signin" | "signup";

/**
 * Global sign-in. An account is not tied to any dex — it is just who you are.
 * Getting into a particular dex happens afterwards, with that dex's code.
 */
export function Gate({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(m: Mode) {
    sfx.move();
    setMode(m);
    setError("");
    setConfirm("");
  }

  async function submit() {
    setError("");
    if (mode === "signup" && password !== confirm) {
      return setError("PASSWORDS DO NOT MATCH");
    }

    setBusy(true);
    try {
      await api("/api/session", {
        method: "POST",
        body: JSON.stringify({ action: mode, username, password }),
      });
      sfx.good();
      router.replace(next || "/me");
      router.refresh();
    } catch (e) {
      sfx.bad();
      setError(String((e as Error).message).toUpperCase());
      setBusy(false);
    }
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  return (
    <Shell title="DEX" subtitle="FIELD GUIDES FOR ANYTHING" actions={<SfxToggle />}>
      <div style={{ maxWidth: 400, margin: "0 auto", padding: "20px 0 40px" }}>
        <div className="tabs" style={{ justifyContent: "center" }}>
          <span className={`tab${mode === "signin" ? " on" : ""}`} onClick={() => switchMode("signin")}>
            SIGN IN
          </span>
          <span className={`tab${mode === "signup" ? " on" : ""}`} onClick={() => switchMode("signup")}>
            CREATE ACCOUNT
          </span>
        </div>

        <div className="stack">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>USERNAME</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={onEnter}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              placeholder="anshul"
              autoFocus
            />
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>PASSWORD</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onEnter}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="••••••••"
            />
            {mode === "signup" ? (
              <div className="label" style={{ marginTop: 6 }}>AT LEAST 8 CHARACTERS.</div>
            ) : null}
          </div>

          {mode === "signup" ? (
            <div>
              <div className="label" style={{ marginBottom: 6 }}>CONFIRM PASSWORD</div>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={onEnter}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </div>
          ) : null}

          {error ? <div className="err shake">{error}</div> : null}

          <button className="primary" style={{ width: "100%" }} onClick={submit} disabled={busy}>
            {busy ? "…" : mode === "signin" ? "▶ SIGN IN" : "▶ CREATE ACCOUNT"}
          </button>
        </div>

        <div className="label center" style={{ marginTop: 26, lineHeight: 2 }}>
          {mode === "signin"
            ? "NEW HERE? MAKE AN ACCOUNT, THEN A DEX."
            : "NO CODE NEEDED — A CODE GETS YOU INTO SOMEONE ELSE'S DEX."}
        </div>
      </div>
    </Shell>
  );
}
