---
title: MySQL Online DDL 정리
description: MySQL을 운영하다 보면 결국 ALTER TABLE 을 해야 하는 순간이 온다. 컬럼을 추가하거나, 인덱스를 만들거나, 컬럼 타입을 바꾸거나, PK를 바꿔야 할 때가 있다. 문제는 DDL은 자주 하지 않지만 한…
pubDatetime: 2026-05-11T06:28:19.484Z
tags:
  - mysql
  - database
  - ddl
---
## Introduction

MySQL을 운영하다 보면 결국 `ALTER TABLE`을 해야 하는 순간이 온다.

컬럼을 추가하거나, 인덱스를 만들거나, 컬럼 타입을 바꾸거나, PK를 바꿔야 할 때가 있다. 문제는 DDL은 자주 하지 않지만 한 번 잘못 실행하면 영향이 크다는 점이다. 특히 큰 테이블에 무심코 `ALTER TABLE`을 날렸다가 metadata lock이나 table copy 때문에 서비스가 멈출 수 있다.

예전에는 “Online DDL이면 괜찮겠지” 정도로 생각했는데, 실제로는 Online DDL도 종류가 있고, MySQL 버전과 작업 종류에 따라 동작이 다르다. 그래서 `COPY`, `INPLACE`, `INSTANT`, 그리고 `pt-online-schema-change`를 한 번 정리해둔다.

## MySQL ALTER TABLE의 세 가지 접근 방식

MySQL InnoDB의 DDL은 크게 아래 알고리즘으로 이해하면 된다.

- `COPY`
- `INPLACE`
- `INSTANT`
정확히는 작업 종류마다 지원하는 알고리즘과 lock level이 다르다. MySQL 공식 문서에서도 online DDL은 instant/in-place 변경과 concurrent DML을 지원한다고 설명한다.

### COPY

`COPY`는 가장 단순하지만 가장 부담이 큰 방식이다.

대략 이런 식으로 동작한다.

1. 새 정의를 가진 임시 테이블을 만든다.
1. 기존 테이블 데이터를 새 테이블로 복사한다.
1. 복사가 끝나면 테이블을 교체한다.
큰 테이블에서는 시간이 오래 걸리고, 추가 디스크 공간도 필요하다. 무엇보다 작업 중 읽기/쓰기가 제한될 수 있다. 운영 테이블에서 가장 피하고 싶은 방식이다.

물론 모든 변경을 online으로 할 수 있는 것은 아니기 때문에, MySQL이 결국 `COPY`를 선택해야 하는 경우도 있다. 그래서 운영에서는 명시적으로 `ALGORITHM=INPLACE`나 `ALGORITHM=INSTANT`를 지정해서, 기대한 방식으로 실행되지 않으면 실패하게 만드는 편이 안전하다.

```sql
ALTER TABLE your_table
  ADD INDEX idx_created_at (created_at),
  ALGORITHM=INPLACE,
  LOCK=NONE;
```

이렇게 하면 MySQL이 `LOCK=NONE`으로 처리할 수 없을 때 조용히 더 강한 lock으로 진행하는 대신 실패한다. 실패하는 게 서비스 멈추는 것보다 낫다.

### INPLACE

`INPLACE`는 MySQL 5.6부터 본격적으로 사용된 online DDL 방식이다. 이름만 보면 테이블을 전혀 건드리지 않는 것처럼 느껴지지만, 항상 그런 뜻은 아니다.

`INPLACE`라고 해도 내부적으로 table rebuild가 필요한 작업이 있다. 반대로 secondary index 추가처럼 기존 clustered index data를 그대로 두고 처리할 수 있는 작업도 있다.

중요한 건 `INPLACE`가 “항상 즉시 끝난다”는 뜻도 아니고, “항상 lock이 없다”는 뜻도 아니라는 점이다.

운영에서 나는 `INPLACE`를 이렇게 이해하는 편이 좋다고 생각한다.

- `COPY`보다는 낫다.
- DML과 병행 가능한 경우가 많다.
- 그래도 metadata lock은 필요하다.
- 작업 종류에 따라 table rebuild가 발생할 수 있다.
- 작업 시작/종료 시 짧은 lock이 문제가 될 수 있다.

### INSTANT

`INSTANT`는 MySQL 8.0에서 중요해진 방식이다. MySQL 8.0.12부터 `ADD COLUMN` 같은 일부 작업에 `ALGORITHM=INSTANT`를 사용할 수 있다.

`INSTANT`는 이름 그대로 데이터 파일을 다시 쓰지 않고 metadata 변경에 가깝게 처리한다. 그래서 지원되는 작업이라면 훨씬 빠르다.

예를 들어 지원되는 조건에서 컬럼을 추가할 때는 아래처럼 실행할 수 있다.

```sql
ALTER TABLE your_table
  ADD COLUMN memo varchar(255) NULL,
  ALGORITHM=INSTANT;
```

다만 `INSTANT`도 만능은 아니다. 모든 DDL이 instant로 되는 것은 아니고, MySQL 버전에 따라 지원 범위가 다르다. MySQL 8.0에서도 row version limit 같은 제한에 걸리면 instant add/drop column이 거절될 수 있다.

그래서 “8.0이면 ALTER는 안전하다”가 아니라, 내가 실행하려는 ALTER가 실제로 어떤 algorithm을 타는지 확인해야 한다.

## LOCK=NONE을 믿되, 검증해야 한다

Online DDL에서 `LOCK` clause는 중요하다.

공식 문서 기준으로 `LOCK=NONE`은 읽기와 쓰기를 허용하고, `LOCK=SHARED`는 읽기를 허용한다. `LOCK=EXCLUSIVE`는 다른 접근을 막는다.

운영에서는 보통 아래처럼 명시하는 편이 안전하다.

```sql
ALTER TABLE your_table
  ADD INDEX idx_status_created_at (status, created_at),
  ALGORITHM=INPLACE,
  LOCK=NONE;
```

이렇게 했는데 해당 작업이 `LOCK=NONE`으로 불가능하면 MySQL은 실패한다. 이 실패는 좋은 실패다. 적어도 예상하지 못한 lock으로 운영 테이블을 오래 잡는 상황은 피할 수 있기 때문이다.

## Metadata lock이 진짜 문제일 때가 많다

Online DDL이라고 해도 metadata lock은 피할 수 없다.

MySQL은 table structure와 관련된 일관성을 위해 metadata lock을 사용한다. `ALTER TABLE`은 시작할 때도, 끝날 때도 metadata lock이 필요하다. 문제는 오래 실행 중인 transaction이나 query가 table metadata lock을 잡고 있으면, ALTER가 기다린다는 점이다.

더 위험한 건 ALTER가 metadata lock을 기다리는 동안 그 뒤로 들어오는 query들이 줄줄이 막히는 상황이다.

운영에서 DDL 전에 확인할 것:

```sql
SELECT
  OBJECT_SCHEMA,
  OBJECT_NAME,
  LOCK_TYPE,
  LOCK_STATUS,
  OWNER_THREAD_ID
FROM performance_schema.metadata_locks
WHERE OBJECT_SCHEMA = 'your_schema'
  AND OBJECT_NAME = 'your_table';
```

그리고 오래 열린 transaction도 같이 본다.

```sql
SELECT
  trx_id,
  trx_started,
  trx_mysql_thread_id,
  trx_query
FROM information_schema.innodb_trx
ORDER BY trx_started;
```

Online DDL 자체보다 metadata lock 대기가 장애로 이어지는 경우가 많아서, 이 부분은 실제 실행 전 꼭 보는 편이 좋다.

---

## 작업별로 판단해야 한다

DDL은 작업 종류에 따라 위험도가 다르다.

### 인덱스 추가

Secondary index 추가는 많은 경우 `INPLACE`, `LOCK=NONE`으로 처리할 수 있다. 그래도 큰 테이블에서는 CPU, I/O, temp space를 사용한다.

```sql
ALTER TABLE orders
  ADD INDEX idx_user_created_at (user_id, created_at),
  ALGORITHM=INPLACE,
  LOCK=NONE;
```

이 작업은 읽기/쓰기와 병행될 수 있어도, 부하가 없는 것은 아니다. 피크 타임에 실행하면 쿼리 latency가 튈 수 있다.

### 컬럼 추가

MySQL 8.0에서는 조건이 맞으면 `INSTANT`로 처리할 수 있다.

```sql
ALTER TABLE orders
  ADD COLUMN memo varchar(255) NULL,
  ALGORITHM=INSTANT;
```

하지만 버전이나 컬럼 위치, row format, 작업 종류에 따라 instant가 안 될 수 있다. 그래서 staging에서 같은 schema와 비슷한 row count로 먼저 확인하는 게 좋다.

### 컬럼 타입 변경

컬럼 타입 변경은 더 조심해야 한다. 많은 경우 table rebuild가 필요하고, 데이터 검증/변환 비용도 있다.

이런 작업은 native online DDL로 가능한지 확인한 뒤, 어렵다면 `pt-online-schema-change`나 gh-ost 같은 외부 도구를 검토하는 편이 낫다.

### Primary key 변경

PK 변경은 가장 조심해야 하는 작업 중 하나다. InnoDB에서 primary key는 clustered index라서 단순 metadata 변경이 아니다.

운영 대형 테이블에서 PK 변경을 해야 한다면 native ALTER만 보지 말고, 외부 online schema change 도구와 rollback 전략까지 같이 봐야 한다.

## pt-online-schema-change는 언제 쓰나

`pt-online-schema-change`는 Percona Toolkit의 도구다. Percona 문서에 따르면 이 도구는 원본 테이블을 막지 않고 구조를 변경하기 위해 새 테이블을 만들고, 원하는 ALTER를 적용한 뒤, 원본 데이터를 chunk 단위로 복사하고, trigger로 변경분을 동기화한 다음, 마지막에 rename으로 교체한다.

대략 흐름은 이렇다.

1. 원본과 같은 구조의 새 테이블을 만든다.
1. 새 테이블에 ALTER를 적용한다.
1. 원본 테이블에 trigger를 만들어 변경분을 새 테이블에 반영한다.
1. 원본 데이터를 chunk 단위로 새 테이블에 복사한다.
1. 마지막에 `RENAME TABLE`로 원본과 새 테이블을 교체한다.
1. 기본 설정에서는 old table을 drop한다.
예시는 이런 식으로 남겨둘 수 있다. 실제 host/user/password는 config나 prompt로 처리하고 명령어에 직접 남기지 않는 게 좋다.

```bash
pt-online-schema-change \
  --alter "ADD INDEX idx_created_at (created_at)" \
  D=app,t=orders \
  --host=127.0.0.1 \
  --port=3306 \
  --user=dba_user \
  --ask-pass \
  --chunk-size=1000 \
  --max-load="Threads_running=100" \
  --critical-load="Threads_running=300" \
  --set-vars="innodb_lock_wait_timeout=1,lock_wait_timeout=1" \
  --progress=time,30 \
  --dry-run
```

`--dry-run`으로 먼저 확인하고, 실제 실행할 때만 `--execute`를 붙인다.

```bash
pt-online-schema-change ... --execute
```

## pt-osc도 만능은 아니다

pt-osc를 쓰면 모든 문제가 해결되는 것처럼 보이지만, 실제로는 고려할 게 많다.

- 원본 테이블에 trigger를 만든다.
- 이미 trigger가 있는 테이블에서는 제약이 있다.
- foreign key가 있으면 처리 방식이 복잡해진다.
- copy 중 replication lag가 생길 수 있다.
- chunk size와 load 기준을 잘못 잡으면 운영 부하가 커진다.
- 마지막 rename 순간에는 metadata lock이 필요하다.
- 실패 시 old/new table 정리 정책을 이해해야 한다.
Percona 문서에서도 pt-osc가 trigger를 사용하고, 기존 trigger가 있으면 동작에 제한이 있다고 설명한다. 그래서 운영에서는 “native ALTER보다 안전한 도구” 정도로 봐야지, “무조건 무중단”이라고 보면 안 된다.

## 내가 DDL 전에 보는 체크리스트

운영에서 ALTER를 실행해야 한다면 최소한 아래는 본다.

### 1. MySQL 버전 확인

```sql
SELECT VERSION();
```

MySQL 5.7인지 8.0인지, Aurora MySQL이면 major/minor version이 무엇인지에 따라 지원하는 online DDL 범위가 달라진다.

### 2. 예상 algorithm 확인

명시적으로 algorithm과 lock을 지정한다.

```sql
ALTER TABLE your_table
  ADD INDEX idx_col (col),
  ALGORITHM=INPLACE,
  LOCK=NONE;
```

불가능하면 실패하도록 만든다.

### 3. table size 확인

```sql
SELECT
  TABLE_SCHEMA,
  TABLE_NAME,
  TABLE_ROWS,
  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024 / 1024, 2) AS size_gb
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'your_schema'
  AND TABLE_NAME = 'your_table';
```

### 4. metadata lock / long transaction 확인

```sql
SELECT *
FROM information_schema.innodb_trx
ORDER BY trx_started;
```

### 5. replica lag / CDC 영향 확인

DDL이 replication이나 CDC에 어떤 영향을 주는지도 봐야 한다. pt-osc는 trigger와 chunk copy를 사용하기 때문에 downstream에도 부하가 갈 수 있다.

### 6. rollback 전략 확인

DDL은 배포처럼 rollback이 쉽지 않다. 특히 column drop, type 변경, PK 변경은 되돌리기 어렵다. 실행 전에 old table 보존 여부, backup, snapshot, rollback SQL을 정리한다.

## 정리

MySQL Online DDL은 “ALTER를 무중단으로 해주는 기능”이라고 단순하게 보면 위험하다.

내가 정리한 기준은 이렇다.

- `COPY`는 가능하면 피한다.
- `INPLACE`는 online에 가깝지만 lock과 rebuild 가능성을 확인해야 한다.
- `INSTANT`는 빠르지만 지원 범위와 버전 제한이 있다.
- `LOCK=NONE`을 명시해서 예상보다 강한 lock으로 진행되지 않게 한다.
- metadata lock은 Online DDL에서도 여전히 중요하다.
- 큰 테이블, PK 변경, type 변경은 pt-osc 같은 도구를 검토한다.
- pt-osc도 trigger, FK, replication lag, rename lock을 이해하고 써야 한다.
결국 DDL은 SQL 한 줄의 문제가 아니라 운영 작업이다. 실행 전에는 “이 ALTER가 어떤 algorithm을 타는지”, “어디서 lock을 잡는지”, “실패하면 어떻게 돌릴지”를 먼저 확인하는 편이 맞다.

## 참고

- MySQL 8.0 Reference Manual — InnoDB and Online DDL: https://dev.mysql.com/doc/mysql/8.0/en/innodb-online-ddl.html
- MySQL 8.0 Reference Manual — Online DDL Operations: https://dev.mysql.com/doc/mysql/8.0/en/innodb-online-ddl-operations.html
- MySQL Reference Manual — Metadata Locking: https://dev.mysql.com/doc/en/metadata-locking.html
- MySQL Reference Manual — ALTER TABLE Statement: https://dev.mysql.com/doc/refman/8.3/en/alter-table.html
- Percona Toolkit — pt-online-schema-change: https://docs.percona.com/percona-toolkit/pt-online-schema-change.html
