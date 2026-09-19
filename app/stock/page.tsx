export const dynamic = "force-dynamic";
import { getSession } from "@/lib/session";
import { canWrite as sessionCanWrite } from "@/lib/auth";
import StockClient from "./StockClient";

export default async function StockPage() {
  const session = await getSession();
  const canWrite = sessionCanWrite(session);
  return <StockClient canWrite={canWrite} userName={session?.name ?? ""} />;
}
