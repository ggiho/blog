---
title: airflow.cfg에서 나중에 다시 보게 되는 옵션들
description: Airflow를 설치형으로 쓰면 결국 airflow.cfg 를 다시 열어보게 된다. 처음 설치할 때는 기본값으로도 잘 떠서 넘어가게 되는데, API를 호출하거나 task를 병렬로 돌리거나 metadata…
pubDatetime: 2026-05-11T05:53:52.500Z
tags:
  - airflow
  - data-engineering
---
## Introduction

Airflow를 설치형으로 쓰면 결국 `airflow.cfg`를 다시 열어보게 된다.

처음 설치할 때는 기본값으로도 잘 떠서 넘어가게 되는데, API를 호출하거나 task를 병렬로 돌리거나 metadata database를 SQLite에서 MySQL/PostgreSQL로 바꾸는 순간부터는 설정 파일을 제대로 봐야 한다.

이 글은 내가 나중에 다시 보려고 남겨둔 `airflow.cfg` 옵션 정리다. 원래 메모는 Airflow 2.x 기준으로 작성했기 때문에, Airflow 3.x를 쓰는 경우에는 기본값이 달라진 부분을 꼭 확인해야 한다.

## 1. api.auth_backends

Airflow API 인증은 Web UI 로그인과 별도로 설정된다. Airflow 2.x에서는 `[api] auth_backends` 값으로 API 인증 방식을 지정한다.

```plaintext
[api]
auth_backends = airflow.api.auth.backend.session
```

기본값인 `airflow.api.auth.backend.session`은 Web UI session을 기준으로 인증한다. 그래서 별도 인증 없이 API를 호출하면 401을 만나는 경우가 있다.

API를 script나 외부 시스템에서 호출해야 한다면 `basic_auth`를 설정해서 테스트할 수 있다.

```plaintext
[api]
auth_backends = airflow.api.auth.backend.basic_auth
```

다만 basic auth는 편해서 켜는 옵션이지, 아무 생각 없이 운영에 열어둘 옵션은 아니다. reverse proxy, network policy, 계정 권한, TLS 같은 기본적인 보호 장치와 같이 봐야 한다.

API를 아예 막아야 하는 환경이라면 `deny_all` 계열 backend를 사용할 수 있다.

```plaintext
[api]
auth_backends = airflow.api.auth.backend.deny_all
```

내가 겪은 흐름은 단순했다. API를 호출해야 해서 아무 생각 없이 요청을 보냈고, 401을 보고 나서야 `auth_backends`를 확인했다. Airflow API를 외부에서 호출할 일이 있다면 처음부터 이 값을 확인하는 게 좋다.

## 2. core.executor

Executor는 task를 어떤 방식으로 실행할지 결정한다.

Airflow 2.x에서는 처음 설치했을 때 `SequentialExecutor`를 자주 보게 된다.

```plaintext
[core]
executor = SequentialExecutor
```

이름 그대로 task를 순차적으로 실행한다. 로컬에서 간단히 테스트하기에는 편하지만, 여러 task를 병렬로 돌려야 하는 환경에는 맞지 않는다.

작은 단일 서버 구성에서는 `LocalExecutor`를 많이 보게 된다.

```plaintext
[core]
executor = LocalExecutor
```

`LocalExecutor`는 task를 병렬로 실행할 수 있다. 대신 metadata database를 SQLite로 두면 사용할 수 없고, MySQL이나 PostgreSQL 같은 DB backend를 따로 둬야 한다.

Airflow 공식 문서에서도 Airflow 2.x 기준으로 SequentialExecutor는 production에 적합하지 않고, 작은 single-machine production 설치에서는 LocalExecutor를 사용할 수 있다고 설명한다.

여기서 주의할 점은 Airflow 3.x다. 현재 stable 문서 기준으로는 기본 executor가 `LocalExecutor`로 바뀌어 있다. 그래서 예전 메모를 그대로 믿기보다는, 현재 설치된 버전에서 아래 명령으로 값을 확인하는 게 더 안전하다.

```bash
airflow config get-value core executor
```

---

## 3. metadata database를 바꿨다면 db migrate를 실행해야 한다

처음 Airflow를 만질 때는 SQLite로 시작하는 경우가 많다. 그런데 `LocalExecutor`를 쓰거나 운영에 가깝게 구성하려면 metadata database를 MySQL/PostgreSQL로 바꿔야 한다.

이때 connection 설정만 바꾸고 끝내면 안 된다. 새 metadata database에 Airflow schema가 만들어져야 한다.

Airflow 2.7 이후 기준으로는 보통 아래 명령을 사용한다.

```bash
airflow db migrate
```

공식 문서에서도 database schema가 없거나 최신 버전으로 migration해야 할 때 `airflow db migrate`를 실행해야 한다고 설명한다. 그리고 migration 실행 중에는 Airflow component를 멈추는 것을 권장한다.

또 하나 놓치기 쉬운 점은 계정 정보다. metadata database를 새로 만들면 기존 사용자 계정이 자동으로 옮겨지는 게 아니다. Web UI 로그인 계정이 필요하다면 새 DB 기준으로 다시 생성해야 한다.

## 4. 설정을 바꾼 뒤에는 실제 적용값을 확인한다

`airflow.cfg`를 수정했다고 해서 내가 생각한 값이 실제로 적용됐다고 바로 믿으면 안 된다.

Airflow는 config file뿐 아니라 environment variable로도 설정을 override할 수 있다. Docker, Helm, systemd, Kubernetes 환경에서는 오히려 env가 최종값인 경우도 많다.

그래서 설정을 바꾼 뒤에는 파일만 보지 말고 CLI로 실제 값을 확인하는 습관이 좋다.

```bash
airflow config get-value api auth_backends
airflow config get-value core executor
```

문제가 생겼을 때도 “cfg에는 이렇게 되어 있는데 왜 안 되지?”라고 보기 전에, Airflow process가 실제로 읽고 있는 값을 먼저 확인하는 편이 빠르다.

## 정리

내가 다시 Airflow 설치형 환경을 잡는다면 최소한 아래 순서로 확인할 것 같다.

1. API를 호출해야 하는지 먼저 정리한다.
1. 필요하다면 `[api] auth_backends`를 확인한다.
1. task 병렬 실행이 필요한지 보고 `[core] executor`를 정한다.
1. `LocalExecutor`를 쓸 거면 SQLite가 아닌 metadata database를 준비한다.
1. DB를 바꾼 뒤 `airflow db migrate`로 schema를 만든다.
1. 설정 변경 후 `airflow config get-value`로 실제 적용값을 확인한다.
`airflow.cfg`는 처음에는 그냥 기본 설정 파일처럼 보이지만, Airflow를 설치형으로 운영하다 보면 장애 지점과 꽤 가깝다. 특히 API 인증, executor, metadata database는 나중에 다시 보게 될 가능성이 높아서 따로 정리해두는 편이 좋다.

## 참고

- Apache Airflow 2.x — API authentication: https://airflow.apache.org/docs/apache-airflow/2.5.1/administration-and-deployment/security/api.html
- Apache Airflow 2.x — Executor: https://airflow.apache.org/docs/apache-airflow/2.8.4/core-concepts/executor/index.html
- Apache Airflow 2.x — Setting up the database: https://airflow.apache.org/docs/apache-airflow/2.9.3/installation/setting-up-the-database.html
- Apache Airflow stable — Executor: https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/executor/index.html
