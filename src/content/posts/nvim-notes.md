---
title: Neovim을 노트 작성 도구로 쓰기
description: obsidian.nvim + render-markdown + 터미널 캡처로 만든 마크다운 노트 워크플로우
pubDatetime: 2026-07-10T09:00:00Z
tags:
  - nvim
  - notes
  - workflow
---

에디터를 떠나지 않고 노트를 쓰는 게 목표였다. 결국 Neovim을 마크다운 노트 도구로 만들었다.

## 편집

- **obsidian.nvim** — 위키링크(`[[ ]]`)·백링크·체크박스
- **render-markdown.nvim** — 에디터 안에서 헤딩·표·코드블록을 예쁘게 렌더

## 캡처

떠오르면 일단 인박스로 던진다. 터미널 함수 두 개면 충분하다.

- `n <제목>` — 새 노트 만들고 바로 편집
- `nc <메모>` — 편집기 없이 오늘 노트에 한 줄 추가

## 정리

PARA + 번호 폴더(`00 Inbox` ~ `99 Archive`)로 나누고 git으로 매시간 자동 백업. 캡처는 마찰 0, 분류는 나중에.

> 이 블로그도 그 볼트에서 골라 발행한다.
