const dotenv = require('dotenv');
const path = require('path');
const { Redis } = require('@upstash/redis');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const sheetsUsersUrl = process.env.GOOGLE_SCRIPT_URL_USERS;
const sheetsInventoryUrl = process.env.GOOGLE_SCRIPT_URL_INVENTORY;
const secretToken = process.env.DB_SECRET_TOKEN;

if (!upstashUrl || !upstashToken || !sheetsInventoryUrl || !sheetsUsersUrl || !secretToken) {
  console.error("Missing credentials in .env.local!");
  process.exit(1);
}

const redis = new Redis({ url: upstashUrl, token: upstashToken });

// Native fetch POST helper that follows redirect (Apps Script behavior)
async function writeToSheet(sheet, action, keyName, keyValue, data) {
  const isUserSheet = sheet === "Users";
  const url = isUserSheet ? sheetsUsersUrl : sheetsInventoryUrl;
  const payload = { sheet, action, keyName, keyValue, data, token: secretToken };

  // Wait 100ms between requests to avoid script lock conflicts
  await new Promise((resolve) => setTimeout(resolve, 100));

  let retries = 3;
  while (retries > 0) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      const json = JSON.parse(text);
      if (json.error) {
        throw new Error(json.error);
      }
      return json.data;
    } catch (err) {
      retries--;
      if (retries === 0) {
        throw err;
      }
      console.warn(`  -> Request failed: "${err.message}". Retrying... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // wait 1s before retry
    }
  }
}

function mapComponentToSpreadsheet(data) {
  if (!data) return null;
  return {
    "Part Number": data.id,
    "Name": data.name,
    "Category": data.category,
    "Quantity": Number(data.quantity || 0),
    "Box ID": data.boxId || "",
    "Box Name": data.boxName || "",
    "Description": data.description || "",
    "Added By": data.addedBy || "",
    "Created At": data.createdAt || new Date().toISOString(),
  };
}

async function runSync() {
  console.log("=== SRA Database Full Synchronizer ===");
  console.log("Starting full sync of Upstash Redis ➔ Google Sheets...\n");

  // 1. Sync Categories
  try {
    const codes = await redis.smembers("categories:all");
    console.log(`[1/5] Syncing ${codes.length} Categories...`);
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const data = await redis.hgetall(`category:${code}`);
      if (data && Object.keys(data).length > 0) {
        try {
          await writeToSheet("Categories", "UPDATE", "code", code, data).catch(() =>
            writeToSheet("Categories", "CREATE", "code", code, data)
          );
          console.log(`   (${i+1}/${codes.length}) Synced Category: ${code}`);
        } catch (e) {
          console.error(`   x (${i+1}/${codes.length}) Failed Category ${code}: ${e.message}`);
        }
      }
    }
  } catch (err) {
    console.error("Categories sync aborted:", err.message);
  }

  // 2. Sync Boxes
  try {
    const ids = await redis.smembers("boxes:all");
    console.log(`\n[2/5] Syncing ${ids.length} Boxes...`);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const data = await redis.hgetall(`box:${id}`);
      if (data && Object.keys(data).length > 0) {
        const sheetBox = {
          "1ID": data.id,
          name: data.name,
          location: data.location,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          boxType: data.boxType
        };
        try {
          await writeToSheet("Boxes", "UPDATE", "1ID", id, sheetBox).catch(() =>
            writeToSheet("Boxes", "CREATE", "1ID", id, sheetBox)
          );
          console.log(`   (${i+1}/${ids.length}) Synced Box: ${id}`);
        } catch (e) {
          console.error(`   x (${i+1}/${ids.length}) Failed Box ${id}: ${e.message}`);
        }
      }
    }
  } catch (err) {
    console.error("Boxes sync aborted:", err.message);
  }

  // 3. Sync Users
  try {
    const emails = await redis.smembers("users:all");
    console.log(`\n[3/5] Syncing ${emails.length} Users...`);
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const data = await redis.hgetall(`user:${email}`);
      if (data && Object.keys(data).length > 0) {
        try {
          await writeToSheet("Users", "UPDATE", "userId", email, data).catch(() =>
            writeToSheet("Users", "CREATE", "userId", email, data)
          );
          console.log(`   (${i+1}/${emails.length}) Synced User: ${email}`);
        } catch (e) {
          console.error(`   x (${i+1}/${emails.length}) Failed User ${email}: ${e.message}`);
        }
      }
    }
  } catch (err) {
    console.error("Users sync aborted:", err.message);
  }

  // 4. Sync Components
  try {
    const partNumbers = await redis.smembers("components:all");
    console.log(`\n[4/5] Syncing ${partNumbers.length} Components...`);
    for (let i = 0; i < partNumbers.length; i++) {
      const partNumber = partNumbers[i];
      const data = await redis.hgetall(`component:${partNumber}`);
      if (data && Object.keys(data).length > 0) {
        const sheetData = mapComponentToSpreadsheet(data);
        try {
          await writeToSheet("Components", "UPDATE", "Part Number", partNumber, sheetData).catch(() =>
            writeToSheet("Components", "CREATE", "Part Number", partNumber, sheetData)
          );
          console.log(`   (${i+1}/${partNumbers.length}) Synced Component: ${partNumber}`);
        } catch (e) {
          console.error(`   x (${i+1}/${partNumbers.length}) Failed Component ${partNumber}: ${e.message}`);
        }
      }
    }
  } catch (err) {
    console.error("Components sync aborted:", err.message);
  }

  // 5. Sync Transactions
  try {
    const txIds = await redis.zrange("tx:all", 0, -1);
    console.log(`\n[5/5] Syncing ${txIds.length} Transactions...`);
    for (let i = 0; i < txIds.length; i++) {
      const id = txIds[i];
      const data = await redis.hgetall(`tx:${id}`);
      if (data && Object.keys(data).length > 0) {
        const sheetTx = {
          id: data.id,
          componentId: data.componentId,
          componentName: data.componentName,
          type: data.type,
          quantityChange: Number(data.quantityChange),
          quantityAfter: Number(data.quantityAfter),
          performedBy: data.performedBy,
          "notes`````": data.notes || "",
          timestamp: data.timestamp
        };
        try {
          await writeToSheet("Transactions", "UPDATE", "id", id, sheetTx).catch(() =>
            writeToSheet("Transactions", "CREATE", "id", id, sheetTx)
          );
          console.log(`   (${i+1}/${txIds.length}) Synced Transaction: ${id}`);
        } catch (e) {
          console.error(`   x (${i+1}/${txIds.length}) Failed Transaction ${id}: ${e.message}`);
        }
      }
    }
  } catch (err) {
    console.error("Transactions sync aborted:", err.message);
  }

  console.log("\n==========================================");
  console.log("Full Database Synchronization Completed!");
  console.log("==========================================");
}

runSync();
