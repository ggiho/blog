---
title: MySQL 모니터링 스택 구축 — Prometheus/exporter와 PMM
description: >-
  pull vs push 개념부터 node/mysqld exporter + Prometheus + Grafana, Percona PMM,
  그리고 꼭 봐야 할 지표까지
pubDatetime: 2026-08-12T09:00:00.000Z
tags:
  - mysql
  - monitoring
  - prometheus
  - grafana
---

MySQL을 모니터링하는 두 갈래 — 직접 조립하는 **Prometheus + exporter + Grafana**와, 통짜로 얹는 **Percona PMM** — 를 정리했다. 명령의 IP·계정·비밀번호는 전부 예시 플레이스홀더다.

## Pull vs Push

수집 방향으로 아키텍처가 갈린다.

- **Pull (스크랩)** — 모니터링 서버가 대상(exporter)에 주기적으로 **접속해서 긁어온다**. 대표: **Prometheus**. 대상 목록을 중앙에서 관리하고, 대상은 그냥 지표를 노출만 하면 된다.
- **Push** — 지표가 발생하는 쪽에서 수집 서버로 **밀어 넣는다**. 대표: **Telegraf → InfluxDB**. 방화벽/동적 호스트가 많은 환경에 유리.

> [!note]
> Prometheus가 pull, InfluxDB(+Telegraf)가 push다. 헷갈리기 쉬운데 "Prometheus가 대상을 찾아가 긁어온다"로 기억하면 된다.

## 방식 1: Prometheus + exporter + Grafana

### node_exporter (OS 지표)

```shell
wget https://github.com/prometheus/node_exporter/releases/download/v1.4.0/node_exporter-1.4.0.linux-amd64.tar.gz
tar xvzf node_exporter-1.4.0.linux-amd64.tar.gz
cd node_exporter-1.4.0.linux-amd64
nohup ./node_exporter &        # 기본 포트 9100
```

### mysqld_exporter (MySQL 지표)

```shell
wget https://github.com/prometheus/mysqld_exporter/releases/download/v0.14.0/mysqld_exporter-0.14.0.linux-amd64.tar.gz
tar xvf mysqld_exporter-0.14.0.linux-amd64.tar.gz
```

전용 계정을 만들고 최소 권한만 준다.

```sql
CREATE USER 'exporter'@'localhost' IDENTIFIED BY '****';
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'localhost';
```

접속 정보는 my.cnf로 넘긴다(경로를 안 주면 `/root/.my.cnf`를 찾다 에러난다).

```shell
./mysqld_exporter --config.my-cnf=/etc/my.cnf   # 기본 포트 9104
```

> [!tip]
> 방화벽에서 **9100(node)·9104(mysqld)** 를 Prometheus 서버 대역에만 열어준다. `netstat -tupln` 또는 `ss -tupln`으로 리슨 확인.

### Prometheus scrape 설정

Prometheus는 `prometheus.yml`의 타깃을 주기적으로 긁는다.

```yaml
scrape_configs:
  - job_name: node
    static_configs:
      - targets: ["10.0.0.11:9100", "10.0.0.12:9100"]
  - job_name: mysqld
    static_configs:
      - targets: ["10.0.0.11:9104", "10.0.0.12:9104"]
```

### Grafana

Grafana(기본 3000포트)에서 Prometheus를 데이터소스로 추가하고, 검증된 공개 대시보드를 import 하면 시작이 빠르다.

- **Node Exporter Full** — 대시보드 ID `1860`
- **MySQLd Exporter** — Percona/공식 대시보드

## 방식 2: Percona PMM (통짜 솔루션)

exporter·시계열 DB·Grafana·쿼리 분석(QAN)을 한 컨테이너로 묶은 게 PMM이다. "빠르게 제대로"가 목적이면 이쪽.

### PMM 서버 (모니터링 서버)

```shell
docker pull percona/pmm-server:2
docker volume create pmm-data
docker run -d -p 443:443 \
  -v pmm-data:/srv \
  --name pmm-server --restart always \
  percona/pmm-server:2
# https://<pmm-server>  접속 → admin / admin 초기 로그인
```

### PMM 클라이언트 (모니터링 대상 DB 서버)

```shell
# 클라이언트 설치 후 서버 등록
pmm-admin config --server-insecure-tls --server-url=https://admin:****@10.0.0.100:443
```

DB에 PMM 전용 계정을 만든다.

```sql
CREATE USER 'pmm'@'localhost' IDENTIFIED BY '****';
GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD ON *.* TO 'pmm'@'localhost';
```

서비스로 등록한다. `--query-source`로 쿼리 분석 소스를 고른다.

```shell
# performance_schema 기반 (권장)
pmm-admin add mysql --query-source=perfschema --username=pmm --password=**** --port=3306 mydb-perf
# slow log 기반
pmm-admin add mysql --query-source=slowlog --username=pmm --password=**** --port=3306 mydb-slow

pmm-admin list        # 등록된 서비스 확인
```

서버를 옮기거나 정리할 때:

```shell
pmm-admin remove mysql mydb-slow           # list의 service-name으로 제거
# 서버 URL을 바꾸려면 기존 서비스 제거 후 config 재실행
pmm-admin config --server-insecure-tls --server-url=https://admin:****@10.0.0.101:443
```

## 꼭 봐야 할 지표

대시보드가 화려해도 결국 보는 건 정해져 있다.

- **리소스** — memory / CPU / disk usage
- **가용성** — database up/down
- **처리량** — QPS
- **캐시 효율** — InnoDB buffer pool hit ratio, thread cache hit ratio, table open cache ratio
- **연결** — thread connections, connection(aborted) miss rate
- **복제** — replication lag, slave last I/O errno

## 정리

- 방향으로 나뉜다: **Prometheus=pull**, **InfluxDB/Telegraf=push**
- 직접 조립 → node(9100)·mysqld(9104) exporter + Prometheus scrape + Grafana(1860)
- 빠르게 제대로 → **PMM**(pmm-server 컨테이너 + pmm-admin), 쿼리 분석은 `perfschema` 소스
- exporter/pmm 계정은 **최소 권한**(PROCESS·REPLICATION CLIENT·SELECT)
- 지표는 리소스·처리량·캐시효율·연결·복제 5축으로
