import { NextResponse } from "next/server";
import { getLocalMedia, usingSupabase } from "@/lib/store";

export const runtime = "nodejs";

/** Serves images for the local (no-Supabase) backend only. */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  if (usingSupabase) return new NextResponse("Not found", { status: 404 });

  const { file } = await ctx.params;
  const buf = await getLocalMedia(file);
  if (!buf) return new NextResponse("Not found", { status: 404 });

  const type = file.endsWith(".png") ? "image/png" : "image/jpeg";
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
