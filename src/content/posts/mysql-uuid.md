---
title: UUID
description: >-
  (/notion/mysql uuid/img 1.png) sql select CHARGE ORDER ID,uuid(),
  replace(uuid(),' ',''),unhex(replace(uuid(),' ','')),…
pubDatetime: 2023-09-12T05:33:08.521Z
tags:
  - mysql
  - database
---

![](/notion/mysql-uuid/img-1.png)

```sql
select CHARGE_ORDER_ID,uuid(), replace(uuid(),'-',''),unhex(replace(uuid(),'-','')),
       replace(uuid(), _utf8'-', _utf8''), unhex(replace(uuid(), _utf8'-', _utf8''))
```

![](/notion/mysql-uuid/img-2.png)

![](/notion/mysql-uuid/img-3.png)

![](/notion/mysql-uuid/img-4.png)

## Introduction

UUID(Universally Unique Identifier)는 Database에서 Primary key를 식별하기 위해서 사용된다.

32개의 16진수와 4개의 ‘-’의 조합으로 36byte 크기의 데이터가 만들어진다.

```sql
mysql> select uuid();
+--------------------------------------+
| uuid()                               |
+--------------------------------------+
| 274f879a-4bda-11ef-ad2f-303da16f491f |
+--------------------------------------+
1 row in set (0.02 sec)
```

UUID에서 사용 되는 버전은 대표적으로 v1, v4가 있다.

MySQL은 내부적으로 v1을 사용 중이고 `MAC address + timestamp`의 조합으로 데이터가 생성된다.

> [!tip]
> v1: MAC 주소

‘-’로 구분된 각 영역을 보면 

MySQL에서는 auto increment로 PK를 쉽게 생성할 수 있지만 

MySQL 8.0 버전부터는
