# Google Apps Script Setup

This is the backend API that reads/writes the Google Sheet. It runs as a free Google Apps Script web app.

## Google Sheet Column Layout (People tab)

One row per person. Import `schulte_people.csv` and name the tab **People**.

| Col | Name | Description |
|-----|------|-------------|
| A | PersonID | Unique integer ID |
| B | FirstName | Person's first name |
| C | LastName | Last name |
| D | Birthday | YYYY-MM-DD |
| E | Deceased | "Y" if deceased, blank otherwise |
| F | DeathDate | YYYY-MM-DD if deceased |
| G | Phone | Home/landline phone |
| H | Cell | Cell phone |
| I | Email | Email address |
| J | Address | Street address |
| K | City | City |
| L | State | State (2-letter) |
| M | Zip | Zip code |
| N | Anniversary | Wedding anniversary (YYYY-MM-DD) |
| O | SpouseID | PersonID of spouse |
| P | ParentID | PersonID of Schulte-line parent |
| Q | Generation | 0=root, 1=siblings, 2=children, 3=grandchildren, etc. |
| R | Branch | Which Gen 1 sibling branch (e.g., "Phyllis Daming") |
| S | Notes | Misc notes |

## Key Relationships

- **SpouseID** links two people as a couple (bidirectional)
- **ParentID** links a person to their parent in the Schulte bloodline
  - Married-in spouses have blank ParentID (they connect via SpouseID)
  - This field builds the family tree

## Deployment Steps

1. Open your Google Sheet
2. Go to **Extensions > Apps Script**
3. Delete any default code, paste `Code.gs`
4. Update `SHEET_ID` and `TOKEN_SECRET`
5. **Deploy > New deployment > Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Authorize when prompted
7. Copy the Web app URL

## Security Notes

- Data only returned after name + birthday authentication
- Users can only edit their own row (token-locked)
- Deceased persons cannot log in
