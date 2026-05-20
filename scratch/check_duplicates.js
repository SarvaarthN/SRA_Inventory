const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const sheetsInventoryUrl = process.env.GOOGLE_SCRIPT_URL_INVENTORY;
const secretToken = process.env.DB_SECRET_TOKEN;

async function check() {
  const fullUrl = `${sheetsInventoryUrl}?sheet=Components&token=${encodeURIComponent(secretToken || "")}`;
  try {
    const res = await fetch(fullUrl);
    const data = await res.json();
    const seen = {};
    const duplicates = [];
    
    data.forEach((row, index) => {
      const partNumber = row["Part Number"];
      if (partNumber) {
        if (seen[partNumber]) {
          duplicates.push({
            partNumber,
            firstIndex: seen[partNumber].index,
            firstRow: seen[partNumber].row,
            duplicateIndex: index,
            duplicateRow: row
          });
        } else {
          seen[partNumber] = { index, row };
        }
      }
    });

    console.log("=== Google Sheets Duplicate Audit ===");
    console.log(`Total components read: ${data.length}`);
    console.log(`Duplicate component part numbers found: ${duplicates.length}`);
    if (duplicates.length > 0) {
      duplicates.forEach(d => {
        console.log(`\nDuplicate: ${d.partNumber}`);
        console.log(`  Row ${d.firstIndex + 2}: Qty = ${d.firstRow["Quantity"]}, Box = ${d.firstRow["Box ID"]}`);
        console.log(`  Row ${d.duplicateIndex + 2}: Qty = ${d.duplicateRow["Quantity"]}, Box = ${d.duplicateRow["Box ID"]}`);
      });
    }
  } catch (err) {
    console.error("Duplicate audit failed:", err.message);
  }
}

check();
