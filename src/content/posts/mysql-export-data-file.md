---
title: 데이터 파일로 내보내기
description: "shell SELECT FROM table WHERE condition INTO OUTFILE '/tmp/filename.csv' FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES…"
pubDatetime: 2023-04-14T05:19:00.638Z
tags:
  - mysql
  - data-engineering
---
```shell
SELECT * FROM table WHERE condition
INTO OUTFILE '/tmp/filename.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
```

- FIELDS TERMINATED BY 구분자 설정
- ENCLOSED BY 데이터를 “” 감싸기

```shell
LOAD DATA INFILE '/tmp/onl_cardinal_d.csv'
INTO TABLE onl_cardinal_d
FIELDS 
    TERMINATED BY ','
    OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
(cardinal_id,lecture_id,class_weekday,openday,max_seq,class_time,register_dtm,update_dtm)
IGNORE 1 ROWS;
```
