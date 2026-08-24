import { redirect } from "next/navigation";
import { getSession, requiredApprovals } from "@/lib/session";
import { AdminView } from "@/components/AdminView";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/dex");
  return <AdminView handle={session.handle} needed={requiredApprovals()} />;
}
