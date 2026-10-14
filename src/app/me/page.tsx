import { redirect } from "next/navigation";
import { viewerOrNull } from "@/lib/auth";
import { MyDexes } from "@/components/MyDexes";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const me = await viewerOrNull();
  if (!me) redirect("/");
  return <MyDexes username={me.username} />;
}
