---
title: SQL Server 트랜잭션 격리수준
description: 시작하며 SQL Server에서는 오라클과 마찬가지로 default isolation level이 Read Committed 로 설정 되어 있다. 그리고 ANSI 표준과는 다른 격리 수준을 제공하는데 같이…
pubDatetime: 2023-04-23T23:26:11.382Z
tags:
  - sql-server
  - database
  - transaction
---
## 시작하며

SQL Server에서는 오라클과 마찬가지로 default isolation level이 `Read Committed`로 설정 되어 있다.

그리고 ANSI 표준과는 다른 격리 수준을 제공하는데 같이 알아보자.

## 격리수준

- read uncommitted
- read committed
- repeatable read
- `snapshot`
- serializable
SQL Server는 ANSI 표준 격리 수준 4가지 외에 snapshot이라는 격리수준을 제공한다

~~MySQL은 repeatable read 격리수준에서 record lock과 gap lock 기능을 이용하여 phantom read의 발생을 방지하고 있다. 하지만 SQL Server에서는 이와 같은 lock 기능을 제공하지 않아서 별도의 격리수준을 추가로 제공하는 것으로 보인다.~~

> [!note]
> 관련해서 더 찾아보니 SQL Server의 repeatable read 격리수준에서도 phantom read가 발생하지 않는 것으로 보인다. 그렇다면 왜 snapshot 격리수준이 더 필요한 건지는 추후에 더 찾아봐야겠다… 

참고 : [https://www.red-gate.com/simple-talk/databases/sql-server/t-sql-programming-sql-server/questions-about-t-sql-transaction-isolation-levels-you-were-too-shy-to-ask/](https://www.red-gate.com/simple-talk/databases/sql-server/t-sql-programming-sql-server/questions-about-t-sql-transaction-isolation-levels-you-were-too-shy-to-ask/)
