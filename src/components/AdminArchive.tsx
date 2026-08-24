"use client";

import { useMemo, useState } from "react";
import { batchLabel } from "@/lib/constants";
import { sfx } from "@/lib/client";
import type { Creature, CreatureStatus } from "@/lib/types";

const STATUS_INK: Record<CreatureStatus, string> = {
  approved: "var(--lime)",
  pending: "var(--amber)",
  rejected: "var(--danger)",
};

/**
 * Every entry the dex has ever held, whatever its status. This is where an
 * admin fixes a live entry, pulls one back off the wall, or brings a rejected
 * one back for a second look.
 */
export function AdminArchive({
  creatures,
  onEdit,
  onStatus,
  onDelete,
}: {
  creatures: Creature[];
  onEdit: (c: Creature) => void;
  onStatus: (c: Creature, status: CreatureStatus) => void;
  onDelete: (c: Creature) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | CreatureStatus>("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return creatures.filter((c) => {
      if (status && c.status !== status) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.title.toLowerCase().includes(needle) ||
        c.submittedBy.toLowerCase().includes(needle)
      );
    });
  }, [creatures, q, status]);

  const counts = useMemo(
    () => ({
      approved: creatures.filter((c) => c.status === "approved").length,
      pending: creatures.filter((c) => c.status === "pending").length,
      rejected: creatures.filter((c) => c.status === "rejected").length,
    }),
    [creatures],
  );

  return (
    <div className="stack">
      <div className="toolbar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="SEARCH NAME OR SUBMITTER…"
          aria-label="Search entries"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | CreatureStatus)}
          aria-label="Filter by status"
        >
          <option value="">ALL ({creatures.length})</option>
          <option value="approved">IN THE DEX ({counts.approved})</option>
          <option value="pending">PENDING ({counts.pending})</option>
          <option value="rejected">REJECTED ({counts.rejected})</option>
        </select>
      </div>

      {!shown.length ? (
        <div className="empty"><span className="label">NOTHING HERE</span></div>
      ) : (
        shown.map((c) => (
          <div className="plate" key={c.id}>
            <div className="queue-item" style={{ marginBottom: 10 }}>
              <img className="slot-sprite" src={c.spriteUrl} alt={c.name} loading="lazy" />
              <div style={{ minWidth: 0 }}>
                <h3>
                  {c.dexNumber ? `No.${String(c.dexNumber).padStart(3, "0")} ` : ""}
                  {c.name}
                </h3>
                {c.title ? <div className="body-text dim">{c.title}</div> : null}
                <div className="label" style={{ marginTop: 8, color: STATUS_INK[c.status] }}>
                  {c.status === "approved" ? "IN THE DEX" : c.status === "pending" ? "PENDING" : "REJECTED"}
                </div>
                <div className="label" style={{ marginTop: 6 }}>
                  BY {c.submittedBy || "UNKNOWN"}
                  {c.submittedByRole === "public" ? " (TRAINER)" : ""}
                  {c.habitat ? ` · ${c.habitat}` : ""}
                  {c.batch ? ` · ${batchLabel(c.batch)}` : ""}
                  {c.updatedAt ? " · EDITED" : ""}
                </div>
              </div>
            </div>

            <div className="vote-bar">
              <button style={{ fontSize: 8 }} onClick={() => { sfx.select(); onEdit(c); }}>
                EDIT
              </button>
              {c.status !== "approved" ? (
                <button className="go" style={{ fontSize: 8 }} onClick={() => onStatus(c, "approved")}>
                  PUT IN THE DEX
                </button>
              ) : null}
              {c.status !== "pending" ? (
                <button style={{ fontSize: 8 }} onClick={() => onStatus(c, "pending")}>
                  BACK TO QUEUE
                </button>
              ) : null}
              {c.status !== "rejected" ? (
                <button className="no" style={{ fontSize: 8 }} onClick={() => onStatus(c, "rejected")}>
                  TAKE IT DOWN
                </button>
              ) : null}
              <button
                className="ghost"
                style={{ fontSize: 8, marginLeft: "auto" }}
                onClick={() => onDelete(c)}
              >
                DELETE
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
