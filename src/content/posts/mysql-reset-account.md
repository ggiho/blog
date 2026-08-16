---
title: MySQL 계정 정보 모를 때
description: / Introduction 쓸 일이 잘 없는 것 같다가도 종종 사용할 일이 생기곤 한다. sql stop mysqld systemctl stop mysqld mysqld safe replacement…
pubDatetime: 2024-02-18T14:13:53.365Z
tags:
  - mysql
  - database
---
/

## Introduction

쓸 일이 잘 없는 것 같다가도 종종 사용할 일이 생기곤 한다.

```sql
# stop mysqld
systemctl stop mysqld

# mysqld_safe replacement
systemctl set-environment MYSQLD_OPTS="--skip-grant-tables"

# start mysqld safe_mode
systemctl start mysqld
```

safe 모드에서 바로 계정을 만들 수 없다. 아래와 같은 오류를 만나게 될 것이다.

![](/notion/mysql-reset-account/img-1.png)

해결 방법은 `flush privileges;` 

권한 설정을 먼저 불러와야 grant 관련 명령어를 사용할 수 있다.

![](/notion/mysql-reset-account/img-2.png)

정상적으로 계정 설정을 완료 했으면 mysqld를 종료하고 정상적으로 실행해 준다.

```sql
systemctl stop mysqld

# 환경변수 초기화.
# 다른 설정이 있다면 초기화를 하면 안 되지 싶다.
systemctl unset-environment MYSQLD_OPTS

systemctl start mysqld
```

~~dba가 위의 프로세스를 진행할 일이 잘 없기는 하다. 이미 계정과 권한이 있을 것이기 때문. 그리고 db를 내려야 하기 때문에 운영 중인 서비스 db에서는 적용하지 못한다. 그리고 managed db가 판치는 세상에서 on-premise db에서만 사용이 가능한 방법이란 점.~~

내가 이번에 필요한 경우처럼, 묵혀있던 on-premise db에 내 계정이 없을 때 사용하면 좋을 것 같다.
