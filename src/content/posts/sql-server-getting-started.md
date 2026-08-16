---
title: SQL Sever(mssql) 시작하기
description: SQL Sever를 설치하고 사용해보자 (/notion/sql server getting started/img 1.png) CentOS 8 SQL Server 2022 Install 설치 가이드를 참고해서…
pubDatetime: 2023-04-23T01:58:45.627Z
tags:
  - sql-server
  - database
---
## Introduction

SQL Sever를 설치하고 사용해보자

![](/notion/sql-server-getting-started/img-1.png)

> CentOS 8
SQL Server 2022

## Install

설치 가이드를 참고해서 진행한다.

[https://learn.microsoft.com/ko-kr/sql/linux/quickstart-install-connect-red-hat?view=sql-server-ver16](https://learn.microsoft.com/ko-kr/sql/linux/quickstart-install-connect-red-hat?view=sql-server-ver16)

1. `sudo curl -o /etc/yum.repos.d/mssql-server.repo https://packages.microsoft.com/config/rhel/8/mssql-server-2022.repo` 

![](/notion/sql-server-getting-started/img-2.png)

  명령어 실행되면 mssql-server.repo 파일이 생성된다.

![](/notion/sql-server-getting-started/img-3.png)

1. `sudo yum install -y mssql-server`

![](/notion/sql-server-getting-started/img-4.png)

1. `sudo /opt/mssql/bin/mssql-conf setup`

![](/notion/sql-server-getting-started/img-5.png)

  숨도 쉬지 않고 2번 선택

  비밀번호를 설정하면 설치가 완료된다.

1. `systemctl status mssql-server`
  그동안 수 만번의 mysql 타이핑으로 손이 자동으로 mysql을 완성해 버린다. mysql이 아니라 mssql임을 유의하자

![](/notion/sql-server-getting-started/img-6.png)

  mysql의 3306 포트처럼 mssql은 1433 포트를 기본으로 사용한다. 1433. 뭔가 기억에 잘 안 남는다.

![](/notion/sql-server-getting-started/img-7.png)

1. sqlcmd 접속 툴 설치
  1. `sudo curl -o /etc/yum.repos.d/msprod.repo `[`https://packages.microsoft.com/config/rhel/8/prod.repo`](https://packages.microsoft.com/config/rhel/8/prod.repo)
  1. `yum install -y mssql-tools unixODBC-devel`
    YES로 다 넘어가면 설치 완료

```bash
# 환경변수 적용
echo 'export PATH="$PATH:/opt/mssql-tools/bin"' >> ~/.bashrc
source ~/.bashrc
```

## CLI 접속

접속 명령어 : `sqlcmd -S localhost -U SA`

mysql처럼 옵션을 생략하면 root로 접속이 되는지 봤더니 오류가 난다.

![](/notion/sql-server-getting-started/img-8.png)

정상적으로 명령어를 치고 패스워드 입력 후 접속 성공

![](/notion/sql-server-getting-started/img-9.png)

명령어를 입력하고 go 키워드를 넣어야 출력이 된다. 흠..

![](/notion/sql-server-getting-started/img-10.png)

mysql-cli와 유사한 mssql-cli가 있다. 명령어마다 go를 입력하라고? 그건 못참지

## mssql-cli 설치&접속

[https://github.com/dbcli/mssql-cli/blob/main/doc/installation/linux.md#centos-8](https://github.com/dbcli/mssql-cli/blob/main/doc/installation/linux.md#centos-8)

깃헙의 설치 가이드를 참고해서 설치한다.

```bash
# Import the public repository GPG keys
sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc

# Register the Microsoft product feed
curl https://packages.microsoft.com/config/centos/8/prod.repo > /etc/yum.repos.d/msprod.repo

# Install dependencies and mssql-cli
sudo yum install libunwind
sudo yum install mssql-cli
```

`yum -y install libunwind` 설치가 안 되면 `yum -y install epel-release` 후에 시도하기

sqlcmd와 접속 방법은 유사하다.

`mssql-cli -S localhost -U SA`

![](/notion/sql-server-getting-started/img-11.png)

mysql-cli처럼 키워드 힌트를 보여주고 무엇보다 go를 입력하지 않아도 결과가 출력되는 점이 좋다!

## 외부 접속

mssql을 GCE에 설치했기 때문에 1433 포트를 열어줘야 한다.

- 방화벽 규칙 확인
`gcloud compute firewall-rules list`

- 방화벽 규칙 만들기
`gcloud compute firewall-rules create sql-server --allow=tcp:1433`

이후에 확인 해보면 sql-server 규칙이 생성된걸 볼 수 있다.

![](/notion/sql-server-getting-started/img-12.png)

1. datagrip에서 접속
[08S01] 드라이버가 SSL(Secure Sockets Layer) 암호화를 사용하여 SQL Sever로 보안 연결을 설정할 수 없습니다. 오류: "PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target". ClientConnectionId:2b09b454-9e76-4a54-b540-44774db73ec1
sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target.

실패

1. dbeaver에서 시도

![](/notion/sql-server-getting-started/img-13.png)

성공

~~결론: 데이터그립 꼬지다~~

## Conclusion

오라클을 연결할 때도 느꼈지만 Datagrip은 오픈 소스에서는 꽤나 마음에 들지만 상용DB에서는 번거로운 부분이 확실히 있다.

인생 첫 SQL Server를 설치하고 사용해 봤는데 항상 새로운 것을 배우는건 재밌는 것 같다.

MySQL의 work bench 같은 SSMS(SQL Server Management Studio)를 많이 사용하는 것 같은데 나중에 한번 사용해 봐야겠다.
