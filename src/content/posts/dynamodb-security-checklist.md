---
title: DynamoDB 보안 점검 체크리스트
description: 암호화, IAM 최소 권한, 네트워크, 백업/삭제 방지, 감사까지 — DynamoDB를 운영에 올리기 전 확인할 것들
pubDatetime: 2026-08-08T09:00:00Z
tags:
  - dynamodb
  - aws
  - security
---

DynamoDB는 관리형이라 "알아서 안전하겠지" 하기 쉽지만, 설정에 따라 구멍이 생긴다. 운영 배포 전·정기 점검 때 확인하는 항목을 정리한다.

## 암호화

- **저장 시 암호화(at rest)** — DynamoDB는 기본 암호화되지만, 키를 **AWS 관리형(aws/dynamodb)** 대신 **고객 관리형 KMS 키(CMK)** 로 두면 키 정책·회전·감사를 직접 통제할 수 있다
- **전송 중 암호화(in transit)** — 항상 TLS(HTTPS) 엔드포인트로 접근

## IAM 최소 권한

- `dynamodb:*` 금지. 필요한 액션만 (`GetItem`, `Query`, `PutItem` 등)
- **테이블/인덱스 단위 리소스 제한** — `Resource`에 특정 테이블 ARN만
- **조건 키로 행 수준 제한** — `dynamodb:LeadingKeys`로 사용자가 자기 파티션 키 데이터만 접근하게

```json
{
  "Effect": "Allow",
  "Action": ["dynamodb:Query", "dynamodb:GetItem"],
  "Resource": "arn:aws:dynamodb:*:*:table/orders",
  "Condition": {
    "ForAllValues:StringEquals": {
      "dynamodb:LeadingKeys": ["${aws:userid}"]
    }
  }
}
```

## 네트워크

- **VPC 게이트웨이 엔드포인트**로 접근 — 인터넷을 거치지 않고 프라이빗 경로로
- 엔드포인트 정책으로 특정 테이블/액션만 허용

## 백업 · 삭제 방지

- **PITR(Point-in-Time Recovery)** 활성화 — 최근 35일 내 임의 시점 복구
- **삭제 방지(deletion protection)** 켜기 — 실수로 테이블 삭제 방지
- 필요 시 on-demand 백업 정기화

## 감사 · 모니터링

- **CloudTrail**로 컨트롤 플레인(테이블 생성/삭제/정책 변경) 기록
- 데이터 플레인 접근이 중요하면 CloudTrail data events 활성화(비용 고려)
- CloudWatch로 스로틀링·에러·비정상 접근 알림

## 점검 요약

| 항목 | 확인 |
|---|---|
| 저장 암호화 | CMK(고객 관리형) 사용 여부 |
| IAM | 와일드카드 없이 액션·리소스 최소화, 조건 키 |
| 네트워크 | VPC 엔드포인트 + 엔드포인트 정책 |
| 백업 | PITR + 삭제 방지 |
| 감사 | CloudTrail(+data events), CloudWatch 알림 |

관리형이라도 **IAM·네트워크·백업·감사**는 사용자 몫이다. 체크리스트로 주기 점검하면 대부분의 구멍은 막힌다.
