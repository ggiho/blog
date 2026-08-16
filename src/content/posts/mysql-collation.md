---
title: MySQL Collation
description: >-
  MySQL에서 character set은 이제 utf8mb4 를 사용하는 것이 거의 기본처럼 되었다. 문제는 character set만
  맞췄다고 끝나는 게 아니라는 점이다. 운영하다 보면 실제로는 collation…
pubDatetime: 2026-05-11T05:53:49.209Z
tags:
  - mysql
  - database
---

## Introduction

MySQL에서 character set은 이제 `utf8mb4`를 사용하는 것이 거의 기본처럼 되었다. 문제는 character set만 맞췄다고 끝나는 게 아니라는 점이다.

운영하다 보면 실제로는 collation 때문에 예상하지 못한 차이가 생긴다. 정렬 결과가 다르거나, 문자열 비교 결과가 달라지거나, MySQL 8.0에서 dump한 데이터를 5.7이나 MariaDB 쪽으로 가져가다가 `Unknown collation` 오류를 만나는 경우도 있다.

나도 예전에는 character set만 맞으면 된다고 생각했는데, MySQL 5.7에서 8.0으로 넘어가거나 서로 다른 환경의 데이터를 이관하다 보면 collation을 따로 봐야 하는 순간이 생긴다. 그래서 자주 보이는 몇 가지 collation을 기준으로 차이를 정리해 둔다.

## Collation이 하는 일

character set이 “어떤 문자를 저장할 수 있는가”에 가깝다면, collation은 “문자를 어떻게 비교하고 정렬할 것인가”에 가깝다.

예를 들어 같은 `utf8mb4`를 쓰더라도 collation에 따라 아래 동작이 달라질 수 있다.

- 대소문자를 같은 문자로 볼지
- accent가 있는 문자를 같은 문자로 볼지
- 정렬 순서를 어떤 Unicode 기준으로 잡을지
- `=` 비교나 `ORDER BY` 결과가 어떻게 나올지
이름에 붙는 suffix도 어느 정도 의미가 있다.

- `ci`: Case Insensitive, 대소문자를 구분하지 않음
- `cs`: Case Sensitive, 대소문자를 구분함
- `ai`: Accent Insensitive, accent 차이를 구분하지 않음
- `as`: Accent Sensitive, accent 차이를 구분함
- `bin`: binary 기준 비교

## 자주 보는 utf8mb4 collation

### utf8mb4_general_ci

`utf8mb4_general_ci`는 오래된 MySQL 환경에서 많이 보인다. MySQL 5.7에서 `utf8mb4`를 사용할 때 기본 collation으로 자주 만나는 값이기도 하다.

장점은 단순하다. 비교가 빠르고, 오래된 애플리케이션과 호환성이 좋다. 특별한 언어별 정렬 정확도가 필요하지 않은 시스템에서는 큰 문제 없이 사용되기도 한다.

다만 이름 그대로 general한 규칙이라 Unicode 정렬 정확도는 떨어진다. 한글, 특수문자, accent가 섞이는 데이터에서 “사람이 기대하는 정렬”과 다를 수 있다.

### utf8mb4_unicode_ci

`utf8mb4_unicode_ci`는 Unicode Collation Algorithm 기반의 collation이다. `general_ci`보다 비교/정렬 규칙이 더 정확한 편이다.

예전 MySQL 버전에서 다국어 데이터를 다뤄야 하면 `general_ci`보다 `unicode_ci`를 선택하는 경우가 많았다. 대신 비교 비용은 조금 더 있을 수 있다. 지금 기준으로 아주 큰 차이를 체감하기는 어렵지만, 과거에는 성능 때문에 `general_ci`를 선택하는 경우도 있었다.

### utf8mb4_0900_ai_ci

MySQL 8.0에서 기본으로 보게 되는 collation이다. `0900`은 Unicode 9.0.0 기반이라는 의미이고, `ai_ci`는 accent와 case를 구분하지 않는다는 뜻이다.

MySQL 8.0 서버의 기본 character set/collation은 `utf8mb4`, `utf8mb4_0900_ai_ci`다. 그래서 MySQL 8.0에서 별도 설정 없이 database나 table을 만들면 이 collation을 만나기 쉽다.

문제는 이 collation이 MySQL 8.0부터 도입되었다는 점이다. MySQL 5.7은 `utf8mb4_0900_ai_ci`를 알지 못한다. 그래서 8.0에서 dump한 DDL을 5.7이나 일부 MariaDB 환경에 그대로 넣으면 아래처럼 실패할 수 있다.

```sql
ERROR 1273 (HY000): Unknown collation: 'utf8mb4_0900_ai_ci'
```

## 운영 중에 실제로 봐야 하는 지점

### 1. MySQL 5.7 → 8.0 업그레이드

업그레이드 자체가 기존 table의 collation을 자동으로 전부 바꾸지는 않는다. 하지만 새로 생성되는 database/table/column은 서버나 database default collation의 영향을 받는다.

그래서 5.7에서 오래 운영하던 서비스가 8.0으로 올라간 뒤, 신규 테이블만 `utf8mb4_0900_ai_ci`가 되고 기존 테이블은 `utf8mb4_general_ci`나 `utf8mb4_unicode_ci`로 남는 경우가 있다.

이 상태에서 조인이나 문자열 비교가 섞이면 `Illegal mix of collations` 류의 오류를 만날 수 있다.

확인할 때는 아래 쿼리를 자주 쓴다.

```sql
SELECT
  TABLE_SCHEMA,
  TABLE_NAME,
  TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA NOT IN ('mysql', 'performance_schema', 'information_schema', 'sys')
ORDER BY TABLE_SCHEMA, TABLE_NAME;
```

컬럼 단위까지 보려면 아래처럼 확인한다.

```sql
SELECT
  TABLE_SCHEMA,
  TABLE_NAME,
  COLUMN_NAME,
  CHARACTER_SET_NAME,
  COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'your_schema'
  AND CHARACTER_SET_NAME IS NOT NULL
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

### 2. dump/import

MySQL 8.0에서 생성된 dump 파일에는 `utf8mb4_0900_ai_ci`가 포함될 수 있다. 이 파일을 5.7이나 MariaDB에 넣어야 한다면 그대로 import하기 전에 확인해야 한다.

단순히 문자열 치환으로 해결할 수 있는 경우도 있지만, 데이터 비교/정렬 기준이 달라지는 것이기 때문에 운영 데이터라면 가볍게 보면 안 된다.

최소한 아래는 확인하는 것이 좋다.

- target DB가 해당 collation을 지원하는지
- 기존 서비스에서 사용하는 collation과 충돌하지 않는지
- 정렬/검색 결과가 바뀌어도 되는지
- unique index가 걸린 문자열 컬럼에서 중복 판단이 달라지지 않는지

### 3. unique index와 문자열 비교

collation은 단순히 `ORDER BY`만 바꾸는 설정이 아니다. 문자열 비교에도 영향을 준다.

예를 들어 case-insensitive collation에서는 `A`와 `a`를 같은 값처럼 비교할 수 있다. accent-insensitive collation에서는 accent가 있는 문자도 같은 문자처럼 취급될 수 있다.

unique key가 걸려 있는 컬럼이라면 이 차이가 실제 데이터 적재 실패로 이어질 수 있다. 특히 사용자 입력값, 코드값, 외부 시스템 ID처럼 문자열 정합성이 중요한 컬럼은 더 조심해야 한다.

## 정리

개인적으로는 collation을 볼 때 아래 순서로 확인한다.

1. 서버/database/table/column의 default collation이 섞여 있는지 확인
1. MySQL 8.0에서 생성된 `utf8mb4_0900_ai_ci`가 하위 버전으로 내려가는 경로가 있는지 확인
1. 문자열 비교가 중요한 컬럼, unique index 컬럼을 먼저 확인
1. 단순 치환 전에 정렬/비교 결과가 바뀌어도 되는지 확인
`utf8mb4`를 쓰는 것만으로는 부족하다. 운영에서는 “어떤 utf8mb4 collation을 쓰는지”까지 같이 봐야 한다.

특히 MySQL 5.7과 8.0이 섞여 있거나, MariaDB와 데이터를 주고받거나, dump/import가 자주 일어나는 환경이라면 collation은 미리 정리해 두는 편이 낫다. 문제가 터진 뒤에 보면 단순 설정처럼 보이지만, 실제로는 데이터 비교 기준이 바뀌는 문제라서 생각보다 영향 범위가 넓다.

---

## 참고

- MySQL 8.0 Reference Manual — Server Character Set and Collation: https://dev.mysql.com/doc/refman/8.0/en/charset-server.html
- MySQL Globalization 5.7 excerpt — Connection Character Sets and Collations: https://dev.mysql.com/doc/mysql-g11n-excerpt/5.7/en/charset-connection.html
