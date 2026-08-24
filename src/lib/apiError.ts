import { NextResponse } from "next/server";

/**
 * Store failures (most often: no database configured yet) should reach the UI
 * as something a human can act on, not an opaque 500.
 */
export function storeError(e: unknown): NextResponse {
  const message = String((e as Error)?.message ?? e);
  const unconfigured = message.includes("No Supabase configuration");
  return NextResponse.json(
    { error: unconfigured ? "DATABASE NOT CONFIGURED" : `STORE ERROR — ${message}` },
    { status: 503 },
  );
}
