const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../env.local') });

const usersUrl = process.env.GOOGLE_SCRIPT_URL_USERS;
const secretToken = process.env.DB_SECRET_TOKEN;

console.log("=== Google Sheets Diagnostic ===");
console.log("Users URL:", usersUrl);
console.log("Secret Token:", secretToken);

if (!usersUrl) {
  console.error("Error: GOOGLE_SCRIPT_URL_USERS is not set in env.local");
  process.exit(1);
}

async function testFetch() {
  const fullUrl = `${usersUrl}?sheet=Users&token=${encodeURIComponent(secretToken || "")}`;
  console.log("\nAttempting to fetch from:", fullUrl);

  try {
    const res = await fetch(fullUrl);
    console.log("Response Status:", res.status);
    
    const text = await res.text();
    console.log("Raw Response:", text);
    
    try {
      const data = JSON.parse(text);
      console.log("\nParsed Data:", JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("\nFailed to parse JSON. Response is not valid JSON.");
    }
  } catch (error) {
    console.error("Connection failed:", error.message);
  }
}

testFetch();
