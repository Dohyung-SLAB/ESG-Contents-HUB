# Task 01 — Project Scaffolding

## 목적

ESG Content Hub MVP의 기본 Next.js 프로젝트 구조와 UI shell을 구축합니다.

## Cursor 요청문

현재 저장소를 먼저 분석한 후 아래 작업을 수행해줘.

### 목표

Next.js + TypeScript 기반의 ESG Content Hub MVP 프로젝트 골격을 만든다.

### 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- TanStack Table
- Supabase SDK
- OpenAI SDK는 설치만 하되 아직 기능 구현하지 않음

### 기본 화면

아래 Route를 생성해줘.

- `/login`
- `/dashboard`
- `/library`
- `/update/[blockId]`
- `/review`
- `/evidence`
- `/extraction/[jobId]`

### 공통 Layout

좌측 사이드바 메뉴:

- Dashboard
- Content Library
- Annual Update
- Review
- Evidence
- Settings

상단에는:

- Company
- Project
- Reporting Year
- User Profile

영역을 표시할 수 있도록 기본 Header를 만들어줘.

### 디자인 원칙

- B2B SaaS 스타일
- 흰색 배경
- 차분한 회색/네이비 계열 기본 UI
- 기업별 브랜드 컬러를 나중에 Theme로 적용할 수 있는 구조
- 카드, 테이블, 상태 Badge 중심
- 모바일보다 Desktop 사용성을 우선

### 폴더 구조

다음 구조를 기본으로 잡아줘.

- `app/`
- `components/dashboard`
- `components/library`
- `components/update`
- `components/review`
- `components/evidence`
- `components/extraction`
- `lib/supabase`
- `lib/openai`
- `lib/services`
- `lib/validators`
- `types`
- `supabase/migrations`
- `prompts`

### 이번 단계에서 하지 말 것

- Supabase 실제 테이블 생성
- AI 호출
- PDF Parsing
- 실제 로그인 권한 구현
- 복잡한 상태관리

### 완료 조건

1. 모든 Route가 최소 placeholder 화면으로 접근 가능
2. 공통 Sidebar/Header가 정상 표시
3. TypeScript 오류 없음
4. lint 통과
5. production build 통과

작업이 끝나면:
- 생성/수정한 파일 목록
- 구조 설명
- 다음 Task 전에 확인해야 할 사항
을 요약해줘.
