/**
 * SRA Inventory Sheet-to-Upstash Real-Time Sync Script
 * 
 * INSTRUCTIONS:
 * 1. Open your Google Spreadsheet.
 * 2. Click on "Extensions" -> "Apps Script".
 * 3. Delete any code in the editor, and paste this entire script.
 * 4. Click the "Save" icon (or Ctrl+S).
 * 5. Refresh your Google Spreadsheet. You will see a new menu: "SRA Inventory".
 * 6. Click "SRA Inventory" -> "Authorize & Sync to Upstash Database".
 */

const UPSTASH_URL = "https://normal-parakeet-129345.upstash.io";
const UPSTASH_TOKEN = "gQAAAAAAAflBAAIgcDE5NTA3ZDllOWJmM2M0YTJkYjMyYTMwODJlNWNhNmMwYQ";

/**
 * Creates a custom menu in the Google Spreadsheet toolbar.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('SRA Inventory')
    .addItem('Sync to Upstash Database', 'syncAllSheetsToUpstash')
    .addToUi();
}

/**
 * Main function to sync all Google Sheets tabs to Upstash Redis in a high-performance pipeline.
 */
function syncAllSheetsToUpstash() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const pipeline = [];

  // Helper to push a command to pipeline
  function addCommand(cmd) {
    pipeline.push(cmd);
  }

  // --- 1. SYNC CATEGORIES ---
  const catSheet = ss.getSheetByName("Categories");
  const catMap = {}; // Used for component category label mapping
  if (catSheet) {
    const data = getSheetRows(catSheet);
    data.forEach(row => {
      const code = String(row["code"] || "").trim().toUpperCase();
      if (code) {
        catMap[code] = {
          label: row["label"] || code,
          color: row["color"] || "#6366f1"
        };
        const catData = {
          code: code,
          label: row["label"] || "",
          color: row["color"] || "",
          isDefault: String(row["isDefault"] || "false"),
          createdAt: String(row["createdAt"] || new Date().toISOString())
        };
        addCommand(["HMSET", `category:${code}`, ...objectToFlatArray(catData)]);
        addCommand(["SADD", "categories:all", code]);
      }
    });
  }

  // --- 2. SYNC BOXES ---
  const boxSheet = ss.getSheetByName("Boxes");
  if (boxSheet) {
    const data = getSheetRows(boxSheet);
    data.forEach(row => {
      const id = String(row["1ID"] || row["id"] || "").trim();
      if (id) {
        const boxData = {
          id: id,
          name: row["name"] || "",
          location: row["location"] || "",
          createdBy: row["createdBy"] || "",
          createdAt: String(row["createdAt"] || new Date().toISOString()),
          boxType: row["boxType"] || "GENERAL"
        };
        addCommand(["HMSET", `box:${id}`, ...objectToFlatArray(boxData)]);
        addCommand(["SADD", "boxes:all", id]);
      }
    });
  }

  // --- 3. SYNC USERS ---
  const userSheet = ss.getSheetByName("Users");
  if (userSheet) {
    const data = getSheetRows(userSheet);
    data.forEach(row => {
      const email = String(row["userId"] || "").trim().toLowerCase();
      if (email) {
        const userData = {
          userId: email,
          name: row["name"] || "",
          year: row["year"] || "",
          isAdmin: String(row["isAdmin"] || "false"),
          internalId: row["internalId"] || ""
        };
        addCommand(["HMSET", `user:${email}`, ...objectToFlatArray(userData)]);
        addCommand(["SADD", "users:all", email]);
      }
    });
  }

  // --- 4. SYNC COMPONENTS ---
  const compSheet = ss.getSheetByName("Components");
  if (compSheet) {
    const data = getSheetRows(compSheet);
    data.forEach(row => {
      const partNumber = String(row["Part Number"] || "").trim();
      if (partNumber) {
        const catCode = String(row["Category"] || "").trim().toUpperCase();
        const catInfo = catMap[catCode] || { label: catCode, color: "#6366f1" };
        
        const compData = {
          id: partNumber,
          name: row["Name"] || "",
          category: catCode,
          categoryLabel: catInfo.label,
          categoryColor: catInfo.color,
          quantity: String(Number(row["Quantity"] || 0)),
          boxId: row["Box ID"] || "",
          boxName: row["Box Name"] || "",
          description: row["Description"] || "",
          addedBy: row["Added By"] || "",
          createdAt: String(row["Created At"] || new Date().toISOString()),
          updatedAt: String(row["Created At"] || new Date().toISOString())
        };
        
        addCommand(["HMSET", `component:${partNumber}`, ...objectToFlatArray(compData)]);
        addCommand(["SADD", "components:all", partNumber]);
        if (catCode) {
          addCommand(["SADD", `components:cat:${catCode}`, partNumber]);
        }
      }
    });
  }

  // --- 5. SYNC TRANSACTIONS ---
  const txSheet = ss.getSheetByName("Transactions");
  if (txSheet) {
    const data = getSheetRows(txSheet);
    data.forEach(row => {
      const id = String(row["id"] || "").trim();
      if (id) {
        const timestampStr = row["timestamp"] || new Date().toISOString();
        const timestamp = new Date(timestampStr).getTime() || Date.now();
        const notes = row["notes`````"] || row["notes"] || "";
        
        const txData = {
          id: id,
          componentId: row["componentId"] || "",
          componentName: row["componentName"] || "",
          type: row["type"] || "",
          quantityChange: String(Number(row["quantityChange"] || 0)),
          quantityAfter: String(Number(row["quantityAfter"] || 0)),
          performedBy: row["performedBy"] || "",
          notes: notes,
          timestamp: String(timestampStr)
        };
        
        addCommand(["HMSET", `tx:${id}`, ...objectToFlatArray(txData)]);
        addCommand(["ZADD", "tx:all", String(timestamp), id]);
        if (txData.componentId) {
          addCommand(["ZADD", `tx:comp:${txData.componentId}`, String(timestamp), id]);
        }
      }
    });
  }

  if (pipeline.length === 0) {
    ui.alert("Sync Aborted", "No sheets or rows found to synchronize.", ui.ButtonSet.OK);
    return;
  }

  // Execute Upstash Pipeline POST request
  try {
    const response = UrlFetchApp.fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(pipeline),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const text = response.getContentText();
    const result = JSON.parse(text);

    if (code !== 200) {
      throw new Error(`HTTP ${code}: ${text}`);
    }

    // Verify pipeline results for any errors
    let errorCount = 0;
    result.forEach((res, i) => {
      if (res.error) {
        errorCount++;
        console.error(`Pipeline command ${i} failed:`, res.error);
      }
    });

    if (errorCount > 0) {
      ui.alert("Sync Finished with Warnings", `Successfully executed ${pipeline.length - errorCount} commands, but ${errorCount} failed. Check Apps Script logs.`, ui.ButtonSet.OK);
    } else {
      ui.alert("Sync Successful!", `Successfully synced all ${pipeline.length / 2} entities directly to Upstash Redis database!`, ui.ButtonSet.OK);
    }
  } catch (err) {
    ui.alert("Sync Failed", `Error uploading database to Upstash Redis:\n${err.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Real-Time onEdit listener.
 * Whenever any quantity, name, box ID, etc. is changed in your spreadsheet,
 * it immediately pushes that updated row to your Upstash Redis database!
 */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const rowNum = range.getRow();
  
  // Ignore header edits
  if (rowNum === 1) return;

  const validSheets = ["Categories", "Boxes", "Users", "Components", "Transactions"];
  if (!validSheets.includes(sheetName)) return;

  // Retrieve the full row data
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowValues = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const rowObj = {};
  headers.forEach((h, index) => {
    if (h) rowObj[h] = rowValues[index];
  });

  let key = "";
  let dataToPush = {};
  let setAllKey = "";
  let setMember = "";

  if (sheetName === "Categories") {
    const code = String(rowObj["code"] || "").trim().toUpperCase();
    if (!code) return;
    key = `category:${code}`;
    setAllKey = "categories:all";
    setMember = code;
    dataToPush = {
      code: code,
      label: rowObj["label"] || "",
      color: rowObj["color"] || "",
      isDefault: String(rowObj["isDefault"] || "false"),
      createdAt: String(rowObj["createdAt"] || new Date().toISOString())
    };
  } else if (sheetName === "Boxes") {
    const id = String(rowObj["1ID"] || rowObj["id"] || "").trim();
    if (!id) return;
    key = `box:${id}`;
    setAllKey = "boxes:all";
    setMember = id;
    dataToPush = {
      id: id,
      name: rowObj["name"] || "",
      location: rowObj["location"] || "",
      createdBy: rowObj["createdBy"] || "",
      createdAt: String(rowObj["createdAt"] || new Date().toISOString()),
      boxType: rowObj["boxType"] || "GENERAL"
    };
  } else if (sheetName === "Users") {
    const email = String(rowObj["userId"] || "").trim().toLowerCase();
    if (!email) return;
    key = `user:${email}`;
    setAllKey = "users:all";
    setMember = email;
    dataToPush = {
      userId: email,
      name: rowObj["name"] || "",
      year: rowObj["year"] || "",
      isAdmin: String(rowObj["isAdmin"] || "false"),
      internalId: rowObj["internalId"] || ""
    };
  } else if (sheetName === "Components") {
    const partNumber = String(rowObj["Part Number"] || "").trim();
    if (!partNumber) return;
    key = `component:${partNumber}`;
    setAllKey = "components:all";
    setMember = partNumber;
    
    // Asynchronously resolve category label/color
    let catLabel = String(rowObj["Category"] || "");
    let catColor = "#6366f1";
    
    dataToPush = {
      id: partNumber,
      name: rowObj["Name"] || "",
      category: String(rowObj["Category"] || "").trim().toUpperCase(),
      categoryLabel: catLabel,
      categoryColor: catColor,
      quantity: String(Number(rowObj["Quantity"] || 0)),
      boxId: rowObj["Box ID"] || "",
      boxName: rowObj["Box Name"] || "",
      description: rowObj["Description"] || "",
      addedBy: rowObj["Added By"] || "",
      createdAt: String(rowObj["Created At"] || new Date().toISOString()),
      updatedAt: String(new Date().toISOString())
    };
  } else if (sheetName === "Transactions") {
    const id = String(rowObj["id"] || "").trim();
    if (!id) return;
    key = `tx:${id}`;
    const timestampStr = rowObj["timestamp"] || new Date().toISOString();
    const timestamp = new Date(timestampStr).getTime() || Date.now();
    
    dataToPush = {
      id: id,
      componentId: rowObj["componentId"] || "",
      componentName: rowObj["componentName"] || "",
      type: rowObj["type"] || "",
      quantityChange: String(Number(rowObj["quantityChange"] || 0)),
      quantityAfter: String(Number(rowObj["quantityAfter"] || 0)),
      performedBy: rowObj["performedBy"] || "",
      notes: rowObj["notes`````"] || rowObj["notes"] || "",
      timestamp: String(timestampStr)
    };

    // Execute single Sorted Set command
    try {
      UrlFetchApp.fetch(`${UPSTASH_URL}/`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` },
        payload: JSON.stringify(["ZADD", "tx:all", String(timestamp), id])
      });
      if (dataToPush.componentId) {
        UrlFetchApp.fetch(`${UPSTASH_URL}/`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` },
          payload: JSON.stringify(["ZADD", `tx:comp:${dataToPush.componentId}`, String(timestamp), id])
        });
      }
    } catch(e) {}
  }

  // Push single row update to Upstash
  try {
    UrlFetchApp.fetch(`${UPSTASH_URL}/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(["HMSET", key, ...objectToFlatArray(dataToPush)]),
      muteHttpExceptions: true
    });
    
    if (setAllKey && setMember) {
      UrlFetchApp.fetch(`${UPSTASH_URL}/`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${UPSTASH_TOKEN}` },
        payload: JSON.stringify(["SADD", setAllKey, setMember])
      });
    }
  } catch (err) {
    console.error("Real-time edit sync failed:", err.message);
  }
}

/**
 * Utility: Converts a flat object into [key1, value1, key2, value2, ...] representation.
 */
function objectToFlatArray(obj) {
  const arr = [];
  for (const k in obj) {
    arr.push(k, String(obj[k] ?? ""));
  }
  return arr;
}

/**
 * Utility: Fetches all rows from a spreadsheet tab and maps them to JSON objects.
 */
function getSheetRows(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return [];
  
  const headers = values[0];
  const list = [];
  for (let i = 1; i < values.length; i++) {
    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = values[i][j];
    }
    list.push(rowObj);
  }
  return list;
}
