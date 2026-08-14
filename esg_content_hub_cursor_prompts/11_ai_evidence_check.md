# Task 11 — AI Evidence Check

## 목적

사용자가 입력한 주요 Claim과 Evidence 간 기본 정합성을 AI가 확인하도록 구현합니다.

## Cursor 요청문

Evidence Upload와 Narrative Update가 정상 동작하는 것을 확인한 후 Evidence Check 기능을 구현해줘.

### 검토 대상

- Current Key Facts
- Change Summary
- Suggested Narrative의 주요 Claim

### Evidence

연결된 PRIMARY/SUPPORTING Evidence에서 관련 정보를 추출해 비교.

### Output

```json
{
  "checks": [
    {
      "claim": "",
      "status": "SUPPORTED",
      "evidenceId": "",
      "reason": ""
    }
  ],
  "warnings": []
}
```

Status:
- SUPPORTED
- PARTIALLY_SUPPORTED
- NOT_SUPPORTED
- REVIEW_REQUIRED

### 원칙

AI가 승인 여부를 결정하지 않는다.
Evidence Check는 Reviewer 참고정보다.

### UI

Annual Update 및 Review에:
- 체크 아이콘
- Warning 아이콘
- Evidence 연결
- 근거 설명

표시.

### 완료 조건

- Key Fact 기반 Evidence Check 가능
- Reviewer가 결과 확인 가능
- AI Check 결과가 Approval을 자동 실행하지 않음
