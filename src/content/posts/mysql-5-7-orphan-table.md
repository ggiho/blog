---
title: MySQL 5.7 Orphan table
description: Aurora 3 업그레이드 중 좀비 테이블 조치 회고 MySQL upgrade precheck log에서 에러가 발생했다. (/notion/mysql 5 7 orphan table/img 1.png) MySQL…
pubDatetime: 2024-08-06T01:16:27.702Z
tags:
  - mysql
  - troubleshooting
  - database
---
## Introduction

Aurora 3 업그레이드 중 좀비 테이블 조치 회고

MySQL upgrade precheck log에서 에러가 발생했다.

![](/notion/mysql-5-7-orphan-table/img-1.png)

MySQL 공식 문서에서는 Orphan table이라고 불리는 좀비 테이블에 대해서

[https://dev.mysql.com/doc/refman/5.7/en/innodb-troubleshooting-datadict.html](https://dev.mysql.com/doc/refman/5.7/en/innodb-troubleshooting-datadict.html) 공식 문서에서도 해당 내용을 소개하고 있지만 #sql 파일이 존재하지 않았다.

instance에 internal 권한이 없으므로 AWS support case를 등록했다.

RDS 엔지니어의 도움으로 테이블을 삭제할 수 있었지만 해결방법이 궁금했다.

> [!warning]
> 작업 스크립트를 공유해 달라고 했지만 AWS 내부 자료이므로 공유할 수 없음이라고 답변이 왔다.
> 그렇다면 직접 해보자.

```shell
mysql> create table tmp.test (id int);
Query OK, 0 rows affected (0.05 sec)

mysql> insert into tmp.test values(1),(2),(3);
Query OK, 3 rows affected (0.01 sec)
Records: 3  Duplicates: 0  Warnings: 0

mysql> quit
Bye
bash-4.2# ls
db.opt  test.frm  test.ibd  test1.frm  test1.ibd
bash-4.2# ll
bash: ll: command not found
bash-4.2# ls -al
total 220
drwxr-x---  7 mysql mysql   224 Aug  6 01:24 .
drwxr-xr-x 21 mysql root    672 Jul 25 07:11 ..
-rw-r-----  1 mysql root     65 Jul 25 05:09 db.opt
-rw-r-----  1 mysql mysql  8556 Aug  6 01:24 test.frm
-rw-r-----  1 mysql mysql 98304 Aug  6 01:28 test.ibd
-rw-r-----  1 mysql root   8556 Jul 25 05:28 test1.frm
-rw-r-----  1 mysql root  98304 Jul 25 05:29 test1.ibd
bash-4.2# rm -rf test.*
bash-4.2# ls
db.opt  test1.frm  test1.ibd
bash-4.2# mysql -uroot -p
Enter password:
Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 7
Server version: 5.7.44 MySQL Community Server (GPL)

Copyright (c) 2000, 2023, Oracle and/or its affiliates.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> show tables from tmp;
+---------------+
| Tables_in_tmp |
+---------------+
| test1         |
+---------------+
1 row in set (0.00 sec)

mysql> SELECT * FROM INFORMATION_SCHEMA.INNODB_SYS_TABLES WHERE NAME LIKE '%tmp%';
+----------+-----------+------+--------+-------+-------------+------------+---------------+------------+
| TABLE_ID | NAME      | FLAG | N_COLS | SPACE | FILE_FORMAT | ROW_FORMAT | ZIP_PAGE_SIZE | SPACE_TYPE |
+----------+-----------+------+--------+-------+-------------+------------+---------------+------------+
|       48 | tmp/test  |   33 |      4 |    30 | Barracuda   | Dynamic    |             0 | Single     |
|       46 | tmp/test1 |   33 |      4 |    26 | Barracuda   | Dynamic    |             0 | Single     |
+----------+-----------+------+--------+-------+-------------+------------+---------------+------------+
2 rows in set (0.00 sec)

mysql> quit
Bye
bash-4.2# cp test1.frm test.frm
bash-4.2# ls
db.opt  test.frm  test1.frm  test1.ibd
bash-4.2# mysql -uroot -p
Enter password:
Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 8
Server version: 5.7.44 MySQL Community Server (GPL)

Copyright (c) 2000, 2023, Oracle and/or its affiliates.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> show tables from tmp.test;
ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '.test' at line 1
mysql> show tables from tmp;
+---------------+
| Tables_in_tmp |
+---------------+
| test          |
| test1         |
+---------------+
2 rows in set (0.00 sec)

mysql> drop table tmp.test;
Query OK, 0 rows affected (0.02 sec)

mysql> create table tmp.test (id int, name varchar(20));
Query OK, 0 rows affected (0.03 sec)

mysql> quit
Bye
bash-4.2# ls
db.opt  test.frm  test.ibd  test1.frm  test1.ibd
bash-4.2# rm -rf test.*
bash-4.2# cp test1.frm test.frm
bash-4.2# mysql -uroot -p
Enter password:
Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 9
Server version: 5.7.44 MySQL Community Server (GPL)

Copyright (c) 2000, 2023, Oracle and/or its affiliates.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> show tables;
ERROR 1046 (3D000): No database selected
mysql> show tables from tmp;
+---------------+
| Tables_in_tmp |
+---------------+
| test          |
| test1         |
+---------------+
2 rows in set (0.00 sec)

mysql> drop table tmp.test;
Query OK, 0 rows affected (0.01 sec)

mysql> create table tmp.test (id int, name varchar(20));
Query OK, 0 rows affected (0.02 sec)

mysql> quit
Bye
bash-4.2# ls
db.opt  test.frm  test.ibd  test1.frm  test1.ibd
bash-4.2# rm -rf test.*
bash-4.2# touch test.frm
bash-4.2# mysql -uroot -p
Enter password:
Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 10
Server version: 5.7.44 MySQL Community Server (GPL)

Copyright (c) 2000, 2023, Oracle and/or its affiliates.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> show tables from tmp;
+---------------+
| Tables_in_tmp |
+---------------+
| test          |
| test1         |
+---------------+
2 rows in set (0.00 sec)

mysql> drop table tmp.test;
ERROR 1051 (42S02): Unknown table 'tmp.test'
mysql> quit
Bye
bash-4.2# cp test1.frm test.frm
bash-4.2# mysql -uroot -p
Enter password:
Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 11
Server version: 5.7.44 MySQL Community Server (GPL)

Copyright (c) 2000, 2023, Oracle and/or its affiliates.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> drop table tmp.test;
Query OK, 0 rows affected (0.02 sec)

mysql> desc tmp.test1;
+-------+---------+------+-----+---------+-------+
| Field | Type    | Null | Key | Default | Extra |
+-------+---------+------+-----+---------+-------+
| id    | int(11) | YES  |     | NULL    |       |
+-------+---------+------+-----+---------+-------+
1 row in set (0.00 sec)

```

```shell
mysql> SELECT * FROM INFORMATION_SCHEMA.INNODB_SYS_TABLES WHERE NAME LIKE '%tmp%';
+----------+-----------+------+--------+-------+-------------+------------+---------------+------------+
| TABLE_ID | NAME      | FLAG | N_COLS | SPACE | FILE_FORMAT | ROW_FORMAT | ZIP_PAGE_SIZE | SPACE_TYPE |
+----------+-----------+------+--------+-------+-------------+------------+---------------+------------+
|       44 | tmp/test  |   33 |      4 |    24 | Barracuda   | Dynamic    |             0 | Single     |
|       46 | tmp/test1 |   33 |      4 |    26 | Barracuda   | Dynamic    |             0 | Single     |
+----------+-----------+------+--------+-------+-------------+------------+---------------+------------+
2 rows in set (0.00 sec)

mysql> show tables from tmp;
+---------------+
| Tables_in_tmp |
+---------------+
| test1         |
+---------------+
1 row in set (0.01 sec)

mysql> select * from information_schema.tables where table_schema = 'tmp';
+---------------+--------------+------------+------------+--------+---------+------------+------------+----------------+-------------+-----------------+--------------+-----------+----------------+---------------------+-------------+------------+-------------------+----------+----------------+---------------+
| TABLE_CATALOG | TABLE_SCHEMA | TABLE_NAME | TABLE_TYPE | ENGINE | VERSION | ROW_FORMAT | TABLE_ROWS | AVG_ROW_LENGTH | DATA_LENGTH | MAX_DATA_LENGTH | INDEX_LENGTH | DATA_FREE | AUTO_INCREMENT | CREATE_TIME         | UPDATE_TIME | CHECK_TIME | TABLE_COLLATION   | CHECKSUM | CREATE_OPTIONS | TABLE_COMMENT |
+---------------+--------------+------------+------------+--------+---------+------------+------------+----------------+-------------+-----------------+--------------+-----------+----------------+---------------------+-------------+------------+-------------------+----------+----------------+---------------+
| def           | tmp          | test1      | BASE TABLE | InnoDB |      10 | Dynamic    |          0 |              0 |       16384 |               0 |            0 |         0 |           NULL | 2024-07-25 07:04:45 | NULL        | NULL       | latin1_swedish_ci |     NULL |                |               |
+---------------+--------------+------------+------------+--------+---------+------------+------------+----------------+-------------+-----------------+--------------+-----------+----------------+---------------------+-------------+------------+-------------------+----------+----------------+---------------+
1 row in set (0.00 sec)

mysql> quit
Bye
bash-4.2#ls
db.opt  test1.frm  test1.ibd
bash-4.2# vi test1.frm
bash-4.2# cp test1.frm test.frm
bash-4.2# cp test1.ibd test.ibd
bash-4.2# ls
db.opt  test.frm  test.ibd  test1.frm  test1.ibd
bash-4.2# mysql -uroot -p
Enter password:
Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 5
Server version: 5.7.44 MySQL Community Server (GPL)

Copyright (c) 2000, 2023, Oracle and/or its affiliates.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> show tables from tmp;
+---------------+
| Tables_in_tmp |
+---------------+
| test          |
| test1         |
+---------------+
2 rows in set (0.00 sec)

mysql> drop table tmp.test;
Query OK, 0 rows affected (0.04 sec)

mysql> SELECT * FROM INFORMATION_SCHEMA.INNODB_SYS_TABLES WHERE NAME LIKE '%tmp%';
+----------+-----------+------+--------+-------+-------------+------------+---------------+------------+
| TABLE_ID | NAME      | FLAG | N_COLS | SPACE | FILE_FORMAT | ROW_FORMAT | ZIP_PAGE_SIZE | SPACE_TYPE |
+----------+-----------+------+--------+-------+-------------+------------+---------------+------------+
|       46 | tmp/test1 |   33 |      4 |    26 | Barracuda   | Dynamic    |             0 | Single     |
+----------+-----------+------+--------+-------+-------------+------------+---------------+------------+
1 row in set (0.00 sec)

mysql> create table tmp.test (id int);
ERROR 1813 (HY000): Tablespace '`tmp`.`test`' exists.
mysql> quit
Bye
bash-4.2# ls
db.opt  test.ibd  test1.frm  test1.ibd
bash-4.2# rm -rf test.ibd
bash-4.2# mysql -uroot -p
Enter password:
Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 6
Server version: 5.7.44 MySQL Community Server (GPL)

Copyright (c) 2000, 2023, Oracle and/or its affiliates.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> create table tmp.test (id int);
Query OK, 0 rows affected (0.05 sec)

```

## Conclusion

결론적으로 Orphan table 상태가 됐을 때 frm 파일을 복구시키고 drop table 하는 방식으로 문제를 해결할 수 있다.

frm 파일은 다른 일반 테이블을 copy 하는 방식으로 복구해야되고 컬럼의 정보는 일치하지 않아도 된다.

ibd 파일이 남아 있으면 tablespace가 삭제되지 않으므로 frm, ibd 파일을 같이 삭제해야 한다.

해당 내용은 MySQL 8.0 미만의 버전에서만 발생하는 현상이며 MySQL 8.0 부터는 frm 파일이 없어지고 메타데이터는 ibd 파일에 같이 저장하게 된다.

Aurora 3로 업그레이드 하면 더 이상 발생하지 않는 문제이지만 이슈 직접 해결할 수 있는 능력은 중요하다가 생각하기 때문에 이 문제를 마무리 하고 넘어가고 싶었다.
