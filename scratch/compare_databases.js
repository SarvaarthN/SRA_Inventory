const dotenv = require('dotenv');
const path = require('path');
const { Redis } = require('@upstash/redis');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const sheetsInventoryUrl = process.env.GOOGLE_SCRIPT_URL_INVENTORY;
const secretToken = process.env.DB_SECRET_TOKEN;

if (!upstashUrl || !upstashToken || !sheetsInventoryUrl || !secretToken) {
  console.error("Missing credentials in .env.local!");
  process.exit(1);
}

const redis = new Redis({ url: upstashUrl, token: upstashToken });

async function compare() {
  console.log("=== Upstash vs Google Sheets Compare Diagnostics ===\n");
  
  // 1. Fetch from Upstash
  let redisComps = [];
  try {
    const ids = await redis.smembers("components:all");
    for (const id of ids) {
      const data = await redis.hgetall(`component:${id}`);
      if (data) {
        redisComps.push({ id: data.id, name: data.name, quantity: Number(data.quantity || 0) });
      }
    }
  } catch (err) {
    console.error("Failed to fetch from Upstash:", err.message);
    return;
  }

  // 2. Fetch from Google Sheets
  let sheetComps = [];
  try {
    const fullUrl = `${sheetsInventoryUrl}?sheet=Components&token=${encodeURIComponent(secretToken || "")}`;
    const res = await fetch(fullUrl);
    const data = await res.json();
    sheetComps = data.map(c => ({
      id: c["Part Number"],
      name: c["Name"],
      quantity: Number(c["Quantity"] || 0)
    })).filter(c => c.id);
  } catch (err) {
    console.error("Failed to fetch from Google Sheets:", err.message);
    return;
  }

  console.log(`Upstash Components Count: ${redisComps.length}`);
  console.log(`Google Sheets Components Count: ${sheetComps.length}\n`);

  // 3. Analyze Mismatches
  const redisMap = new Map(redisComps.map(c => [c.id, c]));
  const sheetMap = new Map(sheetComps.map(c => [c.id, c]));

  const onlyInRedis = [];
  const onlyInSheet = [];
  const quantityMismatches = [];

  for (const comp of redisComps) {
    if (!sheetMap.has(comp.id)) {
      onlyInRedis.push(comp);
    } else {
      const sComp = sheetMap.get(comp.id);
      if (comp.quantity !== sComp.quantity) {
        quantityMismatches.push({
          id: comp.id,
          name: comp.name,
          upstashQty: comp.quantity,
          sheetQty: sComp.quantity
        });
      }
    }
  }

  for (const comp of sheetComps) {
    if (!redisMap.has(comp.id)) {
      onlyInSheet.push(comp);
    }
  }

  console.log(`- Only in Upstash Redis (${onlyInRedis.length}):`);
  if (onlyInRedis.length > 0) {
    onlyInRedis.slice(0, 10).forEach(c => console.log(`  * ${c.id}: ${c.name} (Qty: ${c.quantity})`));
    if (onlyInRedis.length > 10) console.log(`  ... and ${onlyInRedis.length - 10} more`);
  } else {
    console.log("  None");
  }

  console.log(`\n- Only in Google Sheets (${onlyInSheet.length}):`);
  if (onlyInSheet.length > 0) {
    onlyInSheet.slice(0, 10).forEach(c => console.log(`  * ${c.id}: ${c.name} (Qty: ${c.quantity})`));
    if (onlyInSheet.length > 10) console.log(`  ... and ${onlyInSheet.length - 10} more`);
  } else {
    console.log("  None");
  }

  console.log(`\n- Quantity Mismatches (${quantityMismatches.length}):`);
  if (quantityMismatches.length > 0) {
    quantityMismatches.slice(0, 10).forEach(c => 
      console.log(`  * ${c.id}: ${c.name} (Upstash: ${c.upstashQty} vs Sheets: ${c.sheetQty})`)
    );
    if (quantityMismatches.length > 10) console.log(`  ... and ${quantityMismatches.length - 10} more`);
  } else {
    console.log("  None");
  }
}

compare();
