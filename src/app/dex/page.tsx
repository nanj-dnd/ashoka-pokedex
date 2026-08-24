import { redirect } from "next/navigation";
import { viewerOrNull } from "@/lib/auth";
import { DexView } from "@/components/DexView";

export const dynamic = "force-dynamic";

export default async function DexPage() {
  const me = await viewerOrNull();
  if (!me) redirect("/");
  return <DexView role={me.role} username={me.username} />;
}
