import { NextResponse } from "next/server";
import { SESSION_COOKIE, getSession, newSession, roleForCode } from "@/lib/session";

export const runtime = "nodejs";

/** GET — who am I? Used by the client to render the right shell. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ role: null });
  return NextResponse.json({ role: session.role, handle: session.handle });
}

/** POST — redeem an access code. Admins must also supply a handle. */
export async function POST(req: Request) {
  const { code, handle } = (await req.json().catch(() => ({}))) as {
    code?: string;
    handle?: string;
  };

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "ENTER A CODE" }, { status: 400 });
  }

  const role = roleForCode(code);
  if (!role) {
    return NextResponse.json({ error: "ACCESS DENIED" }, { status: 401 });
  }

  let cleanHandle = "";
  if (role === "admin") {
    cleanHandle = (handle ?? "").trim().toUpperCase().replace(/[^A-Z0-9_ .-]/g, "").slice(0, 20);
    if (cleanHandle.length < 2) {
      // Signals to the client that it should show the handle field.
      return NextResponse.json({ error: "HANDLE REQUIRED", needsHandle: true }, { status: 400 });
    }
  }

  const res = NextResponse.json({ role, handle: cleanHandle });
  res.cookies.set(SESSION_COOKIE, newSession(role, cleanHandle), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

/** DELETE — log out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
