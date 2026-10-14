import { redirect, notFound } from "next/navigation";
import { dexViewerOrNull } from "@/lib/auth";
import { getDexBySlug } from "@/lib/store";
import { DexProvider } from "@/lib/DexContext";
import { DexView } from "@/components/DexView";
import { JoinDex } from "@/components/JoinDex";

export const dynamic = "force-dynamic";

export default async function DexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const dv = await dexViewerOrNull(slug);
  if (!dv) {
    // Either signed out or the dex does not exist. Tell those apart, so a
    // signed-out person following a shared link lands on sign-in rather than
    // a 404 that makes the dex look broken.
    const exists = await getDexBySlug(slug).catch(() => null);
    if (!exists) notFound();
    redirect(`/?next=${encodeURIComponent(`/d/${slug}`)}`);
  }

  const { dex, role, username } = dv;

  // Signed in but not a member yet: the join screen, not the dex.
  if (!role) return <JoinDex slug={dex.slug} name={dex.name} tagline={dex.tagline} />;

  return (
    <DexProvider
      slug={dex.slug}
      name={dex.name}
      tagline={dex.tagline}
      config={dex.config}
      role={role}
      username={username}
    >
      <DexView />
    </DexProvider>
  );
}
