---
title: RDS start export task
description: >-
  스냅샷 생성 aws rds create db cluster snapshot \ db cluster snapshot identifier dev
  cluster snapshot 2024 09 24 \ db cluster…
pubDatetime: 2024-09-24T06:00:37.804Z
tags:
  - aws
  - rds
  - data-engineering
---

#### 스냅샷 생성

aws rds create-db-cluster-snapshot \
--db-cluster-snapshot-identifier dev-cluster-snapshot-2024-09-24 \
--db-cluster-identifier webfulfillment-mdb-dev-01-cluster

#### 스냅샷 정보 확인

aws rds describe-db-cluster-snapshots | jq '.DBClusterSnapshots[] | {SnapshotId: .DBClusterSnapshotIdentifier, CreatedAt: .SnapshotCreateTime, DBClusterSnapshotArn: .DBClusterSnapshotArn}'

#### export to s3

aws rds start-export-task \
--export-task-identifier export-dev-cluster-snapshot-2024-09-24 \
--source-arn arn:aws:rds:ap-northeast-2:607516933194:cluster-snapshot:dev-cluster-snapshot-2024-09-24 \
--s3-bucket-name webfulfillment-dev-msk \
--kms-key-id arn:aws:kms:ap-northeast-2:607516933194:key/dd64e559-f671-454a-8b3e-171d7e4a2cbb \
--iam-role-arn arn:aws:iam::607516933194:role/AppAdmins
