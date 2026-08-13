export const dynamic = "force-dynamic";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import NewOrderClient from "./NewOrderClient";

export default async function NewOrderPage() {
  const session = await getSession();
  // Same write rule the components and boxes pages use.
  const canWrite = session?.year === "TY" || session?.year === "LY";
  if (!canWrite) redirect("/orders");
  return <NewOrderClient />;
}
