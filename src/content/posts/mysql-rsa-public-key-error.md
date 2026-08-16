---
title: Retrieval of the RSA public key is not enabled for insecure connections
description: >-
  (/notion/mysql rsa public key error/img 1.png) MySQL: Retrieval of the RSA
  public key is not enabled for insecure…
pubDatetime: 2024-02-26T07:38:09.813Z
tags:
  - mysql
  - troubleshooting
---

![](/notion/mysql-rsa-public-key-error/img-1.png)

MySQL: Retrieval of the RSA public key is not enabled for insecure connections.

PM작업 후에 Power BI에서 데이터소스에 접근이 불가능해졌다.

#### 원인

PM 작업 후에 MySQL을 latest stable 버전으로 설치한다.

8.0.36으로 stable 버전이 바뀐 것을 확인할 수 있었는데 버전이 올라가면서 8.0의 default password plugin인 caching_sha2_password의 변경이 있었거나 버그인 것으로 추정된다.

일반적인 접속은 잘 되지만 특정 connector의 문제가 아닐까 싶다.

#### 해결 방법

해당 계정의 password plugin을 변경해준다.

```python
# 계정의 plugin 확인
select user,host,plugin from mysql.user;

# plugin 변경
alter user userName identified with mysql_native_password by password;

## password를 입력하지 않으면 빈 값으로 변경되므로 기존 password를 꼭 입력하기
```

#### 후기

MySQL은 8.0 버전부터 default password plugin이 바뀌었는데 실질적으로 체감되는 부분은 없었다.

비록 Aurora for MySQL은 3버전에서도 mysql_native_plugin을 사용해서 관련해서는 크게 신경을 쓰지 않았었다.

설치형 관리를 위해서라도 관련해서는 잘 알아둘 필요가 있을 것 같다.
