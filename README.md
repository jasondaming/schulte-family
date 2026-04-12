# Schulte Family Directory

A private family contact directory and family tree, hosted on GitHub Pages with data stored in a private Google Sheet.

## How It Works

- **Website** (public GitHub repo) — hosted on GitHub Pages, contains no personal data
- **Data** (private Google Sheet) — person-centric format, one row per person
- **Login** — family members sign in with first name + birthday
- **Edit** — users can update info for themselves, their spouse, and their children
- **Admin** — admins can edit anyone, add/remove people, and manage reunion info

## Data Format

Every individual has their own row, linked by relationships:

| Field | Purpose |
|-------|---------|
| PersonID | Unique identifier (immutable) |
| SpouseID | Links to spouse's PersonID |
| ParentID | Links to bloodline parent's PersonID |
| Generation | 0=root couple, 1=their children, 2=grandchildren, etc. |
| Branch | Which top-level sibling branch |

Married-in spouses have blank ParentID — they connect to the tree through SpouseID.

## Family Structure

Generation 0 is the root couple. Their children (Generation 1) form the top-level branches. Each branch is named after the bloodline sibling. The tree supports 5+ generations with expand/collapse navigation.

## Features

- **Directory** — searchable contact cards grouped by household, with tap-to-call and tap-to-email
- **Children links** — all children listed on parent cards, clickable to scroll to their card
- **Upcoming Birthdays** — sorted list showing name, date, turning age, and days until
- **Family Tree** — card-based visual tree with expand/collapse, click-drag panning, branch colors, and click-for-details tooltips
- **Tree navigation** — click the tree icon on any directory card to jump to that person in the tree
- **Edit Profile** — update name, contact info, birthday, anniversary for yourself, spouse, and children
- **Add/Remove People** — add children, add spouse, record death or divorce
- **Life Events** — record births, deaths, marriages, moves, and other milestones
- **Reunion Page** — event info, schedule, and food signup for family gatherings
- **Admin Panel** — search/edit any person, add people under any parent, add spouses, view changelog
- **Deceased handling** — deceased shown with cross (✝) and greyed styling, kept in records
- **Different last names** — couples with different surnames displayed correctly
- **Print Directory** — print-friendly layout
- **Mobile-friendly** — responsive design

## Security

- Auth tokens are bound to immutable PersonID (not row index), so row deletions don't cause identity drift
- Users can only edit themselves, their spouse, and their children
- Admins can edit anyone and manage the directory
- All changes are logged to a Changelog sheet with before/after values
- Deceased persons cannot log in

## Setup Guide

### Step 1: Convert the source data

```bash
pip install pandas xlrd
python tools/convert_to_people.py "path/to/source.xls"
```

This creates a CSV with all people and relationships pre-linked.

### Step 2: Import into Google Sheets

1. Create a new Google Sheet
2. File > Import > Upload the CSV
3. **Rename the tab to "People"**
4. Add column T header: **IsAdmin** — put "Y" for admin users
5. Review the data

### Step 3: Deploy the Google Apps Script

1. In the Sheet: **Extensions > Apps Script**
2. Paste contents of `apps-script/Code.gs`
3. Set `SHEET_ID` (from your sheet URL) and change `TOKEN_SECRET`
4. **Deploy > New deployment > Web app** (Execute as: Me, Access: Anyone)
5. Copy the deployment URL

The script auto-creates additional sheet tabs as needed: LifeEvents, Changelog, Reunion, FoodSignup.

### Step 4: Set up the website

1. Push this repo to GitHub, enable GitHub Pages
2. Visit the site, open browser console (F12), run:
   ```js
   setApiUrl("https://script.google.com/macros/s/YOUR_ID/exec")
   ```

## Google Sheet Tabs

| Tab | Purpose | Auto-created |
|-----|---------|:---:|
| People | Main directory (one row per person) | No |
| LifeEvents | Birth, death, marriage records | Yes |
| Changelog | Audit log of all edits | Yes |
| Reunion | Admin-managed event info/schedule | Yes |
| FoodSignup | Potluck dish signups | Yes |

## Tech Stack

- Vanilla HTML/CSS/JavaScript (no framework, no build step)
- Google Sheets as database
- Google Apps Script as API backend
- GitHub Pages for hosting
- Cost: $0 (or ~$12/year with a custom domain)
