---
title: DuckDB
description: 요즘 핫하다는 나만 모르던 DuckDB를 사용해 봤다. tip DuckDB는 SQLite의 직관성 및 접근성과 전문 열 데이터베이스의 고성능 기능을 조화롭게 결합한 데이터베이스입니다 Install shell…
pubDatetime: 2024-08-14T08:36:24.333Z
tags:
  - duckdb
  - data-engineering
---
## Introduction

요즘 핫하다는 나만 모르던 DuckDB를 사용해 봤다.

> [!tip]
> DuckDB는 SQLite의 직관성 및 접근성과 전문 열 데이터베이스의 고성능 기능을 조화롭게 결합한 데이터베이스입니다

### Install

```shell
brew install duckdb
```

```sql
# CUSTOMER_CASE_STATUS_TRACKING.csv
# 40M rows
# 23.57GB
D CREATE TABLE ccst AS
  SELECT *
  FROM read_csv_auto('~/CUSTOMER_CASE_STATUS_TRACKING.csv',
                     types={'column20': 'VARCHAR','column05':'VARCHAR','column18':'VARCHAR','column10':'VARCHAR','column06':'VARCHAR','column15':'VARCHAR'});
100% ▕████████████████████████████████████████████████████████████
```

약 40M 건의 csv 파일을 쉽게 import 할 수 있다.

전처리가 되어 있지 않아서 type 오류가 계속 발생했다. 일단 type을 변경

```sql
D insert into ccst select * from read_csv_auto('~/CUSTOMER_CASE_STATUS_TRACKING.csv',
                       types={'column20': 'VARCHAR','column05':'VARCHAR','column18':'VARCHAR','column10':'VARCHAR','column06':'VARCHAR','column15':'VARCHAR'});
100% ▕████████████████████████████████████████████████████████████▏
```

미리 테이블을 생성했다면 같은 방식으로 insert 할 수 있다. 

일반적으로 사용하던 insert select문으로 쉽게 사용 가능하다.

create와 성능상으로 큰 차이는 없어보인다.

사실 이 파일은 MySQL에 load data infile로 업로드 하려다가 실패한 파일이다.

6시간동안 import 했지만 timeout이 나버린 상황.

그러면 DuckDB에서는 얼마의 시간이 걸렸을까?

40초다. 거의 10M에 1초 수준. 여기에서부터 충격을 받았다.

그리고 나서 쿼리를 실행했다. 대략 id별로 max date를 찾아서 사용여부 컬럼 값을 찾는 쿼리

실행 계획을 보면 대략 38GB의 cost를 사용한다.

MySQL에서 꽤나 오래 걸리던 이 쿼리 DuckDB에서는 몇 초 걸렀을까?

3초.

말 그대로 미친 수준이다. 이런걸 다른 사람들은 이미 쓰고 있었다고?

datamart의 퍼포먼스 때문에 고민이 많았던 나에게 한 줄기 빛처럼 나타난 DuckDB

혹시나 데이터 마이그레이션이 쉽다면 report를 만드는데 굉장히 수월해질 것이라는 생각에 방법을 찾아봤다.

python 라이브러리 dlt를 사용해볼까나

## Conclusion

엄청난 속도를 자랑하는 DuckDB를 사용해봤다.
