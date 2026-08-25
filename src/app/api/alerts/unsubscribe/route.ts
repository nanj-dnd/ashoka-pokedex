import { readAlertToken } from "@/lib/session";
import { updateAccountAlerts } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://primafacie.in").replace(/\/$/, "");

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<div style="background:#0b0f14;color:#dbe6f5;font-family:ui-monospace,Menlo,Consolas,monospace;min-height:100vh;display:grid;place-items:center;padding:24px;margin:0">
  <div style="max-width:420px;text-align:center">
    <div style="color:#ffcb05;font-size:12px;letter-spacing:.12em;text-transform:uppercase">${title}</div>
    <p style="font-size:16px;line-height:1.5">${body}</p>
    <a href="${SITE}/dex" style="display:inline-block;background:#cf3a30;color:#fff;text-decoration:none;padding:12px 18px;font-size:13px;letter-spacing:.08em">OPEN THE DEX</a>
  </div>
</div>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/**
 * GET /api/alerts/unsubscribe?t=…
 *
 * One click from an email footer, so it has to work without a session — the
 * signed token is the whole authorisation, and all it can do is switch one
 * account's alerts off. The address itself is kept, so turning them back on in
 * the dex does not mean typing it in again.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const accountId = readAlertToken(token);
  if (!accountId) {
    return page("LINK NOT VALID", "That unsubscribe link has been altered or is out of date.", 400);
  }

  try {
    await updateAccountAlerts(accountId, { alerts: false });
  } catch {
    return page("SOMETHING WENT WRONG", "We could not turn your alerts off. Try again in a minute.", 503);
  }

  return page(
    "ALERTS OFF",
    "You will not get any more mail from the Ashoka Pokedex. Your account and your address are untouched — you can turn alerts back on from the dex whenever you like.",
  );
}
