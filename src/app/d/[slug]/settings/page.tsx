import { redirect } from "next/navigation";
import { dexViewerOrNull } from "@/lib/auth";
import { DexSettings } from "@/components/DexSettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dv = await dexViewerOrNull(slug);
  if (!dv) redirect("/");
  // Only the owner sets the constraints — admins run the queue, not the rules.
  if (dv.role !== "owner") redirect(`/d/${slug}`);

  const { dex } = dv;
  return (
    <DexSettings
      slug={dex.slug}
      name={dex.name}
      tagline={dex.tagline}
      listed={dex.listed}
      config={dex.config}
      codes={{ admin: dex.adminCode, member: dex.memberCode }}
    />
  );
}
