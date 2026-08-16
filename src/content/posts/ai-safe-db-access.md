---
title: AI로 데이터베이스에 안전하게 접근하기
description: LLM·MCP로 DB를 다룰 때 지켜야 할 원칙 — 최소 권한, 읽기 전용, PII 마스킹, 쿼리 가드레일, 감사
pubDatetime: 2026-08-11T09:00:00Z
tags:
  - ai
  - mcp
  - database
  - security
---

MCP(Model Context Protocol) 같은 도구로 LLM이 DB에 직접 붙어 쿼리하는 일이 흔해졌다. 편리한 만큼, "AI가 프로덕션 DB에 아무 쿼리나 날릴 수 있다"는 위험도 같이 온다. DBA 관점에서 최소한 지켜야 할 것들을 정리한다.

## 1. 전용 계정 · 최소 권한

AI에게 개인 계정이나 관리자 계정을 절대 주지 않는다. **AI 전용 계정**을 따로 만들고 딱 필요한 권한만 준다.

```sql
CREATE USER 'ai_readonly'@'%' IDENTIFIED BY '****';
GRANT SELECT ON analytics.* TO 'ai_readonly'@'%';   -- 특정 스키마의 읽기만
-- DDL·DML·GRANT는 주지 않는다
```

> [!warning]
> `SELECT ON *.*` 도 넓다. 필요한 스키마/테이블로 좁히고, `mysql`·시스템 스키마는 제외한다.

## 2. 읽기 전용 · 프로덕션 분리

가능하면 AI는 **리드 리플리카나 개발/스테이징 DB**에 붙인다. 프로덕션 마스터 직결은 피한다. 쓰기 워크로드에서 격리되고, 사고가 나도 서비스 영향이 없다.

## 3. PII 마스킹

읽기 전용이라도 **민감 데이터가 그대로 노출**되면 곤란하다. 민감 컬럼은 마스킹 뷰로 감싸고, AI 계정은 원본 테이블 대신 그 뷰만 보게 한다.

```sql
CREATE VIEW analytics.users_masked AS
SELECT id,
       CONCAT(LEFT(name, 1), '**')                   AS name,
       CONCAT(SUBSTRING(phone,1,3),'****',RIGHT(phone,4)) AS phone,
       created_at
FROM   analytics.users;

GRANT SELECT ON analytics.users_masked TO 'ai_readonly'@'%';
-- 원본 analytics.users 에는 권한을 주지 않는다
```

## 4. 쿼리 가드레일

계정 권한만으로 부족하면 접근 계층(프록시·MCP 서버)에서 한 번 더 막는다.

- 위험 구문 차단 — `DROP`, `DELETE`, `UPDATE`, `TRUNCATE`
- `LIMIT` 강제 — 대량 스캔·전량 반출 방지
- 실행 시간 제한 — `max_execution_time`(MySQL) 등으로 폭주 쿼리 차단
- 허용 스키마/테이블 화이트리스트

```sql
-- 세션 레벨 타임아웃 (MySQL 8.0, ms)
SET SESSION max_execution_time = 5000;
```

## 5. 감사 로그

"AI가 무슨 쿼리를 했는가"를 반드시 남긴다. 감사 플러그인이나 접근 계층 로그로 **계정·쿼리·시각**을 기록해 두면 사고 조사와 컴플라이언스(ISMS 등) 대응이 된다.

## 6. 자격증명 관리

접속 정보는 코드/설정 파일에 평문으로 두지 않는다. 환경변수나 시크릿 매니저로 주입하고, AI 도구에 넘기는 범위를 최소화한다.

## 정리

- AI에는 **전용 계정 + 최소 권한**, 관리자 계정 금지
- **리플리카/개발 DB**에 붙이고 프로덕션 직결은 지양
- 민감 컬럼은 **마스킹 뷰**로만 노출
- 접근 계층에서 **위험 구문 차단·LIMIT·타임아웃**
- **감사 로그**로 추적 가능하게, 자격증명은 시크릿으로

편의와 안전은 트레이드오프가 아니다. 위 레이어를 깔아두면 AI를 안전하게 "읽기 도우미"로 쓸 수 있다.
