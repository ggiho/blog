---
title: '[MySQL 성능 최적화] 02. 신뢰성 엔지니어링 환경에서의 모니터링'
description: >-
  시작하며 스터디의 교재는 Real MySQL을 사용하지만 책을 한 권만 읽은 사람이 제일 무섭다는 말이 있듯이 다른 책도 읽을 필요성을
  느껴서 O’relly의 High Performance MySQL 4th를…
pubDatetime: 2023-05-11T11:09:54.079Z
tags:
  - mysql
  - monitoring
  - database
---

## 시작하며

스터디의 교재는 Real MySQL을 사용하지만 책을 한 권만 읽은 사람이 제일 무섭다는 말이 있듯이 다른 책도 읽을 필요성을 느껴서 O’relly의 High Performance MySQL 4th를 번역한 MySQL 성능 최적화 책을 구매했다.

요즘은 스터디가 새로운 기능을 테스트 해보거나 업무에 사용된 스킬들을 공유하는 식으로 진행되지만 기존에는 Real MySQL의 내용을 정리해서 각자 공유하는 방식으로 진행이 됐었다. 그러다보니 책의 내용을 완벽하게 이해하는 것보다 내용을 정리하는데에 더 초점이 맞춰졌던 것 같다.

그래서 이 책을 공부할 때에는 내용의 정리보다 내가 읽으면서 느꼈던 점을 위주로 적어보고 싶어졌다. 이렇게 글을 읽고 쓰는 것에 익숙해지면 내 생각을 조금 더 잘 정리하고 잘 전달할 수 있게 되는 날이 오지 않을까?

## 본문

2장의 앞부분을 보면 DBA의 역할의 변화에 대해서 서술한다. SRE(Site Reliability Engineering)나 DBRE(Database Reliability Engineering)로 DBA의 역할이 바뀌고 있다는 부분에 대해서 크게 공감이 갔다. 우아한 테크 세미나 RDS Aurora 모니터링 세션을 보고난 후에 느꼈던 감정은
