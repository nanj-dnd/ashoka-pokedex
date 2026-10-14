"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "./Shell";
import { SfxToggle } from "./Bits";
import { api, sfx } from "@/lib/client";
import type { DexSummary } from "@/lib/types";

const ROLE_COLOR: Record<string, string> = {
  owner: "#ffcb05",
  admin: "#35d6e6",
  member: "#8b9bb4",
};

export function MyDexes({ username }: { username: string }) {
  const router = useRouter();
  const [dexes, setDexes] = useState<DexSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joinSlug, setJoinSlug] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ dexes: DexSummary[] }>("/api/dexes");
      setDexes(res.dexes);
    } catch (e) {
      setError(String((e as Error).message).toUpperCase());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOut() {
    await api("/api/session", { method: "DELETE" }).catch(() => {});
    router.replace("/");
    router.refresh();
  }

  function openJoin() {
    const slug = joinSlug.trim().toLowerCase().replace(/^.*\//, "");
    if (!slug) return;
    sfx.select();
    router.push(`/d/${slug}`);
  }

  return (
    <Shell
      title="YOUR DEXES"
      subtitle={username.toUpperCase()}
      actions={
        <>
          <SfxToggle />
          <button className="ghost" style={{ fontSize: 8, padding: "8px 10px" }} onClick={signOut}>
            SIGN OUT
          </button>
        </>
      }
    >
      <div className="stack">
        <button className="primary" onClick={() => { sfx.select(); router.push("/new"); }}>
          + MAKE A DEX
        </button>

        {error ? <div className="err">{error}</div> : null}

        {loading ? (
          <div className="label blink center" style={{ padding: 30 }}>LOADING…</div>
        ) : dexes.length ? (
          <div className="stack">
            {/* Not .queue-item: that is a grid sized for [sprite][content], so
                a row without a sprite lands the name in the 88px column. */}
            {dexes.map((d) => (
              <div
                key={d.slug}
                className="plate"
                role="button"
                tabIndex={0}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }}
                onClick={() => { sfx.select(); router.push(`/d/${d.slug}`); }}
                onKeyDown={(e) => { if (e.key === "Enter") router.push(`/d/${d.slug}`); }}
              >
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <h2>{d.name}</h2>
                  {d.tagline ? (
                    <div className="body-text dim" style={{ marginTop: 4 }}>{d.tagline}</div>
                  ) : null}
                  <div className="label" style={{ marginTop: 8 }}>
                    /d/{d.slug} · {d.entries} {d.entries === 1 ? "ENTRY" : "ENTRIES"} ·{" "}
                    {d.members} {d.members === 1 ? "MEMBER" : "MEMBERS"}
                  </div>
                </div>
                {/* .queue-item is a flex row, so the chip has to be told not
                    to grow — otherwise it eats the width and squashes the name. */}
                <span
                  className="chip"
                  style={{
                    ["--chip-color" as string]: ROLE_COLOR[d.role],
                    flex: "0 0 auto",
                    alignSelf: "flex-start",
                  }}
                >
                  {d.role.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="plate center" style={{ padding: 28 }}>
            <div className="label">NO DEXES YET</div>
            <p className="body-text dim" style={{ marginTop: 10 }}>
              Make one, or enter the link someone shared with you.
            </p>
          </div>
        )}

        <div className="plate stack">
          <div className="label">JOIN SOMEONE ELSE&apos;S DEX</div>
          <div className="row">
            <input
              value={joinSlug}
              onChange={(e) => setJoinSlug(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") openJoin(); }}
              placeholder="their-dex-link"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button style={{ flex: "0 0 auto" }} onClick={openJoin} disabled={!joinSlug.trim()}>
              GO
            </button>
          </div>
          <div className="label">YOU WILL NEED THEIR CODE ON THE NEXT SCREEN.</div>
        </div>
      </div>
    </Shell>
  );
}
