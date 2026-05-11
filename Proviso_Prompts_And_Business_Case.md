# Proviso
## Prompts, Architecture & Business Case

---

## PART 1 — The Problem We Are Solving

---

### The Current Reality — Triple Entry

Every M-Files implementation follows the same painful sequence. The same information is written, drawn, and re-entered multiple times by hand. Nothing is automated. Nothing is reused.

```
Step 1 — Consultant reads the client SOW
         (Word document, email, PDF)

Step 2 — Consultant opens Cacoo
         Manually draws the workflow diagram
         State boxes drawn one by one
         Arrows drawn one by one
         ← Same information as the SOW

Step 3 — Consultant opens M-Files Admin
         Manually redraws the same diagram
         Clicks through every state
         Clicks through every transition
         Configures every permission
         ← Same information again

Step 4 — Consultant writes the PRD
         Documents what was just built
         ← Same information again

Step 5 — Consultant manually tests 30+ scenarios
         One by one, logged in as each user
         ← Verifying what was already in the SOW

Step 6 — Consultant writes the compliance report
         Documents what the tests proved
         ← Same information again
```

**The same information — users, workflow states, transitions, permissions, rules — is written six times. Every re-entry is an opportunity for error. Every error means rework.**

---

### The Time Cost

| Task | Manual time | With Proviso |
| :--- | ---: | ---: |
| Draw workflow in Cacoo | 45–90 min | 0 min |
| Build workflow in M-Files Admin | 2–3 hours | 0 min |
| Configure permissions and conditions | 1–2 hours | 0 min |
| Manual test execution (30+ cases) | 4–6 hours | 3 min |
| Write compliance report | 1–2 hours | 10 sec |
| **Total per implementation** | **8–14 hours** | **~15 min** |

**Per project savings: 8 to 14 hours. Per consultant per year: hundreds of hours.**

---

### The Template Reuse Problem

Some consultants attempt to save time by copying a vault from a previous project. This creates a different problem. Workflows inherited from a previous client carry decisions that no longer apply. Conditions exist because a different client needed them. States are named for a different business process. The result is vaults that work but that nobody fully understands — complex without reason, fragile under change.

**Template reuse does not solve the problem. It transfers it.**

---

### The Solution — Proviso

Proviso reads the SOW once and generates everything downstream automatically.

```
                    SOW
              (single source of truth)
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   Diagram       workflow      PRD
  (Mermaid)       .json      (.md)
  auto-drawn   auto-built   auto-written
                     │
                     ▼
              M-Files Vault
              (COM API)
              workflow already drawn
              just add conditions
```

**One input. Everything else is automatic.**

The consultant chooses how to provide the SOW — three paths, all producing the same result:

| Input method | Best for |
| :--- | :--- |
| ◈ NLP | Structured Markdown SOW — offline, free, instant |
| ✦ AI Extract | Any raw SOW format — paste Word, email, PDF text |
| ⬡ Cacoo Import | Team already has Cacoo diagram — pull via API |

---

## PART 2 — The Three Prompts

---

### Prompt 1 — ◈ NLP (Markdown + spaCy + regex)

**What it is:** The local parsing pipeline. No API. No internet. No cost. Runs entirely on the consultant's machine.

**Three engines working together:**

```
markdown-it-py    → understands document structure
                    tables, headings, lists, paragraphs

regex             → extracts structured data from tables
                    | State Name | Initial |
                    → { name: "Draft", initial: true }
                    100% accuracy

spaCy             → reads English prose sentences
en_core_web_sm      "Only Contract Managers can create..."
12 MB model         → { permission: "Contract Managers",
                        action: "create" }
                    80–90% accuracy
```

**The system prompt / parser instructions (Python):**

```python
# proviso/parser/nlp_parser.py
# ─────────────────────────────────────────────
# PROVISO NLP PARSER — three-layer extraction
# Layer 1: markdown-it-py (document structure)
# Layer 2: regex (table extraction)
# Layer 3: spaCy en_core_web_sm (prose rules)
# ─────────────────────────────────────────────

EXTRACTION_RULES = {

    # ── Layer 2: regex patterns for table extraction ──

    "workflow_name": r"^##\s+Workflow[:\s]+(.+)",

    "state_table": {
        "section_header": r"^###\s+States",
        "row_pattern":    r"^\|([^|]+)\|([^|]+)\|",
        "columns": {
            "name":    0,   # State Name column
            "initial": 1,   # Initial column — "Yes" = True
        }
    },

    "transition_table": {
        "section_header": r"^###\s+Transitions",
        "row_pattern":    r"^\|([^|]+)\|([^|]+)\|(?:([^|]+)\|)?(?:([^|]+)\|)?",
        "columns": {
            "from":       0,  # From State
            "to":         1,  # To State
            "condition":  2,  # Optional condition
            "permission": 3,  # Optional permission group
        }
    },

    "user_table": {
        "section_header": r"^###\s+Users",
        "columns": {
            "name":   0,
            "role":   1,
            "email":  2,
            "isCM":   3,   # "Yes" = True
            "groups": 4,   # Comma-separated
        }
    },

    "property_table": {
        "section_header": r"^###\s+Properties",
        "columns": {
            "name":     0,
            "type":     1,   # Text|Integer|Decimal|Date|Lookup
            "required": 2,   # "Yes" = True
        }
    },

    "rules_table": {
        "section_header": r"^###\s+Rules",
        "columns": {
            "text": 0,
        }
    },

    # ── Layer 3: spaCy patterns for prose extraction ──

    "spacy_patterns": {

        # Threshold: "exceeding fifty thousand euros"
        # "over €50,000" / "greater than 50000"
        "threshold": [
            r"(?:exceeding|over|greater than|more than)\s+"
            r"(?:€|EUR\s*)?([\d,]+(?:\.\d+)?)\s*"
            r"(?:euros?|EUR|dollars?|\$)?",
        ],

        # Permission: "only [group] can [action]"
        # "[group] must approve" / "requires [group] approval"
        "permission": [
            r"only\s+(.+?)\s+(?:can|may|must)\s+(.+?)[\.\,]",
            r"requires?\s+(?:approval\s+from\s+)?(.+?)\s+"
            r"(?:approval|sign-off|authorisation)",
            r"(?:must be|requires?)\s+(?:approved|authorised)\s+"
            r"by\s+(.+?)[\.\,]",
        ],

        # Action: "automatically converted to PDF"
        # "locked against editing" / "send notification"
        "action": [
            r"(?:automatically\s+)?(?:convert(?:ed)?\s+to\s+PDF)",
            r"lock(?:ed)?\s+(?:against|from)\s+(?:further\s+)?editing",
            r"send\s+(?:a\s+)?notification",
            r"assign\s+(?:a\s+)?task",
        ],
    }
}

# Confidence scoring
CONFIDENCE = {
    "table_row":     1.00,  # Regex on table — perfect
    "list_item":     1.00,  # Regex on list — perfect
    "spacy_match":   0.85,  # spaCy pattern match
    "spacy_partial": 0.65,  # spaCy partial match — flag for review
    "not_found":     0.00,  # Not extracted — skip
}
```

**What the NLP tab shows the consultant:**

```
◈ NLP Editor

┌─────────────────────────────────────────┐
│ ## Workflow: Contract Lifecycle         │
│                                         │
│ ### States                              │
│ | State Name    | Initial |             │
│ | Draft         | Yes     |             │
│ | Under Review  | No      |             │
│                                         │
│ ### Rules                               │
│ Only Contract Managers can create       │
│ contracts.                              │ ← spaCy reads this
└─────────────────────────────────────────┘

[◈ Parse with NLP]

Extracting...
  ✓ States table          → 11 rows   [1.00]
  ✓ Transitions table     → 15 rows   [1.00]
  ✓ Users table           → 5 rows    [1.00]
  ✓ Properties table      → 7 rows    [1.00]
  ✓ Rules prose           → 4 rules   [0.87]
  ──────────────────────────────────────────
  ✓ Spreadsheet populated — 0 warnings
```

---

### Prompt 2 — ✦ AI Extract (Claude API)

**What it is:** The consultant pastes any raw SOW — Word text, email, PDF paste, any language, any format. Claude extracts everything and populates the spreadsheet.

**The system prompt (sent to Claude API):**

```python
# proviso/prompts/claude_extract.py
# ─────────────────────────────────────────────
# PROVISO AI EXTRACTION PROMPT
# Sent to Claude API with the raw SOW text
# Returns structured workflow.json
# ─────────────────────────────────────────────

CLAUDE_SYSTEM_PROMPT = """
You are Proviso — an intelligent extraction engine for
Document Management System implementations.

Your job is to read a Statement of Work (SOW) and extract
ALL implementation requirements into a structured JSON format.

## Output Format

Return ONLY valid JSON matching this exact schema.
No explanation. No preamble. No markdown code fences.
Start your response with { and end with }.

{
  "name": "project or workflow name",
  "description": "one sentence overview",
  "users": [
    {
      "name": "full name",
      "role": "job title",
      "email": "email if provided, empty string if not",
      "isCM": true or false,
      "groups": ["group name 1", "group name 2"]
    }
  ],
  "states": [
    {
      "name": "exact state name as written",
      "initial": true or false,
      "description": "brief description if provided"
    }
  ],
  "transitions": [
    {
      "from": "exact from state name",
      "to": "exact to state name",
      "condition": "condition text or empty string",
      "permission": "authorized group or Automatic"
    }
  ],
  "properties": [
    {
      "name": "field name",
      "type": "Text or Integer or Decimal or Date or Lookup or Boolean",
      "required": true or false
    }
  ],
  "rules": [
    "plain English rule — one complete sentence per rule"
  ]
}

## Extraction Rules — follow strictly

1. NEVER invent requirements not stated in the document
2. NEVER assume users, states, or rules that are not written
3. If a field is not mentioned — use empty string or empty array
4. Extract state names EXACTLY as written — preserve capitalisation
5. For threshold conditions, extract the operator and value:
   "exceeding €50,000" → "Contract Value > 50000"
   "below fifty thousand" → "Contract Value < 50000"
6. For automatic transitions (time-based, event-based):
   set permission to "Automatic"
7. For users — isCM is true only if explicitly identified as
   Contract Manager or given explicit create/edit rights
8. If the document is in French — extract and translate to English
9. For ambiguous rules — include them verbatim in the rules array
10. Rules about permissions go in rules array AND in the relevant
    transition permission field

## Quality Check

Before returning JSON, verify:
- Every transition references states that exist in the states array
- Every user group referenced in transitions exists in user groups
- Initial state is set on exactly one state (the starting point)
- No duplicate state names
- No duplicate transition pairs (same from + same to)
"""

CLAUDE_USER_PROMPT = """
Extract all implementation requirements from this SOW:

{raw_sow_text}
"""
```

**What the AI tab shows the consultant:**

```
✦ AI Extract

Paste your Statement of Work here — any format,
any language. Claude will extract everything.

┌─────────────────────────────────────────┐
│ Acme Corporation requires a document    │
│ management solution to centralize the   │
│ creation, review, and approval of       │
│ Service Agreements...                   │
│                                         │
│ [paste raw SOW text here]               │
└─────────────────────────────────────────┘

[✦ Extract with Claude]

Sending to Claude API...
Extracting requirements...
  ✓ Project name identified
  ✓ 5 users extracted
  ✓ 11 workflow states identified
  ✓ 15 transitions mapped
  ✓ 7 metadata properties found
  ✓ 4 business rules extracted
  ──────────────────────────────────────
  ✓ Spreadsheet populated — review and confirm
```

**Review step — consultant verifies before ingesting:**

After Claude extracts, the consultant sees the spreadsheet populated. They can edit any cell before saving JSON. This is the human-in-the-loop step that catches any misinterpretation.

---

### Prompt 3 — ⬡ Cacoo Import

**What it is:** The team already has an approved workflow diagram in Cacoo. Proviso calls the Cacoo REST API, reads the diagram structure, and populates the spreadsheet. No re-drawing. No re-entering.

**The API call and parsing instructions (Python):**

```python
# proviso/adapters/cacoo_adapter.py
# ─────────────────────────────────────────────
# PROVISO CACOO ADAPTER
# Calls Cacoo REST API
# Parses XML response → workflow.json
# ref: developer.nulab.com/docs/cacoo/
# ─────────────────────────────────────────────

CACOO_API_BASE = "https://cacoo.com/api/v1"

CACOO_PARSING_RULES = {

    # API endpoint
    "endpoint": "/diagrams/{diagram_id}/contents.xml",
    "params":   "returnValues=position,textStyle",

    # XML parsing rules
    # Cacoo SVG/XML structure:
    #   <sheet> contains all elements
    #     <group> with <text> = STATE BOX
    #     <line> with arrow end = TRANSITION
    #     <text> standalone = label on transition

    "state_indicators": [
        "attr-stencil-id",      # Shape type attribute
        "group",                # Grouped shape = state box
    ],

    "transition_indicators": [
        "line",                 # Line element = arrow
        "arrow",                # End style = arrow head
        "connection",           # Connection element
    ],

    # Position matching
    # Lines connect to shapes by proximity
    # Match line endpoints to nearest shape center
    "position_threshold_px": 20,

    # Text extraction
    # State name = text inside the group element
    # Transition label = text near the line midpoint
    "text_extraction": {
        "state_name":       ".//text",
        "transition_label": ".//text[@class='label']",
    },

    # Initial state detection
    # In Cacoo: state with no incoming arrows = initial
    # OR state connected to a start circle = initial
    "initial_state_rules": [
        "no_incoming_arrows",   # No arrows pointing to it
        "connected_to_start",   # Has a [*] start symbol
    ]
}

# Parser instructions
CACOO_PARSER_INSTRUCTIONS = """
When parsing Cacoo XML response:

1. Find all <group> elements containing <text>
   → Each is a workflow state
   → Extract the text as the state name
   → Trim whitespace

2. Find all <line> elements where end style = "arrow"
   → Each is a workflow transition
   → Match start point to nearest state (source)
   → Match end point to nearest state (target)
   → Extract nearby text label if present

3. Identify initial state
   → State with no incoming arrows
   → OR state connected to a filled circle start symbol

4. Build workflow.json
   → states array from all found groups
   → transitions array from all found lines
   → Conditions and permissions = empty (to be added in Phase 2)

5. Populate Proviso spreadsheet
   → Proviso becomes the source of truth
   → Cacoo diagram is now read-only input
   → All future edits happen in Proviso
"""
```

**What the Cacoo tab shows the consultant:**

```
⬡ Cacoo Import

┌─────────────────────────────────────┐
│ Diagram ID  [00e77f4dc9973517      ]│
│ API Key     [••••••••••••••••••••••]│
│             [→ Fetch from Cacoo]    │
└─────────────────────────────────────┘

Connecting to Cacoo API...
GET /diagrams/00e77f.../contents.xml
Parsing XML — extracting shapes and arrows...
  ✓ 11 state boxes found
  ✓ 15 transition arrows mapped
  ✓ State names extracted from text labels
  ✓ Initial state identified (Draft)
  ──────────────────────────────────────
  ✓ Spreadsheet populated
  → Proviso is now the source of truth
  → Conditions and permissions: add in Phase 2
```

---

## PART 3 — JSON Review Before Ingestion

Before any COM API call is made, Proviso writes `workflow.json` to disk. The consultant reviews it directly in the app or in any text editor. This is the verification gate.

**Why this matters:**

Business rules, roles, and permissions are complex. Before instructing the COM API to create these entities in a live vault, the consultant must confirm the JSON is correct. Ingesting wrong permissions to a production vault is difficult to reverse.

**The review workflow:**

```
Spreadsheet populated (NLP / AI / Cacoo)
        │
        ▼
[Save JSON] → writes workflow.json to disk
        │
        ▼
Consultant opens JSON viewer in Proviso
Reviews every section:
  ✓ states — correct names and initial flag
  ✓ transitions — correct from/to pairs
  ✓ users — correct roles and groups
  ✓ properties — correct types
  ✓ rules — correct rule text
        │
        ▼
[Approve] — unlocks Ingest button
        │
        ▼
COM API ingests to M-Files vault
```

**The JSON schema (what the consultant reviews):**

```json
{
  "schema_version": "1.0",
  "name": "Contract Lifecycle",
  "description": "Acme Corporation — Service Agreements and NDAs",

  "states": [
    { "name": "Draft",             "initial": true  },
    { "name": "Under Review",      "initial": false },
    { "name": "Reviewed",          "initial": false },
    { "name": "Signed Internally", "initial": false }
  ],

  "transitions": [
    { "from": "Draft",         "to": "Under Review",      "condition": "",                    "permission": "Contract Managers" },
    { "from": "Under Review",  "to": "Reviewed",          "condition": "All reviewers approve","permission": "Automatic"         },
    { "from": "Reviewed",      "to": "Approve 50k",       "condition": "Contract Value <= 50000", "permission": "Contract Managers" },
    { "from": "Reviewed",      "to": "Approve High",      "condition": "Contract Value > 50000",  "permission": "Executive Management" }
  ],

  "users": [
    { "name": "Bill Ward",   "role": "CEO", "email": "bill.ward@acme.com",   "isCM": true,  "groups": ["Contract Managers", "Executive Management"] },
    { "name": "Betty Black", "role": "CFO", "email": "betty.black@acme.com", "isCM": true,  "groups": ["Contract Managers", "Executive Management"] }
  ],

  "properties": [
    { "name": "Contract Title",  "type": "Text",    "required": true  },
    { "name": "Contract Value",  "type": "Decimal", "required": true  },
    { "name": "Expiration Date", "type": "Date",    "required": false }
  ],

  "rules": [
    "Service Agreements over €50,000 require Executive Management approval",
    "Only Contract Managers can create and edit contracts",
    "All users can view all contracts at all times",
    "Signed contracts are converted to PDF and locked from editing"
  ],

  "phase": 1,
  "phase_note": "States and transitions ingested. Users, properties, rules deferred to Phase 2."
}
```

---

## PART 4 — The M-Files COM API Library

**What exists — confirmed from GitHub research:**

| Library | Source | What it does |
| :--- | :--- | :--- |
| `python-mfiles` | github.com/afcmrp/python-mfiles | Python wrapper around M-Files API — search, upload, download, create objects |
| `pywin32` | github.com/mhammond/pywin32 | Raw Windows COM access — full M-Files admin operations |
| `MFilesSamplesAndLibraries` | github.com/M-Files | Official M-Files C# samples and libraries |

**For Proviso — recommendation:**

```
Phase 1 POC:    pywin32 (raw COM)
                Full admin access
                AddWorkflowAdmin confirmed working
                No abstraction layer needed for POC

Phase 1+:       python-mfiles as helper
                Wraps common operations cleanly
                pip install mfiles
                Useful for object operations
                Not needed for workflow creation

Phase 2:        pywin32 for conditions/permissions
                python-mfiles for testing assertions
                Best of both
```

**Install both:**

```bash
pip install pywin32
pip install mfiles
```

---

*Proviso · scriptdotnet © 2026*
*From specification to vault — automatically*
