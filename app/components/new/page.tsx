export const dynamic = "force-dynamic";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import NewComponentClient from "./NewComponentClient";

export default async function NewComponentPage() {
  const session = await getSession();
  const canWrite = session?.year === "TY" || session?.year === "LY";
  if (!canWrite) redirect("/components");
  return <NewComponentClient />;
}
