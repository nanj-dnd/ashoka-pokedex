"use client";

import { useEffect, useState } from "react";
import { api, sfx } from "@/lib/client";

interface Settings {
  email: string;
  alerts: boolean;
  /** Whether the deployment actually has a mail provider configured. */
  configured: boolean;
}

/**
 * Per-account email alerts. Opt-in: with no address on file nothing is ever
 * sent, and the switch is meaningless until one is given.
 */
export function AlertSettings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<Settings>("/api/alerts");
        setSettings(res);
        setEmail(res.email);
      } catch (e) {
        setError(String((e as Error).message).toUpperCase());
      }
    })();
  }, []);

  async function save(patch: { email?: string; alerts?: boolean }) {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ email: string; alerts: boolean }>("/api/alerts", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setSettings((cur) => (cur ? { ...cur, ...res } : cur));
      setEmail(res.email);
      sfx.good();
      setNote(
        patch.alerts === false
          ? "ALERTS OFF"
          : res.email
            ? "SAVED — YOU'LL HEAR FROM THE DEX"
            : "EMAIL REMOVED",
      );
    } catch (e) {
      sfx.bad();
      setError(String((e as Error).message).toUpperCase());
    } finally {
      setBusy(false);
    }
  }

  const on = Boolean(settings?.alerts && settings.email);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <h2 style={{ color: "var(--cyan)" }}>DEX ALERTS</h2>
          <button className="ghost" onClick={onClose}>CLOSE X</button>
        </div>

        {!settings ? (
          <div className="empty"><span className="label blink">LOADING</span></div>
        ) : (
          <div className="stack">
            <div className="plate">
              <div className="body-text dim">
                Get an email when someone new is added to the dex, and when
                someone already in it evolves to a higher rarity. Nothing else,
                and nothing at all until you put an address in.
              </div>
            </div>

            {!settings.configured ? (
              <div className="plate">
                <div className="label amber">MAIL IS NOT SET UP ON THIS DEPLOYMENT</div>
                <div className="body-text dim" style={{ marginTop: 6 }}>
                  You can save an address, but nothing will be sent until the
                  site has a mail provider configured.
                </div>
              </div>
            ) : null}

            <div className="plate stack">
              <div>
                <div className="label" style={{ marginBottom: 6 }}>EMAIL</div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void save({ email }); }}
                  placeholder="you@ashoka.edu.in"
                  autoComplete="email"
                  maxLength={200}
                />
              </div>

              <div className="row">
                <button
                  className="primary"
                  onClick={() => save({ email, alerts: true })}
                  disabled={busy || email.trim() === settings.email}
                >
                  {busy ? "SAVING…" : settings.email ? "UPDATE" : "TURN ALERTS ON"}
                </button>
                {settings.email ? (
                  <button
                    style={{ flex: "0 0 auto" }}
                    onClick={() => save({ alerts: !settings.alerts })}
                    disabled={busy}
                  >
                    {settings.alerts ? "PAUSE" : "RESUME"}
                  </button>
                ) : null}
                {settings.email ? (
                  <button
                    className="ghost"
                    style={{ flex: "0 0 auto" }}
                    onClick={() => save({ email: "", alerts: false })}
                    disabled={busy}
                  >
                    REMOVE
                  </button>
                ) : null}
              </div>

              <div className={`label ${on ? "lime" : "dim"}`}>
                {on
                  ? `ON — SENDING TO ${settings.email.toUpperCase()}`
                  : settings.email
                    ? "PAUSED — NOTHING IS BEING SENT"
                    : "OFF — NO ADDRESS ON FILE"}
              </div>
            </div>

            {note ? <div className="ok">{note}</div> : null}
            {error ? <div className="err shake">{error}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
