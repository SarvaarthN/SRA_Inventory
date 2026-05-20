import { Redis } from "@upstash/redis";
import https from "https";

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
    if (prop === "hgetall") {
      return async function (key: string) {
        let res = await getRedis().hgetall(key);
        
        // Self-healing: If user email is missing from Redis (but Admin just added to Sheets), retrieve and cache it!
        if ((!res || Object.keys(res).length === 0) && key.startsWith("user:")) {
          const email = key.substring(5).toLowerCase();
          try {
            const freshUsers = await fetchSheetData("Users");
            const foundUser = freshUsers.find((u: any) => String(u.userId).toLowerCase() === email);
            if (foundUser) {
              await getRedis().hset(key, foundUser);
              await getRedis().sadd(keys.usersAll(), email);
              res = foundUser;
            }
          } catch (err) {
            console.error("Failed to self-heal user from Google Sheets:", err);
          }
        }
        return res;
      };
    }

    const r = getRedis();
    const value = Reflect.get(r, prop, r);
    if (typeof value === "function") {
      return value.bind(r);
    }
    return value;
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
  user: (userId: string) => `user:${userId}`,
  usersAll: () => `users:all`,
  userCounter: () => `counter:user`,
};

// --- Google Sheets Sync Helpers ---

// Native HTTPS GET helper that follows redirects (vital for Google Apps Script Web Apps)
function nativeHttpsGet(urlStr: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (SRA Inventory)",
      },
    };

    const req = https.request(urlStr, options, (res) => {
      // Follow 301/302 redirects automatically
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          nativeHttpsGet(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

// Native HTTPS POST helper that follows redirects to GET results (standard Apps Script behavior)
function nativeHttpsPost(urlStr: string, bodyObj: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "Mozilla/5.0 (SRA Inventory)",
      },
    };

    const req = https.request(urlStr, options, (res) => {
      // Follow redirects. Google Apps Script redirects POSTs to a GET results page.
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          nativeHttpsGet(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

// Fetch sheets from the appropriate Google Spreadsheet using the Secret Token
async function fetchSheetData(sheet: string): Promise<any[]> {
  const isUserSheet = sheet === "Users";
  const url = isUserSheet 
    ? process.env.GOOGLE_SCRIPT_URL_USERS 
    : process.env.GOOGLE_SCRIPT_URL_INVENTORY;

  const secretToken = process.env.DB_SECRET_TOKEN || "";

  if (!url) return [];

  try {
    const fullUrl = `${url}?sheet=${encodeURIComponent(sheet)}&token=${encodeURIComponent(secretToken)}`;
    const rawText = await nativeHttpsGet(fullUrl);
    const data = JSON.parse(rawText);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Google Sheets read error for sheet ${sheet}:`, error);
    return [];
  }
}

// Write to sheet routing to correct web app with Secret Token
async function writeToSheet(sheet: string, action: "CREATE" | "UPDATE" | "DELETE", keyName: string, keyValue: string, data: any) {
  const isUserSheet = sheet === "Users";
  const url = isUserSheet 
    ? process.env.GOOGLE_SCRIPT_URL_USERS 
    : process.env.GOOGLE_SCRIPT_URL_INVENTORY;

  const secretToken = process.env.DB_SECRET_TOKEN || "";

  if (!url) return;

  try {
    const payload = { sheet, action, keyName, keyValue, data, token: secretToken };
    const rawText = await nativeHttpsPost(url, payload);
    const json = JSON.parse(rawText);
    if (json.error) throw new Error(json.error);
    return json.data;
  } catch (error) {
    console.error(`Google Sheets DB write error [${action} on ${sheet}]:`, error);
    throw error;
  }
}

// Fire-and-forget non-blocking background sheet updater
export function queueSheetUpdate(sheet: string, action: "CREATE" | "UPDATE" | "DELETE", keyName: string, keyValue: string, data: any) {
  writeToSheet(sheet, action, keyName, keyValue, data).catch((err) => {
    console.error(`Background Sheets update failed for ${sheet} (${action}):`, err);
  });
}

// Convert website properties to spreadsheet columns for writing
function mapComponentToSpreadsheet(data: any): any {
  if (!data) return null;
  return {
    "Part Number": data.id,
    "Name": data.name,
    "Category": data.category,
    "Quantity": Number(data.quantity),
    "Box ID": data.boxId,
    "Box Name": data.boxName,
    "Description": data.description,
    "Added By": data.addedBy,
    "Created At": data.createdAt || new Date().toISOString(),
  };
}

// --- Two-Way Database Mirroring Utilities ---

// Utility to sync all Redis data to Google Sheets (Non-destructive to Redis, only overwrites Sheets)
export async function syncAllRedisToSheets() {
  console.log("Starting robust Redis to Google Sheets sync...");
  const realRedis = getRedis();

  // 1. Sync Categories
  try {
    const catCodes = await realRedis.smembers(keys.categoriesAll());
    console.log(`Syncing ${catCodes.length} categories to Google Sheets...`);
    for (const code of catCodes) {
      try {
        const data = await realRedis.hgetall(keys.category(code));
        if (data && Object.keys(data).length > 0) {
          await writeToSheet("Categories", "UPDATE", "code", code, data).catch(() => 
            writeToSheet("Categories", "CREATE", "code", code, data)
          );
        }
      } catch (e: any) {
        console.error(`Error syncing category ${code}:`, e.message || e);
      }
    }
  } catch (err) {
    console.error("Error in categories sync block:", err);
  }

  // 2. Sync Boxes
  try {
    const boxIds = await realRedis.smembers(keys.boxesAll());
    console.log(`Syncing ${boxIds.length} boxes to Google Sheets...`);
    for (const id of boxIds) {
      try {
        const data = await realRedis.hgetall(keys.box(id));
        if (data && Object.keys(data).length > 0) {
          const sheetBox = {
            "1ID": data.id,
            name: data.name,
            location: data.location,
            createdBy: data.createdBy,
            createdAt: data.createdAt,
            boxType: data.boxType
          };
          await writeToSheet("Boxes", "UPDATE", "1ID", id, sheetBox).catch(() =>
            writeToSheet("Boxes", "CREATE", "1ID", id, sheetBox)
          );
        }
      } catch (e: any) {
        console.error(`Error syncing box ${id}:`, e.message || e);
      }
    }
  } catch (err) {
    console.error("Error in boxes sync block:", err);
  }

  // 3. Sync Users
  try {
    const userIds = await realRedis.smembers(keys.usersAll());
    console.log(`Syncing ${userIds.length} users to Google Sheets...`);
    for (const userId of userIds) {
      try {
        const data = await realRedis.hgetall(keys.user(userId));
        if (data && Object.keys(data).length > 0) {
          await writeToSheet("Users", "UPDATE", "userId", userId, data).catch(() =>
            writeToSheet("Users", "CREATE", "userId", userId, data)
          );
        }
      } catch (e: any) {
        console.error(`Error syncing user ${userId}:`, e.message || e);
      }
    }
  } catch (err) {
    console.error("Error in users sync block:", err);
  }

  // 4. Sync Components
  try {
    const componentIds = await realRedis.smembers(keys.componentsAll());
    console.log(`Syncing ${componentIds.length} components to Google Sheets...`);
    for (const id of componentIds) {
      try {
        const data = await realRedis.hgetall(keys.component(id));
        if (data && Object.keys(data).length > 0) {
          const sheetData = mapComponentToSpreadsheet(data);
          await writeToSheet("Components", "UPDATE", "Part Number", id, sheetData).catch(() =>
            writeToSheet("Components", "CREATE", "Part Number", id, sheetData)
          );
        }
      } catch (e: any) {
        console.error(`Error syncing component ${id}:`, e.message || e);
      }
    }
  } catch (err) {
    console.error("Error in components sync block:", err);
  }

  // 5. Sync Transactions
  try {
    const txIds = await realRedis.zrange(keys.transactionsAll(), 0, -1);
    console.log(`Syncing ${txIds.length} transactions to Google Sheets...`);
    for (const id of txIds) {
      try {
        const data = await realRedis.hgetall(keys.transaction(id as string));
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
          await writeToSheet("Transactions", "UPDATE", "id", id as string, sheetTx).catch(() =>
            writeToSheet("Transactions", "CREATE", "id", id as string, sheetTx)
          );
        }
      } catch (e: any) {
        console.error(`Error syncing transaction ${id}:`, e.message || e);
      }
    }
  } catch (err) {
    console.error("Error in transactions sync block:", err);
  }

  console.log("Full Redis to Google Sheets sync completed successfully!");
}

// Utility to sync all Google Sheets data to Redis (Populates/heals empty/corrupted Redis databases)
export async function syncAllSheetsToRedis() {
  console.log("Starting full Google Sheets to Redis sync...");
  const realRedis = getRedis();

  // 1. Sync Categories
  try {
    const categories = await fetchSheetData("Categories");
    for (const cat of categories) {
      if (cat.code) {
        await realRedis.hset(keys.category(cat.code), cat);
        await realRedis.sadd(keys.categoriesAll(), cat.code);
      }
    }
  } catch (err) {
    console.error("Error syncing categories from Sheets:", err);
  }

  // 2. Sync Boxes
  try {
    const boxes = await fetchSheetData("Boxes");
    for (const box of boxes) {
      const boxId = box["1ID"] || box["id"];
      if (boxId) {
        const mappedBox = {
          id: boxId,
          name: box["name"] || "",
          location: box["location"] || "",
          createdBy: box["createdBy"] || "",
          createdAt: box["createdAt"] || new Date().toISOString(),
          boxType: box["boxType"] || "GENERAL"
        };
        await realRedis.hset(keys.box(boxId), mappedBox);
        await realRedis.sadd(keys.boxesAll(), boxId);
      }
    }
  } catch (err) {
    console.error("Error syncing boxes from Sheets:", err);
  }

  // 3. Sync Users
  try {
    const users = await fetchSheetData("Users");
    for (const user of users) {
      if (user.userId) {
        const email = String(user.userId).toLowerCase();
        await realRedis.hset(keys.user(email), user);
        await realRedis.sadd(keys.usersAll(), email);
      }
    }
  } catch (err) {
    console.error("Error syncing users from Sheets:", err);
  }

  // 4. Sync Components
  try {
    const components = await fetchSheetData("Components");
    const categories = await realRedis.smembers(keys.categoriesAll());
    const categoryObjects: any[] = [];
    for (const code of categories) {
      const catObj = await realRedis.hgetall(keys.category(code));
      if (catObj) categoryObjects.push(catObj);
    }

    for (const comp of components) {
      const partNumber = comp["Part Number"];
      if (partNumber) {
        const category = comp["Category"] || "";
        const catObj = categoryObjects.find(c => String(c.code).toLowerCase() === String(category).toLowerCase());
        
        const mapped = {
          id: partNumber,
          name: comp["Name"] || "",
          category: category,
          categoryLabel: catObj ? String(catObj.label) : category,
          categoryColor: catObj ? String(catObj.color) : "#6366f1",
          quantity: Number(comp["Quantity"] || 0),
          boxId: comp["Box ID"] || "",
          boxName: comp["Box Name"] || "",
          description: comp["Description"] || "",
          addedBy: comp["Added By"] || "",
          createdAt: comp["Created At"] || new Date().toISOString(),
          updatedAt: comp["Created At"] || new Date().toISOString(),
        };
        await realRedis.hset(keys.component(partNumber), mapped);
        await realRedis.sadd(keys.componentsAll(), partNumber);
        if (category) {
          await realRedis.sadd(keys.componentsByCategory(category), partNumber);
        }
      }
    }
  } catch (err) {
    console.error("Error syncing components from Sheets:", err);
  }

  // 5. Sync Transactions
  try {
    const transactions = await fetchSheetData("Transactions");
    for (const tx of transactions) {
      if (tx.id) {
        const mappedTx = {
          id: tx.id,
          componentId: tx.componentId || "",
          componentName: tx.componentName || "",
          type: tx.type || "",
          quantityChange: Number(tx.quantityChange || 0),
          quantityAfter: Number(tx.quantityAfter || 0),
          performedBy: tx.performedBy || "",
          notes: tx["notes`````"] || tx["notes"] || "",
          timestamp: tx.timestamp || new Date().toISOString()
        };
        await realRedis.hset(keys.transaction(tx.id), mappedTx);
        const timestamp = new Date(mappedTx.timestamp).getTime();
        await realRedis.zadd(keys.transactionsAll(), { score: timestamp, member: tx.id });
        if (mappedTx.componentId) {
          await realRedis.zadd(keys.transactionsByComponent(mappedTx.componentId), { score: timestamp, member: tx.id });
        }
      }
    }
  } catch (err) {
    console.error("Error syncing transactions from Sheets:", err);
  }

  // 6. Heal and Restore Database Counters
  try {
    console.log("Healing database counters from synced data...");
    
    // Heal Box Counter
    const boxes = await realRedis.smembers(keys.boxesAll());
    let maxBoxNum = 0;
    for (const id of boxes) {
      const match = id.match(/BOX-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxBoxNum) maxBoxNum = num;
      }
    }
    if (maxBoxNum > 0) {
      await realRedis.set(keys.boxCounter(), maxBoxNum);
      console.log(`Restored box counter to: ${maxBoxNum}`);
    }

    // Heal User Counter
    const users = await realRedis.smembers(keys.usersAll());
    let maxUserNum = 0;
    for (const email of users) {
      const user = await realRedis.hgetall<any>(keys.user(email));
      if (user && user.internalId) {
        const match = user.internalId.match(/USR-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxUserNum) maxUserNum = num;
        }
      }
    }
    if (maxUserNum > 0) {
      await realRedis.set(keys.userCounter(), maxUserNum);
      console.log(`Restored user counter to: ${maxUserNum}`);
    }

    // Heal Component Counter
    const components = await realRedis.smembers(keys.componentsAll());
    const compCounters: { [key: string]: number } = {};
    for (const id of components) {
      const match = id.match(/^([^\/]+)\/(\d+)\/(\d+)$/);
      if (match) {
        const cat = match[1];
        const year = parseInt(match[2], 10);
        const num = parseInt(match[3], 10);
        const key = keys.counter(cat, year);
        if (!compCounters[key] || num > compCounters[key]) {
          compCounters[key] = num;
        }
      }
    }
    for (const key of Object.keys(compCounters)) {
      const maxVal = compCounters[key];
      await realRedis.set(key, maxVal);
      console.log(`Restored counter for ${key} to: ${maxVal}`);
    }
  } catch (err) {
    console.error("Error healing database counters:", err);
  }

  console.log("Full Google Sheets to Redis sync completed successfully!");
}
