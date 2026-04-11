"""
Convert the Schulte family Excel database to a person-centric format.

Each person gets their own row, linked by relationships:
  - SpouseID: links to their spouse's PersonID
  - ParentID: links to their Schulte-bloodline parent's PersonID
    (married-in spouses have blank ParentID, connected via SpouseID)

Usage:
    python tools/convert_to_people.py "path/to/DATABASE, SCHULTE.xls"

Outputs: schulte_people.csv in the same directory as the input file.
"""

import sys
import re
import pandas as pd
from pathlib import Path

# ============================================================
# TREE STRUCTURE — from Jason's hand-mapped family hierarchy
# ============================================================
# Each generation is a list of tuples:
#   (parent_ref, seq_in_this_gen, lastName, firstNames)
#
# parent_ref points to the seq number in the PREVIOUS generation.
# seq is the ID used by the NEXT generation's parent_ref.
#
# For Gen 1: parent_ref is always 0 (the root, Sylvia).
# ============================================================

# Gen 0: The root patriarch/matriarch — parents of "the 12"
# Gus & Almeda Schulte (both deceased, from Notes on Doris/Phyllis rows)
GEN0_GUS = ("Schulte", "Gus", "1908-10-18", "1987-05-02")
GEN0_ALMEDA = ("Schulte", "Almeda", "1913-03-26", "1983-01-28")

# Gen 1: "The 12" — children of Gus & Almeda Schulte
# (gen1_id, lastName, firstNames)
# gen1_id is referenced by Gen 2's parent column
# Sylvia (0) is included — she married Charlie Goffinet, both deceased
# Bill Daming was Janice's husband (deceased), separate spreadsheet row
# Pete (3a) is a deceased sibling
GEN1 = [
    (0, "Goffinet", "Sylvia (Charlie)"),  # Sylvia Schulte married Charlie Goffinet
    (1, "Young", "Doris"),
    (2, "Daming", "Phyllis"),
    (3, "Daming", "Janice"),
    # Bill Daming = Janice's deceased husband, handled separately below
    # Pete = deceased sibling, handled separately below
    (4, "Schulte", "Don & Ann"),
    (5, "Schulte", "John & Mary Ann"),
    (6, "Schulte", "Herb & Peggy"),
    (7, "Kluemper", "Kathy & Ronnie"),
    (8, "Pierce", "Connie & Dave"),
    (9, "Painter", "Cindy & Chuck"),
    (10, "Schulte", "Paul"),
]

# Gen 2: (parent_gen1_id, seq, lastName, firstNames)
GEN2 = [
    (0, 1, "Goffinet", "Mike & Janet"),
    (0, 2, "Caskey", "Denise & Dave"),
    (1, 3, "Young", "Brenda"),
    (1, 4, "Young", "Doug"),
    (2, 5, "Daming", "Dwayne & Kathy"),
    (2, 6, "Kitley", "Donna"),
    (2, 7, "Daming", "Barry & Nadine"),
    (2, 8, "Lamp", "Bonnie"),
    (2, 9, "Shepard", "Sandy & Todd"),
    (3, 10, "Daming", "Ken & Kathy"),
    (3, 11, "Daming", "Randy"),
    (3, 12, "Meglio", "Karen & Dave"),
    (3, 13, "Ludwig", "Patty & Rob"),
    (4, 14, "Schulte", "Rob & Heather"),
    (4, 15, "Lloyd", "Tara & Tim"),
    (5, 16, "Schulte", "Brett & Lana"),
    (5, 17, "Stoermer", "Janet & Todd"),
    (5, 18, "Schulte", "Tom & Amy"),
    (5, 19, "Beumel", "Diane & Donny"),
    (6, 20, "Schulte", "Scott & Chris"),
    (6, 21, "Schulte", "Brian"),
    (6, 22, "Schulte", "Kevin & Kelly"),
    (6, 23, "Schulte", "Aaron"),
    (6, 24, "Troth", "Doris & Chris"),
    (6, 25, "Pattison", "Nicole & Stephen"),
    (7, 26, "Kluemper", "Steven & Heather"),
    (7, 27, "Kluemper", "Mark & Marsha"),
    (7, 28, "Summerlot", "Vicki & Mike"),
    (7, 29, "Kluemper", "Daryl & Jennifer"),
    (7, 30, "Duttlinger", "Jill & Dave"),
    (8, 31, "DeCarlo", "Jamie & Mike"),
    (8, 32, "Pierce", "Jon & Kimberly"),
    (9, 33, "Lashley", "Peter & Jennifer"),
    (9, 34, "Lashley", "Eric & Melanie"),
    (9, 35, "Washburn", "Valerie & Stewart"),
    (9, 36, "Kissel", "Katie & Matt"),
]

# Gen 3: (parent_gen2_seq, seq, lastName, firstNames)
GEN3 = [
    (1, 1, "Goffinet", "Kris"),
    (1, 2, "Goffinet", "Paige"),
    (1, 3, "Smith", "Natalie & Brian"),
    (1, 4, "Kendall", "Andrea & Chris"),
    (2, 5, "Caskey", "Marc & Amy"),
    (2, 6, "Caskey", "Jeff & Jill"),
    (2, 7, "Caskey", "Eric"),
    (5, 8, "Daming", "Ryan & Jamie"),
    (5, 9, "Fowler", "Noelle & Drew"),
    (5, 10, "Daming", "Rachel"),
    (6, 11, "Kitley", "John Carl & Michelle"),
    (6, 12, "Adams", "Jessica"),
    (6, 13, "Kitley", "Weston & Molly"),
    (7, 14, "Aycock", "Erica & Ross"),
    (7, 15, "Daming", "Elizabeth"),
    (7, 16, "Brown", "Monica & David"),
    (7, 17, "Ruiz", "Corissa"),
    (7, 18, "Hopkins", "Heidi & Micah"),
    (7, 19, "Daming", "Anthony & Raquel"),
    (7, 20, "Daming", "Nathaniel & Olivia"),
    (8, 21, "Lamp", "Taryn"),
    (8, 22, "Summers", "Haley & Adam"),
    (9, 23, "Tollison", "Cassie & Josh"),
    (9, 24, "Shepard", "Chad & Tiffany"),
    (9, 25, "Carnes", "Caitlin & Ryne"),
    (10, 26, "Daming", "Michael & Becca"),
    (10, 27, "Daming", "John & Jen"),
    (10, 28, "Daming", "Chris & Lauren"),
    (10, 29, "Daming", "Will"),
    (11, 30, "Daming", "Jason & Tara"),
    (11, 31, "Daming", "Brian & Julia"),
    (11, 32, "Daming", "Mark"),
    (12, 33, "Hoff", "Amanda & Alex"),
    (12, 34, "Shockley", "Christina & Kyle"),
    (12, 35, "Meglio", "Matthew & Tasia"),
    (12, 36, "Meglio", "Steven"),
    (13, 37, "Ludwig", "Jeff & Brittany"),
    (13, 38, "Boesch", "Melissa & Zac"),
    (13, 39, "Ludwig", "Kevin"),
    (16, 40, "Field", "Kayla & Tyler"),
    (21, 41, "Schulte", "Joshuah"),
    (26, 42, "Kluemper", "Jacob & Katie"),
    (28, 43, "Summerlot", "Matt & Sarah"),
    (29, 44, "Kluemper", "Anthony & Emmy"),
    (33, 45, "Rasor", "Reagan & Alston"),
    (34, 46, "Lashley", "Emma"),
    (34, 47, "Lashley", "Teddy & Jaren"),
]

# Gen 4: (parent_gen3_seq, seq, lastName, firstNames)
GEN4 = [
    (1, 1, "Goffinet", "Haley"),
    (1, 2, "Goffinet", "Tristin"),
]

# Deceased family members mentioned in Notes
# Gus, Almeda = Gen 0 root (handled separately)
# Sylvia, Pete = Gen 1 siblings (handled in GEN1 / separately)
# Charlie Goffinet = Sylvia's husband (handled as spouse in GEN1 entry 0)
# Bill Daming = Janice's husband (handled separately)
#
# Remaining deceased from notes:
# (associated_family_key, name, birthday, death_date, relationship_hint)
DECEASED_FROM_NOTES = [
    # Carlos Daming = Bill's brother, married Phyllis Schulte (deceased spouse)
    # Ray = deceased, associated with Don & Ann Schulte (unclear relationship)
    (("Daming", "Phyllis"), "Carlos", "1935-08-30", "1996-09-22", "deceased_spouse"),
    (("Schulte", "Don & Ann"), "Ray", "1935-08-29", "2017-08-04", "deceased_relative"),
    # Deceased children / relatives in later generations
    (("Daming", "Dwayne & Kathy"), "Adriene", "1982-04-21", "1982-04-28", "deceased_child"),
    (("Daming", "Randy"), "Joetta", "1962-10-31", "1994-03-01", "deceased_relative"),
    (("Kitley", "John Carl & Michelle"), "Julie", "1984-06-08", "2017-05-17", "deceased_relative"),
    (("Ruiz", "Corissa"), "Luke", "2019-07-28", "2019-07-28", "deceased_child"),
    (("Hopkins", "Heidi & Micah"), "Michael", "2019-07-28", "2023-09-03", "deceased_child"),
]

# Bill (under Janice, no last name in spreadsheet) — he's in the spreadsheet as
# a separate row with no last name. We map him to spreadsheet row index 3.
BILL_ROW_INDEX = 3  # 0-indexed in df (the row after Janice)


def main():
    if len(sys.argv) < 2:
        print("Usage: python convert_to_people.py <path_to_xls>")
        sys.exit(1)

    xls_path = sys.argv[1]
    df = pd.read_excel(xls_path, header=1)

    # Rename columns
    col_map = {
        'Unnamed: 0': 'RowNum', 'Last Name': 'LastName', 'First Names': 'FirstNames',
        'Address': 'Address', 'City': 'City', 'State': 'State', 'Zip Code': 'Zip',
        'Home Phone': 'HomePhone', 'Cell Phones': 'Cell',
        'First Names 2': '_fn2', 'Emails': 'Email',
        'Person1': 'Person1', 'Person1 BD': 'Person1BD',
        'Person2': 'Person2', 'Person2 BD': 'Person2BD',
        'Annv.': 'Anniversary', 'First Names 3': '_fn3',
        'No.In.Fam': 'FamilySize', 'Notes': 'Notes',
        'First Names 4': '_fn4',
    }
    # Add child columns
    for i in range(1, 10):
        col_map[f'Child{i}'] = f'Child{i}'
        bd_key = f'Child{i} BD' if i != 7 else 'Child 7BD'
        col_map[bd_key] = f'Child{i}BD'

    df = df.rename(columns=col_map)

    # Build lookup: (lastName_lower, firstNames_lower) -> df row
    family_lookup = {}
    for idx, row in df.iterrows():
        ln = clean(row.get('LastName', ''))
        fn = clean(row.get('FirstNames', ''))
        if ln or fn:
            key = (ln.lower(), fn.lower())
            family_lookup[key] = row

    # Also index by just firstNames for Bill (no last name)
    bill_row = df.iloc[BILL_ROW_INDEX] if BILL_ROW_INDEX < len(df) else None

    # ============================================================
    # Build person records
    # ============================================================
    people = []  # list of dicts
    next_id = [1]  # mutable counter

    def new_id():
        pid = next_id[0]
        next_id[0] += 1
        return pid

    # Track: tree_entry_key -> person_id (for the Schulte-line person in each family)
    # Also track: (gen, seq) -> person_id for parent linking
    gen_seq_to_person = {}  # (gen_level, seq) -> person_id of Schulte-line person

    # Also track spouse pairs for SpouseID linking
    spouse_pairs = []  # (person_id_1, person_id_2)

    # Track families we've processed (to add children later)
    family_persons = []  # (family_row, schulte_person_id, spouse_person_id, gen, seq, parent_ref)

    def find_family_row(last_name, first_names):
        """Find the spreadsheet row matching this family."""
        key = (last_name.lower(), first_names.lower())
        if key in family_lookup:
            return family_lookup[key]
        # Try fuzzy: strip spaces
        for k, v in family_lookup.items():
            if k[0] == key[0] and k[1].replace(' ', '') == key[1].replace(' ', ''):
                return v
        return None

    def split_couple(first_names):
        """Split 'Don & Ann' into ('Don', 'Ann'). Single name returns (name, None)."""
        if ' & ' in first_names:
            parts = first_names.split(' & ', 1)
            return parts[0].strip(), parts[1].strip()
        return first_names.strip(), None

    def fmt_date(val):
        """Format date value as YYYY-MM-DD."""
        if pd.isna(val) or val is None:
            return ''
        if hasattr(val, 'strftime'):
            return val.strftime('%Y-%m-%d')
        s = str(val).strip()
        if s == 'nan' or not s:
            return ''
        # Strip time portion if present (e.g., "1987-05-16 00:00:00")
        if ' ' in s and s.split(' ')[0].count('-') == 2:
            return s.split(' ')[0]
        return s

    def create_person(first_name, last_name, row=None, is_person1=True,
                      generation=0, branch='', parent_id='', spouse_id='',
                      deceased=False, birthday_override='', death_date='', notes=''):
        """Create a person dict from available data."""
        pid = new_id()

        # Pull contact info from spreadsheet row if available
        if row is not None:
            person = {
                'PersonID': pid,
                'FirstName': first_name,
                'LastName': last_name,
                'Birthday': birthday_override or fmt_date(
                    row.get('Person1BD') if is_person1 else row.get('Person2BD')
                ),
                'Deceased': 'Y' if deceased else '',
                'DeathDate': death_date,
                'Phone': clean(row.get('HomePhone', '')),
                'Cell': extract_cell(clean(row.get('Cell', '')), first_name, is_person1),
                'Email': extract_email(clean(row.get('Email', '')), first_name, is_person1),
                'Address': clean(row.get('Address', '')),
                'City': clean(row.get('City', '')),
                'State': clean(row.get('State', '')),
                'Zip': clean(row.get('Zip', '')),
                'Anniversary': fmt_date(row.get('Anniversary')),
                'SpouseID': spouse_id,
                'ParentID': parent_id,
                'Generation': generation,
                'Branch': branch,
                'Notes': notes,
            }
        else:
            person = {
                'PersonID': pid,
                'FirstName': first_name,
                'LastName': last_name,
                'Birthday': birthday_override,
                'Deceased': 'Y' if deceased else '',
                'DeathDate': death_date,
                'Phone': '', 'Cell': '', 'Email': '',
                'Address': '', 'City': '', 'State': '', 'Zip': '',
                'Anniversary': '',
                'SpouseID': spouse_id,
                'ParentID': parent_id,
                'Generation': generation,
                'Branch': branch,
                'Notes': notes,
            }
        people.append(person)
        return pid

    def get_branch(gen1_id):
        """Get branch name from Gen1 ID."""
        for gid, ln, fn in GEN1:
            if gid == gen1_id:
                p1, _ = split_couple(fn)
                # Clean up "Sylvia (Charlie)" -> "Sylvia"
                p1 = re.sub(r'\s*\(.*\)', '', p1).strip()
                return f"{p1} {ln}".strip()
        return ""

    def trace_branch(gen_level, parent_ref):
        """Trace back to find the Gen1 branch ID."""
        if gen_level == 1:
            return parent_ref  # parent_ref IS the gen1 ID (it's 0 = root for gen1)
        if gen_level == 2:
            return parent_ref  # parent_ref is gen1 ID
        if gen_level == 3:
            # parent_ref is gen2 seq; find gen2 entry to get its gen1 parent
            for p, s, ln, fn in GEN2:
                if s == parent_ref:
                    return p  # p is gen1 ID
            return -1
        if gen_level == 4:
            # parent_ref is gen3 seq; find gen3 entry to get its gen2 parent, then gen1
            for p3, s3, ln3, fn3 in GEN3:
                if s3 == parent_ref:
                    # p3 is gen2 seq
                    for p2, s2, ln2, fn2 in GEN2:
                        if s2 == p3:
                            return p2  # gen1 ID
            return -1
        return -1

    def process_family(last_name, first_names, gen_level, seq, parent_ref, row=None):
        """Process a family entry: create person(s) and track for linking."""
        p1_name, p2_name = split_couple(first_names)
        if gen_level == 1:
            branch = f"{p1_name} {last_name}".strip()
        elif gen_level >= 2:
            gen1_id = trace_branch(gen_level, parent_ref)
            branch = get_branch(gen1_id)
        else:
            branch = "Root"

        # Find parent's PersonID
        if gen_level == 0:
            parent_pid = ''
        elif gen_level == 1:
            parent_pid = gen_seq_to_person.get((0, 0), '')  # root (Gus)
        elif gen_level == 2:
            parent_pid = gen_seq_to_person.get((1, parent_ref), '')  # Gen 1 entry
        elif gen_level == 3:
            parent_pid = gen_seq_to_person.get((2, parent_ref), '')
        elif gen_level == 4:
            parent_pid = gen_seq_to_person.get((3, parent_ref), '')
        else:
            parent_pid = ''

        # Create Person1 (Schulte-line)
        p1_id = create_person(
            p1_name, last_name, row=row, is_person1=True,
            generation=gen_level, branch=branch, parent_id=parent_pid
        )

        # Track this person for child linking
        gen_seq_to_person[(gen_level, seq)] = p1_id

        # Create Person2 (married-in spouse) if exists
        p2_id = ''
        if p2_name:
            p2_id = create_person(
                p2_name, last_name, row=row, is_person1=False,
                generation=gen_level, branch=branch, parent_id='',  # married in
            )
            # Link spouses
            spouse_pairs.append((p1_id, p2_id))

        # Track for child processing
        family_persons.append((row, p1_id, p2_id, gen_level, seq, parent_ref, last_name))

        return p1_id, p2_id

    # ============================================================
    # Process Gen 0: Gus & Almeda Schulte (parents of "the 12")
    # ============================================================
    # Both deceased, not in the spreadsheet — create from Notes data
    gus_id = create_person(
        "Gus", "Schulte", row=None, generation=0, branch="Root",
        deceased=True, birthday_override=GEN0_GUS[2], death_date=GEN0_GUS[3],
        notes="Patriarch. Father of the 12 Schulte siblings."
    )
    almeda_id = create_person(
        "Almeda", "Schulte", row=None, generation=0, branch="Root",
        deceased=True, birthday_override=GEN0_ALMEDA[2], death_date=GEN0_ALMEDA[3],
        notes="Matriarch. Mother of the 12 Schulte siblings."
    )
    spouse_pairs.append((gus_id, almeda_id))
    gen_seq_to_person[(0, 0)] = gus_id  # Root for ParentID linking

    # ============================================================
    # Process Gen 1: "The 12" Schulte siblings
    # ============================================================
    # Special handling for Sylvia (entry 0): she's a Schulte sibling who
    # married Charlie Goffinet. The spreadsheet lists her as
    # "Goffinet, Sylvia (Charlie)" — we need to split properly.
    sylvia_row = find_family_row("Goffinet", "Sylvia (Charlie)")
    # Sylvia is the Schulte-line person, Charlie is her husband
    sylvia_id = create_person(
        "Sylvia", "Goffinet", row=sylvia_row, is_person1=True,
        generation=1, branch="Sylvia Goffinet",
        parent_id=gus_id,
        deceased=True, birthday_override="1933-09-12", death_date="2019-09-12",
        notes="Schulte sibling. Married Charlie Goffinet."
    )
    charlie_id = create_person(
        "Charlie", "Goffinet", row=sylvia_row, is_person1=False,
        generation=1, branch="Sylvia Goffinet",
        deceased=True, birthday_override="1933-10-07", death_date="1990-06-12",
    )
    spouse_pairs.append((sylvia_id, charlie_id))
    gen_seq_to_person[(1, 0)] = sylvia_id  # Gen 1, seq 0

    # Process the rest of Gen 1 (entries 1-10)
    for gen1_id, ln, fn in GEN1:
        if gen1_id == 0:
            continue  # Already handled Sylvia above
        row = find_family_row(ln, fn)
        process_family(ln, fn, gen_level=1, seq=gen1_id, parent_ref=0, row=row)

    # Handle Pete (deceased sibling, entry 3a)
    pete_id = create_person(
        "Pete", "Schulte", row=None, generation=1, branch="Pete Schulte",
        parent_id=gus_id,
        deceased=True, birthday_override="1939-09-03", death_date="2019-02-19",
        notes="Deceased Schulte sibling."
    )

    # Handle Bill Daming (Janice's deceased husband, separate row in spreadsheet)
    if bill_row is not None:
        p1_name = clean(bill_row.get('FirstNames', ''))
        if p1_name and p1_name.lower() == 'bill':
            # Find Janice's PersonID to link as spouse
            janice_pid = gen_seq_to_person.get((1, 3), '')  # Gen 1, seq 3 = Janice
            bill_id = create_person(
                "Bill", "Daming", row=bill_row, is_person1=True,
                generation=1, branch="Janice Daming",
                deceased=True, death_date="",
                notes="Janice Schulte's husband. Lived at separate address."
            )
            if janice_pid:
                spouse_pairs.append((janice_pid, bill_id))

    # ============================================================
    # Process Gen 2
    # ============================================================
    for parent_ref, seq, ln, fn in GEN2:
        row = find_family_row(ln, fn)
        process_family(ln, fn, gen_level=2, seq=seq, parent_ref=parent_ref, row=row)

    # ============================================================
    # Process Gen 3
    # ============================================================
    for parent_ref, seq, ln, fn in GEN3:
        row = find_family_row(ln, fn)
        process_family(ln, fn, gen_level=3, seq=seq, parent_ref=parent_ref, row=row)

    # ============================================================
    # Process Gen 4
    # ============================================================
    for parent_ref, seq, ln, fn in GEN4:
        row = find_family_row(ln, fn)
        process_family(ln, fn, gen_level=4, seq=seq, parent_ref=parent_ref, row=row)

    # Build person index (used by children and deceased processing below)
    pid_to_person = {p['PersonID']: p for p in people}

    # ============================================================
    # Add inline children who don't have their own family row
    # ============================================================
    # For each family, check Child1-Child9. If the child's name matches
    # a Person1 in a family with this family as parent, skip (already created).
    # Otherwise, create a child-only person record.

    # Build set of known Person1 names by parent
    # gen_seq_to_person maps (gen, seq) -> person_id
    # We need: parent_person_id -> set of first names of their family-row children
    parent_to_known_children = {}
    for row_data, p1_id, p2_id, gen, seq, parent_ref, ln in family_persons:
        parent_pid = ''
        if gen == 1:
            parent_pid = gen_seq_to_person.get((0, 0), '')
        elif gen == 2:
            parent_pid = gen_seq_to_person.get((1, parent_ref), '')
        elif gen == 3:
            parent_pid = gen_seq_to_person.get((2, parent_ref), '')
        elif gen == 4:
            parent_pid = gen_seq_to_person.get((3, parent_ref), '')

        if parent_pid:
            if parent_pid not in parent_to_known_children:
                parent_to_known_children[parent_pid] = set()
            # Add the Schulte-line person's first name
            p = pid_to_person.get(p1_id)
            if p:
                parent_to_known_children[parent_pid].add(p['FirstName'].lower())

    # Now process inline children
    for row_data, p1_id, p2_id, gen, seq, parent_ref, family_ln in family_persons:
        if row_data is None:
            continue

        known = parent_to_known_children.get(p1_id, set())
        # Inherit branch from the parent person
        branch = pid_to_person[p1_id].get('Branch', '')

        for ci in range(1, 10):
            child_name = clean(row_data.get(f'Child{ci}', ''))
            if not child_name:
                continue
            # Strip asterisk (stepchild marker)
            child_name_clean = child_name.rstrip('*').strip()

            # Check if this child already has their own family row
            if child_name_clean.lower() in known:
                continue

            child_bd = fmt_date(row_data.get(f'Child{ci}BD', ''))
            stepchild = child_name.endswith('*')

            create_person(
                child_name_clean, family_ln, row=None,
                generation=gen + 1,
                branch=branch if gen >= 1 else pid_to_person[p1_id].get('Branch', ''),
                parent_id=p1_id,
                birthday_override=child_bd,
                notes='Stepchild' if stepchild else '',
            )

    # ============================================================
    # Add deceased persons from Notes
    # ============================================================
    for family_key, name, birthday, death_date, rel_type in DECEASED_FROM_NOTES:
        fln, ffn = family_key

        # Find the associated family's person (may be deceased themselves)
        assoc_pid = None
        for p in people:
            fn_match = p['FirstName'].lower() == split_couple(ffn)[0].lower()
            ln_match = p['LastName'].lower() == fln.lower() if fln else not p['LastName']
            if fn_match and ln_match:
                assoc_pid = p['PersonID']
                break

        parent_id = ''
        branch = ''
        gen = 0
        last_name = ''
        if assoc_pid:
            assoc = pid_to_person.get(assoc_pid, {})
            branch = assoc.get('Branch', '')
            gen = assoc.get('Generation', 0)
            if rel_type == 'deceased_child':
                parent_id = assoc_pid
                gen = gen + 1
            elif rel_type == 'deceased_spouse':
                # Use the same last name as the associated person
                last_name = assoc.get('LastName', '')

        deceased_pid = create_person(
            name, last_name, row=None, generation=gen, branch=branch,
            parent_id=parent_id, deceased=True,
            birthday_override=birthday, death_date=death_date,
            notes=f"Deceased. Associated with {ffn} {fln}.".strip()
        )

        # Link as spouse if applicable
        if rel_type == 'deceased_spouse' and assoc_pid:
            spouse_pairs.append((assoc_pid, deceased_pid))

    # ============================================================
    # Output
    # ============================================================
    # ============================================================
    # Link spouse IDs bidirectionally (after all people are created)
    # ============================================================
    pid_to_person = {p['PersonID']: p for p in people}
    for p1_id, p2_id in spouse_pairs:
        if p1_id in pid_to_person:
            pid_to_person[p1_id]['SpouseID'] = p2_id
        if p2_id in pid_to_person:
            pid_to_person[p2_id]['SpouseID'] = p1_id

    out_cols = [
        'PersonID', 'FirstName', 'LastName', 'Birthday', 'Deceased', 'DeathDate',
        'Phone', 'Cell', 'Email', 'Address', 'City', 'State', 'Zip',
        'Anniversary', 'SpouseID', 'ParentID', 'Generation', 'Branch', 'Notes',
    ]
    out_df = pd.DataFrame(people)[out_cols]
    out_path = Path(xls_path).parent / 'schulte_people.csv'
    out_df.to_csv(out_path, index=False)

    # Stats
    total = len(out_df)
    deceased_count = (out_df['Deceased'] == 'Y').sum()
    with_spouse = (out_df['SpouseID'] != '').sum()
    with_parent = (out_df['ParentID'] != '').sum()
    gen_counts = out_df['Generation'].value_counts().sort_index()
    branch_counts = out_df['Branch'].value_counts()

    print(f"Wrote {total} people to {out_path}")
    print(f"  Deceased: {deceased_count}")
    print(f"  With spouse link: {with_spouse}")
    print(f"  With parent link: {with_parent}")
    print(f"\nBy generation:")
    for g, c in gen_counts.items():
        print(f"  Gen {g}: {c} people")
    print(f"\nBy branch (top 15):")
    for b, c in branch_counts.head(15).items():
        print(f"  {b}: {c}")


# ============================================================
# Utility functions
# ============================================================

def clean(val):
    """Clean a cell value to string."""
    if pd.isna(val) or val is None:
        return ''
    s = str(val).strip()
    if s.lower() == 'nan':
        return ''
    return s


def strip_name_prefix(phone_part):
    """Strip leading name-initial prefix like 'D ', 'MA ', 'K ' from a phone number."""
    return re.sub(r'^[A-Za-z]+\s+', '', phone_part.strip())


def extract_cell(cell_str, first_name, is_person1):
    """
    Extract the relevant cell phone from a combined string like
    'D 812-686-0633, A 812-480-8179' or 'J 812-393-9875, MA 812-686-0290'.
    Each person now gets their own row, so strip the name prefix and return just the number.
    """
    if not cell_str:
        return ''

    # Split on comma, semicolon, or double-space (some entries use spaces)
    parts = re.split(r'[,;]\s*|\s{2,}', cell_str)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) == 1:
        return strip_name_prefix(parts[0])

    # Try to match by first initial
    initial = first_name[0].upper() if first_name else ''
    for part in parts:
        prefix_match = re.match(r'^([A-Za-z]+)\s+(\d)', part.strip())
        if prefix_match and prefix_match.group(1)[0].upper() == initial:
            return strip_name_prefix(part)

    # If person1, return first; if person2, return second
    idx = 0 if is_person1 else min(1, len(parts) - 1)
    return strip_name_prefix(parts[idx])


def strip_email_prefix(email_part):
    """Strip short name-initial prefix like 'A- ', 'D- ', 'Ke - ', 'KV- ' from an email.
    Only strips if the prefix is 1-3 letters followed by optional dash/space, and an @ exists after."""
    email_part = email_part.strip()
    m = re.match(r'^([A-Za-z]{1,3})\s*-\s*(.+@.+)$', email_part)
    if m:
        return m.group(2).strip()
    # Also handle "C- email" without dash: "A email@..." (only if very short prefix)
    m = re.match(r'^([A-Za-z]{1,2})\s{2,}(.+@.+)$', email_part)
    if m:
        return m.group(2).strip()
    return email_part


def extract_email(email_str, first_name, is_person1):
    """Extract the relevant email from a combined string like 'D- d@x.com  A- a@x.com'."""
    if not email_str:
        return ''
    # Split on comma, semicolon, or double-space (some entries use spaces between emails)
    parts = re.split(r'[,;]\s*|\s{2,}', email_str)
    parts = [p.strip() for p in parts if p.strip() and '@' in p]

    if len(parts) == 0:
        # No @ found — might be a note like "(work)", return the whole thing cleaned
        return email_str.strip()

    if len(parts) == 1:
        return strip_email_prefix(parts[0])

    # Try to match by name-initial prefix like "A- amschulte@hotmail.com"
    # Match on full prefix (e.g., "Ke" matches "Ken", "KV" matches "Kevin")
    name_upper = first_name.upper() if first_name else ''
    for part in parts:
        raw = part.strip()
        cleaned = strip_email_prefix(raw)
        if cleaned != raw:
            # There was a prefix — extract it
            prefix = raw[:len(raw) - len(cleaned)].strip().rstrip('-').strip().upper()
            if prefix and name_upper.startswith(prefix):
                return cleaned

    # No prefix match — return first for person1, second for person2
    idx = 0 if is_person1 else min(1, len(parts) - 1)
    return strip_email_prefix(parts[idx])


if __name__ == '__main__':
    main()
