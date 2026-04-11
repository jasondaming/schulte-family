# Schulte Family Directory

A private family contact directory and family tree, hosted on GitHub Pages with data stored in a private Google Sheet.

## How It Works

- **Website** (public GitHub repo) — hosted on GitHub Pages, contains no personal data
- **Data** (private Google Sheet) — person-centric format, one row per person
- **Login** — family members sign in with first name + birthday
- **Edit** — users can update contact info for themselves, their spouse, and their children
- **Admin** — admins can edit anyone, add/remove people, and manage reunion info

## Data Format

Every individual has their own row, linked by relationships:

| Field | Purpose |
|-------|---------|
| PersonID | Unique identifier (immutable) |
| SpouseID | Links to spouse's PersonID |
| ParentID | Links to Schulte-bloodline parent's PersonID |
| Generation | 0=Gus & Almeda, 1=the 12 siblings, 2=their children, etc. |
| Branch | Which sibling branch (e.g., "Phyllis Daming", "Herb Schulte") |

Married-in spouses have blank ParentID — they connect to the tree through SpouseID.

## Family Structure

The family descends from **Gus & Almeda Schulte** (Generation 0), whose 12 children form the top-level branches:

| ID | Name | Branch |
|----|------|--------|
| 0 | Sylvia (& Charlie) Goffinet | Sylvia Goffinet |
| 1 | Doris Young | Doris Young |
| 2 | Phyllis (& Carlos) Daming | Phyllis Daming |
| 3 | Janice (& Bill) Daming | Janice Daming |
| 3a | Pete Schulte (deceased) | Pete Schulte |
| 4 | Don & Ann Schulte | Don Schulte |
| 5 | John & Mary Ann Schulte | John Schulte |
| 6 | Herb & Peggy Schulte | Herb Schulte |
| 7 | Kathy & Ronnie Kluemper | Kathy Kluemper |
| 8 | Connie & Dave Pierce | Connie Pierce |
| 9 | Cindy & Chuck Painter | Cindy Painter |
| 10 | Paul Schulte | Paul Schulte |

## Features

- **Directory** — searchable contact cards grouped by household, with tap-to-call and tap-to-email
- **Upcoming Birthdays** — sorted list showing name, date, turning age, and days until
- **Family Tree** — card-based visual tree with expand/collapse, click-drag panning, branch colors, and click-for-details tooltips
- **Tree navigation** — click the tree icon on any directory card to jump to that person in the tree
- **Edit Profile** — update contact info for yourself, your spouse, and dependent children
- **Add/Remove People** — add new children, record death or divorce (removes/unlinks married-in spouses)
- **Life Events** — record births, deaths, marriages, moves, and other milestones
- **Reunion Page** — event info, schedule, and food signup for family gatherings
- **Admin Panel** — search/edit any person, add people under any parent, view changelog
- **Print Directory** — print-friendly layout
- **Mobile-friendly** — responsive design

## Security

- Auth tokens are bound to immutable PersonID (not row index), so row deletions don't cause identity drift
- Users can only edit themselves, their spouse, and their children
- Admins can edit anyone and manage the directory
- All changes are logged to a Changelog sheet with before/after values
- Deceased persons cannot log in

## Setup Guide

### Step 1: Convert the Excel file

```bash
pip install pandas xlrd
python tools/convert_to_people.py "path/to/DATABASE, SCHULTE.xls"
```

This creates `schulte_people.csv` with all people and relationships pre-linked.

### Step 2: Import into Google Sheets

1. Create a new Google Sheet
2. File > Import > Upload `schulte_people.csv`
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
