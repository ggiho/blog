---
title: Aurora MySQL Architecture를 다시 정리해보기
description: >-
  Aurora MySQL을 쓰다 보면 겉으로는 MySQL처럼 보이는데, 운영 관점에서는 일반 MySQL과 다른 지점이 꽤 많다. 처음에는
  “MySQL 호환 managed database” 정도로 생각하기 쉽다.…
pubDatetime: 2026-05-11T06:25:57.947Z
tags:
  - aurora
  - mysql
  - aws
---

## Introduction

Aurora MySQL을 쓰다 보면 겉으로는 MySQL처럼 보이는데, 운영 관점에서는 일반 MySQL과 다른 지점이 꽤 많다.

처음에는 “MySQL 호환 managed database” 정도로 생각하기 쉽다. SQL도 MySQL이고, InnoDB도 있고, binlog도 쓸 수 있다. 그런데 장애 복구, replica lag, storage 장애, commit latency 같은 주제로 들어가면 Aurora는 전통적인 MySQL과 다른 구조를 가지고 있다.

내가 가장 헷갈렸던 지점은 redo log와 dirty page였다. 일반 MySQL에서는 redo log, checkpoint, dirty page flush, crash recovery가 자연스럽게 한 묶음으로 떠오른다. 그런데 Aurora에서는 compute와 storage가 분리되어 있고, durability의 많은 부분을 storage layer가 책임진다.

이 글은 Aurora MySQL을 “그냥 빠른 MySQL”이 아니라, 왜 구조적으로 다르게 동작하는지 정리해보는 글이다.

## 먼저 일반 MySQL의 쓰기 흐름을 생각해본다

일반적인 MySQL/InnoDB에서 DML이 수행되면 대략 이런 흐름을 떠올릴 수 있다.

1. buffer pool의 page를 수정한다.
1. 변경 내용을 redo log buffer에 기록한다.
1. commit 시 redo log를 flush한다.
1. binlog가 켜져 있다면 binlog도 기록한다.
1. 이후 checkpoint나 eviction 과정에서 dirty page가 disk로 flush된다.
1. crash recovery 시 redo log를 replay해서 page를 일관된 상태로 복구한다.
여기서 중요한 건 commit 시점에 data page 자체를 매번 disk에 쓰는 게 아니라는 점이다. commit durability는 redo log가 책임지고, dirty page flush는 나중에 일어난다.

Aurora도 이 큰 그림을 완전히 버린 것은 아니다. 하지만 redo log record가 저장되는 위치와 page를 materialize하는 책임이 달라진다.

## Aurora는 compute와 storage를 분리한다

Aurora의 핵심은 compute layer와 storage layer가 분리되어 있다는 점이다.

일반 MySQL에서는 DB instance가 local disk/EBS 위에 database file과 redo log file을 두고 동작한다고 생각하면 된다. 반면 Aurora는 writer/reader instance가 shared cluster volume을 바라본다. Aurora replica도 별도 데이터 복사본을 유지하는 방식이 아니라 같은 cluster volume을 공유한다.

AWS 문서에서도 Aurora cluster volume은 여러 copy로 구성되고, primary instance와 Aurora replica가 이 volume을 하나의 logical volume처럼 본다고 설명한다. 이 구조 때문에 Aurora replica는 일반 MySQL asynchronous replica보다 lag가 작다. AWS 문서 기준으로 Aurora replica lag는 보통 primary write 이후 100ms보다 훨씬 작다고 설명되어 있다.

즉, Aurora의 replica는 “writer의 binlog를 받아서 자기 disk에 적용하는 MySQL replica”라기보다, 같은 storage를 읽는 별도 compute node에 가깝다.

---

## Aurora storage는 10GiB segment와 6-way replication으로 구성된다

Aurora storage는 database volume을 작은 protection group 단위로 나누어 관리한다. Aurora 논문에서는 storage를 10GB segment 단위로 나누고, 각 segment를 3개 AZ에 2개씩 총 6개 copy로 유지한다고 설명한다.

이 구조에서 write quorum은 4/6, read quorum은 3/6이다.

조금 풀어서 보면:

- 하나의 protection group은 6개의 copy를 가진다.
- 3개 AZ에 2개씩 배치된다.
- write는 6개 중 4개가 받아야 durable하다고 판단한다.
- read는 최신 write와 교차할 수 있도록 3개 quorum을 사용한다.
이 설계의 목적은 단순히 “copy를 많이 둔다”가 아니다. AZ 하나가 통째로 문제가 생기고, 동시에 다른 AZ의 일부 storage node에 문제가 생겨도 read/write 가능성을 유지하기 위한 구조다.

운영 관점에서 보면 이 부분이 중요하다. Aurora에서 storage 장애는 특정 DB instance 장애와 같은 문제가 아니다. compute instance가 죽어도 storage volume은 별도로 유지되고, storage node 일부가 죽어도 quorum과 self-healing으로 복구된다.

## commit 시점에 Aurora는 page가 아니라 log record를 보낸다

Aurora 논문에서 가장 인상적인 부분은 “database tier에서 network를 건너가는 write는 redo log record뿐”이라는 설명이다. 일반 MySQL처럼 database tier가 background write, checkpoint, cache eviction을 위해 page를 storage로 쓰는 구조가 아니다.

Aurora에서는 변경이 발생하면 writer instance가 Aurora storage로 redo-log-equivalent record를 보낸다. storage node는 이 log record를 받아서 durable하게 저장하고, 필요할 때 page를 materialize한다.

대략 흐름은 이렇게 볼 수 있다.

1. SQL이 실행되고 InnoDB buffer pool의 page가 변경된다.
1. Aurora는 변경에 해당하는 log record를 만든다.
1. log record를 해당 protection group의 6개 storage copy로 전송한다.
1. 4개 copy에서 ACK를 받으면 write quorum을 만족한다.
1. commit이 durable하다고 보고 transaction을 완료할 수 있다.
1. page 자체의 최신 이미지는 storage layer에서 log record를 적용해 만들어진다.
이 구조 때문에 Aurora는 일반 MySQL보다 checkpoint/dirty page flush 관점이 다르다. dirty page를 flush해야 durability가 생기는 구조가 아니라, storage layer에 quorum으로 hardened된 log record가 durability의 핵심이 된다.

## dirty page flush를 다르게 봐야 한다

일반 MySQL을 오래 보면 dirty page flush는 중요한 운영 지표처럼 느껴진다. checkpoint age, redo log pressure, flush list, LRU flushing 같은 것들이 성능에 영향을 준다.

Aurora에서도 buffer pool은 여전히 중요하다. AWS 문서에서도 Aurora MySQL의 중요한 memory area로 buffer pool과 log buffer를 설명한다. 자주 읽는 table/index page를 memory에서 처리한다는 점은 MySQL과 같다.

하지만 Aurora에서는 database tier가 page를 storage로 직접 flush하지 않는다. Aurora 논문 기준으로는 database tier에서 page를 network로 쓰지 않고, log applicator가 storage tier로 이동해 있다.

그래서 Aurora의 dirty page는 durability보다 cache 관리 관점으로 보는 편이 맞다. buffer pool에 page가 dirty로 남아 있더라도, commit durability는 storage quorum에 의해 확보된다. page image를 실제로 최신 상태로 만드는 일은 storage layer가 log record를 적용하면서 수행한다.

이 부분을 이해하면 Aurora에서 crash recovery가 왜 빠른지도 같이 이해된다.

## Aurora의 recovery가 빠른 이유

일반 MySQL crash recovery는 redo log를 replay하면서 마지막 checkpoint 이후의 변경을 반영한다. database가 클수록, write가 많을수록 recovery 시간이 운영 이슈가 될 수 있다.

Aurora는 log apply와 page materialization의 많은 부분을 storage layer에서 계속 처리한다. AWS 문서에서도 Aurora는 unplanned restart 이후 거의 즉시 recovery하고, binary log 없이 application data를 계속 제공하도록 설계되었다고 설명한다. Aurora 논문도 storage service와 협력해 volume recovery를 수행하고 database가 빠르게 online될 수 있다고 설명한다.

다만 여기서 주의할 점이 있다. Aurora MySQL에서 binary logging을 켜면 unplanned restart recovery time에 직접 영향을 줄 수 있다. AWS 문서도 binary logging이 켜져 있으면 DB instance가 binary log recovery를 수행해야 하므로 recovery time에 영향을 준다고 설명한다.

즉, “Aurora는 recovery가 빠르다”는 말은 맞지만, binlog 설정과 workload에 따라 운영에서 체감하는 recovery time은 달라질 수 있다.

---

## replica는 shared storage를 보지만 cache는 별도다

Aurora replica는 writer와 같은 cluster volume을 본다. 그래서 일반 MySQL replica처럼 relay log를 받아서 자기 데이터 파일에 적용하는 구조와는 다르다.

하지만 replica가 완전히 공짜로 항상 최신 page를 memory에 가지고 있는 것은 아니다. 각 DB instance는 자기 buffer pool을 가진다. writer가 변경한 page가 reader의 buffer pool에 이미 있다면 reader는 그 page를 최신 상태로 맞춰야 한다. Aurora 논문에서는 writer의 log stream이 read replica에도 전달되고, reader는 해당 log record가 자신의 buffer cache에 있는 page를 가리키면 적용하고, 아니면 버린다고 설명한다.

이 구조 때문에 Aurora replica lag는 작지만 0이라고 단정하면 안 된다. 공식 문서도 replica lag가 보통 100ms보다 훨씬 작다고 설명하지만, write rate가 높으면 증가할 수 있다고 말한다.

운영에서는 아래처럼 이해하는 게 안전하다.

- read scaling은 Aurora replica로 비교적 쉽게 확장할 수 있다.
- writer와 reader는 같은 storage volume을 본다.
- 그래도 reader instance의 cache 상태와 log apply 상태 때문에 lag는 존재할 수 있다.
- 강한 read-after-write가 필요하면 reader endpoint만 믿으면 안 되고 consistency 요구사항을 따로 설계해야 한다.

## failover가 빠른 이유와 그래도 봐야 하는 것

Aurora에서 writer instance가 장애를 만나면 Aurora replica 중 하나가 writer로 승격될 수 있다. 이때 replica는 이미 같은 storage volume을 보고 있으므로 데이터 복사를 새로 할 필요가 없다.

AWS 문서도 Aurora replica를 failover target으로 사용할 수 있고, primary instance를 recreate하는 것보다 failover promotion이 빠르다고 설명한다. 또한 failover 시 writer와 failover target 위주로 reboot 동작이 일어나는 구조를 설명한다.

Aurora의 page cache도 일반적인 MySQL과 다르게 동작한다. AWS 문서에 따르면 Aurora의 page cache는 database와 별도 process로 관리되어 database failure 후에도 살아남을 수 있다. Aurora MySQL에서는 writer reboot/failover 상황에서 어떤 instance의 page cache가 유지되는지에 따라 warm-up 양상이 달라진다.

운영 관점에서는 failover를 “데이터 복사가 없으니 끝”으로 보면 안 된다.

봐야 할 것은 따로 있다.

- application connection retry가 잘 되는지
- DNS cache / driver / connection pool이 writer 변경을 잘 따라가는지
- failover target instance class가 writer workload를 감당할 수 있는지
- reader endpoint로 보내던 read traffic이 failover 중 어떻게 흔들리는지
- binlog 설정 때문에 restart recovery가 길어지지 않는지
Aurora 구조가 failover를 빠르게 만들지만, application 쪽 connection handling이 약하면 사용자는 그대로 장애를 느낀다.

## binlog는 여전히 중요하다

Aurora가 storage layer에서 durability를 처리한다고 해서 binlog가 사라지는 것은 아니다. Aurora MySQL에서도 binlog는 CDC, 외부 replication, 일부 migration 구성에서 여전히 중요하다.

다만 Aurora 내부 replica와 외부 MySQL replication을 구분해야 한다.

- Aurora cluster 안의 reader는 shared storage 기반 replica다.
- 다른 Region이나 외부 MySQL과의 replication은 binlog 기반이 될 수 있다.
- binlog를 켜면 recovery time과 write overhead에 영향을 줄 수 있다.
DMS나 Debezium 같은 CDC 도구를 붙이는 경우에도 binlog 설정은 운영상 중요한 변수가 된다. Aurora architecture를 볼 때 storage quorum만 보면 안 되고, 실제 서비스에서 binlog를 어떻게 쓰는지도 같이 봐야 한다.

## 일반 MySQL과 Aurora commit 흐름을 비교해보면

아주 단순화하면 일반 MySQL은 이렇게 볼 수 있다.

```plaintext
DML
→ buffer pool page 변경
→ redo log buffer 기록
→ COMMIT
→ redo log flush
→ binlog flush
→ commit ACK
→ 이후 dirty page flush
```

Aurora는 이렇게 보는 편이 이해하기 쉽다.

```plaintext
DML
→ buffer pool page 변경
→ Aurora log record 생성
→ storage layer로 전송
→ 4/6 write quorum ACK
→ 필요 시 binlog 기록/flush
→ commit ACK
→ storage layer가 log를 적용해 page materialize
```

정확한 내부 순서는 engine version, binlog 설정, flush 설정에 따라 더 복잡할 수 있다. 하지만 운영자가 이해해야 하는 핵심은 “commit durability의 중심이 local redo log file이 아니라 distributed storage quorum으로 이동했다”는 점이다.

---

## 내가 운영하면서 볼 포인트

Aurora MySQL을 운영한다면 구조를 공부하는 것에서 끝내지 않고 아래 지표를 같이 볼 것 같다.

1. **Replica lag**
- reader endpoint를 쓰는 서비스에서 read-after-write 문제가 없는지 확인한다.

1. **Commit latency / write latency**
- storage quorum과 network path가 commit latency에 영향을 줄 수 있다.

1. **Buffer pool hit ratio**
- Aurora도 결국 memory hit가 중요하다. shared storage라고 해서 memory tuning이 사라지는 것은 아니다.

1. **Binlog 설정**
- CDC/replication 때문에 필요할 수 있지만, recovery와 write overhead에 영향을 줄 수 있다.

1. **Failover test**
- DB만 보는 게 아니라 application retry, DNS cache, driver 동작까지 같이 봐야 한다.

1. **Instance class parity**
- failover target reader가 writer와 같은 부하를 받을 수 있는지 확인한다.

## 정리

Aurora MySQL은 MySQL 호환 database지만, 내부 구조는 일반 MySQL과 다르게 봐야 한다.

내가 이해한 핵심은 이렇다.

- Aurora는 compute와 storage를 분리한다.
- storage는 3개 AZ에 6개 copy를 유지한다.
- write는 4/6 quorum으로 durable해진다.
- database tier는 page보다 log record를 storage로 보낸다.
- page materialization과 recovery의 많은 부분이 storage layer로 이동한다.
- Aurora replica는 같은 storage volume을 보지만 cache/log apply 때문에 lag는 존재할 수 있다.
- binlog는 Aurora 내부 durability와 별개로 CDC/외부 replication/recovery time에 영향을 준다.
결국 Aurora를 운영할 때는 “MySQL인데 AWS가 관리해준다”보다 “MySQL interface를 가진 distributed storage 기반 database”에 가깝게 봐야 한다. 그래야 failover, replica lag, binlog, recovery time 같은 이슈를 만났을 때 원인을 덜 헤매게 된다.

## 참고

- Amazon Aurora reliability: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.Reliability.html
- Replication with Amazon Aurora: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Replication.html
- Essential concepts for Aurora MySQL tuning: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraMySQL.Managing.Tuning.concepts.html
- Introducing the Aurora Storage Engine: https://aws.amazon.com/blogs/database/introducing-the-aurora-storage-engine/
- Amazon Aurora: Design Considerations for High Throughput Cloud-Native Relational Databases: https://assets.amazon.science/dc/2b/4ef2b89649f9a393d37d3e042f4e/amazon-aurora-design-considerations-for-high-throughput-cloud-native-relational-databases.pdf
