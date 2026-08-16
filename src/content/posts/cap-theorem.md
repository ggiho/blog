---
title: CAP 이론
description: >-
  CAP 이론 (CAP Theorem) In a distributed system, you can choose at most two out
  of three guarantees: Consistency,…
pubDatetime: 2025-07-14T10:40:41.906Z
tags:
  - distributed
  - theory
---

## Introduction

### 📌 CAP 이론 (CAP Theorem)

> In a distributed system, you can choose at most two out of three guarantees: Consistency, Availability, and Partition Tolerance.

---

#### 1. ✅ 핵심 특성 정의

---

#### 2. 🔄 트레이드오프 종류

CAP 이론에 따르면 분산 환경에서 네트워크 문제가 발생하면, 세 특성 중 두 가지만 유지할 수 있습니다:

- **CP (Consistency + Partition Tolerance)**
  - → **가용성 희생**
  - 파티션 발생 시 시스템은 으로 응답을 차단하여 일관성을 지킵니다.
  - 은행, 예약 시스템 등에 적합 
- **AP (Availability + Partition Tolerance)**
  - → **일관성 희생**
  - 파티션 시 응답 유지하지만 일시적으로 데이터 불일치 발생.
  - SNS, CDN, 실시간 분석 등에 적합 
- **CA (Consistency + Availability)**
  - → **Partition Tolerance 불가능**
  - 이론상 가능하지만, 분산 시스템에서는 네트워크 장애를 고려해야 하기 때문에 현실적으로 거의 존재하지 않습니다.
  - 단일 노드 RDBMS 수준에 가깝습니다 

---

#### 3. 🔍 왜 "2개만" 선택해야 하나?

네트워크 분할이 발생하면:

- **일관성 유지 → 일부 노드 응답 거부 (가용성 포기)**
- **가용성 유지 → 최신 데이터 보장 어려움 (일관성 포기)** 
즉, 분산 시스템은 파티션 상황에서 C와 A 중 무엇을 우선할지 결정해야 합니다.

---

#### 4. ⚙️ 실세계 적용 예

- **CP 시스템**: HBase, MongoDB(primary), Zookeeper 등
- **AP 시스템**: Cassandra, CouchDB, DynamoDB 등
- **CA 시스템**: 단일 인스턴스 RDBMS (MySQL, PostgreSQL 등) – **현실의 분산 시스템에는 거의 해당 안됨** 

---

#### 5. 🧠 확장: PACELC 이론

CAP의 한계를 보완한 확장 이론입니다.

- **P (Partition)** 발생 시 → A vs C 선택
- **Else (E, 평시)** → Latency (L) vs Consistency (C) 선택 
즉,

```mathematica
If P:
  choose A or C
Else:
  choose L or C
```

---

#### 6. 🎯 정리

1. 분산 시스템은 **네트워크 분할(P)**을 항상 고려해야 함
1. 이론상 CAP 중 두 가지만 충족 가능
1. **실용적 설계는 PACELC와 같은 정량적 접근이 필요**
1. 시스템 요구사항(응답성, 최신성, 내결함성 등)에 따라 최적 조합 선택

---

#### 참고 문헌

- IBM “What is the CAP theorem?” 
- OneNY 블로그 “CAP 이론으로 보는 RDBMS vs NoSQL”
