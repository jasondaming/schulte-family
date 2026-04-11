# Schulte Family Directory

A private family contact directory and family tree, hosted free on GitHub Pages with data stored in a private Google Sheet.

## How It Works

- **Website** (public GitHub repo) — hosted on GitHub Pages, contains no personal data
- **Data** (private Google Sheet) — person-centric format, one row per person
- **Login** — family members sign in with first name + birthday
- **Edit** — logged-in users can update their own address, phone, and email

## Data Format

The data is **person-centric** — every individual has their own row, linked by relationships:

| Field | Purpose |
|-------|---------|
| PersonID | Unique identifier |
| SpouseID | Links to spouse's PersonID |
| ParentID | Links to Schulte-bloodline parent's PersonID |
| Generation | 0=root, 1=siblings, 2=their children, 3=grandchildren... |
| Branch | Which original sibling branch (e.g., "Phyllis Daming") |

Married-in spouses have blank ParentID — they connect to the tree through SpouseID.

## Setup Guide

### Step 1: Convert the Excel file

```bash
pip install pandas xlrd
python tools/convert_to_people.py "path/to/DATABASE, SCHULTE.xls"
```

This creates `schulte_people.csv` — 305 people with relationships pre-linked.

### Step 2: Import into Google Sheets

1. Create a new Google Sheet
2. File > Import > Upload `schulte_people.csv`
3. **Rename the tab to "People"**
4. Review the data — the conversion script handles most relationships automatically

### Step 3: Deploy the Google Apps Script

1. In the Sheet: **Extensions > Apps Script**
2. Paste contents of `apps-script/Code.gs`
3. Set `SHEET_ID` (from your sheet URL) and change `TOKEN_SECRET`
4. **Deploy > New deployment > Web app** (Execute as: Me, Access: Anyone)
5. Copy the deployment URL

### Step 4: Set up the website

1. Push this repo to GitHub, enable GitHub Pages
2. Visit the site, open browser console (F12), run:
   ```js
   setApiUrl("https://script.google.com/macros/s/YOUR_ID/exec")
   ```

## Features

- **Directory** — searchable contact cards, grouped by household (couples shown together)
- **Upcoming Birthdays** — next 30 days highlighted
- **Family Tree** — interactive SVG tree with zoom, couples shown as joined nodes
- **Edit Profile** — update your own contact info, saved to the Google Sheet
- **Branch Filtering** — view contacts by Schulte sibling branch
- **Mobile-friendly** — responsive design

## Family Structure

305 people across 5 generations:

| Gen | Count | Description |
|-----|-------|-------------|
| 0 | 2 | Sylvia & Charlie (root) |
| 1 | 22 | The Schulte siblings + spouses |
| 2 | 66 | Their children + spouses |
| 3 | 137 | Grandchildren + spouses |
| 4 | 73 | Great-grandchildren |
| 5 | 5 | Great-great-grandchildren |

## Tech Stack

- Vanilla HTML/CSS/JavaScript (no build step)
- Google Sheets as database
- Google Apps Script as API
- GitHub Pages for hosting
- Cost: $0
