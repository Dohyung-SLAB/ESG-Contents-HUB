# TOC Section Extraction

Two-pass pipeline:
1. Extract hierarchical **outline** with kinds: category | content | case | target.
2. Split body by outline titles; create candidates only for content / case / target.

## Kind definitions
- **category**: Report hierarchy labels that group content but are NOT writing blocks  
  (e.g. 준법경영 체계, 준법경영 추진 활동). Shown in diagnostics only.
- **content**: Actual Content Blocks (e.g. 준법경영 추진 방향, 교육, 제도 운영).
- **case**: Case / CASE / 사례 items.
- **target**: Goals/KPIs attached to a parent content (e.g. 컴플라이언스 목표 → parent 준법경영 추진 방향).

## Content Type
Do **not** pre-assign a fixed type from the TOC name. Infer from each segment’s narrative character, and allow reviewers to change it in the UI.

## Candidate rules
- One candidate per content/case/target segment. Never merge.
- Full verbatim narrative; tables as Markdown.
- title = TITLE_HINT exactly.
- section may include parent category path.
- Return JSON only.
