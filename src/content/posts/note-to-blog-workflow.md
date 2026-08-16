---
title: 터미널에서 노트하고 블로그까지 — 내 글쓰기 워크플로우
description: 'Obsidian 볼트를 단일 소스로, 터미널 별칭으로 캡처하고 gpub 한 방으로 발행하는 흐름'
pubDatetime: 2026-08-16T00:00:00.000Z
tags:
  - obsidian
  - neovim
  - workflow
  - blog
---

노트는 여기저기 흩어지고, 블로그 발행은 늘 번거로웠다. "쓰는 곳"과 "펴내는 곳"을 하나로 묶고 싶었다. 지금은 **Obsidian 볼트 하나를 단일 소스**로 두고, 터미널 별칭으로 캡처·검색하고, `gpub` 한 방으로 발행한다. 그 흐름을 정리한다.

## 원칙: 볼트가 단일 소스

`~/40_Notes`(Obsidian 볼트)가 **개인 지식이자 블로그의 원천**이다. 그중 `publish: true`가 붙은 글만 블로그로 나간다. 블로그 글도 결국 볼트에 있으니, `nf`/`ng`로 똑같이 검색된다.

```text
~/40_Notes/50_Blog/*.md   (publish: true, slug 지정)
        │  npm run sync    (slug로 1:1 매핑 → 파일명/URL 고정)
        ▼
   src/content/posts/*.md  (Astro 콘텐츠)
        │  astro build + pagefind
        ▼
   Cloudflare Pages        (gihoblog.pages.dev)
```

## 터미널 별칭

전부 셸 함수다. 손이 터미널을 안 떠난다.

### 캡처 — 일단 남긴다

```bash
nc 라면 끓이다 떠오른 인덱스 아이디어   # 오늘 일일로그에 한 줄 append
n  Redshift 삽질 정리                   # 새 노트 파일 생성 + nvim (frontmatter 자동)
```

### 탐색 — 다시 꺼낸다

```bash
nf            # 볼트 전체 파일 fzf로 찾아 열기 (bat 프리뷰)
ng 커넥션풀   # 내용 grep → 매칭된 줄로 바로 nvim
```

### 블로그 트랙 — 공개할 것만

새로 쓰거나(`nb`), 이미 쌓인 노트를 승격(`npub`)한다.

```bash
# 새 블로그 글: 50_Blog에 발행용 frontmatter로 생성
nb() {
  local title slug file
  title="$*"; -z "$title" && vared -p "블로그 제목: " title
  slug=$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\{2,\}/-/g; s/^-//; s/-$//')
  -z "$slug" && slug="post-$(date +%Y%m%d)"
  file="$NOTES_DIR/50_Blog/${slug}.md"
  -f "$file" || printf -- '---\ntitle: %s\ndescription: \ntags: []\npublishDate: %s\npublish: true\nslug: %s\n---\n\n' \
      "$title" "$(date +%Y-%m-%d)" "$slug" > "$file"
  nvim "$file"
}
```

```bash
npub "00 Inbox/2026-08-16-redshift-삽질.md"   # 기존 노트를 50_Blog로 이동 + publish:true 보강
```

### 발행 — 한 방

```bash
alias gpub='(cd ~/30_Projects/01_Personal/blog && npm run publish:site && npm run deploy)'
```

`gpub` 하나로 **변환(sync) → 빌드 → Cloudflare 배포**까지 끝난다.

## 전체 흐름

```text
 캡처            탐색/편집       블로그로            발행      백업
 nc / n   ─→   nf / ng   ─→   nb / npub   ─→   gpub   ─→  vsync
              (볼트에서)      (50_Blog로)      (한 방)    (git push)
```

## 왜 이렇게 갔나

- **한 곳에서** — 개인 메모부터 발행글까지 볼트 한 곳. 검색·편집·발행이 끊기지 않는다
- **마크다운 + git** — CMS 없음. 글이 곧 파일, 버전 관리 공짜
- **slug 고정** — frontmatter `slug`로 URL을 박아둬서 제목을 바꿔도 링크가 안 깨진다
- **터미널을 안 떠난다** — nvim에서 쓰고, 별칭으로 캡처하고, `gpub`로 편다

## 마무리

핵심은 "쓰는 도구와 펴내는 도구를 하나로." 볼트를 단일 소스로 두면 **머릿속 → 노트 → 블로그**가 한 줄기로 흐른다. 이 글도 `nb`로 만들어 `gpub`로 냈다.
