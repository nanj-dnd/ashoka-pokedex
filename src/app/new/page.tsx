import { redirect } from "next/navigation";
import { viewerOrNull } from "@/lib/auth";
import { CreateDex } from "@/components/CreateDex";

export const dynamic = "force-dynamic";

export default async function NewDexPage() {
  const me = await viewerOrNull();
  if (!me) redirect("/");
  return <CreateDex />;
}
