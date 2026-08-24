"use client";

import type { ReactNode } from "react";

/** The red handheld the whole app lives inside. */
export function Shell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="dex-wrap">
      <div className="dex">
        <div className="dex-hardware">
          <div className="lens" aria-hidden />
          <div className="lamps" aria-hidden>
            <i className="lamp red" />
            <i className="lamp yellow" />
            <i className="lamp green" />
          </div>
          <div className="dex-title">
            <h1>{title}</h1>
            {subtitle ? (
              <div className="label" style={{ marginTop: 6, color: "rgba(255,255,255,.75)" }}>
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        <div className="screen">{children}</div>

        <div className="dex-footer">
          <div className="dpad" aria-hidden>
            <i className="gap" /><i /><i className="gap" />
            <i /><i className="mid" /><i />
            <i className="gap" /><i /><i className="gap" />
          </div>
          {actions ? <div className="row" style={{ flex: "0 1 auto" }}>{actions}</div> : null}
          <div className="grille" aria-hidden>
            <i /><i /><i /><i /><i />
          </div>
        </div>
      </div>
    </div>
  );
}
