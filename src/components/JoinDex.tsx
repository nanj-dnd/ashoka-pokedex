"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "./Shell";
import { SfxToggle } from "./Bits";
import { api, sfx } from "@/lib/client";

/**
 * Shown to someone signed in who has not joined this dex. The code decides
 * whether they come in as an admin or a member, so there is only one field.
 */
export function JoinDex({
  slug,
  name,
  tagline,
}: {
  slug: string;
  name: string;
  tagline: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function join() {
    setError("");
    if (!code.trim()) return setError("ENTER THE CODE");
    setBusy(true);
    try {
      await api(`/api/d/${slug}/join`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      sfx.good();
      router.replace(`/d/${slug}`);
      router.refresh();
    } catch (e) {
      sfx.bad();
      setError(String((e as Error).message).toUpperCase());
      setBusy(false);
    }
  }

  return (
    <Shell title={name} subtitle="MEMBERS ONLY" actions={<SfxToggle />}>
      <div style={{ maxWidth: 400, margin: "0 auto", padding: "20px 0 40px" }}>
        {tagline ? (
          <p className="body-text dim center" style={{ marginBottom: 22 }}>{tagline}</p>
        ) : null}

        <div className="stack">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>ACCESS CODE</div>
            <input
              className="code-input"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") join(); }}
              inputMode="numeric"
              placeholder="----"
              aria-label="Access code"
              autoFocus
            />
          </div>

          {error ? <div className="err shake">{error}</div> : null}

          <button className="primary" style={{ width: "100%" }} onClick={join} disabled={busy}>
            {busy ? "…" : "▶ JOIN"}
          </button>

          <button className="ghost" onClick={() => router.push("/me")}>
            BACK TO YOUR DEXES
          </button>
        </div>

        <div className="label center" style={{ marginTop: 26, lineHeight: 2 }}>
          WHOEVER RUNS THIS DEX HAS THE CODE.
        </div>
      </div>
    </Shell>
  );
}
