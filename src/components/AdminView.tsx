"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BASE_RARITY, RARITY_STYLE, batchLabel } from "@/lib/constants";
import { api, sfx } from "@/lib/client";
import { Shell } from "./Shell";
import { Pips, RarityBadge, SfxToggle, TypeChip } from "./Bits";
import { Capture } from "./Capture";
import type { Creature } from "@/lib/types";

type Tab = "capture" | "queue";

export function AdminView({ handle, needed }: { handle: string; needed: number }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("capture");
  const [queue, setQueue] = useState<Creature[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ creatures: Creature[] }>("/api/creatures?scope=pending");
      setQueue(res.creatures);
      setError("");
    } catch (e) {
      setError(String((e as Error).message).toUpperCase());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function vote(c: Creature, v: "approve" | "reject") {
    try {
      const res = await api<{ resolved?: string }>(`/api/creatures/${c.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ vote: v }),
      });
      if (res.resolved === "approved") {
        sfx.good();
        setNote(`${c.name.toUpperCase()} ADDED TO THE PUBLIC DEX`);
      } else if (res.resolved === "rejected") {
        sfx.bad();
        setNote(`${c.name.toUpperCase()} REJECTED`);
      } else {
        sfx.select();
        setNote(`VOTE RECORDED — ${c.name.toUpperCase()} STILL NEEDS MORE`);
      }
      await load();
    } catch (e) {
      sfx.bad();
      setError(String((e as Error).message).toUpperCase());
    }
  }

  async function remove(c: Creature) {
    if (!confirm(`Delete "${c.name}" permanently? This cannot be undone.`)) return;
    try {
      await api(`/api/creatures/${c.id}/vote`, { method: "DELETE" });
      sfx.move();
      setNote(`${c.name.toUpperCase()} DELETED`);
      await load();
    } catch (e) {
      setError(String((e as Error).message).toUpperCase());
    }
  }

  async function logout() {
    await api("/api/session", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  return (
    <Shell
      title="ADMIN TERMINAL"
      subtitle={`SIGNED IN AS ${handle}`}
      actions={
        <>
          <SfxToggle />
          <button style={{ fontSize: 8, padding: "8px 10px" }} onClick={() => router.push("/dex")}>
            VIEW DEX
          </button>
          <button className="ghost" style={{ fontSize: 8, padding: "8px 10px" }} onClick={logout}>
            EXIT
          </button>
        </>
      }
    >
      <div className="tabs">
        <span className={`tab${tab === "capture" ? " on" : ""}`} onClick={() => { sfx.move(); setTab("capture"); }}>
          ◉ NEW CATCH
        </span>
        <span className={`tab${tab === "queue" ? " on" : ""}`} onClick={() => { sfx.move(); setTab("queue"); void load(); }}>
          APPROVAL QUEUE {queue.length ? `(${queue.length})` : ""}
        </span>
      </div>

      {note ? <div className="ok" style={{ marginBottom: 12 }}>{note}</div> : null}
      {error ? <div className="err" style={{ marginBottom: 12 }}>{error}</div> : null}

      {tab === "capture" ? (
        <Capture
          onSubmitted={() => {
            setNote(`SUBMITTED — NEEDS ${needed} OTHER ADMIN${needed === 1 ? "" : "S"} TO APPROVE`);
            void load();
          }}
        />
      ) : loading ? (
        <div className="empty"><span className="label blink">LOADING QUEUE</span></div>
      ) : !queue.length ? (
        <div className="empty stack">
          <div className="label">QUEUE CLEAR</div>
          <div className="body-text dim">Nothing is waiting for approval.</div>
        </div>
      ) : (
        <div>
          {queue.map((c) => {
            const approvals = c.votes.filter((v) => v.vote === "approve").length;
            const rejections = c.votes.filter((v) => v.vote === "reject").length;
            const mine = c.votes.find((v) => v.handle === handle);
            const own = c.submittedBy === handle;
            // Pending entries have no sightings yet, so everyone sits at base rarity.
            const ink = RARITY_STYLE[BASE_RARITY].ink;

            return (
              <div className="plate" key={c.id}>
                <div className="queue-item">
                  <img className="slot-sprite" src={c.spriteUrl} alt={c.name} />
                  <div>
                    <h3 style={{ color: ink }}>{c.name}</h3>
                    {c.title ? <div className="body-text dim">{c.title}</div> : null}

                    <div className="chip-row" style={{ margin: "10px 0" }}>
                      <RarityBadge rarity={BASE_RARITY} />
                      {c.types.map((t) => <TypeChip key={t} type={t} />)}
                    </div>

                    <div className="label">
                      BY {c.submittedBy || "UNKNOWN"} · {c.habitat || "NO HABITAT"}
                      {c.batch ? ` · ${batchLabel(c.batch)}` : ""}
                    </div>

                    {c.characteristics.length ? (
                      <div className="chip-row" style={{ marginTop: 10 }}>
                        {c.characteristics.map((t) => (
                          <span key={t} className="chip outline" style={{ ["--chip-color" as string]: ink }}>{t}</span>
                        ))}
                      </div>
                    ) : null}

                    {c.entry ? <p className="body-text" style={{ marginTop: 10 }}>{c.entry}</p> : null}
                  </div>
                </div>

                <div className="vote-bar">
                  <Pips have={approvals} need={needed} />
                  <span className="label">
                    {approvals}/{needed} APPROVED
                    {rejections ? ` · ${rejections} AGAINST` : ""}
                  </span>

                  <div style={{ marginLeft: "auto" }} className="row">
                    {own ? (
                      <span className="label amber">YOUR CATCH — AWAITING OTHERS</span>
                    ) : (
                      <>
                        <button
                          className="go"
                          style={{ fontSize: 8 }}
                          onClick={() => vote(c, "approve")}
                          disabled={mine?.vote === "approve"}
                        >
                          {mine?.vote === "approve" ? "✓ APPROVED" : "APPROVE"}
                        </button>
                        <button
                          className="no"
                          style={{ fontSize: 8 }}
                          onClick={() => vote(c, "reject")}
                          disabled={mine?.vote === "reject"}
                        >
                          {mine?.vote === "reject" ? "✗ REJECTED" : "REJECT"}
                        </button>
                      </>
                    )}
                    <button className="ghost" style={{ fontSize: 8 }} onClick={() => remove(c)}>
                      DELETE
                    </button>
                  </div>
                </div>

                {c.votes.length ? (
                  <div className="label" style={{ marginTop: 10 }}>
                    VOTES — {c.votes.map((v) => `${v.handle}:${v.vote === "approve" ? "YES" : "NO"}`).join("  ")}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
