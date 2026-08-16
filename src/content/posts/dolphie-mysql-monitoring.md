---
title: Dolphie for MySQL monitoring
description: Dolphie Dolphie is real time monitoring tool for MySQL. install shell pip pip install dolphie brew brew install dolphie…
pubDatetime: 2024-07-26T06:15:06.402Z
tags:
  - mysql
  - monitoring
  - tools
---
## Dolphie

Dolphie is real time monitoring tool for MySQL.

### install

```shell
# pip
pip install dolphie

# brew
brew install dolphie

# docker
docker pull ghcr.io/charles-001/dolphie:latest
docker run -dit --name dolphie ghcr.io/charles-001/dolphie:latest
docker exec -it dolphie bash
```

나는 docker로 설치를 해봤다.

bash에서 dolphie 명령어로 시작할 수 있다.

사용후 느낀점

grafana처럼 여러개의 인스턴스를 동시에 볼 수 없다는 단점이 있지만 간단한 확인 용도로는 편리해 보인다.

? 키를 누르면 key 매뉴얼이 제공된다.

![](/notion/dolphie-mysql-monitoring/img-1.png)

이중 몇 가지 유용한 기능

- o: `show engine innodb status` 명령어의 결과를 바로 확인할 수 있다.

![](/notion/dolphie-mysql-monitoring/img-2.png)

- e: error log를 확인할 수 있다.
  MySQL 8.0 이상 버전에서 performance_schema를 enable한 상태에서 조회 가능하다.

![](/notion/dolphie-mysql-monitoring/img-3.png)

- performance_schema.data_locks, performance_schema.processlist의 정보를 실시간으로 확인할 수 있다. r key로 refresh interval을 조절할 수 있다.
  가장 마음에 들었던 기능안 t key와의 조합이다.

- t: process의 detail과 해당 쿼리의 plan까지 볼 수 있다.
  쿼리를 추적하고 튜닝할 때 하던 동작을 한번에 해결할 수 있어서 앞으로 자주 사용할 것 같다.

![](/notion/dolphie-mysql-monitoring/img-4.png)

![](/notion/dolphie-mysql-monitoring/img-5.png)

![](/notion/dolphie-mysql-monitoring/img-6.png)

## Conclusion

대부분의 회사가 이미 모니터링 시스템이 갖추어져 있을 것이다.

Dolphie는 메인 모니터링 툴로는 부족한 점이 있지만 서브로는 충분히 유용하게 사용할 수 있을 것 같다.
