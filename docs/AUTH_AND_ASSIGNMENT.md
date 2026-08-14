# Auth rules (updated)

## 가입 규칙
| 대상 | 이메일 | 역할 |
|------|--------|------|
| 컨설턴트 | `*@sustainlab.co.kr`만 | ADMIN |
| 현업 / ESG | 컨설턴트가 Settings에서 **초대한 이메일만** | CONTRIBUTOR / REVIEWER |

## 권장 흐름
1. 컨설턴트가 `@sustainlab.co.kr`로 `/signup`
2. Settings에서 고객사·프로젝트 생성
3. Settings → **고객사 담당자 초대**에 이메일 등록
4. 고객사가 그 이메일로 `/signup` → 자동으로 프로젝트 멤버십 부여

## 데이터 초기화
```bash
npm run wipe:all
```
모든 회사·프로젝트·컨텐츠·프로필·Auth 사용자를 삭제합니다.

## SQL (권장)
`supabase/migrations/20260814000000_project_invites.sql` 을 Supabase SQL Editor에서 실행하면
초대가 DB 테이블에 저장됩니다. 미적용 시 Storage 버킷 `app-invites`로 동작합니다.
