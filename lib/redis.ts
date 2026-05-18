import { Redis } from "@upstash/redis";

// Lazy singleton — defers construction until first use so Next.js build
// can evaluate this module without real credentials being present.
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return Reflect.get(getRedis(), prop, getRedis());
  },
});

// Key helpers
export const keys = {
  component: (id: string) => `component:${id}`,
  componentsAll: () => `components:all`,
  componentsByCategory: (cat: string) => `components:cat:${cat}`,
  counter: (cat: string, year: number) => `counter:${cat}:${year}`,
  box: (id: string) => `box:${id}`,
  boxesAll: () => `boxes:all`,
  boxCounter: () => `counter:box`,
  transaction: (id: string) => `tx:${id}`,
  transactionsAll: () => `tx:all`,
  transactionsByComponent: (id: string) => `tx:comp:${id}`,
  txCounter: () => `counter:tx`,
  category: (code: string) => `category:${code}`,
  categoriesAll: () => `categories:all`,
};
