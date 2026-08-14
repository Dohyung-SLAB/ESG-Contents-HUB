# Task 09 — AI Change Summary

## 목적

전년 대비 변경사항을 구조화하고 요약하는 첫 번째 AI 기능을 구현합니다.

## Cursor 요청문

현재 Annual Update Workflow가 정상 동작하는 것을 먼저 확인한 뒤 OpenAI Responses API를 이용해 Change Summary 기능을 구현해줘.

### 원칙

가능한 단순 Numeric 비교는 LLM을 사용하지 말고 Rule 기반으로 처리.

예:
- 188 → 205
- 99% → 98%

LLM은:
- 정성 변경사항
- 복합 변경사항의 자연어 요약

에만 사용.

### Input

- Previous Narrative
- Previous Key Facts
- Current Form Input
- Current Key Facts

### Output Structured JSON

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

### CT-006 기대 결과

Previous:
- 적용 매장 188개
- 모의훈련 반기 1회

Current:
- 적용 매장 205개
- 모의훈련 반기 1회

Summary 예:
`적용 매장이 188개에서 205개로 확대되었으며, 모의훈련 주기는 반기 1회로 유지되었습니다.`

### 저장

AI 결과는 바로 Content Version에 확정 저장하지 말고 `ai_suggestions`에 먼저 저장.

사용자가 Apply하면 `change_summary`에 반영.

### 오류 처리

- API 실패
- JSON validation 실패
- timeout
- unsupported response

처리.

### 완료 조건

- Change Summary 생성
- Suggestion 저장
- Apply 가능
- Regenerate 가능
