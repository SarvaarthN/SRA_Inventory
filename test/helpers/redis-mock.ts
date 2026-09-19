import { upstashDeserialize } from "./upstash";

type Hash = Map<string, string>;
type ZEntry = { score: number; member: string };

/**
 * In-memory stand-in for Upstash Redis.
 *
 * Critically it reproduces Upstash's read behaviour: values are stored as
 * strings and JSON.parsed on the way back out, so a location written as "101"
 * is READ BACK as the number 101. A mock that returned clean strings would let
 * exactly the class of bug we are guarding against sail through green tests.
 */
export class MockRedis {
  private hashes = new Map<string, Hash>();
  private sets = new Map<string, Set<string>>();
  private zsets = new Map<string, ZEntry[]>();
  private counters = new Map<string, number>();

  /** Commands recorded in order — lets tests assert on write behaviour. */
  public calls: { cmd: string; args: unknown[] }[] = [];

  private record(cmd: string, ...args: unknown[]) {
    this.calls.push({ cmd, args });
  }

  reset() {
    this.hashes.clear();
    this.sets.clear();
    this.zsets.clear();
    this.counters.clear();
    this.calls = [];
  }

  /** Seed a hash the way the app writes it (all values stringified). */
  seedHash(key: string, value: Record<string, unknown>) {
    const h: Hash = new Map();
    for (const [k, v] of Object.entries(value)) h.set(k, String(v));
    this.hashes.set(key, h);
  }

  seedSet(key: string, members: string[]) {
    this.sets.set(key, new Set(members));
  }

  seedZSet(key: string, entries: ZEntry[]) {
    this.zsets.set(key, [...entries].sort((a, b) => a.score - b.score));
  }

  // ── Commands ────────────────────────────────────────────────────────────
  async hgetall<T>(key: string): Promise<T | null> {
    this.record("hgetall", key);
    const h = this.hashes.get(key);
    if (!h || h.size === 0) return null;
    const out: Record<string, unknown> = {};
    // The coercion that bites in production.
    for (const [k, v] of h) out[k] = upstashDeserialize(v);
    return out as T;
  }

  async hset(key: string, value: Record<string, unknown>): Promise<number> {
    this.record("hset", key, value);
    const h = this.hashes.get(key) ?? new Map<string, string>();
    for (const [k, v] of Object.entries(value)) h.set(k, String(v));
    this.hashes.set(key, h);
    return Object.keys(value).length;
  }

  async smembers(key: string): Promise<string[]> {
    this.record("smembers", key);
    return [...(this.sets.get(key) ?? [])];
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    this.record("sadd", key, members);
    const s = this.sets.get(key) ?? new Set<string>();
    members.flat().forEach((m) => s.add(String(m)));
    this.sets.set(key, s);
    return members.length;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    this.record("srem", key, members);
    const s = this.sets.get(key);
    if (!s) return 0;
    members.flat().forEach((m) => s.delete(String(m)));
    return members.length;
  }

  async del(key: string): Promise<number> {
    this.record("del", key);
    const had = this.hashes.delete(key);
    this.sets.delete(key);
    this.zsets.delete(key);
    return had ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    this.record("incr", key);
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }

  async zadd(key: string, entry: ZEntry): Promise<number> {
    this.record("zadd", key, entry);
    const z = this.zsets.get(key) ?? [];
    const existing = z.findIndex((e) => e.member === entry.member);
    if (existing >= 0) z[existing] = entry;
    else z.push(entry);
    z.sort((a, b) => a.score - b.score);
    this.zsets.set(key, z);
    return 1;
  }

  async zrange<T = string[]>(
    key: string,
    start: number,
    stop: number,
    opts?: { rev?: boolean }
  ): Promise<T> {
    this.record("zrange", key, start, stop, opts);
    const z = [...(this.zsets.get(key) ?? [])];
    if (opts?.rev) z.reverse();
    const end = stop === -1 ? z.length : stop + 1;
    return z.slice(start, end).map((e) => e.member) as T;
  }

  /**
   * Pipeline queues commands and resolves them in order, like Upstash.
   * Arrow functions capture `this` lexically so there is no alias to leak.
   */
  pipeline() {
    const queued: (() => Promise<unknown>)[] = [];
    const api = {
      hgetall: (key: string) => { queued.push(() => this.hgetall(key)); return api; },
      hset: (key: string, v: Record<string, unknown>) => { queued.push(() => this.hset(key, v)); return api; },
      sadd: (key: string, ...m: string[]) => { queued.push(() => this.sadd(key, ...m)); return api; },
      srem: (key: string, ...m: string[]) => { queued.push(() => this.srem(key, ...m)); return api; },
      del: (key: string) => { queued.push(() => this.del(key)); return api; },
      zadd: (key: string, e: ZEntry) => { queued.push(() => this.zadd(key, e)); return api; },
      incr: (key: string) => { queued.push(() => this.incr(key)); return api; },
      exec: async () => {
        const out: unknown[] = [];
        for (const fn of queued) out.push(await fn());
        return out;
      },
    };
    return api;
  }
}

export const mockRedis = new MockRedis();
