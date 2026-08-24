"use client";

import { useCallback, useEffect, useState } from "react";
import { api, sfx } from "@/lib/client";
import type { TrainerStanding } from "@/lib/types";

/**
 * Account management. Roles are read from the account row on every request, so
 * a promotion or demotion takes effect on the target's very next click — they
 * do not have to sign out and back in, and a demoted admin cannot keep using
 * the terminal on the strength of an old cookie.
 */
export function AdminTrainers({
  accountId,
  onNote,
  onError,
}: {
  accountId: string;
  onNote: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [trainers, setTrainers] = useState<TrainerStanding[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ trainers: TrainerStanding[]; totalApproved: number }>(
        "/api/leaderboard",
      );
      setTrainers(res.trainers);
      setTotal(res.totalApproved);
    } catch (e) {
      onError(String((e as Error).message).toUpperCase());
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => { void load(); }, [load]);

  async function setRole(t: TrainerStanding, role: "admin" | "public") {
    const verb = role === "admin" ? "Promote" : "Demote";
    if (!confirm(`${verb} ${t.username}?`)) return;
    setBusyId(t.id);
    try {
      await api(`/api/accounts/${t.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      sfx.good();
      onNote(`${t.username.toUpperCase()} IS NOW ${role === "admin" ? "AN ADMIN" : "A TRAINER"}`);
      await load();
    } catch (e) {
      sfx.bad();
      onError(String((e as Error).message).toUpperCase());
    } finally {
      setBusyId("");
    }
  }

  async function remove(t: TrainerStanding) {
    if (
      !confirm(
        `Delete the account "${t.username}"? Their ${t.seen} sightings go with it, which will move rarity. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(t.id);
    try {
      await api(`/api/accounts/${t.id}`, { method: "DELETE" });
      sfx.move();
      onNote(`${t.username.toUpperCase()} DELETED`);
      await load();
    } catch (e) {
      sfx.bad();
      onError(String((e as Error).message).toUpperCase());
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <div className="empty"><span className="label blink">LOADING TRAINERS</span></div>;

  const admins = trainers.filter((t) => t.role === "admin").length;

  return (
    <div className="stack">
      <div className="label">
        {trainers.length} ACCOUNT{trainers.length === 1 ? "" : "S"} · {admins} ADMIN
        {admins === 1 ? "" : "S"}
      </div>

      {trainers.map((t) => {
        const me = t.id === accountId;
        const pct = total ? Math.round((t.seen / total) * 100) : 0;
        return (
          <div className="plate" key={t.id}>
            <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3>
                {t.username}
                {t.role === "admin" ? <span className="tag admin">ADMIN</span> : null}
                {me ? <span className="tag you">YOU</span> : null}
              </h3>
            </div>

            <div className="label">
              SEEN {t.seen}/{total} ({pct}%) · {t.nominations} SUBMITTED · {t.approved} IN THE DEX
            </div>

            <div className="vote-bar">
              {me ? (
                <span className="label amber">
                  YOUR OWN ACCOUNT — ASK ANOTHER ADMIN
                </span>
              ) : (
                <>
                  {t.role === "public" ? (
                    <button
                      className="go"
                      style={{ fontSize: 8 }}
                      disabled={busyId === t.id}
                      onClick={() => setRole(t, "admin")}
                    >
                      MAKE ADMIN
                    </button>
                  ) : (
                    <button
                      style={{ fontSize: 8 }}
                      disabled={busyId === t.id}
                      onClick={() => setRole(t, "public")}
                    >
                      MAKE TRAINER
                    </button>
                  )}
                  <button
                    className="no"
                    style={{ fontSize: 8, marginLeft: "auto" }}
                    disabled={busyId === t.id}
                    onClick={() => remove(t)}
                  >
                    DELETE ACCOUNT
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
