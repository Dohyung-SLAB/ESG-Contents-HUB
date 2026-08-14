# Task 13 — Extraction Review

## 목적

AI가 PDF에서 추출한 Content Block 후보를 사람이 검토하여 Content Library에 반영하도록 구현합니다.

## Cursor 요청문

PDF Extraction 결과를 검토하는 `/extraction/[jobId]` 화면을 구현해줘.

### 상단 Summary

- Total Candidates
- High Confidence
- Review Required
- Attention

Confidence 예:
- 0.90 이상: High
- 0.75~0.89: Review
- 0.75 미만: Attention

### Candidate Table

Column:
- Select
- Suggested Block
- Section
- Content Type
- Update Type
- Source Page
- Confidence
- Review Status

### Actions

각 Candidate:
- Approve
- Rename
- Edit Type
- Edit Update Type
- Edit Narrative
- Merge
- Split
- Delete

### Source Viewer

Candidate 선택 시:
- Source Page
- Source Text
를 우측에 보여줘.

가능하면 향후 PDF 하이라이트를 붙일 수 있도록 source mapping 구조는 유지.

### Approve Logic

Approve 시:
1. content_blocks INSERT
2. content_versions INSERT
3. key_facts INSERT
4. Source 정보 저장

Initial Version:
- imported report year
- status = APPROVED
- change_type = NEW

### Merge

복수 Candidate를 하나의 Block으로 통합.

### Split

한 Candidate를 2개 이상 Block으로 나눌 수 있게 하되,
MVP에서는 간단한 Dialog 기반 Manual Split도 허용.

### 완료 조건

- Candidate 승인 가능
- Merge/Split 가능
- 승인 후 Library에서 조회 가능
