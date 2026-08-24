"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Capture } from "./Capture";
import { Pips } from "./Bits";
import type { MyNomination } from "@/lib/types";

const STATUS_STYLE: Record<MyNomination["status"], { className: string; text: string }> = {
  pending: { className: "amber", text: "WITH THE ADMINS" },
  approved: { className: "lime", text: "IN THE DEX" },
  rejected: { className: "danger", text: "TURNED DOWN" },
};

/**
 * The trainer side of the queue: nominate someone, then watch what the admins
 * did with it. Vote counts are shown, vote *authors* are not — who blocked
 * your nomination is between the admins.
 */
export function Nominate() {
  const [mine, setMine] = useState<MyNomination[]>([]);
  const [limit, setLimit] = useState(3);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ nominations: MyNomination[]; openLimit: number }>(
        "/api/creatures?scope=mine",
      );
      setMine(res.nominations);
      setLimit(res.openLimit);
      setError("");
    } catch (e) {
      setError(String((e as Error).message).toUpperCase());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const open = mine.filter((n) => n.status === "pending").length;
  const atLimit = open >= limit;

  return (
    <div className="stack">
      {note ? <div className="ok">{note}</div> : null}
      {error ? <div className="err">{error}</div> : null}

      {loading ? (
        <div className="empty"><span className="label blink">LOADING</span></div>
      ) : (
        <Capture
          mode="nominate"
          atLimit={atLimit}
          limitNote={`You have ${open} nominations waiting on the admins. Once one of them is resolved you can send in another.`}
          onSubmitted={() => {
            setNote("NOMINATION SENT — THE ADMINS TAKE IT FROM HERE");
            void load();
          }}
        />
      )}

      {mine.length ? (
        <div className="plate">
          <div className="label" style={{ marginBottom: 12 }}>
            MY NOMINATIONS ({mine.length})
          </div>
          <div className="board">
            {mine.map((n) => {
              const style = STATUS_STYLE[n.status];
              return (
                <div className="board-row" key={n.id} style={{ cursor: "default" }}>
                  <img className="board-sprite" src={n.spriteUrl} alt={n.name} loading="lazy" />
                  <div style={{ minWidth: 0 }}>
                    <div className="board-name">
                      {n.status === "approved" && n.dexNumber
                        ? `No.${String(n.dexNumber).padStart(3, "0")} `
                        : ""}
                      {n.name}
                    </div>
                    <div className={`label ${style.className}`}>{style.text}</div>
                  </div>
                  {n.status === "pending" ? (
                    <span style={{ marginLeft: "auto" }} title={`${n.approvals} of ${n.needed} approvals`}>
                      <Pips have={n.approvals} need={n.needed} />
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
