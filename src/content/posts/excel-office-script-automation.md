---
title: Office Script로 엑셀 리포트 자동화하기
description: '연결된 데이터 소스 새로고침부터 가공·정리까지, Office Script + Power Automate로 반복 리포팅 없애기'
pubDatetime: 2026-08-07T09:00:00.000Z
tags:
  - excel
  - office-script
  - automation
---

정기 리포트가 "엑셀 열기 → 새로고침 → 저장 → 공유"의 반복이면, **Office Script**로 자동화할 수 있다. VBA와 달리 클라우드(Excel on the web)에서 돌고, Power Automate로 스케줄링까지 붙는다.

## Office Script란

Excel on the web의 TypeScript 기반 자동화다. `ExcelScript.Workbook`을 받아 시트·범위·테이블을 조작한다.

```typescript
function main(workbook: ExcelScript.Workbook) {
  // 연결된 데이터 소스(쿼리) 전체 새로고침
  workbook.refreshAllDataConnections();

  const sheet = workbook.getWorksheet("Report");
  const used = sheet.getUsedRange();
  console.log(`행 수: ${used.getRowCount()}`);
}
```

## 흔한 패턴: 새로고침 + 가공

Power Query/데이터 연결로 소스를 물려두고, 스크립트로 새로고침한 뒤 필요한 정리를 한다.

```typescript
function main(workbook: ExcelScript.Workbook) {
  workbook.refreshAllDataConnections();

  const src = workbook.getWorksheet("Data").getUsedRange();
  const values = src.getValues();

  // 예: 특정 조건 집계 후 Summary 시트에 기록
  const total = values.slice(1).reduce((acc, row) => acc + (row[3] as number), 0);
  workbook.getWorksheet("Summary").getRange("B2").setValue(total);
}
```

> [!tip]
> `refreshAllDataConnections()`는 연결 종류에 따라 비동기로 끝날 수 있다. 갱신 완료를 전제로 후속 계산을 한다면, 소스 규모에 맞춰 흐름을 나누거나 Power Automate 단계로 분리한다.

## 스케줄링: Power Automate

스크립트를 저장해두면 Power Automate 흐름에서 **"Run script"** 액션으로 호출할 수 있다.

- 트리거: 매일/매주 정해진 시각(Recurrence)
- 액션: Excel Online → Run script → (선택) Teams/메일로 결과 알림

이렇게 하면 사람이 파일을 열지 않아도 리포트가 갱신된다.

## 주의점

- **VBA 매크로는 Office Script가 아니다** — 로직 이식 필요
- 외부 시스템 직접 접근은 제한적 — DB/API 연동은 Power Automate 커넥터나 Power Query 쪽에서
- 대용량은 브라우저/타임아웃 한계 고려 — 무거운 집계는 소스(쿼리) 단에서 미리

## 정리

- Excel on the web + TypeScript로 리포트 자동화
- `refreshAllDataConnections()`로 연결 소스 갱신 + 스크립트로 가공
- **Power Automate**로 스케줄 실행 → "사람이 여는 리포트"를 없앤다
