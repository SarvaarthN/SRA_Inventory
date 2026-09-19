# SRA Inventory System

A shared record of everything the Student Robotics Association owns: what is in stock, where it is kept, and who took it.

## Contents

- [What this is for](#what-this-is-for)
- [Signing in](#signing-in)
- [What you can do](#what-you-can-do)
- [The sections](#the-sections)
- [Part numbers](#part-numbers)
- [Quick Add](#quick-add)
- [Invoice Upload](#invoice-upload)
- [Worth remembering](#worth-remembering)
- [Getting help](#getting-help)
- [Contributing](#contributing)

## What this is for

The club kept losing track of components. Parts disappeared after room cleaning sessions, nobody knew who had borrowed what, and items already sitting in a box were ordered again because no one could confirm they existed.

This site fixes that. Every component has a part number and an assigned box. Every time stock moves, the system records who moved it, how many, and when. If something goes missing there is always a record of who touched it last.

## Signing in

Go to the site and sign in with the user ID and password given to you by a club administrator. If you do not have an account, ask one of them to create it.

Sessions last seven days, so you will not have to sign in every visit. Use the sign out button in the top right if you are on a shared computer.

## What you can do

What you are allowed to do depends on your year.

| | SY | TY and LY |
| --- | --- | --- |
| View the inventory | Yes | Yes |
| Check items in and out | Yes | Yes |
| Add or edit components and boxes | No | Yes |
| Delete anything | No | Yes |

Some accounts also carry an administrator flag, which adds the ability to create and manage user accounts. Ask an existing administrator if you need this.

## The sections

Navigation sits along the top on a computer and along the bottom on a phone. Orders and Categories live under the menu button on a phone.

### Dashboard

The page you land on. It shows the state of the inventory at a glance: how many component types and total units exist, how many boxes there are, anything low or out of stock, a breakdown by category, and the last ten things that happened.

Start here if you want to know whether something is worth ordering.

### Check In/Out

The page you will use most. Search for a component, then record taking it out or bringing it back.

Taking something out requires your name and a quantity. Do this before you physically take the item, even if it is a single resistor. The log is the whole point: when something goes missing, it shows who had it last.

Returning something works the same way. Put the component back in its correct box afterwards. If you are not sure which box it belongs to, open the component's page and it will tell you.

### Components

Every component in the club, in one list.

The search box matches on name, part number, description, box name and box location, so you can look something up however you happen to remember it. The category buttons underneath narrow the list further.

Select Manage on any row to open that component. Its page shows the current quantity, which box it lives in and where that box is, its full history, and buttons to add stock, remove stock, move it to a different box, or delete it.

### Boxes

Every physical storage box, showing how many different components and how many total units each one holds. Open a box to see exactly what is inside it.

A box cannot be deleted while it still has components in it. Move or remove those first.

### Orders

Components that have been ordered from a vendor but have not arrived yet. An order records the vendor, order number, expected delivery date, cost and the list of items.

When the delivery turns up, open the order and mark it received. The system then creates the new components or adds to the existing ones automatically, so nothing has to be typed in twice.

### Categories

The list of component categories. The eight default ones are fixed. You can add your own with a code, a label and a colour.

The code becomes part of the part number of everything filed under it, and it cannot be changed afterwards, so keep it short and obvious. BATT for batteries, RF for radio modules. You can also create a category while adding a component, without coming here first.

### History

Every action anyone has ever taken: what was created, what moved in or out, what was deleted, who did it and when.

This is where to look when a count does not match reality.

### Manage Users

Administrators only. Create accounts, set each person's year, grant or remove the administrator flag, and delete accounts.

### Export CSV

In the navigation bar. Downloads the complete component list as a spreadsheet, which is useful for stock checks away from a screen.

## Part numbers

Every component gets a unique number when it is added:

```
CATEGORY / YEAR / SEQUENCE

SENS/2026/001    first sensor added in 2026
TOOL/2026/003    third tool added in 2026
DEVB/2027/001    first development board added in 2027
```

Numbering runs separately for each category and each year, so `SENS/2026/001` and `TOOL/2026/001` both exist and refer to different things.

Write the part number on the physical component's bag or container as soon as you add it. It is the fastest way to find something, and it means an item that gets moved during a clean up can still be identified.

## Quick Add

TY and LY members see a Quick Add button in the bottom right corner. It takes a plain description of what arrived instead of a form:

```
15 HC-SR04 sensors and 4 servo motors in the Workbench box
```

It checks what already exists first, so describing something the club already has adds to that stock rather than creating a duplicate entry. It will also create a box if you mention one that does not exist yet.

It tells you exactly what it did, and everything it does appears in History under your name, the same as if you had typed it in by hand. If it misreads you, correct it the normal way through the Components page.

## Invoice Upload

TY and LY members see an Upload Invoice button on the Components page. Upload a photo, scan or PDF of a vendor invoice and it reads off the item lines automatically, showing them in an editable list before anything is saved so you can fix a misread name or quantity first.

Confirming creates a single new box named after the vendor and the date, for example `Robu.in_2026-09-19`, with every item on the invoice added to it as a new component. Keeping a delivery in its own box, rather than mixed into general storage, is exactly what [INVENTORY_GUIDE.md](INVENTORY_GUIDE.md)'s delivery procedure asks for.

## Worth remembering

Record the transaction before you physically move the item, not afterwards. Doing it later is how entries get forgotten.

Put things back in the box they came from. If the right box is unclear, the component's page shows where it belongs.

Label the physical item with its part number, and label every box with its ID, name and location. A labelled item that gets moved can be put back. An unlabelled one becomes someone else's problem.

When a delivery arrives, enter it into the system before anything goes into project storage.

The club's full operating procedure, including how to handle deliveries and room cleaning sessions, is in [INVENTORY_GUIDE.md](INVENTORY_GUIDE.md).

## Getting help

If something looks wrong, check History first. It usually explains what happened.

If a count is genuinely incorrect, correct it through the component's page with a note saying why, so the next person can see what was done.

For anything else, ask a club administrator.

## Contributing

If you want to work on the site itself, read [CONTRIBUTING.md](CONTRIBUTING.md). It covers local setup, the project structure, the testing requirements and how to open a pull request.
