export const dynamic = "force-dynamic";
import { getSession } from "@/lib/session";
import { canWrite as sessionCanWrite } from "@/lib/auth";
import { redirect } from "next/navigation";
import NewOrderClient from "./NewOrderClient";

export default async function NewOrderPage() {
  const session = await getSession();
  // Same write rule the components and boxes pages use.
  const canWrite = sessionCanWrite(session);
  if (!canWrite) redirect("/orders");
  return <NewOrderClient />;
}
