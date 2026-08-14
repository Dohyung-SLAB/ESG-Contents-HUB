# Task 06 — Evidence Management

## 목적

Content Version별 근거자료를 업로드하고 재사용할 수 있도록 Evidence 관리 기능을 구현합니다.

## Cursor 요청문

현재 Supabase Storage와 Evidence Schema를 기반으로 Evidence 기능을 구현해줘.

### 기능

#### Evidence Upload
Annual Update 화면에서:
- drag & drop
- 파일 선택

지원 파일:
- PDF
- DOCX
- XLSX
- PPTX
- CSV
- 이미지

### 저장

파일:
- Supabase Storage

Metadata:
- evidences table

Mapping:
- content_evidences table

### relationship_type

업로드 시 사용자가 선택 가능:

- PRIMARY
- SUPPORTING
- REFERENCE

기본값:
- SUPPORTING

### Evidence Library

`/evidence` 화면 구현.

Column:
- Filename
- Document Type
- Reporting Year
- Department
- Uploaded By
- Uploaded At
- Linked Content Blocks

### 재사용

하나의 Evidence가 여러 Content Version과 연결될 수 있도록 UI 구현.

### 삭제

파일 자체 삭제와 Mapping 해제를 분리해줘.

- Unlink: 관계만 제거
- Delete Evidence: 실제 파일 및 Metadata 삭제

실제 삭제는 ADMIN만 가능하도록 함수 구조를 만들어줘.

### 완료 조건

- CT-006에 Evidence 업로드 가능
- 업로드한 Evidence가 Annual Update/Library 양쪽에 표시
- 동일 Evidence를 다른 Block과 연결 가능
- Unlink 가능
