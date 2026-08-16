---
title: JSON column type
description: Overview MySQL 5.7.8 버전부터 JSON 컬럼 타입을 지원하기 시작했다. 사용할 기회가 없었는데 마침 기회가 생겨서 정리해 본다. sql insert into json test set class…
pubDatetime: 2023-03-29T02:38:10.071Z
tags:
  - mysql
  - database
---
## Overview

MySQL 5.7.8 버전부터 JSON 컬럼 타입을 지원하기 시작했다. 사용할 기회가 없었는데 마침 기회가 생겨서 정리해 본다.

## 

```sql
insert into json_test set class_time = '{"1": {"start_time": "14:00", "end_time": "14:50"}, "2": {"start_time": "15:00", "end_time": "15:50"}}';
SELECT JSON_EXTRACT(JSON_UNQUOTE(JSON_EXTRACT(class_time, '$.1')),'$.start_time') a from json_test;
```

## Conclusion
