---
title: just로 DBA 반복 작업 자동화하기
description: justfile로 mysqlsh 덤프·유저/grants 백업 같은 반복 작업을 파라미터화해 팀 표준으로
pubDatetime: 2026-08-10T09:00:00Z
tags:
  - mysql
  - tools
  - automation
---

DBA 일은 "그 명령 뭐였더라"의 연속이다. mysqlsh 덤프 옵션, grants 뽑는 절차, 특정 스키마만 내보내기… 매번 히스토리를 뒤지는 대신 [`just`](https://github.com/casey/just)로 레시피화해두면 팀 누구나 같은 방식으로 실행할 수 있다.

## 왜 just인가

`Makefile`과 비슷하지만 셸 스크립트를 쓰기 훨씬 편하고, **프롬프트 입력**과 **기본값**을 자연스럽게 다룰 수 있다. 레포에 `justfile` 하나 두면 그게 곧 팀의 실행 표준이 된다.

```shell
just            # 레시피 목록
just mysql-dump # 특정 레시피 실행
```

## 예시: 스키마 선택 덤프

mysqlsh 유틸리티 덤프는 빠르지만 옵션이 많다. 자주 쓰는 형태를 레시피로 고정하고, **덤프할 스키마는 실행 시 입력**받게 한다.

```make
# justfile
host := "localhost"

# 특정 스키마만 mysqlsh로 덤프
mysqlsh-dump-data schema:
    mysqlsh --uri {{host}} -- util dump-schemas '["{{schema}}"]' \
        --outputUrl=/backup/{{schema}} \
        --threads=4 --compression=zstd

# 스키마를 안 정하면 프롬프트로 물어보기
dump:
    #!/usr/bin/env bash
    read -p "schema: " s
    just mysqlsh-dump-data "$s"
```

> [!tip]
> 스키마 선택을 "스킵"하고 전체를 덤프하면 사고가 나기 쉽다. **명시적으로 대상을 받도록** 만들어 두면 실수로 전량 덤프하는 일을 줄인다.

## 예시: 전체 유저 · grants 백업

계정 마이그레이션이나 재해 복구를 위해 **모든 유저의 grants**를 뽑아둔다. `pt-show-grants`가 있으면 간단하고, 없으면 `information_schema`로 생성한다.

```make
# 모든 유저 grants 덤프 (pt-show-grants)
dump-grants host user out="grants.sql":
    pt-show-grants --host {{host}} --user {{user}} --ask-pass > {{out}}
```

```make
# pt-toolkit 없이: SHOW GRANTS 를 동적으로 생성
dump-grants-native host user:
    mysql -h {{host}} -u {{user}} -p -N -e \
      "SELECT CONCAT('SHOW GRANTS FOR ', QUOTE(user), '@', QUOTE(host), ';') \
       FROM mysql.user" \
    | mysql -h {{host}} -u {{user}} -p -N | sed 's/$/;/'
```

## 얻는 것

- **표준화** — "그때 그 명령"이 레포에 박제됨. 팀 누구나 동일 실행
- **안전** — 위험한 기본값(전체 덤프 등)을 명시 입력으로 전환
- **문서화** — `justfile` 자체가 살아있는 런북

DBA의 반복 작업일수록 레시피로 남겨두면, 나중의 나와 팀 모두가 편해진다.
