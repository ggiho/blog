---
title: minikube + podman
description: mongodb replica set을 테스트하기 위해서 docker compose를 이용해서 3개의 mongodb 인스턴스를 만들었다. 회사 pc에서도 테스트를 하기 위해서 동일한 과정을 진행했는데 무의식적으로…
pubDatetime: 2024-02-29T02:09:34.493Z
tags:
  - kubernetes
  - podman
  - tools
---
mongodb replica set을 테스트하기 위해서 docker-compose를 이용해서 3개의 mongodb 인스턴스를 만들었다.

회사  pc에서도 테스트를 하기 위해서 동일한 과정을 진행했는데 무의식적으로 docker desktop을 설치하다가 라이센스가 유료로 전환된 것이 떠올랐다.

docker desktop만 유료가 됐을 뿐이지 docker를 직접 설치하는 것은 아파치 라이센스를 따르므로 docker desktop만 사용하지 않는다면 문제가 없지만 안타깝게도 mac에서 docker를 사용하려면 docker desktop이 필요하다.

그래서 대체제로 언급되는 것들이 몇 가지 있다.

Lima, Minikube, Rancher desktop 등

이 중 Minikube + Podman 으로 구성을 해보려고 한다.

[https://mogita.com/minikube-podman-on-m1-apple-silicon](https://mogita.com/minikube-podman-on-m1-apple-silicon)

위 블로그를 참고하여 설치를 진행했다.

```shell
> brew install minikube
> minikube start
```

![](/notion/minikube-podman/img-1.png)

podman 없이 minikube를 start하면 오류가 발생한다.

```shell
> brew install podman
> podman machine init --cpus 2 --memory 8192 --disk-size 80
> podman machine start
> podman system connection default podman-machine-default-root
> minikube start --driver=podman --container-runtime=cri-o
```

minikube config set driver podman 명령어까지 입력하면 아래와 같은 오류가 발생한다. 재시작이 필요함

![](/notion/minikube-podman/img-2.png)

```shell
> minikube stop
> podman machine stop

> podman machine start
> minikube start --driver=podman --container-runtime=cri-o
> 
```
