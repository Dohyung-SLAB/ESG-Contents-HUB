# Supabase 연결 가이드

## Supabase가 하는 일
- 앱 **외부**에 PostgreSQL DB를 둡니다 (클라우드).
- 지금처럼 서버 메모리(pilot store)가 아니라 DB에 데이터가 남습니다.
- Auth(로그인), Storage(파일)도 같은 프로젝트에서 쓸 수 있습니다.

## 1. 프로젝트 만들기 (1회)
1. https://supabase.com/dashboard 접속 후 로그인
2. **New project** 생성 (이름 예: `esg-content-hub`)
3. DB 비밀번호를 안전한 곳에 저장
4. Project Settings → **API**에서 복사:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (절대 프론트에 노출 금지)

## 2. `.env.local` 작성 (프로젝트 루트)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 3. 스키마 적용
Supabase Dashboard → **SQL Editor** → New query → 아래 파일을 순서대로 붙여넣기 실행:
1. `supabase/migrations/20260813000000_init_esg_schema.sql`
2. `supabase/migrations/20260813000001_rls_policies.sql`
3. `supabase/seed.sql`

또는 키가 준비되면:
```bash
npm run seed:samlip
```
(시드는 service role로 데이터 삽입. 스키마는 SQL Editor로 먼저 적용 권장)

## 4. 데모 사용자 (profiles)
시드에는 `auth.users`가 없어서 profiles가 비어 있습니다. 한 번 실행:
```bash
npm run ensure:demo-users
```
생성 계정 (비밀번호 공통 `SamlipDemo1!`):
- admin@samlip.local (ADMIN)
- contributor@samlip.local (CONTRIBUTOR)
- reviewer@samlip.local (REVIEWER)

## 5. 앱 연결 확인
`.env.local`이 있으면 앱이 **자동으로 Supabase**를 읽기/쓰기합니다 (서비스 롤, 서버 전용).
없으면 기존 in-memory pilot store로 동작합니다.

```bash
npm run verify:supabase
npm run dev
```

## Beyond-MVP (멀티 프로젝트 · TOC 추출 · 보고서 초안)
SQL Editor에서 `supabase/combined/beyond_mvp.sql` 실행 후:
```bash
npm run apply:beyond-mvp
npm run ensure:demo-users
```
자세한 QA: `docs/FULL_PRODUCT_QA.md`


## 키 형식 참고
새 API 키(`sb_publishable_…` / `sb_secret_…`)도 지원합니다.
`NEXT_PUBLIC_SUPABASE_ANON_KEY`에 publishable, `SUPABASE_SERVICE_ROLE_KEY`에 secret을 넣으면 됩니다.