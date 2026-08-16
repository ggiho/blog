---
title: Airflow Tutorial
description: >-
  이미 안 쓰이는 곳이 없을 정도로 유명한 Apache top level 오픈소스이기 때문에 설명은 생략해도 될 것 같다. 이전 회사에서
  cron을 airflow로 변경했던 적이 있었는데 시간이 꽤나 지나서 기억이…
pubDatetime: 2024-09-23T14:23:03.705Z
tags:
  - airflow
  - data-engineering
---

## Introduction

이미 안 쓰이는 곳이 없을 정도로 유명한 Apache top level 오픈소스이기 때문에 설명은 생략해도 될 것 같다.

이전 회사에서 cron을 airflow로 변경했던 적이 있었는데 시간이 꽤나 지나서 기억이 희미해졌다. 

다시 airflow를 사용할 일이 생긴김에 정리를 해보자.

## Install

docker compose로 손쉽게 서비스를 올릴 수 있다.

```shell
curl -LfO 'https://airflow.apache.org/docs/apache-airflow/2.10.2/docker-compose.yaml'
mkdir -p ./dags ./logs ./plugins ./config
echo -e "AIRFLOW_UID=$(id -u)" > .env

docker compose up airflow-init

docker compose up -d
```

airflow가 처음이라면 example을 참고하고 걸리적 거리므로 `AIRFLOW__CORE__LOAD_EXAMPLES: ‘False’` 로 변경해 준다

`docker compose down -v` 옵션으로 volume을 remove할 수 있다.

dag를 작성하

`tenacity`  특정 조건일 때 재실행

원하던 기능인듯?
