const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const usersUrl = process.env.GOOGLE_SCRIPT_URL_USERS;
const inventoryUrl = process.env.GOOGLE_SCRIPT_URL_INVENTORY;
const secretToken = process.env.DB_SECRET_TOKEN;

console.log("=== SRA Inventory Comprehensive Sheets Check ===");
console.log("Users URL:", usersUrl);
console.log("Inventory URL:", inventoryUrl);
console.log("Secret Token:", secretToken);

async function testSheet(sheetName, url) {
  const fullUrl = `${url}?sheet=${encodeURIComponent(sheetName)}&token=${encodeURIComponent(secretToken || "")}`;
  console.log(`\nTesting table [${sheetName}]...`);
  try {
    const start = Date.now();
    const res = await fetch(fullUrl);
    const duration = Date.now() - start;
    console.log(`  -> Status: ${res.status} (took ${duration}ms)`);
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);  
      if (parsed.error) {
        console.log(`  -> Error returned: ${parsed.error}`);
      } else {
        console.log(`  -> Success! Found ${parsed.length} rows.`);
        if (parsed.length > 0) {
          console.log(`  -> First row sample:`, JSON.stringify(parsed[0]));
        }
      }
    } catch (e) {
      console.log(`  -> Invalid JSON Response. Raw first 100 chars:`, text.substring(0, 100));
    }
  } catch (err) {
    console.error(`  -> Fetch failed:`, err.message);
  }
}

async function runAll() {
  if (!usersUrl || !inventoryUrl) {
    console.error("Missing URLs in .env.local!");
    process.exit(1);
  }

  // Check Users (Spreadsheet 1)
  await testSheet("Users", usersUrl);

  // Check Inventory Tabs (Spreadsheet 2)
  await testSheet("Components", inventoryUrl);
  await testSheet("Boxes", inventoryUrl);
  await testSheet("Categories", inventoryUrl);
  await testSheet("Transactions", inventoryUrl);
}

runAll();
