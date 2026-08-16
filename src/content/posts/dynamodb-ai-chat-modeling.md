---
title: DynamoDB로 AI Chat 이력 모델링하기
description: >-
  DynamoDB로 콜센터 상담 이력이 저장되고 있었지만, 내가 입사하기 전에 이미 구축된 영역이라 직접 만질 기회가 많지는 않았다.
  RDBMS처럼 매일 slow query를 보고 index를 조정하는 식의…
pubDatetime: 2026-05-11T05:57:51.651Z
tags:
  - dynamodb
  - nosql
  - aws
---

## Introduction

DynamoDB로 콜센터 상담 이력이 저장되고 있었지만, 내가 입사하기 전에 이미 구축된 영역이라 직접 만질 기회가 많지는 않았다. RDBMS처럼 매일 slow query를 보고 index를 조정하는 식의 모니터링을 하던 시스템도 아니어서, 사실상 “돌고 있으니까 잘 도는구나” 정도로만 보고 있었다.

그러다 반갑게도 DynamoDB 테이블 모델링 요건이 들어왔다.

요즘은 어디서든 AI를 비즈니스에 붙이려는 시도가 많고, 상담 업무도 예외는 아니었다. ChatGPT 같은 AI Chat 기능을 만들면서 사용자 질문, AI 답변, 상담 이력, 피드백 같은 데이터를 어떻게 저장할지 고민해야 했다.

처음에는 RDBMS처럼 생각했다. `chat_room`, `message`, `feedback` 같은 테이블을 만들고 FK로 연결하면 될 것 같았다. 그런데 DynamoDB는 그렇게 접근하면 장점을 살리기 어렵다. DynamoDB 모델링은 table을 먼저 나누는 게 아니라, 먼저 “어떤 방식으로 읽을 것인가”를 정리하는 쪽에 가깝다.

## DynamoDB를 RDBMS처럼 보면 헷갈린다

DynamoDB는 완전 관리형 key-value / document database다. Join을 전제로 하지 않고, primary key와 index를 이용해서 필요한 item을 빠르게 찾는 구조에 가깝다.

AWS에서 DynamoDB를 설명할 때도 access pattern을 먼저 정의하라고 계속 이야기한다. 이 말이 처음에는 뻔하게 들리는데, 실제로 모델링을 해보면 꽤 중요하다.

RDBMS에서는 정규화된 테이블을 먼저 만들고 나중에 query를 얹어도 어느 정도 버틸 수 있다. 필요하면 join을 하고, index를 추가하고, explain을 보면서 조정한다. 물론 이것도 쉬운 일은 아니지만, 적어도 데이터 모델과 query model 사이에 어느 정도 여유가 있다.

DynamoDB는 그 여유가 훨씬 적다. 나중에 “이 조건으로도 조회해야 하는데?”가 나오면 GSI를 추가하거나 item 구조를 바꿔야 할 수 있다. 그래서 처음부터 조회 패턴을 꽤 구체적으로 적어야 한다.

## 먼저 access pattern을 적는다

AI Chat 이력을 저장한다고 하면 대략 이런 조회가 필요할 수 있다.

1. 특정 사용자의 최근 chat session 목록 조회
1. 특정 session의 message 목록 시간순 조회
1. 특정 상담 건과 연결된 AI Chat 이력 조회
1. 특정 기간에 생성된 chat session 조회
1. 실패하거나 fallback된 AI 응답 목록 조회
1. 사용자 feedback이 낮은 답변 목록 조회
1. 운영자가 특정 session을 빠르게 찾아보는 조회
여기서 중요한 건 “데이터를 어떻게 저장할까?”보다 “어떤 query를 자주, 빠르게, 안정적으로 수행해야 할까?”다.

예를 들어 화면에서 가장 자주 필요한 조회가 `사용자별 최근 session`과 `session별 message 목록`이라면, 이 두 패턴은 base table primary key만으로 처리하고 싶다. 반대로 운영자용 통계나 배치성 조회라면 GSI나 별도 집계 테이블로 빼도 된다.

---

## 단순한 key 설계 예시

가장 단순하게는 single table 구조를 생각할 수 있다.

```plaintext
PK = USER#{userId}
SK = SESSION#{createdAt}#{sessionId}
```

이렇게 두면 특정 사용자의 session 목록을 시간순으로 조회하기 쉽다.

message는 session 단위로 묶어서 조회해야 하므로 아래처럼 둘 수 있다.

```plaintext
PK = SESSION#{sessionId}
SK = MESSAGE#{createdAt}#{messageId}
```

그러면 특정 session의 message 목록은 partition key 하나로 모아서 읽을 수 있다.

```plaintext
Query PK = SESSION#{sessionId}
```

이 구조의 장점은 단순하다는 점이다. 사용자의 session 목록과 session의 message 목록이라는 가장 기본적인 access pattern을 base table에서 처리할 수 있다.

다만 이것만으로 모든 조회를 처리할 수는 없다. 예를 들어 상담 건 기준으로 AI Chat을 찾아야 한다면 별도 item을 추가하거나 GSI를 둬야 한다.

## GSI는 “나중에 검색용”이 아니라 access pattern용이다

처음 DynamoDB를 볼 때 GSI를 RDBMS index처럼 생각하기 쉽다. 나도 처음에는 “필요한 컬럼에 index 하나 걸면 되겠지”에 가깝게 생각했다.

그런데 DynamoDB의 GSI는 그냥 검색 성능을 높이는 부가 장치라기보다, base table과 다른 key schema로 접근하기 위한 또 다른 access pattern에 가깝다.

예를 들어 상담 건 기준 조회가 필요하다면 아래처럼 GSI를 둘 수 있다.

```plaintext
GSI1PK = CASE#{caseId}
GSI1SK = SESSION#{createdAt}#{sessionId}
```

운영자가 실패한 AI 응답을 확인해야 한다면 아래처럼 실패 상태를 기준으로 모을 수도 있다.

```plaintext
GSI2PK = STATUS#FAILED
GSI2SK = CREATED_AT#{createdAt}#SESSION#{sessionId}
```

다만 GSI를 만들 때는 정말 필요한지 봐야 한다. GSI는 쓰기 시점에도 같이 유지되고, projection을 어떻게 잡느냐에 따라 저장 비용과 읽기 비용도 달라진다.

## Hot partition을 피해야 한다

DynamoDB 모델링에서 가장 조심해야 하는 것 중 하나는 hot partition이다.

특정 partition key로 읽기/쓰기가 몰리면 전체 table capacity가 충분해도 throttling이 날 수 있다. AWS 문서에서도 partition key는 workload가 고르게 분산되도록 설계하라고 안내한다.

AI Chat에서는 아래 같은 key가 위험할 수 있다.

```plaintext
PK = AI_CHAT
PK = DATE#2025-02-07
PK = STATUS#FAILED
```

모든 요청이 하나의 key로 몰리거나, 특정 날짜/상태에 쓰기가 집중될 수 있기 때문이다.

특히 `STATUS#FAILED` 같은 key는 운영자가 조회하기에는 편하지만, 실패 이벤트가 한 시점에 몰리면 쓰기 hotspot이 생길 수 있다. 이런 경우에는 시간 bucket을 나누거나 shard suffix를 붙이는 식으로 분산을 고려해야 한다.

```plaintext
GSI2PK = STATUS#FAILED#2025-02-07#SHARD#03
```

물론 처음부터 모든 것을 shard로 쪼개면 조회가 복잡해진다. 그래서 실제 traffic, 실패 이벤트 빈도, 운영 조회 요구사항을 보고 정하는 편이 좋다.

## message item 크기도 확인해야 한다

AI Chat에서는 message body가 길어질 수 있다. 질문은 짧아도 AI 답변이 길 수 있고, prompt, retrieved context, token usage, model metadata까지 같이 저장하고 싶어질 수 있다.

DynamoDB item size limit은 400KB다. 그래서 “관련 정보를 한 item에 다 넣자”는 방식은 위험할 수 있다.

내가 보기에는 아래처럼 나누는 편이 안전하다.

- 화면에 바로 필요한 message 본문과 최소 metadata는 DynamoDB item에 저장
- 큰 prompt/context/raw response는 S3에 저장하고 pointer만 DynamoDB에 저장
- 분석용 로그는 별도 pipeline으로 분리
처음에는 하나의 item에 다 넣는 게 편하다. 하지만 AI 쪽 데이터는 생각보다 빨리 커진다. 특히 context나 tool call 결과까지 저장하기 시작하면 400KB는 여유 있는 숫자가 아니다.

---

## LSI와 GSI를 구분해서 본다

DynamoDB에는 LSI와 GSI가 있다.

LSI는 base table과 partition key를 공유하고 sort key만 다르게 둔다. 같은 partition 안에서 다른 정렬/조회가 필요할 때 쓸 수 있다. 단, table 생성 시점에만 만들 수 있다.

GSI는 base table과 다른 partition key를 가질 수 있다. 나중에 추가할 수도 있고, base table과 다른 access pattern을 만들 때 자주 사용한다. 대신 GSI read는 eventual consistency만 지원한다.

정리하면, AI Chat 이력 모델링에서는 대부분 GSI를 먼저 고려하게 될 가능성이 높다. 상담 건 기준, 상태 기준, 기간 기준처럼 base key와 다른 축으로 읽어야 하는 경우가 많기 때문이다.

하지만 GSI를 많이 만드는 게 정답은 아니다. access pattern이 애매한 상태에서 index부터 늘리면 비용과 복잡도만 올라간다.

## 내가 잡은 모델링 순서

이번에 DynamoDB를 다시 보면서, 나는 아래 순서로 정리하는 게 가장 낫다고 느꼈다.

1. 화면/API에서 실제로 필요한 조회 목록을 먼저 적는다.
1. 조회 빈도와 중요도를 나눈다.
1. 가장 중요한 조회는 base table key로 처리한다.
1. 보조 조회는 GSI로 뺄지, 별도 집계/검색 저장소로 뺄지 결정한다.
1. partition key별 traffic이 한쪽으로 몰리지 않는지 본다.
1. item size가 커질 수 있는 필드는 S3 분리를 고려한다.
1. 운영 조회와 분석 조회를 같은 table에서 억지로 해결하려고 하지 않는다.

## 예시로 정리한 item 형태

실제 구현 전 설계 단계에서는 이런 식으로 item 형태를 적어보면 도움이 된다.

```plaintext
// Chat session item
PK     = USER#{userId}
SK     = SESSION#{createdAt}#{sessionId}
type   = SESSION
caseId = {caseId}
status = OPEN | CLOSED

GSI1PK = CASE#{caseId}
GSI1SK = SESSION#{createdAt}#{sessionId}
```

```plaintext
// Message item
PK        = SESSION#{sessionId}
SK        = MESSAGE#{createdAt}#{messageId}
type      = MESSAGE
role      = USER | ASSISTANT
content   = {message body}
s3Pointer = {optional large payload pointer}
```

```plaintext
// Failed response lookup item or GSI projection
GSI2PK = STATUS#FAILED#{yyyyMMdd}
GSI2SK = CREATED_AT#{createdAt}#SESSION#{sessionId}
```

이건 정답이라기보다 출발점이다. 실제로는 traffic, retention, 개인정보 보관 정책, 검색 요구사항에 따라 달라질 수 있다.

## 정리

DynamoDB 모델링은 RDBMS 모델링보다 더 먼저 query를 생각하게 만든다.

처음에는 이게 불편했다. 테이블을 예쁘게 나누고 FK로 연결하는 방식이 익숙했기 때문이다. 그런데 AI Chat 이력처럼 access pattern이 비교적 분명하고, session/message 단위 조회가 많은 데이터라면 DynamoDB가 잘 맞을 수도 있겠다는 생각이 들었다.

다만 전제는 있다.

- access pattern을 먼저 적어야 한다.
- partition key가 몰리지 않게 설계해야 한다.
- GSI를 남발하지 않아야 한다.
- item size limit을 의식해야 한다.
- 검색/분석성 조회를 DynamoDB 하나로 다 해결하려고 하면 안 된다.
개인적으로 가장 크게 배운 건 “DynamoDB에서는 모델링이 곧 query 설계”라는 점이다. RDBMS처럼 저장 구조를 먼저 잡고 나중에 query를 맞추는 방식으로 접근하면 중간에 다시 갈아엎을 가능성이 높다.

---

## 참고

- Amazon DynamoDB — Best practices for designing and architecting with DynamoDB: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html
- Amazon DynamoDB — Designing partition keys to distribute your workload: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-uniform-load.html
- Amazon DynamoDB — Core components: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html
- AWS Prescriptive Guidance — Best practices for DynamoDB data modeling: https://docs.aws.amazon.com/prescriptive-guidance/latest/dynamodb-data-modeling/best-practices.html
