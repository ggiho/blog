---
title: MySQL adaptive hash index
description: >-
  몇년 전 MySQL 8.0 버전을 스터디할 때 Adaptive hash index(AHI)에 대한 주제로 토론을 했던 적이 있다. 당시에는
  8.0 버전뿐 아니라 MySQL에 대한 이해도가 전반적으로 떨어졌을 때라서…
pubDatetime: 2025-08-15T14:24:05.220Z
tags:
  - mysql
  - database
  - internals
---

## Introduction

몇년 전 MySQL 8.0 버전을 스터디할 때 Adaptive hash index(AHI)에 대한 주제로 토론을 했던 적이 있다.

당시에는 8.0 버전뿐 아니라 MySQL에 대한 이해도가 전반적으로 떨어졌을 때라서 이해가 안 되는 부분이 많았다. 가장 기억에 남는 것은 AHI 기능을 켜는 것은 자유지만 함부로 끄면 안 된다는 것인데 이 얘기를 했던 스터디원도 명확한 이유를 알지 못해서 궁금증이 속시원하게 해결되지 않았었다.

최근에 다시 한번 AHI를 공부하면서 이해한 내용을 정리해 본다.

~~예전에는 정리하는 것을 싫어했는데 나이를 점점 먹어가면서 기록하지 않으면 높은 확률로 잊어버리게 되고 나중에 다시 찾아보기를 반복했다. 한번 시간을 들여서 정리를 하는게 오히려 시간을 아끼는 것이라는걸 깨달았다.~~

## What is Adaptive hash index?

Adaptive는 `적응하는, 상황에 맞춰 변화하는` 이라는 뜻을 가지고 있는데 

InnoDB에서는 hash index를 지원하지 않는다. 처음 Adaptive hash index라는 말을 들었을 때도 hash index가 있다고? 라는 생각이 첫 번째로 들었다.

[https://dev.mysql.com/doc/refman/8.0/en/index-btree-hash.html#hash-index-characteristics](https://dev.mysql.com/doc/refman/8.0/en/index-btree-hash.html#hash-index-characteristics)

## Conclusion
