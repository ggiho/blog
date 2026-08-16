---
title: MariaDB/MySQL 백업·복구 실전 정리 — mariabackup와 mysqldump
description: >-
  mariabackup 물리 백업 전체 흐름, mysqldump 핵심 옵션(OOM 회피), 덤프에서 특정 테이블만 추출, 복구 후 복제
  연결까지
pubDatetime: 2026-08-13T09:00:00.000Z
tags:
  - mariadb
  - mysql
  - backup
  - replication
---

물리 백업(mariabackup)과 논리 백업(mysqldump)을 상황별로 정리했다. 명령의 IP·계정·비밀번호는 전부 예시 플레이스홀더다.

> [!warning]
> 백업 스크립트에 평문 비밀번호를 박아두지 말 것. `mysql_config_editor`(로그인 패스), `~/.my.cnf`(권한 600), 또는 실행 시 `-p`로 프롬프트 입력을 쓴다. 스크립트를 노트/저장소에 올릴 때 특히 조심(실제 자격증명 유출의 단골).

## mariabackup 물리 백업

논리 덤프보다 빠르고, 대용량에서 특히 유리하다. `--backup → --prepare → --copy-back` 3단계가 핵심.

### 설치

```shell
# yum으로 DB를 설치했다면
yum install MariaDB-backup
```

### 백업 → prepare

```shell
# 1) 백업 (mysql OS 계정 또는 root로 수행)
mariabackup --user=backup_user --password=**** --backup \
  --no-lock --target-dir=/backup

# 2) prepare (필수)
mariabackup --prepare --target-dir=/backup
```

`--prepare`를 왜 하냐면, 백업이 진행되는 **동안 발생한 변경분**을 반영해 정합성을 맞추기 위해서다. 그 변경은 리다이렉트 로그(`ib_logfile`)에 기록돼 있고, prepare 단계에서 데이터 파일에 적용된다. 서버와 통신하지 않으므로 **원격지로 옮긴 뒤 prepare 해도 된다.**

> [!tip]
> `--no-lock`을 빼면 백업 동안 락이 걸린다. 온라인 백업이 목적이면 넣는다(InnoDB 기준).

### 복원 (copy-back)

```shell
systemctl stop mariadb
rm -rf /var/lib/mysql/*                       # 기존 데이터 디렉토리 비우기
mariabackup --copy-back --target-dir=/backup  # (--move-back 도 가능)
chown -R mysql:mysql /var/lib/mysql/*         # root로 했다면 소유권 원복
systemctl start mariadb
```

### 원격지로 스트리밍

디스크에 떨구지 않고 SSH로 바로 다른 노드에 푼다.

```shell
mariabackup --user=backup_user --password=**** --backup --no-lock \
  --target-dir=/backup --stream=mbstream \
  | ssh user@db02 "mbstream -x -C /backup"
```

## 복구 후 복제 연결

copy-back 한 복제본을 마스터에 붙일 때는 백업 시점의 위치가 필요하다. 그 정보는 백업 디렉토리에 있다.

```shell
cat /backup/xtrabackup_binlog_info   # binlog 파일명, position, GTID
```

### binlog position 방식

```sql
CHANGE MASTER TO
  master_host='db01', master_port=3306,
  master_user='repl', master_password='****',
  master_log_file='mysql-bin.000040', master_log_pos=123456789;
START SLAVE;
SHOW SLAVE STATUS\G
```

### GTID 방식 (권장)

```sql
STOP SLAVE;
CHANGE MASTER TO
  master_host='db01', master_port=3306,
  master_user='repl', master_password='****',
  master_use_gtid=slave_pos;
START SLAVE;
```

> [!important]
> GTID로 복제를 구성해야 MaxScale의 자동 failover/switchover가 정상 동작한다. binlog position으로 붙여두면 마스터가 바뀌는 순간 슬레이브가 따라오지 못한다.

## mysqldump 논리 백업

이식성이 좋고 부분 백업에 유리하다. 옵션 몇 개가 성패를 가른다.

```shell
mysqldump -h db01 -u backup_user -p \
  -R --single-transaction --quick --master-data=2 \
  --databases mydb > mydb.sql
```

- **`-R` (`--routines`)** — 프로시저/함수 포함. **빼먹으면 스토어드 루틴이 백업 안 된다.** 복구 후에야 아는 경우가 많으니 습관화
- **`--single-transaction`** — InnoDB 일관성 스냅샷 (락 없이)
- **`--quick`** — 결과를 메모리에 모으지 않고 바로 스트리밍. **대용량에서 OOM을 피하는 핵심 옵션.** 메모리 넉넉한 환경에선 안 겪다가 큰 테이블에서 갑자기 터진다
- **`--master-data=2`** — 덤프에 `CHANGE MASTER`(binlog 위치)를 주석으로 기록 → 복제 구성에 활용

### Aurora / RDS 주의점

관리형 환경은 권한 제약이 있어 옵션을 바꿔야 한다.

```shell
mysqldump -h myinstance.xxxx.ap-northeast-2.rds.amazonaws.com -u backup_user -p \
  --skip-lock-tables --set-gtid-purged=OFF --max-allowed-packet=1G \
  --databases mydb > mydb.sql
```

- Aurora에서 `--single-transaction`이 `Access denied`로 막히면 `--skip-lock-tables`로 대체
- `--set-gtid-purged=OFF` — GTID 정보를 덤프에 넣지 않아 대상에서 충돌 방지
- 복원은 접속 후 `source mydb.sql`

## 덤프에서 특정 테이블만 뽑기

전체 덤프 파일에서 테이블 하나만 필요할 때, 다시 덤프 뜨지 말고 `sed`로 잘라낸다.

```shell
sed -n -e '/DROP TABLE.*`mytable`/,/UNLOCK TABLES/p' full-dump.sql > mytable.sql
```

## 데이터만, 조건부로 백업

스키마 없이 특정 조건의 **데이터만** 뽑을 때.

```shell
mysqldump -u backup_user -p --no-create-info --complete-insert \
  mydb mytable --where="created_at > '2026-01-01 00:00:00'" > data.sql
```

- **`--no-create-info`** — `CREATE TABLE` 제외, 데이터만
- **`--complete-insert`** — 컬럼명을 명시한 INSERT (스키마가 다른 대상에도 안전)
- **`--where`** — 조건 필터 (증분 이관에 유용)

## 정리

- 대용량·빠른 복구 → **mariabackup** (`backup → prepare → copy-back`, prepare 필수)
- 이식·부분 백업 → **mysqldump** (`-R`·`--quick` 꼭 챙기기)
- 관리형(RDS/Aurora)은 `--skip-lock-tables`·`--set-gtid-purged=OFF`
- 복구 후 복제는 **GTID** 방식으로 (MaxScale failover 호환)
- 스크립트에 평문 비밀번호 금지
