---
title: MySQL replication 동작 원리
description: 슬레이브에서 어떤 빈로그 포지션을 보고 데이터를 동기화 해야 하는가에 대한 질문에 대해서 ???? xtrabackup info에서 binlog position으로 동기화 하는거 아닌가라고 했었는데 스터디 멤버에게…
pubDatetime: 2023-05-05T15:33:39.930Z
tags:
  - mysql
  - replication
  - database
---
슬레이브에서 어떤 빈로그 포지션을 보고 데이터를 동기화 해야 하는가에 대한 질문에 대해서

????

xtrabackup info에서 binlog position으로 동기화 하는거 아닌가라고 했었는데 스터디 멤버에게 좀 더 자세한 설며을 들을 수 있어서 기록을 해놓는다

슬레이브에서 마스터의 데이터를 동기화할 때 SQL thread와 I/O thread가 사용 된다.

SQL 스레드는 마스터에서 실행 된 모든 쿼리를, I/O 스레드는 데이터를 동기화 하는 역할을 수행한다. 기본적으로 I/O 스레드는 병렬로 처리되지만 SQL 스레드는 싱글로 처리되기 때문에 SQL 스레드에서 병목 현상이 발생하게 되고 SQL 스레드의 position으로 

MySQL에서 마스터에서 슬레이브로 데이터가 넘어가는
