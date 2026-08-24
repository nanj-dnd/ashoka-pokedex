import { redirect } from "next/navigation";
import { requiredApprovals } from "@/lib/session";
import { viewerOrNull } from "@/lib/auth";
import { AdminView } from "@/components/AdminView";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await viewerOrNull();
  if (!me) redirect("/");
  // Demoted admins land back in the dex on their next page load, cookie or not.
  if (me.role !== "admin") redirect("/dex");
  return <AdminView accountId={me.accountId} username={me.username} needed={requiredApprovals()} />;
}
