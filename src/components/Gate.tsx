"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "./Shell";
import { SfxToggle } from "./Bits";
import { api, sfx } from "@/lib/client";

type Mode = "signin" | "signup";

export function Gate() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    sfx.move();
    setMode(next);
    setError("");
    setConfirm("");
  }

  async function submit() {
    setError("");

    if (mode === "signup") {
      if (!code.trim()) return setError("ACCESS CODE REQUIRED");
      if (password !== confirm) return setError("PASSWORDS DO NOT MATCH");
    }

    setBusy(true);
    try {
      const res = await api<{ account: { role: "admin" | "public" } }>("/api/session", {
        method: "POST",
        body: JSON.stringify({ action: mode, code, username, password }),
      });
      sfx.good();
      router.replace(res.account.role === "admin" ? "/admin" : "/dex");
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
    <Shell title="ASHOKA POKEDEX" subtitle="RESTRICTED DEVICE" actions={<SfxToggle />}>
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
          {mode === "signup" ? (
            <div>
              <div className="label" style={{ marginBottom: 6 }}>ACCESS CODE</div>
              <input
                className="code-input"
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
                onKeyDown={onEnter}
                inputMode="numeric"
                placeholder="----"
                aria-label="Access code"
                autoFocus
              />
              <div className="label" style={{ marginTop: 6 }}>
                THE CODE DECIDES IF YOU JOIN AS A TRAINER OR AN ADMIN.
              </div>
            </div>
          ) : null}

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
              autoFocus={mode === "signin"}
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
          {mode === "signin" ? "NO ACCOUNT? YOU NEED A CODE." : "ALREADY REGISTERED? SIGN IN."}
        </div>
      </div>
    </Shell>
  );
}
