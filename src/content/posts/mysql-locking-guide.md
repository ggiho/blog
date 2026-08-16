---
title: 실무에서 부딪히는 MySQL 잠금(Lock) 정리
description: '레코드/갭/넥스트키 락부터 메타데이터 락, GET_LOCK, AUTO_INC 락까지 — 흩어진 노트를 한 편으로'
pubDatetime: 2026-08-15T09:00:00.000Z
tags:
  - mysql
  - lock
  - database
  - transaction
---

노트 여기저기에 흩어져 있던 잠금 관련 메모를 한 번에 정리한다. InnoDB 기준이고, 버전 차이가 있는 부분은 따로 표시했다.

## InnoDB 잠금의 종류

InnoDB의 행 잠금은 "행 그 자체"가 아니라 **인덱스 레코드**에 걸린다. 이 사실을 놓치면 "왜 안 건드린 행까지 잠기지?"에서 막힌다.

- **레코드 락(Record Lock)** — 인덱스 레코드 하나에 거는 잠금
- **갭 락(Gap Lock)** — 레코드와 레코드 *사이 공간*에 거는 잠금. 그 범위에 새 행이 끼어드는 걸 막는다(팬텀 방지)
- **넥스트키 락(Next-Key Lock)** — 레코드 락 + 직전 갭 락. InnoDB의 기본 동작 단위
- **인텐션 락(IS/IX)** — 테이블 레벨 의도 표시. 행 잠금 전에 먼저 걸려 테이블/행 잠금 간 충돌을 빠르게 판단

> [!note]
> 갭 락은 격리수준의 영향을 크게 받는다. 기본값 **REPEATABLE READ**에서는 갭 락이 활발히 걸리지만, **READ COMMITTED**에서는 대부분 비활성화되어 순수 레코드 락에 가깝게 동작한다. 불필요한 갭 락으로 동시성이 떨어진다면 격리수준부터 의심한다.

## Locking Read — 편리하지만 데드락의 단골

일반 `SELECT`는 잠금을 걸지 않는다(일관된 스냅샷 읽기). 하지만 아래 구문은 **읽으면서 잠금**을 건다. 편리한 만큼 데드락도 잘 유발한다.

```sql
-- 배타 잠금(X): 읽은 행을 이 트랜잭션이 곧 수정할 것
START TRANSACTION;
SELECT * FROM orders WHERE id = 100 FOR UPDATE;

-- 공유 잠금(S): 읽는 동안 남이 못 바꾸게만
SELECT * FROM orders WHERE id = 100 FOR SHARE;   -- 8.0 (구: LOCK IN SHARE MODE)
```

MySQL 8.0부터는 대기 방식을 제어할 수 있다.

```sql
SELECT * FROM orders WHERE id = 100 FOR UPDATE NOWAIT;       -- 잠겨 있으면 즉시 에러
SELECT * FROM orders WHERE id = 100 FOR UPDATE SKIP LOCKED;  -- 잠긴 행은 건너뜀 (큐 처리에 유용)
```

두 트랜잭션이 서로 다른 순서로 `FOR UPDATE`를 잡으면 그대로 데드락이다. **잠금 획득 순서를 항상 동일하게** 맞추는 게 가장 확실한 예방책이다.

## 데드락

InnoDB는 데드락을 **자동 탐지**해서 비용이 더 적은 쪽 트랜잭션을 롤백한다(`ERROR 1213`). 즉 데드락은 "막는" 것이 아니라 **재시도 가능하게 설계**하는 게 정석이다.

```sql
SHOW ENGINE INNODB STATUS\G   -- LATEST DETECTED DEADLOCK 섹션에 마지막 데드락 상세
```

- `innodb_lock_wait_timeout` (기본 50초) — 데드락은 아니지만 잠금 대기가 길어질 때 끊는 임계값
- `innodb_deadlock_detect` (기본 ON) — 초고동시성 환경에선 탐지 비용 때문에 끄고 timeout에만 의존하기도 한다

## 메타데이터 락(MDL) — DDL이 멈춰 있을 때

`ALTER TABLE`이 걸린 채 안 끝나고, 뒤이은 쿼리까지 줄줄이 막히는 상황의 범인은 대개 **메타데이터 락**이다. 트랜잭션이 테이블을 참조하는 동안에는 그 테이블의 스키마 변경이 대기하고, 그 뒤 쿼리들도 MDL 큐에서 함께 밀린다.

```sql
-- MySQL 8.0
SELECT * FROM performance_schema.metadata_locks WHERE OBJECT_TYPE = 'TABLE';

-- MariaDB (METADATA_LOCK_INFO 플러그인)
SELECT * FROM information_schema.metadata_lock_info;
```

범인은 보통 **오래 열려 있는 트랜잭션**이다. `information_schema.INNODB_TRX`에서 오래된 트랜잭션을 먼저 찾는다.

## 사용자 레벨 락 — GET_LOCK

행/테이블과 무관하게 **애플리케이션 뮤텍스**가 필요할 때 쓴다. 배치 중복 실행 방지 같은 데 유용하다.

```sql
SELECT GET_LOCK('daily_batch', 10);   -- 최대 10초 대기, 획득 시 1
-- ... 작업 ...
SELECT RELEASE_LOCK('daily_batch');
SELECT IS_FREE_LOCK('daily_batch');
```

주의할 점:

- 락은 **세션(커넥션) 스코프**다. 커넥션 풀에서 빌린 커넥션이 반납·재사용되며 락이 의도치 않게 유지/해제되는 사고가 흔하다.
- MySQL 5.7부터 한 세션이 **여러 개의 이름 락**을 동시에 보유할 수 있다(이전엔 새 락을 잡으면 기존 락 해제).
- 누가 잡고 있는지는 아래로 확인한다.

```sql
SELECT * FROM performance_schema.metadata_locks
WHERE OBJECT_TYPE = 'USER LEVEL LOCK';
```

## AUTO_INC 락과 innodb_autoinc_lock_mode

`AUTO_INCREMENT` 값을 채번할 때 걸리는 테이블 레벨 락의 동작을 결정한다. 대량 INSERT 성능과 복제 안전성의 트레이드오프다.

- **0 (traditional)** — 모든 INSERT(simple·bulk·mixed) 끝까지 AUTO_INC 테이블 락 유지. 가장 보수적·안전
- **1 (consecutive)** — bulk INSERT에만 테이블 락. 채번 값이 연속됨을 보장. **MySQL 5.7 기본값**
- **2 (interleaved)** — 어떤 INSERT에도 테이블 락을 걸지 않음. 가장 빠르고 확장성 좋지만 채번이 **끼어들어(interleave)** 연속성이 깨지고, **statement-based replication에서 안전하지 않다**. **MySQL 8.0 기본값**

> [!warning]
> 8.0으로 올리면 기본값이 2로 바뀐다. SBR을 쓰거나 채번 연속성에 의존하는 로직이 있다면 업그레이드 시 반드시 확인한다. (8.0 기본 복제 포맷은 ROW라 대개 문제없지만, 혼합 환경이면 짚고 넘어가야 한다.)

## 잠금 대기 진단

누가 누구를 막고 있는지는 8.0의 `data_locks` / `data_lock_waits`(또는 `sys.innodb_lock_waits`)로 한 번에 본다.

```sql
SELECT
  w.blocking_pid, b.trx_query AS blocking_query,
  w.waiting_pid,  r.trx_query AS waiting_query
FROM sys.innodb_lock_waits w
JOIN information_schema.innodb_trx b ON b.trx_mysql_thread_id = w.blocking_pid
JOIN information_schema.innodb_trx r ON r.trx_mysql_thread_id = w.waiting_pid;
```

`prod=#` `select blocking_pid, waiting_pid, wait_age, locked_table from sys.innodb_lock_waits;`

| blocking_pid | waiting_pid | wait_age | locked_table |
| ---: | ---: | --- | --- |

*(0 rows)*

`blocking_pid`를 `KILL` 하면 대기가 풀린다. 다만 근본 원인(긴 트랜잭션, 잘못된 잠금 순서)을 잡지 않으면 반복된다.

## 정리

- 행 잠금은 **인덱스 레코드**에 걸린다 — 인덱스 설계가 곧 잠금 설계
- 갭 락이 과하면 **격리수준(RR→RC)** 을 의심
- 데드락은 막는 게 아니라 **재시도**로 설계, 잠금 순서를 통일
- DDL이 멈추면 **MDL + 오래된 트랜잭션**을 확인
- `GET_LOCK`은 **커넥션 스코프**임을 늘 염두
- 8.0 업그레이드 시 `innodb_autoinc_lock_mode = 2` 확인
