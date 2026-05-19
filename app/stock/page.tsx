export const dynamic = "force-dynamic";
import { getSession } from "@/lib/session";
import StockClient from "./StockClient";

export default async function StockPage() {
  const session = await getSession();
  const canWrite = session?.year === "TY" || session?.year === "LY";
  return <StockClient canWrite={canWrite} userName={session?.name ?? ""} />;
}
