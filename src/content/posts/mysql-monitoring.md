---
title: MySQL Monitoring
description: >-
  시작하며 PMM tip Alerting Contact points + New contact point Integration 항목을
  Slack으로 선택 Webhook URL 입력 후 Test…
pubDatetime: 2023-03-29T05:29:22.250Z
tags:
  - mysql
  - monitoring
  - database
---

## 시작하며

## PMM

> [!tip]
> 

Alerting > Contact points > + New contact point

**Integration 항목을 Slack으로 선택
Webhook URL 입력 후 Test**

![](/notion/mysql-monitoring/img-1.png)

![](/notion/mysql-monitoring/img-2.png)

Alerting > Notification policies

정책 등록을 해준다

![](/notion/mysql-monitoring/img-3.png)

alert rule 등록

![](/notion/mysql-monitoring/img-4.png)

![](/notion/mysql-monitoring/img-5.png)

Grafana의 경보 시스템은 대규모 모니터링에 적합하지 않을 수 있습니다. 그 이유는 다음과 같습니다.

1. 구성 복잡성 : 대규모 모니터링에서는 많은 수의 데이터 소스와 메트릭이 포함되므로, 경보를 구성하고 관리하는 작업이 매우 복잡해집니다. 이러한 복잡성은 경보의 오작동이나 알림을 놓치는 문제를 유발할 수 있습니다.
1. 성능 문제 : 대규모 모니터링에서는 많은 양의 데이터를 처리하므로, Grafana의 경보 시스템은 추가 리소스를 필요로 할 수 있습니다. 이는 서버의 성능 문제를 야기할 수 있으며, 경보 시스템의 안정성과 신뢰성을 저해할 수 있습니다.
1. 대역폭 문제 : 대규모 모니터링에서는 수백 또는 수천 개의 서버를 모니터링 할 수 있으므로, 경보 시스템이 생성하는 알림 메시지가 대량으로 발생할 수 있습니다. 이는 네트워크 대역폭을 초과할 수 있으며, 경보 시스템의 성능과 안정성을 저해할 수 있습니다.
1. 데이터 정합성 : 대규모 모니터링에서는 데이터의 정합성과 일관성을 유지하는 것이 중요합니다. 그러나 데이터 소스 및 메트릭이 많을 경우, 데이터 정합성 문제가 발생할 수 있으며, 이는 경보 시스템의 정확성과 신뢰성을 저해할 수 있습니다.

Prometheus의 Alertmanager는 Grafana의 경보 시스템과 비교하여 다음과 같은 단점을 해결할 수 있습니다.

1. 확장성 : Alertmanager는 대규모 모니터링에 대한 확장성이 뛰어납니다. Alertmanager는 클러스터링을 지원하며, 알림을 생성하고 처리하는 데 필요한 리소스를 수평으로 확장할 수 있습니다.
1. 유연성 : Alertmanager는 다양한 경보 처리 및 라우팅 규칙을 정의할 수 있으며, 이를 통해 알림을 수신하는 대상, 알림의 우선순위 및 알림을 처리하는 방법 등을 유연하게 구성할 수 있습니다.
1. 높은 성능 : Alertmanager는 수천 개의 경보 규칙 및 대량의 경보를 처리할 수 있습니다. 또한, 메모리 버퍼링 및 비동기 처리를 사용하여 경보 처리의 속도와 안정성을 높입니다.
1. 안정성 : Alertmanager는 고가용성 및 장애 복구 기능을 제공합니다. 이를 통해 Alertmanager 자체의 장애 또는 대상 시스템의 장애로 인해 알림이 누락되는 것을 방지할 수 있습니다.
따라서, Prometheus의 Alertmanager는 Grafana의 경보 시스템에 비해 대규모 모니터링에서 보다 확장성, 유연성, 성능 및 안정성을 제공하며, 이러한 이점으로 인해 많은 기업에서 Alertmanager를 경보 처리 시스템으로 선택하고 있습니다.

Grafana Alerting:

1. Grafana 대시보드에서 알림 규칙을 만듭니다. 이를 위해 대시보드의 설정 메뉴에서 "Alerts"를 선택하고, "New Alert Rule"을 클릭합니다.
1. 알림 규칙을 구성합니다. 이 단계에서는 규칙의 이름, 규칙을 적용할 대시보드 패널, 알림 수신자 등을 설정합니다.
1. 알림을 수신할 대상을 선택합니다. 이 단계에서는 이메일, Slack, PagerDuty 등 다양한 수신자 유형을 선택하고, 해당 수신자에 대한 정보를 입력합니다.
1. 알림 규칙을 저장하고 활성화합니다.

Prometheus Alertmanager:

1. Prometheus 서버에 Alertmanager를 설치하고, 구성 파일(alertmanager.yml)을 생성합니다.
1. 알림 규칙을 정의하는 Prometheus 규칙 파일(rule files)을 생성합니다. 이 파일에서는 알림 조건, 라벨 등을 정의합니다.
1. Alertmanager 구성 파일(alertmanager.yml)에서, 알림 라우팅 규칙을 정의합니다. 이 단계에서는 알림을 수신할 대상, 우선순위 등을 설정합니다.
1. Alertmanager를 실행하고, Prometheus 서버와 통합합니다. 이를 위해 Alertmanager에서 수신하는 webhook URL을 Prometheus 서버의 설정 파일에 추가하고, Prometheus 서버를 다시 시작합니다.
1. 알림 규칙을 테스트합니다. 이를 위해 Prometheus의 "Alert" 탭에서 알림 규칙을 직접 트리거하거나, Prometheus 규칙 파일에서 지정된 알림 조건이 발생할 때까지 기다립니다. 이후 Alertmanager에서 정의한 알림 라우팅 규칙에 따라 알림이 수신되는지 확인합니다.

## 마치며
