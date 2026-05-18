export const dynamic = "force-dynamic";
import { redis, keys } from "@/lib/redis";
import { Component, CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import ComponentsClient from "./ComponentsClient";

async function getComponents() {
  const ids = await redis.smembers(keys.componentsAll());
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(keys.component(id)));
  const results = await pipeline.exec();
  return (results.map((r) => r as Component | null).filter(Boolean) as Component[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export default async function ComponentsPage() {
  const components = await getComponents();
  return <ComponentsClient initialComponents={components} />;
}
