# Task 10 — AI Narrative Update

## 목적

확정된 변경사항과 Evidence를 기반으로 당해연도 보고서용 Narrative 수정안을 생성합니다.

## Cursor 요청문

Change Summary 기능이 정상 동작하는지 먼저 확인한 후 Narrative Update 기능을 구현해줘.

### Input

- Previous Narrative
- Previous Key Facts
- Current Key Facts
- Confirmed Changes
- Evidence Facts

### System Rules

반드시 아래 원칙을 Prompt에 명시해줘.

1. 새로운 사실을 생성하지 않는다.
2. 입력에 없는 활동을 추가하지 않는다.
3. 수치를 임의 생성하지 않는다.
4. 변경되지 않은 정보는 불필요하게 수정하지 않는다.
5. Evidence가 불충분하면 `[확인 필요]`로 표시한다.
6. 이전 공시의 의미와 톤을 가능한 유지한다.
7. AI 결과는 최종 공시가 아니라 Suggestion이다.

### Output

```json
{
  "suggestedNarrative": "",
  "warnings": [],
  "unsupportedClaims": []
}
```

### UI

Annual Update 화면 하단:

- Generate Suggestion
- Apply
- Edit
- Regenerate
- Reject

### 저장

`ai_suggestions`에 저장.
Apply한 경우에만 Current Version narrative에 반영.

### 완료 조건

- AI 수정안 생성
- 직접 편집 가능
- Apply/Reject 가능
- 미지원 Claim Warning 표시
