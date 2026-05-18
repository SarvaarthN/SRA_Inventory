export const dynamic = "force-dynamic";
import { redis, keys } from "@/lib/redis";
import { Component, Transaction } from "@/lib/types";
import { notFound } from "next/navigation";
import ComponentDetail from "./ComponentDetail";

type Props = { params: Promise<{ id: string }> };

async function getData(id: string) {
  const component = await redis.hgetall<Component>(keys.component(id));
  if (!component) return null;

  const txIds = (await redis.zrange(keys.transactionsByComponent(id), 0, -1, { rev: true })) as string[];
  const pipeline = redis.pipeline();
  txIds.forEach((tid) => pipeline.hgetall(keys.transaction(tid)));
  const results = await pipeline.exec();
  const transactions = results.map((r) => r as unknown as Transaction | null).filter(Boolean) as Transaction[];

  return { component, transactions };
}

export default async function ComponentDetailPage({ params }: Props) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const data = await getData(decodedId);
  if (!data) notFound();
  return <ComponentDetail component={data.component} transactions={data.transactions} />;
}
