---
title: MySQL 시스템 변수 정리 — 연결·버퍼·InnoDB 핵심
description: 자주 만지는 MySQL 시스템 변수를 연결·스레드·세션 버퍼·InnoDB 메모리·내구성으로 묶어 정리
pubDatetime: 2023-04-13T00:00:00.000Z
tags:
  - mysql
  - database
  - tuning
---

MySQL 튜닝에서 반복적으로 마주치는 시스템 변수를 용도별로 묶어 정리했다. 값은 워크로드·버전마다 다르니 "무엇을 조절하는지"에 초점을 둔다.

## 연결 · 네트워크

| 변수 | 설명 |
|---|---|
| `max_connections` | 동시 클라이언트 연결 최대치. 기본 151, 초과 시 `Too many connections` |
| `wait_timeout` / `interactive_timeout` | 유휴 연결을 끊기까지의 시간(초). 기본 28800(8h) |
| `max_allowed_packet` | 단일 패킷/문자열의 최대 크기. 큰 BLOB·덤프 복원 시 상향 |
| `port` / `socket` | 접속 포트 / 로컬 Unix 소켓 경로 |

## 스레드

| 변수 | 설명 |
|---|---|
| `thread_cache_size` | 종료된 연결의 스레드를 재사용하도록 캐시. 짧은 연결이 잦은 환경에서 스레드 생성 비용 절감 |
| `thread_pool_size` | (스레드 풀 사용 시) 동시 실행 그룹 수. 연결이 매우 많은 시스템의 확장성 |
| `innodb_thread_concurrency` | InnoDB 내부 동시 실행 스레드 상한 (0=무제한) |
| `innodb_read_io_threads` / `innodb_write_io_threads` | 읽기·쓰기 I/O 스레드 수. CPU 코어 수에 비례해 설정 |

## 세션 버퍼 (⚠️ 연결마다 할당)

정렬·조인·임시테이블용 버퍼는 **전역이 아니라 연결(세션)마다** 잡힌다. 그래서 "크게 잡을수록 좋다"가 아니다.

| 변수 | 용도 |
|---|---|
| `sort_buffer_size` | `ORDER BY`·`GROUP BY` 정렬 |
| `join_buffer_size` | 인덱스 없는 조인(Block Nested Loop) |
| `read_buffer_size` / `read_rnd_buffer_size` | 순차 스캔 / 랜덤 읽기 캐시 |
| `tmp_table_size` / `max_heap_table_size` | 메모리 임시 테이블 크기(둘 중 작은 값이 상한). 넘으면 디스크 임시테이블로 전환 |

> [!warning]
> 이 버퍼들은 **연결 수만큼 곱해진다.** 예를 들어 `sort_buffer_size=256M`에 연결이 500개면 최악의 경우 수십~수백 GB가 잡혀 OOM으로 이어진다. 전역 기본값은 보수적으로 두고, 무거운 쿼리에서만 세션 단위로 올리는 편이 안전하다.

## InnoDB 메모리 · I/O

| 변수 | 설명 |
|---|---|
| `innodb_buffer_pool_size` | InnoDB 데이터·인덱스 캐시. **가장 중요한 변수.** 전용 서버면 RAM의 50~75% |
| `innodb_buffer_pool_instances` | 버퍼 풀을 여러 인스턴스로 분할(뮤텍스 경합 완화). 버퍼 풀이 클 때 유효 |
| `innodb_log_buffer_size` | 커밋 전 로그를 담는 버퍼. 기본 16MB, 큰 트랜잭션이 많으면 상향 |
| `innodb_file_per_table` | 테이블마다 별도 `.ibd` 파일. 기본 ON(권장) |
| `innodb_flush_method` | 데이터/로그 파일의 I/O 방식(예: `O_DIRECT`로 OS 이중 캐싱 회피) |

## 내구성 — innodb_flush_log_at_trx_commit

성능과 내구성의 트레이드오프를 가르는 핵심 변수다.

- **1 (기본)** — 매 커밋마다 로그를 디스크에 flush + fsync. **완전한 ACID.** 가장 안전, 가장 느림
- **2** — 매 커밋마다 OS 캐시에 write, fsync는 약 1초 주기. **DB 프로세스가 죽어도 안전**, OS/장비가 죽으면 최근 ~1초 유실
- **0** — write·fsync 모두 약 1초 주기. 가장 빠르지만 **mysqld 크래시 시 최근 ~1초 유실**

> [!note]
> 복제 슬레이브나 재생성 가능한 데이터에선 2(또는 0)로 성능을 얻고, 원본 트랜잭션 무결성이 중요한 마스터는 1을 유지하는 식으로 나눈다.

## 참고: 사라진 변수

`query_cache_size` / `query_cache_type`는 **MySQL 8.0에서 제거**됐다. 옛 문서·설정을 그대로 가져오면 8.0에서 기동 실패하니 주의. 결과 캐싱이 필요하면 애플리케이션 레벨(Redis 등)이나 ProxySQL로 대체한다.

## 정리

- 버퍼는 **전역(InnoDB 버퍼 풀)** 과 **세션(sort/join/tmp)** 을 구분해서 본다 — 세션 버퍼는 연결 수만큼 곱해진다
- 성능 1순위는 `innodb_buffer_pool_size`, 내구성 1순위는 `innodb_flush_log_at_trx_commit`
- 8.0에선 `query_cache` 관련 변수를 걷어낸다
