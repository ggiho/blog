---
title: using rowid filter
description: >-
  시작하며 실행계획을 확인하다가 extra 컬럼에 처음 보는 문구가 있어서 조사해 봤습니다. MySQL에는 존재하지 않고 MariaDB
  단독으로 쓰이는 조건인 것 같습니다. (/notion/rowid…
pubDatetime: 2023-03-30T00:07:27.058Z
tags:
  - mysql
  - index
  - optimizer
---

## 시작하며

실행계획을 확인하다가 extra 컬럼에 처음 보는 문구가 있어서 조사해 봤습니다.
MySQL에는 존재하지 않고 MariaDB 단독으로 쓰이는 조건인 것 같습니다.

![](/notion/rowid-filter/img-1.png)

## 

> MariaDB의 Rowid 필터링 최적화는 쿼리 옵티마이저가 Rowid가 포함된 쿼리의 성능을 개선하기 위해 사용하는 최적화 기법입니다. 이 최적화는 필터링 절을 WHERE 절에서 INDEX 절로 푸시 다운하여 작동합니다. 이렇게 하면 쿼리 옵티마이저가 전체 테이블 스캔 대신 인덱스 스캔을 사용하여 디스크에서 읽는 데이터의 양을 줄여 쿼리 성능을 개선하는 데 도움이 됩니다.

## 마치며
