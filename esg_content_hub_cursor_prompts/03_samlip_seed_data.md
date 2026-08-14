# Task 03 — Samlip Pilot Seed Data

## 목적

삼립의 `소비자 신뢰 확보` 이슈를 파일럿 데이터로 등록하여 이후 UI와 Workflow를 검증합니다.

## Cursor 요청문

현재 Database Schema를 확인한 후 MVP 테스트를 위한 Seed Data를 만들어줘.

### Company

- 회사명: 삼립

### Base Project

- Project Name: `2026 Sustainability Report`
- Reporting Year: 2026
- Status: COMPLETED

### Current Project

- Project Name: `2027 Sustainability Report`
- Reporting Year: 2027
- Base Year: 2026
- Status: ACTIVE

### Issue

- Name: `소비자 신뢰 확보`
- Category: SOCIAL

### Content Blocks

아래 18개 Content Block을 생성해줘.

1. CT-001 소비자중심경영 체계
2. CT-002 소비자 신뢰 확보 추진 조직
3. CT-003 VOC·CCM 운영 회의체
4. CT-004 소비자 신뢰 관련 위험 및 기회
5. CT-005 소비자 신뢰 확보 중장기 로드맵
6. CT-006 위해상품 판매차단 시스템
7. CT-007 사업장 식품안전 점검
8. CT-008 식품안전 교육
9. CT-009 식품안전 인증
10. CT-010 식품안전·품질경영 내재화
11. CT-011 VOC 운영
12. CT-012 소비자분쟁 대응
13. CT-013 통합 VOC 시스템 고도화
14. CT-014 고객 중심 혁신제품
15. CT-015 고객 브랜드 경험
16. CT-016 식품안전 이슈 모니터링
17. CT-017 클레임 관리 목표 및 실적
18. CT-018 VOC 운영 실적

### Content Type / Update Type 예시

- CT-001: GOVERNANCE / NARRATIVE
- CT-002: GOVERNANCE / STRUCTURE
- CT-003: GOVERNANCE / STRUCTURE
- CT-004: RISK_OPPORTUNITY / NARRATIVE
- CT-005: STRATEGY / TARGET
- CT-006: ACTIVITY / ACTIVITY
- CT-007: PERFORMANCE / NUMERIC
- CT-008: ACTIVITY / ACTIVITY
- CT-009: CERTIFICATION / CERTIFICATION
- CT-010: ACTIVITY / NARRATIVE
- CT-011: PROCESS / ACTIVITY
- CT-012: PROCESS / NARRATIVE
- CT-013: ACTIVITY / ACTIVITY
- CT-014: ACTIVITY / ACTIVITY
- CT-015: ACTIVITY / ACTIVITY
- CT-016: RISK_OPPORTUNITY / NARRATIVE
- CT-017: TARGET / NUMERIC
- CT-018: PERFORMANCE / NUMERIC

### CT-006 샘플 데이터

2026 Version에 다음 Key Fact를 생성해줘.

- 적용 매장 = 188 / 단위: 개 / NUMBER
- 모의훈련 주기 = 반기 1회 / FREQUENCY

2026 Version 상태:
- APPROVED

2027 Version:
- previous_version_id = 2026 Version
- status = NOT_STARTED
- change_type = PENDING

### CT-018 샘플 Key Facts

2025 또는 Base Data로 다음 값을 등록해 UI 테스트가 가능하게 해줘.

- 문의 건수 = 11607
- 불만 건수 = 2185
- 칭찬·제안 = 445
- 처리비율 = 99%
- 상담 만족도 = 93점

### Dynamic Form Schema

CT-018에는 다음 입력폼이 자동 생성되도록 `form_schema`를 넣어줘.

- 문의 건수
- 불만 건수
- 칭찬·제안
- 처리비율
- 상담 만족도

### 주의

실제 보고서에 없는 내용을 임의로 사실처럼 확장하지 말고, Seed Data는 UI/Workflow 테스트 목적임을 코드 주석으로 남겨줘.

### 완료 조건

- Seed script 실행 가능
- 18개 Block 생성
- 2026/2027 Version 관계 정상
- CT-006 및 CT-018 샘플 데이터 조회 가능
