## Source of Truth

Always read and follow:

C:\Users\KenRK\OneDrive\Desktop\KRK-Donations\docs\app-overview\app-overview.md

This file defines the architecture, rules, and intent of the system.
Do not proceed with any changes without aligning to it.

If anything is unclear, incomplete, or conflicting, ask questions before proceeding.
Do not make assumptions. If the user is creating a feature not listed in this doc, ask if they want the overview updated and added to this doc..

---
## Project information
"C:\Users\KenRK\OneDrive\Desktop\KRK-Donations\docs"
This is the docs folder where updates and plans are stored. This is an important repo and needs to be maintained.


## Project Folder Requirements

For every new task or feature:

Create a new folder in:
C:\Users\KenRK\OneDrive\Desktop\KRK-Donations\docs\projects

Folder name must clearly describe the task.

Inside the folder, create and maintain the following files:

---

### updates.md

Purpose: Track all changes made during the project.

Rules:

* Add a new entry for every meaningful change
* Each entry must include:

  * Date
  * AI model used (Claude, Codex, Gemini, etc.)
  * Description of the change
* Keep entries chronological

---

### plans.md

Purpose: Document plans before making changes.

Rules:

* Organize by sections
* Clearly describe intended changes
* Include reasoning for decisions
* Update this file before implementing changes
* Revise plans if direction changes

---

### summary.md

Purpose: Final summary of completed work.

Rules:

* Only update once the project is complete
* Summarize:

  * What was built or changed
  * Key decisions made
  * New features or improvements

---

## Editing Rules

* Always review existing code before making changes
* Do not assume variables, structures, or logic exist
* Confirm dependencies and relationships before editing
* Make precise, minimal changes where possible
* Avoid introducing regressions

---

## Safety and Quality

* Act conservatively and carefully
* Watch for bugs, edge cases, and data integrity issues
* Flag unclear or risky logic before proceeding
* Prefer correctness over speed

---

## Communication

* Ask follow-up questions when requirements are unclear
* Do not proceed on uncertain assumptions
* Highlight potential flaws or better approaches when identified

---

## General Behavior

* Stay aligned with the system design at all times
* Maintain consistency across all changes
* Prioritize accuracy, maintainability, and clarity
* Do not overbuild beyond the defined scope without justification