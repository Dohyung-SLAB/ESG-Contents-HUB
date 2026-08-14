# Task 12 — PDF Content Extraction

## 목적

기존 지속가능경영보고서 PDF를 업로드하면 AI가 Content Block 후보를 자동 추출하도록 구현합니다.

## Cursor 요청문

기존 Workflow가 정상 동작하는지 먼저 확인한 후 PDF Extraction 기능을 구현해줘.

### 처리 순서

1. PDF Upload
2. Supabase Storage 저장
3. extraction_jobs 생성
4. 페이지별 Parsing
5. Structure Detection
6. Content Block Extraction
7. Content Type / Update Type 분류
8. Key Fact Extraction
9. Candidate 저장
10. Review Required 상태

### AI 처리

MVP에서는 호출을 다음 4단계로 나눠줘.

A. Document Structure Detection  
B. Content Block Extraction + Classification  
C. Key Fact Extraction  
D. QA / Confidence

### Content Block 판단 기준

별도 Block은 아래 기준을 고려.

1. 독립적으로 관리 가능한가
2. 별도 담당자가 존재할 수 있는가
3. 별도 Evidence가 존재할 수 있는가
4. 다음 연도에 독립적으로 변경될 수 있는가
5. 다른 공시에서 재사용 가능한가

### Structured Output

각 Candidate:

- title
- section
- subTopic
- contentType
- updateType
- narrative
- keyFacts
- source.page
- source.sourceText
- confidence

### 절대 규칙

- Source에 없는 사실 생성 금지
- 수치 추정 금지
- Source Page 필수
- Enum 외 Content Type 생성 금지
- Enum 외 Update Type 생성 금지

### 저장

AI 결과는 `content_blocks`가 아니라 `extraction_candidates`에 저장.

### 완료 조건

- PDF Upload 가능
- Extraction Job 진행상태 표시
- Candidate 생성
- Source Page 저장
- Confidence 저장
