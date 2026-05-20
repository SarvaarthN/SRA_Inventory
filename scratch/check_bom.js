const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const sheetsUsersUrl = process.env.GOOGLE_SCRIPT_URL_USERS;
const sheetsInventoryUrl = process.env.GOOGLE_SCRIPT_URL_INVENTORY;
const secretToken = process.env.DB_SECRET_TOKEN;

async function checkSheet(sheetName, url) {
  const fullUrl = `${url}?sheet=${encodeURIComponent(sheetName)}&token=${encodeURIComponent(secretToken || "")}`;
  console.log(`\n--- Headers for [${sheetName}] ---`);
  try {
    const res = await fetch(fullUrl);
    const data = await res.json();
    if (data.length > 0) {
      const keys = Object.keys(data[0]);
      console.log("Detected Keys:", keys);
    } else {
      console.log("No data returned.");
    }
  } catch (err) {
    console.error(`Failed to fetch ${sheetName}:`, err.message);
  }
}

async function run() {
  await checkSheet("Users", sheetsUsersUrl);
  await checkSheet("Categories", sheetsInventoryUrl);
  await checkSheet("Boxes", sheetsInventoryUrl);
  await checkSheet("Components", sheetsInventoryUrl);
  await checkSheet("Transactions", sheetsInventoryUrl);
}

run();
