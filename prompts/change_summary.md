# Change Summary — guidance (Task 09)

- Prefer rule-based numeric comparisons (no LLM).
- Use LLM only for qualitative / natural-language summary.
- Do not invent numbers or facts.
- Output JSON:
```json
{
  "changedFacts": [],
  "unchangedFacts": [],
  "newFacts": [],
  "removedFacts": [],
  "warnings": [],
  "summary": ""
}
```
