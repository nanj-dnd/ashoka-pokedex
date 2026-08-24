import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/session";
import { putMedia } from "@/lib/store";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB per image, post-resize on the client

/** Decode a `data:image/...;base64,...` URL into bytes + extension. */
function decodeDataUrl(dataUrl: unknown): { buf: Buffer; ext: string; type: string } | null {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[3], "base64");
  if (buf.length === 0 || buf.length > MAX_BYTES) return null;
  const ext = m[2] === "jpeg" ? "jpg" : m[2];
  return { buf, ext, type: m[1] };
}

/**
 * POST /api/upload  { sprite: dataURL, photo?: dataURL }
 * Returns the URLs to store on the creature. Admin only — the public code
 * never gets to write media.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "ADMINS ONLY" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD REQUEST" }, { status: 400 });

  const sprite = decodeDataUrl(body.sprite);
  if (!sprite) return NextResponse.json({ error: "BAD SPRITE" }, { status: 400 });

  const stem = randomUUID();
  const spriteUrl = await putMedia(`${stem}-sprite.${sprite.ext}`, sprite.buf, sprite.type);

  let photoUrl = "";
  const photo = decodeDataUrl(body.photo);
  if (photo) {
    photoUrl = await putMedia(`${stem}-photo.${photo.ext}`, photo.buf, photo.type);
  }

  return NextResponse.json({ spriteUrl, photoUrl });
}
