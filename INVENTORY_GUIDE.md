# SRA Inventory System - Guide

## Table of Contents

1. [Overview](#overview)
2. [Website Sections](#website-sections)
3. [Step-by-Step Workflows](#step-by-step-workflows)
   - [Creating a Box](#creating-a-box)
   - [Adding a New Component](#adding-a-new-component)
   - [Adding Stock to an Existing Component](#adding-stock-to-an-existing-component)
   - [Checking Out a Component](#checking-out-a-component)
   - [Returning a Component](#returning-a-component)
   - [Adding a New Category](#adding-a-new-category)
4. [Part Number System](#part-number-system)
5. [Inventory Maintenance Protocol](#inventory-maintenance-protocol)
   - [The Problem](#the-problem)
   - [Standard Operating Procedure](#standard-operating-procedure)
   - [Room Cleaning Protocol](#room-cleaning-protocol)

---

## Overview

The SRA Inventory System tracks all club components and tools. It records what is in stock, where each item is stored, who added it, and who has taken it out. Every action is logged so there is always a clear history of what happened and who was responsible.

The system is accessible from any device through the browser. No login is required.

---

## Website Sections

### Dashboard

The landing page. Shows a summary of the entire inventory:

- Total number of component types and total units across all of them
- Number of storage boxes
- Low stock and out-of-stock alerts
- Breakdown of components by category
- Recent activity feed showing the last 10 transactions

Use the **Check In/Out** button here to go directly to the most common workflow.

### Check In/Out

The primary day-to-day page. Used whenever someone takes a component or returns one. Search for any component and record the transaction in under 30 seconds.

### Components

A full list of every component in the inventory. Supports search by name, part number, box name, or description. Can be filtered by category. Click **Manage** on any row to see full details, history, and perform actions on that specific component.

### Boxes

Lists all physical storage boxes. Each box shows how many component types it contains and the total number of units. Click any box to see exactly what is inside it.

### Categories

Manage the component category list. Default categories are locked. Custom categories can be added here with a chosen color label. New categories can also be added inline while creating a component without visiting this page separately.

### History

A full audit log of every action ever performed. Shows who did what, when, and by how much the stock changed. 

---

## Step-by-Step Workflows

### Creating a Box

A box must exist before a component can be assigned to it.

1. Go to **Boxes** in the navigation
2. Click **New Box**
3. Fill in:
   - **Box Name** - a clear, descriptive name (e.g. "Sensors Box A", "Tools Shelf 2")
   - **Location** - where the box physically is (e.g. "Cabinet 3, Shelf 2, Room 101")
   - **Your Name** - who is creating this box
4. Click **Create Box**

The box is assigned an ID automatically (BOX-001, BOX-002, etc.).

Label the physical box with its ID and name immediately after creating it.

---

### Adding a New Component

Use this when a component is being entered into the system for the first time.

1. Go to **Components** and click **Add Component**, or use the button on the Dashboard
2. Select the **Create New** tab
3. Fill in:
   - **Component Name** - be specific (e.g. "DHT11 Temperature Sensor", not just "Sensor")
   - **Category** - select the appropriate category; if none fits, use the **New Category** button
   - **Description** - optional but recommended. Include specs, model number, or project context
   - **Initial Stock Quantity** - how many units are being entered right now
   - **Storage Box** - start typing the box name to search. Select the box where this component will be kept. If the box does not exist yet, create it first
   - **Your Name** - who is adding this to the inventory
4. Click **Create Component**

A part number is assigned automatically in the format `CATEGORY/YEAR/NUMBER` (e.g. `SENS/2026/003`).

Write this part number on the physical component bag or container.

---

### Adding Stock to an Existing Component

Use this when more units of an already-registered component arrive (e.g. a reorder comes in).

1. Go to **Components** and click **Add Component**
2. Stay on the **Add to Existing** tab (selected by default)
3. Type the component name in the search box. Matching components appear as you type
4. Click the correct component to select it
5. Fill in:
   - **Quantity to Add** - number of new units being added
   - **Storage Box** - where the new stock is being placed (may be the same or different box)
   - **Your Name**
   - **Notes** - optional, e.g. "Restocked from XYZ supplier"
6. Click **Add to Stock**

The stock count updates immediately and the action is logged in History.

---

### Checking Out a Component

Use this whenever someone takes a component from the room for use in a project or to take home.

1. Go to **Check In/Out** in the navigation
2. Type the component name, part number, or category in the search box
3. Find the component in the results
4. Click the **Out** button on that component's card
5. An inline form appears. Fill in:
   - **Quantity** - how many units are being taken
   - **Your Name** - who is taking it (mandatory)
   - **Notes** - optional but recommended. E.g. "For Line Follower project", "Taking home to test"
6. Click **Confirm Check Out**

The stock count decreases immediately. The transaction is logged with your name, the quantity, and the timestamp.

If the stock shows 0, the Out button is disabled. Contact the person who last checked it out if you need it.

---

### Returning a Component

Use this when someone brings a component back, whether from home or from a project that is done.

1. Go to **Check In/Out**
2. Search for the component
3. Click the **In** button on the card
4. Fill in:
   - **Quantity** - how many units are being returned
   - **Your Name**
   - **Notes** - optional, e.g. "Returned after Line Follower demo"
5. Click **Confirm Check In**

---

### Adding a New Category

If a component type does not fit any existing category:

**Method 1 - Inline (while creating a component):**

On the Create New component form, click **New Category** next to the category heading. A dialog opens to enter the code, label, and color. The new category is immediately available for selection.

**Method 2 - Categories page:**

Go to **Categories** in the navigation, fill in the form at the bottom, and click **Create Category**.

Category codes appear in part numbers. Keep them short and clear (e.g. BATT for batteries, RF for RF modules). Once created, a category code cannot be changed, so choose carefully.

---

## Part Number System

Every component gets a unique part number on creation:

```
CATEGORY / YEAR / SEQUENCE NUMBER

Examples:
SENS/2026/001   - First sensor added in 2026
TOOL/2026/003   - Third tool added in 2026
DEVB/2027/001   - First dev board added in 2027
```

The year and sequence number are assigned automatically. The category prefix comes from whichever category is selected. Numbers reset per category per year, so SENS/2026/001 and TOOL/2026/001 can both exist.

Write this number on the physical item's bag or container. It is the fastest way to look something up in the system.

---

## Inventory Maintenance Protocol

### The Problem

The club has faced recurring issues with inventory:

- Components go missing, especially after room-cleaning sessions where items get moved without being tracked
- SMD components and other small parts from multiple projects have been mixed into single boxes, making it difficult to identify ownership and causing reorders of items that were already in stock
- There is no consistent checkout or check-in process, so it is unclear who has taken what
- Items arrive but are not entered into the inventory promptly, so the system does not reflect reality

### Standard Operating Procedure

**When a delivery arrives:**

1. Do not open the package and put it somewhere random
2. Keep the package in the designated delivery area until the owner claims it
3. The owner must be present or be notified immediately on arrival
4. The owner opens the package and enters every component into the inventory system before moving anything to project storage
5. Each component bag or container must be physically labelled with its part number
6. Only after steps 3 to 5 are complete should the items move to the project's storage box

**When taking a component:**

1. Go to Check In/Out on the website
2. Find the component and click Out
3. Enter your name and the quantity
4. Then physically take the component

This applies even if you are taking one resistor. The log exists so that when something goes missing, there is a clear record of the last person who touched it.

**When returning a component:**

1. Go to Check In/Out
2. Find the component and click In
3. Enter your name and the quantity
4. Place the component back in its correct box

Do not put a component back in a random box. If the component's assigned box is unclear, check the component's detail page which shows the box it was last assigned to.

**Project-wise storage:**

- Every active project should have its own labelled box or bin
- Components assigned to a project should be stored in that project's box, not the general inventory boxes
- When a project concludes, components that are no longer needed should be returned to inventory via a Check In transaction, and the component's box assignment can be updated accordingly
- Cross-project mixing should be avoided. If two projects share a component type, each project should have its own separately tracked quantity

**Labelling standard:**

Every physical box must have a label showing:
- Box ID (e.g. BOX-003)
- Box name
- Location

Every component bag or container must have a label showing:
- Part number (e.g. SENS/2026/007)
- Component name

This ensures that even if something is moved during cleaning, it can be identified and returned to the right place.

### Room Cleaning Protocol

During any room-cleaning session:

1. All boxes must be moved to a single designated area, not scattered across shelves or tables
2. No box should be opened and its contents mixed with another box during cleaning
3. After cleaning, each box goes back to its designated location (written on the label)
4. If a component is found loose without a label or box, it should be placed in a "Found Items" box and logged in a group chat so the owner can claim it and re-enter it into the system properly
5. After every cleaning session, one person should do a quick check on the inventory system to confirm that the stock counts still look reasonable

Following this protocol means that cleaning sessions, which have historically caused the most inventory confusion, do not result in lost or mixed components.

---