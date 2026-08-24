import { redirect } from "next/navigation";
import { viewerOrNull } from "@/lib/auth";
import { Gate } from "@/components/Gate";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await viewerOrNull();
  if (me) redirect(me.role === "admin" ? "/admin" : "/dex");
  return <Gate />;
}
