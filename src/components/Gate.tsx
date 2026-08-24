"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "./Shell";
import { SfxToggle } from "./Bits";
import { api, sfx } from "@/lib/client";

export function Gate() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [handle, setHandle] = useState("");
  const [needsHandle, setNeedsHandle] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await api<{ role: "admin" | "public" }>("/api/session", {
        method: "POST",
        body: JSON.stringify({ code, handle }),
      });
      sfx.good();
      router.replace(res.role === "admin" ? "/admin" : "/dex");
      router.refresh();
    } catch (e) {
      const msg = String((e as Error).message).toUpperCase();
      sfx.bad();
      // The API tells us a valid admin code still needs a handle.
      if (msg.includes("HANDLE")) {
        setNeedsHandle(true);
        setError("ADMIN DETECTED — ENTER YOUR HANDLE");
      } else {
        setError(msg);
        setCode("");
      }
      setBusy(false);
    }
  }

  return (
    <Shell title="ASHOKA POKEDEX" subtitle="RESTRICTED DEVICE" actions={<SfxToggle />}>
      <div style={{ maxWidth: 380, margin: "0 auto", padding: "28px 0 40px" }}>
        <div className="center stack" style={{ marginBottom: 26 }}>
          <h2 className="amber">ENTER ACCESS CODE</h2>
          <div className="body-text dim">
            A field guide to the creatures of Ashoka University.
          </div>
        </div>

        <div className="stack">
          <input
            className="code-input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 8));
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            inputMode="numeric"
            autoFocus
            placeholder="----"
            aria-label="Access code"
          />

          {needsHandle ? (
            <div>
              <div className="label" style={{ marginBottom: 6 }}>YOUR ADMIN HANDLE</div>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="ANSHUL"
                maxLength={20}
                autoFocus
              />
              <div className="label" style={{ marginTop: 6 }}>
                THIS IS HOW YOUR APPROVALS ARE SIGNED.
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="err shake" style={needsHandle ? { color: "var(--amber)" } : undefined}>
              {error}
            </div>
          ) : null}

          <button className="primary" style={{ width: "100%" }} onClick={submit} disabled={busy || !code}>
            {busy ? "CHECKING…" : "▶ ENTER"}
          </button>
        </div>

        <div className="label center" style={{ marginTop: 30, lineHeight: 2 }}>
          NO CODE? ASK AN ADMIN.
        </div>
      </div>
    </Shell>
  );
}
