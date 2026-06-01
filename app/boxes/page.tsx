export const dynamic = "force-dynamic";
import { redis, keys } from "@/lib/redis";
import { Box, Component } from "@/lib/types";
import BoxesClient from "./BoxesClient";

async function getBoxes() {
  const [boxIds, componentIds] = await Promise.all([
    redis.smembers(keys.boxesAll()),
    redis.smembers(keys.componentsAll()),
  ]);
  if (!boxIds.length) return [];

  const pipeline = redis.pipeline();
  boxIds.forEach((id) => pipeline.hgetall(keys.box(id)));
  // only add component commands if there are any, to avoid empty-pipeline error
  if (componentIds.length) {
    componentIds.forEach((id) => pipeline.hgetall(keys.component(id)));
  }
  const results = await pipeline.exec();

  const boxes = results.slice(0, boxIds.length).map((r) => r as Box | null).filter(Boolean) as Box[];
  const components = results.slice(boxIds.length).map((r) => r as Component | null).filter(Boolean) as Component[];

  return boxes
    .map((b) => ({
      ...b,
      componentCount: components.filter((c) => c.boxId === b.id).length,
      totalQty: components.filter((c) => c.boxId === b.id).reduce((s, c) => s + Number(c.quantity), 0),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default async function BoxesPage() {
  const boxes = await getBoxes();
  return <BoxesClient boxes={boxes} />;
}
