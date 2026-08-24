import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Gate } from "@/components/Gate";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(session.role === "admin" ? "/admin" : "/dex");
  return <Gate />;
}
