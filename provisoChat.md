# Proviso Chat Notes

Date: 2026-05-12
Context: Beta III planning and UX direction for Proviso AI

## Conversation Capture

### User Vision (captured)
- Proviso should become AI-aware so consultants can paste natural language scenarios.
- AI/NLP should generate custom states, transitions, permissions, and render the diagram while edits are entered.
- Proviso should capture institutional knowledge from prior vault implementations and make that reusable for future clients.
- JSON should remain the canonical working format until export time.
- Export to M-Files should happen as a final one-way conversion step via COM API.
- A master reusable folder/library structure should include workflows, OCR mappings, ERP mappings, and projects.

### Key Product Framing
- Proviso is not only a workflow editor.
- Proviso is an institutional knowledge platform for DMS implementations.
- Value levels:
  1. Speed
  2. Consistency
  3. Knowledge capture (most strategic)

### Architecture Agreement
- Keep integrity in spreadsheet/store layer.
- AI should propose changes, not directly overwrite live state.
- Required flow:
  1. Scenario input
  2. AI extraction
  3. Canonical normalization
  4. Validation
  5. Diff review
  6. Apply approved changes
  7. Render + export

### Repository and Library Structure
User-provided structure included:
- `proviso_master/workflows/*`
- `proviso_master/ocr/*`
- `proviso_master/erp/*`
- `proviso_master/projects/*`
- Metadata-driven template discovery (`metadata.json`)
- Project linkage and lineage (`project.json`)

### Assistant Recommendations Accepted
- Use canonical JSON model as platform core.
- Add a full AI workspace, not just a small prompt box.
- Implement three interaction levels:
  1. Quick prompt bar
  2. AI side panel
  3. Focus mode for long NLP input
- Add context settings for:
  - Workflow type
  - Mode (create/adapt/simplify)
  - OCR provider
  - ERP provider
  - Safety mode (diff required)
- Keep Mermaid for now unless diagram-native editing becomes a primary requirement.

### Beta III GUI Guidance
- Expandable/resizable AI panel.
- Dedicated context builder.
- Diff drawer with selective apply.
- Focus mode modal for long scenario paste.
- Project profile/settings screen to set AI defaults.

## Artifacts Created During This Chat

1. `ProvisoAI_Plan.md`
- Technical implementation plan with architecture, mermaid diagrams, roadmap, metadata model, and sprint progression.

2. `ProvisoAI_BetaIII_Mockup.html`
- Visual HTML mockup of the Beta III workspace including:
  - Spreadsheet + diagram layout
  - AI Studio panel
  - Context selectors
  - Diff drawer
  - Focus Mode scenario composer

## Shared Strategic Message
"Proviso captures every workflow, every OCR mapping, every ERP integration as reusable JSON templates. When a new client arrives, you describe what they need, AI adapts the closest existing template, and export to M-Files in hours. Every implementation makes the next one faster."

## Next Suggested Step
- Convert Beta III UI into a wireframe specification with screen-by-screen user flows and acceptance criteria.
