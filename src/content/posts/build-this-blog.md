---
title: 이 블로그를 만든 방법 — Astro + Cloudflare Pages
description: Obsidian 볼트의 글을 골라 Astro로 빌드하고 Cloudflare Pages에 무료로 배포하기
pubDatetime: 2026-08-14T09:00:00.000Z
tags:
  - astro
  - cloudflare
  - meta
featured: true
---

이 블로그는 "psql 콘솔" 컨셉의 Astro 사이트다. 파이프라인은 단순하다.

## 흐름

```
Obsidian 볼트(글에 publish: true)
  → sync 스크립트로 골라 posts/로 변환
  → Astro 빌드 (정적)
  → Cloudflare Pages 배포
```

## 왜 이 스택인가

- **Astro** — 정적 빌드가 빠르고 디자인 자유도가 높다. 홈을 SQL `select`처럼 꾸민 것도 그 덕분
- **Cloudflare Pages** — 정적 트래픽 무제한 + 엣지 CDN + 무료 SSL이 사실상 공짜
- **글은 마크다운** — Neovim에서 쓰고 git으로 관리. CMS 없음

## 발행

볼트 글에 `publish: true`를 붙이고 한 줄이면 끝.

```bash
npm run publish:site && npm run deploy
```

> 만드는 과정에서 여러 번 갈아엎었다. 결국 "내가 쓰는 도구(터미널/DB)"에서 정체성을 뽑는 게 답이었다.
