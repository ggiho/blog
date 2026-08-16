---
title: Mac 초기 세팅 flow
description: "1. chezmoi init javascript chezmoi init https://github.com/ggiho/dotfiles.git chezmoi update v chezmoi installed,…"
pubDatetime: 2026-01-21T05:37:46.446Z
tags:
  - macos
  - setup
  - tools
---
1. chezmoi init

```javascript
chezmoi init https://github.com/ggiho/dotfiles.git
chezmoi update -v
```

  - chezmoi installed, homebrew를 먼저 설치해야 되는 번거로움이 있다. 자동화 대상
1. brew bundle

```javascript
brew bundle --verbose
```

  - Brewfile list 중 하나라도 실패하면 전체가 설치에 실패하는 문제가 있다.
  - 설치 중에 비밀번호를 요구하는 프로그램들이 있다. 자동화 가능?
1. 설치한 프로그램들을 수동으로 한번씩 시작해 줘야함
1. karabiner에 한/영 키를 F18로 적용하기 위해서 input sources에서 우커맨드를 F18로 수동으로 변경해 줘야함
1. tmux plugin 수동으로 install 해야함
  → tpm 설치하는 스크립트 추가로 해결

```javascript
if "test ! -d ~/.config/tmux/.tmux/plugins/tpm" \
   "run 'git clone https://github.com/tmux-plugins/tpm ~/.config/tmux/.tmux/plugins/tpm && ~/.config/tmux/.tmux/plugins/tpm/bin/install_plugins'"
```

1. raycast 무료 플랜은 설정 동기화가 안 돼서 수동으로 처리해야됨
  - yabai로 대체 가능해 보이는데 클립보드 히스토리는?
    → aerospace를 사용하려고 했는데 앱 실행이 raycast만큼 부드럽지 못하고 두개를 병행해서 사용 시 충돌하는 문제가 있다.

    aerospace의 gaps라는 기능이 마음에 드는데(전체 화면에서 약간씩의 여백을 주는 기능) 동시에 사용 불가능할듯 싶다. 대체제로 hammerspoon으로 기능을 만들 수가 있는데 이 상태로 조금 더 사용해 보기로 함

  - raycast key binding 작업이 생각보다 얼마 안걸려서 수동으로 처리할 수도 있겠다

1. finder 경로보기(view → show path bar), new finder windows show → root 경로 설정
1. Hidpi로 2752x1152 해상도 설정

```javascript
bash -c "$(curl -fsSL https://raw.githubusercontent.com/xzhih/one-key-hidpi/master/hidpi.sh)"
```

  customer 해상도 생성 후에 better display 에서 Hidpi 2752x1152 선택

1. aws cetification 설정
  1. zshrc에 AWS_PROFILE 설정을 안하니까 인증 오류남
1. datagrip에서 ideavim 사용 시에 hjkl 방향키 hold가 안 된다. 아래 명령어 실행하고 재시작하면 해결

```shell
defaults write com.jetbrains.datagrip ApplePressAndHoldEnabled -bool false
```
