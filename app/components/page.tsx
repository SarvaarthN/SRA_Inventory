export const dynamic = "force-dynamic";
import { redis, keys } from "@/lib/redis";
import { Box, Component } from "@/lib/types";
import { getSession } from "@/lib/session";
import { canWrite as sessionCanWrite } from "@/lib/auth";
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

async function getBoxLocations(): Promise<Record<string, string>> {
  const ids = await redis.smembers(keys.boxesAll());
  if (!ids.length) return {};
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(keys.box(id)));
  const results = await pipeline.exec();
  const locations: Record<string, string> = {};
  (results.map((r) => r as Box | null).filter(Boolean) as Box[]).forEach((b) => {
    // Upstash JSON-parses hash values, so a location like "101" comes back as a
    // number. Coerce here so this really is a Record<string, string>.
    const location = b.location == null ? "" : String(b.location);
    if (location) locations[String(b.id)] = location;
  });
  return locations;
}

export default async function ComponentsPage() {
  const [components, boxLocations, session] = await Promise.all([
    getComponents(),
    getBoxLocations(),
    getSession(),
  ]);
  const canWrite = sessionCanWrite(session);
  return (
    <ComponentsClient
      initialComponents={components}
      boxLocations={boxLocations}
      canWrite={canWrite}
    />
  );
}
