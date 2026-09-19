export const dynamic = "force-dynamic";
import { getSession } from "@/lib/session";
import { canWrite as sessionCanWrite } from "@/lib/auth";
import { redirect } from "next/navigation";
import NewComponentClient from "./NewComponentClient";

export default async function NewComponentPage() {
  const session = await getSession();
  const canWrite = sessionCanWrite(session);
  if (!canWrite) redirect("/components");
  return <NewComponentClient />;
}
