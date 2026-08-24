import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DexView } from "@/components/DexView";

export const dynamic = "force-dynamic";

export default async function DexPage() {
  const session = await getSession();
  if (!session) redirect("/");
  return <DexView role={session.role} handle={session.handle} />;
}
