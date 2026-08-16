---
title: AWS DMS 테스트하면서 실제로 막혔던 지점들
description: AWS DMS를 테스트하면서 생각보다 여러 지점에서 막혔다. 처음에는 source와 target endpoint를 만들고, replication instance를 하나 띄운 다음, migration task만 잘…
pubDatetime: 2026-05-11T05:53:50.754Z
tags:
  - dms
  - aws
  - data-engineering
---
## Introduction

AWS DMS를 테스트하면서 생각보다 여러 지점에서 막혔다.

처음에는 source와 target endpoint를 만들고, replication instance를 하나 띄운 다음, migration task만 잘 만들면 될 거라고 생각했다. 실제로 기본 설정 자체는 어렵지 않았다. 문제는 task가 실패했을 때 원인을 찾는 과정, LOB 컬럼을 옮기는 방식, transformation rule 제약, 그리고 CDC를 켰을 때 source DB에 걸리는 부하였다.

이 글은 DMS 사용법을 처음부터 정리한 글이라기보다는, 테스트하면서 실제로 삽질했던 지점을 다시 보기 좋게 정리한 기록에 가깝다. 환경마다 결과는 다를 수 있지만, 적어도 DMS를 운영 환경에 붙이기 전에 어떤 부분을 먼저 확인해야 하는지 체크리스트로는 쓸 수 있을 것 같다.

## 1. Endpoint 생성은 단순하지만 권한에서 자주 막힌다

DMS를 사용하려면 먼저 source endpoint와 target endpoint를 만든다.

source 쪽에서 가장 먼저 확인해야 했던 건 replication에 필요한 권한이었다. 권한이 부족하면 endpoint connection test 단계에서 바로 실패하거나, task를 실행한 뒤에 애매한 오류로 이어질 수 있다.

또 하나 헷갈렸던 부분은 server name이었다. 콘솔에서 입력하는 값이 단순 label이 아니라 실제 접속 가능한 endpoint 또는 IP여야 한다. 너무 당연한 얘기인데, 처음 설정할 때는 콘솔 필드명이 애매해서 한 번씩 확인하게 된다.

Target endpoint도 큰 흐름은 source와 비슷했다. 다만 MySQL 계열 target을 사용할 때는 DMS가 데이터를 적재하는 방식 때문에 target DB parameter도 같이 봐야 했다.

## 2. Table error가 났다면 CloudWatch log부터 켜야 한다

처음 만난 오류는 task의 table load state가 `Table error`로 떨어지는 상황이었다. 콘솔 화면만 보면 어떤 오류인지 바로 알기 어렵다.

이때 task 생성 시 CloudWatch log를 남기도록 설정해두면 실제 원인에 접근할 수 있다. 나는 이 설정을 켜고 나서야 target DB 쪽 설정 문제를 확인할 수 있었다.

운영 환경에서는 여기서 한 가지를 더 조심해야 한다. DMS가 CloudWatch log를 쓰기 위해 IAM role을 만들거나 사용하게 되는데, 조직의 tagging 정책이나 IAM 관리 방식에 따라 role이 자동 정리될 수 있다. 그러면 어느 시점부터 log가 더 이상 쌓이지 않아서 원인 파악이 다시 어려워진다.

정리하면, DMS task를 테스트할 때는 아래를 먼저 확인하는 편이 낫다.

- task 생성 시 CloudWatch log 활성화
- DMS가 사용하는 IAM role 유지 여부
- 운영 환경의 tagging/정책 자동화와 충돌 여부
- table error가 났을 때 콘솔 상태값만 보지 말고 log에서 원인 확인

---

## 3. MySQL target에서는 local_infile을 확인해야 했다

CloudWatch log를 따라가보니 target DB에서 `local_infile` 설정이 필요했다.

AWS DMS 공식 문서에서도 MySQL-compatible target에 데이터를 load하려면 database parameter `local_infile = 1`을 설정하라고 안내한다. 테스트 환경에서는 이 값이 꺼져 있었고, 설정을 켠 뒤 실패했던 table을 다시 load하자 정상적으로 진행됐다.

```plaintext
[mysqld]
local_infile = ON
```

RDS/Aurora MySQL이라면 parameter group에서 조정해야 하므로, 단순히 DB 안에서 변수만 보고 끝내지 말고 실제 적용 여부와 재시작 필요 여부까지 같이 확인하는 게 좋다.

## 4. Selection rule은 JSON으로 관리하는 게 편하다

테이블 몇 개만 옮기는 테스트라면 콘솔에서 selection rule을 직접 추가해도 된다. 하지만 schema나 table이 많아지면 콘솔 입력만으로는 관리가 어렵다.

이때는 table mapping JSON을 만들어서 관리하는 편이 낫다.

예를 들어 특정 schema/table 목록을 include rule로 만들고 싶다면, 대략 이런 식으로 JSON을 생성할 수 있다.

```python
def selection_rule(rule_id: int, schema: str, table: str) -> dict:
    return {
        "rule-type": "selection",
        "rule-id": str(rule_id),
        "rule-name": str(rule_id),
        "object-locator": {
            "schema-name": schema,
            "table-name": table,
        },
        "rule-action": "include",
        "filters": [],
    }
```

실제 운영에서는 schema/table 목록을 코드에 하드코딩하기보다 별도 파일에서 읽어오게 만드는 편이 좋다. 그래야 제외 테이블이 생기거나 task를 나눠야 할 때 실수를 줄일 수 있다.

## 5. Transformation rule은 생각보다 제약이 크다

DMS에서 제일 의외였던 부분은 transformation rule이었다.

처음에는 schema rename, table prefix 추가, table name lower case 처리 같은 변환을 한 task 안에서 자연스럽게 조합할 수 있을 거라고 생각했다. 그런데 DMS는 같은 object level에 여러 transformation rule을 마음대로 적용하기 어렵다.

공식 문서에도 같은 schema/table/column 같은 object에 transformation rule action을 여러 개 적용할 수 없다는 제약이 있다. 콘솔 기준으로도 schema level, table level, column level에 transformation rule을 하나보다 많이 넣을 수 없다는 설명이 있다.

이 제약 때문에 테스트 중에는 필요한 변환을 모두 DMS 안에서 해결하지 못했다. 결국 어떤 변환은 포기하거나, DB parameter 쪽으로 우회하거나, 마이그레이션 전후 스크립트로 분리하는 방식까지 같이 봐야 했다.

개인적으로는 이 지점이 DMS를 단순 migration tool이 아니라 운영 migration pipeline으로 볼 때 가장 먼저 설계해야 하는 부분이라고 느꼈다.

## 6. LOB mode는 미리 정하지 않으면 full load 중에 터질 수 있다

TEXT 같은 LOB 컬럼이 있는 테이블을 full load할 때도 오류를 만났다.

DMS에는 LOB를 처리하는 방식이 여러 가지가 있다.

- Limited LOB mode
- Full LOB mode
- Inline LOB mode
처음에는 Full LOB mode가 가장 안전해 보였다. 큰 LOB도 잘리지 않고 옮길 수 있기 때문이다. 하지만 DMS는 Full LOB mode에서 LOB를 조각 단위로 가져오고, 이 방식은 느릴 수 있다. 공식 문서에서도 Full LOB mode는 LOB를 한 번에 하나씩 piece by piece로 migrate하기 때문에 느릴 수 있다고 설명한다.

반대로 Limited LOB mode는 최대 LOB 크기를 지정한다. 이 값을 잘 잡으면 성능상 유리하지만, 지정한 크기보다 큰 LOB는 잘릴 수 있다. 그래서 운영 데이터라면 먼저 실제 컬럼의 최대 크기를 확인해야 한다.

내 경우에는 문제가 난 컬럼의 최대 크기를 확인한 뒤, 여유를 두고 Limited LOB size를 조정해서 다시 실행했다.

```sql
SELECT
  MAX(CHAR_LENGTH(your_lob_column)) AS max_length
FROM your_table;
```

이렇게 실제 값을 확인하고 나서 설정을 바꿨을 때는 full load가 정상적으로 진행됐다.

LOB가 있는 테이블은 task를 만들기 전에 아래를 먼저 보는 게 좋다.

- LOB 컬럼이 있는 table 목록
- 각 LOB 컬럼의 실제 최대 크기
- 잘림을 허용할 수 있는 데이터인지
- Full LOB mode로 느려져도 되는지
- Limited LOB mode를 쓴다면 size를 얼마로 잡을지

---

## 7. Data validation은 생각보다 큰 차이가 없었다

테스트 중에는 Data validation을 켰을 때와 껐을 때 full load 시간이 얼마나 달라지는지도 봤다.

내가 테스트한 테이블은 약 1,560만 건 정도였고, Data validation을 켠 상태와 끈 상태의 차이가 생각보다 크지 않았다. 켰을 때는 약 17분, 껐을 때는 약 16분 정도였다.

물론 이건 테이블 구조, 네트워크, replication instance class, target DB 성능에 따라 달라질 수 있다. 그래도 적어도 이 테스트에서는 validation 자체가 병목이라고 보기는 어려웠다.

## 8. CDC에서 source CPU가 많이 오른 것이 가장 큰 문제였다

가장 치명적으로 느꼈던 부분은 CDC였다.

DMS task는 크게 아래 방식으로 동작한다.

- 기존 데이터만 migration
- 기존 데이터를 migration한 뒤 ongoing change replication
- 변경분만 replication
full load 중에 CPU를 많이 쓰는 건 어느 정도 예상했다. 그런데 full load 이후 CDC만 남은 상태에서도 source DB CPU가 꽤 올라갔다.

테스트 환경에서는 task 1개를 추가할 때마다 source CPU가 대략 2% 정도 증가하는 것처럼 보였다. task가 여러 개로 늘어나면 이 증가분이 무시하기 어려운 수준이 됐다.

이 부분은 support case로 확인했고, 당시에는 task 수를 줄이거나 더 높은 class의 인스턴스를 사용하는 방향을 안내받았다. 다만 내가 이해하기 어려웠던 부분은 “CDC만 하는데도 왜 이렇게 source CPU를 많이 쓰는가”였다.

결국 그 시점에는 DMS 전환을 바로 진행하지 않고, DB 버전 업그레이드 이후에 다시 테스트하기로 했다.

## 9. 업그레이드 이후 다시 테스트해보니 양상이 달라졌다

이후 Aurora MySQL 메이저 업그레이드를 진행하고 다시 테스트했다. 업그레이드 전에는 task가 늘어날수록 source CPU 사용률이 부담스러웠는데, 업그레이드 이후에는 같은 테스트에서 CPU 사용률이 훨씬 낮게 관찰됐다.

당시 support case 기준으로는 사용 중이던 Aurora MySQL 2.x 특정 버전에서 DMS 연결 시 CPU 사용률이 증가하는 이슈가 있었고, 이후 버전에서 개선된 것으로 안내받았다. 이 부분은 환경과 버전에 따라 달라질 수 있으므로 일반화하면 안 될 것 같다.

그래도 이 경험 이후로는 DMS를 붙이기 전에 source DB의 minor version과 알려진 이슈를 먼저 확인하게 됐다. DMS 설정만 보는 것보다, source DB engine version까지 같이 봐야 한다.

## 정리

DMS는 콘솔에서 task를 만드는 것만 보면 간단해 보인다. 하지만 실제 운영 데이터에 붙이면 생각보다 확인할 게 많다.

내가 다음에 DMS를 다시 테스트한다면 순서는 이렇게 잡을 것 같다.

1. source/target 권한과 endpoint connection test 먼저 확인
1. CloudWatch log와 DMS IAM role 유지 여부 확인
1. MySQL target이면 `local_infile` 확인
1. table mapping JSON으로 selection rule 관리
1. 필요한 transformation을 DMS 안에서 모두 처리할 수 있는지 먼저 검증
1. LOB 컬럼 목록과 최대 크기 확인 후 LOB mode 결정
1. full load뿐 아니라 CDC 상태에서 source CPU도 반드시 모니터링
1. source DB engine version과 DMS 관련 알려진 이슈 확인
DMS는 “버튼 몇 번으로 migration”이라는 느낌으로 접근하면 위험하다. 특히 CDC를 운영 DB에 붙이는 순간부터는 source DB 부하, task 수, LOB 처리, transformation 제약을 같이 봐야 한다.

개인적으로는 DMS 자체보다도 “DMS를 붙일 수 있는 형태로 migration scope를 정리하는 일”이 더 어려웠다. 그래서 다음에는 task를 만들기 전에 schema/table/rule/LOB/CDC 부하를 먼저 표로 정리하고 시작할 것 같다.

---

## 참고

- AWS DMS — Using a MySQL-compatible database as a target: https://docs.aws.amazon.com/dms/latest/userguide/CHAP_Target.MySQL.html
- AWS DMS — Setting LOB support for source databases in a task: https://docs.aws.amazon.com/dms/latest/userguide/CHAP_Tasks.LOBSupport.html
- AWS DMS — Transformation rules and actions: https://docs.aws.amazon.com/dms/latest/userguide/CHAP_Tasks.CustomizingTasks.TableMapping.SelectionTransformation.Transformations.html
- AWS DMS — Specifying table selection and transformations rules from the console: https://docs.aws.amazon.com/dms/latest/userguide/CHAP_Tasks.CustomizingTasks.TableMapping.Console.html
