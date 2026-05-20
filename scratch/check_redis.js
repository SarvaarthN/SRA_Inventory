const dotenv = require('dotenv');
const path = require('path');
const { Redis } = require('@upstash/redis');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

console.log("=== Upstash Redis Diagnostics ===");
console.log("URL:", url ? "Set" : "Not Set");
console.log("Token:", token ? "Set" : "Not Set");

if (!url || !token) {
  console.error("Missing Upstash Redis credentials in .env.local!");
  process.exit(1);
}

const redis = new Redis({ url, token });

async function run() {
  try {
    const components = await redis.smembers("components:all");
    const boxes = await redis.smembers("boxes:all");
    const categories = await redis.smembers("categories:all");
    const users = await redis.smembers("users:all");
    const transactions = await redis.zrange("tx:all", 0, -1);

    console.log("\nCounts in Upstash Redis:");
    console.log(`- Categories: ${categories.length}`);
    console.log(`- Boxes:      ${boxes.length}`);
    console.log(`- Users:      ${users.length}`);
    console.log(`- Components: ${components.length}`);
    console.log(`- Transactions: ${transactions.length}`);

    if (components.length > 0) {
      console.log(`\nSample Component ID: ${components[0]}`);
      const comp = await redis.hgetall(`component:${components[0]}`);
      console.log("Sample Component Data:", JSON.stringify(comp));
    }
  } catch (err) {
    console.error("Upstash Redis connection or fetch failed:", err);
  }
}

run();
