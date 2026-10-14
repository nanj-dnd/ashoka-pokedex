import { redirect } from "next/navigation";
import { dexViewerOrNull } from "@/lib/auth";
import { DexProvider } from "@/lib/DexContext";
import { AdminView } from "@/components/AdminView";
import { canAdmin } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dv = await dexViewerOrNull(slug);
  if (!dv) redirect("/");
  if (!canAdmin(dv.role)) redirect(`/d/${slug}`);

  const { dex, role, username, accountId } = dv;
  return (
    <DexProvider
      slug={dex.slug}
      name={dex.name}
      tagline={dex.tagline}
      config={dex.config}
      role={role}
      username={username}
    >
      <AdminView
        accountId={accountId}
        username={username}
        needed={dex.config.requiredApprovals}
      />
    </DexProvider>
  );
}
