---
title: CSV를 Parquet으로 한 방에 (duckdb)
description: duckdb 한 줄로 CSV를 Parquet으로 변환하는 작은 셸 스크립트
pubDatetime: 2026-05-25T09:00:00.000Z
tags:
  - duckdb
  - data-engineering
  - shell
---

CSV를 Parquet으로 바꿀 일이 잦다. duckdb 한 줄이면 된다. 자주 쓰니 `csv2parquet` 스크립트로 묶어뒀다.

```bash
#!/bin/bash
set -euo pipefail
usage() {
    echo "Usage: $(basename "$0") <input.csv>" >&2
    exit 1
}
[ "$#" -ne 1 ] && usage
csvfile="$1"
[ ! -f "$csvfile" ] && { echo "Error: file not found: $csvfile" >&2; exit 1; }
"$csvfile" != *.csv && { echo "Error: input must be .csv" >&2; exit 1; }

parquetfile="${csvfile%.csv}.parquet"
echo "Input CSV     : $csvfile"
echo "Output Parquet: $parquetfile"
duckdb -c "COPY (SELECT * FROM read_csv_auto('$csvfile', delim=',')) TO '$parquetfile' (FORMAT PARQUET);"
```

핵심은 결국 이 한 줄이다.

```sql
COPY (SELECT * FROM read_csv_auto('in.csv')) TO 'out.parquet' (FORMAT PARQUET);
```

`read_csv_auto`가 타입·구분자를 알아서 추론하고, `COPY ... (FORMAT PARQUET)`가 압축된 컬럼 포맷으로 떨궈준다. 별도 파이썬/pandas 없이 CLI만으로 끝나는 게 장점.
