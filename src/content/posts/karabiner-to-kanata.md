---
title: "Karabiner에서 kanata로 전환하기"
description: "Karabiner-Elements를 걷어내고 kanata로 완전히 옮기기 — 제거·설치·launchd 자동실행과 자동 업데이트로 인한 재발 트러블슈팅까지"
pubDatetime: 2026-05-01T09:00:00Z
tags:
  - keyboard
  - kanata
  - macos
---

Karabiner-Elements에서 kanata로 전환하는 전체 과정을 정리한 문서.

> [!success] 검증 완료 절차 (TL;DR)
> 1. `brew install kanata`
> 2. `kanata --check --cfg ~/.config/kanata/kanata.kbd`
> 3. `sudo ~/.config/kanata/scripts/install-launchd.sh` — Karabiner grabber 비활성화 + `local.kanata.vhid`/`local.kanata` 등록·시작을 한 번에 처리
> 4. **재부팅** (권장 — 메모리에 남은 Karabiner 프로세스 정리)
> 5. 동작 확인: 콤보(J+K=Backspace), Home Row Mod(S 홀드=Alt), Ctrl-Nav(Caps+HJKL)
>
> ⚠️ 초안이 참조하던 `remove-karabiner.sh`는 **실제로 없다.** 평소 복구는 `install-launchd.sh` 하나로 충분하고, Karabiner 완전 삭제가 필요할 때만 아래 "수동으로 제거하는 경우"를 쓴다.

> [!info] 검증 환경
> - macOS 26.2, Apple Silicon
> - kanata v1.11.0 (2026-07 기준 v1.12.0로 업데이트됨)
> - Homebrew 설치 기준

> [!note] 이 설정은 chezmoi로 관리됨
> `~/.config/kanata/` 전체(`kanata.kbd`, `launchd/`, `scripts/`)가 chezmoi managed. 소스: `~/.local/share/chezmoi/dot_config/kanata/`.
> **스크립트·설정 수정은 chezmoi 소스에서 하고 `chezmoi apply`** 한다. `~/.config/kanata/`를 직접 고치면 다음 apply 때 덮어써진다.

> [!warning] 동시 사용 불가
> Karabiner-Elements와 kanata는 둘 다 가상 키보드 드라이버를 통해 입력을 가로채기 때문에 **동시에 사용할 수 없다.** 한쪽을 완전히 비활성화한 뒤 다른 쪽을 실행해야 한다.

> [!danger] 실전에서 겪은 핵심 교훈
> - Karabiner 프로세스를 `kill`/`killall`로 죽여도 **launchd KeepAlive 설정 때문에 자동 재시작**된다
> - Karabiner 앱(`/Applications/Karabiner-Elements.app`)을 삭제해도 **바이너리가 `/Library/Application Support/org.pqrs/Karabiner-Elements/`에 별도로 존재**해서 계속 살아난다
> - Karabiner가 메모리에 남아있으면 kanata가 `IOHIDDeviceOpen error: not permitted`로 키보드를 잡지 못한다
> - **결론: Karabiner-Elements 디렉토리 삭제 + 재부팅이 가장 확실한 방법**


## 1단계: Karabiner-Elements 완전 제거

kanata를 설치하기 전에 Karabiner를 완전히 제거한다. 단순히 프로세스를 죽이는 것으로는 부족하다.

> [!tip] VirtualHID 드라이버는 남긴다
> kanata는 Karabiner의 **VirtualHID 드라이버**를 사용한다. 아래 제거 대상에 VirtualHID 관련 파일은 포함되지 않는다.

### 제거 방법

> [!bug] `remove-karabiner.sh`는 실제로 없다
> 이 문서 초안이 참조하던 `remove-karabiner.sh`는 만들어진 적이 없다. 존재하는 스크립트는 `install-launchd.sh`, `install-virtualhiddevice.sh`, `uninstall-launchd.sh` 뿐이다.
> - **일상 복구/재설정**: `install-launchd.sh`가 Karabiner grabber(`karabiner_console_user_server`, `Karabiner-Core-Service-rev2`, `Karabiner-Core-Service`)를 `launchctl disable`로 영구 비활성화한다. **앱을 삭제하지 않고도** 충돌이 해소된다.
> - **완전 삭제**: 아래 "수동으로 제거하는 경우"를 사용한다.

### 수동으로 제거하는 경우

```bash
# Karabiner 앱 삭제
sudo rm -rf /Applications/Karabiner-Elements.app
sudo rm -rf /Applications/Karabiner-EventViewer.app

# Karabiner 바이너리 디렉토리 삭제 (핵심!)
sudo rm -rf '/Library/Application Support/org.pqrs/Karabiner-Elements'

# 재부팅 (메모리에 남은 프로세스 정리)
sudo reboot
```

> [!danger] 재부팅 필수
> 디렉토리를 삭제해도 메모리에 남아있는 Karabiner 프로세스가 키보드를 계속 잡고 있다. `killall`로 죽여도 launchd가 자동 재시작시킨다. **재부팅이 가장 확실한 해결책이다.**

> [!warning] 절대 삭제하면 안 되는 것
> 아래 항목은 kanata가 의존하므로 **삭제하지 않는다:**
> - `/Applications/.Karabiner-VirtualHIDDevice-Manager.app`
> - `/Library/Application Support/org.pqrs/Karabiner-DriverKit-VirtualHIDDevice/`


## 2단계: kanata 설치

### Homebrew로 설치

```bash
brew install kanata
```

설치 확인:

```bash
which kanata        # /opt/homebrew/bin/kanata
kanata --version    # kanata 1.11.0
```

> [!note] GitHub Release에서 직접 설치
> Homebrew 대신 [GitHub Releases](https://github.com/jtroo/kanata/releases)에서 바이너리를 다운로드할 수도 있다. Apple Silicon이면 `kanata-macos-aarch64` 파일을 받는다.


## 3단계: Karabiner VirtualHID 드라이버 확인

kanata는 macOS에서 키 이벤트를 출력하기 위해 Karabiner의 VirtualHID 드라이버를 사용한다.

### 이미 설치되어 있는지 확인

```bash
ls '/Library/Application Support/org.pqrs/Karabiner-DriverKit-VirtualHIDDevice/'
```

Karabiner를 쓰고 있었다면 이미 설치되어 있다.

### 드라이버 활성화

```bash
'/Applications/.Karabiner-VirtualHIDDevice-Manager.app/Contents/MacOS/Karabiner-VirtualHIDDevice-Manager' activate
```

> [!warning] Karabiner 완전 삭제 시
> 나중에 Karabiner-Elements를 완전히 삭제하더라도 `Karabiner-DriverKit-VirtualHIDDevice`와 `.Karabiner-VirtualHIDDevice-Manager.app`은 **반드시 남겨둬야** 한다. 이것 없이는 kanata가 macOS에서 동작하지 않는다.


## 4단계: 설정 파일 준비

### 설정 파일 위치

```
~/.config/kanata/kanata.kbd
```

### 현재 설정 요약

| 기능 | 설명 |
|------|------|
| Home Row Mods | A=Ctrl, S=Alt, D=Cmd, F=Shift, ;=RShift |
| Combo | J+K=Backspace, K+L=Escape, ,+.=?, 등 |
| Ctrl-Nav 레이어 | Caps/Ctrl 홀드 시 HJKL=방향키, G=Home, ;=End |

### 문법 검증

```bash
kanata --check --cfg ~/.config/kanata/kanata.kbd
```

> [!tip] 설정 문법 참고
> - [kanata Configuration Guide](https://github.com/jtroo/kanata/wiki/Configuration-guide)
> - [kanata 키 이름 목록](https://github.com/jtroo/kanata/blob/main/docs/key-names.md)


## 5단계: 수동 실행으로 테스트

VirtualHID daemon을 먼저 실행하고, 이어서 kanata를 실행한다.

### VirtualHID daemon 실행

```bash
sudo '/Library/Application Support/org.pqrs/Karabiner-DriverKit-VirtualHIDDevice/Applications/Karabiner-VirtualHIDDevice-Daemon.app/Contents/MacOS/Karabiner-VirtualHIDDevice-Daemon'
```

### kanata 실행 (별도 터미널)

```bash
sudo kanata --cfg ~/.config/kanata/kanata.kbd
```

정상 동작 시 나타나는 로그:

```
Starting kanata proper
driver connected: true
```

> [!danger] 키보드 입력이 안 될 때
> 설정 오류로 키보드가 먹통이 되면 **마우스로** 터미널을 클릭하고 Ctrl+C로 kanata를 종료한다. 블루투스 키보드가 있으면 백업용으로 미리 연결해두면 안전하다.

테스트가 끝나면 두 프로세스 모두 Ctrl+C로 종료한다.


## 6단계: 자동 실행 설정 (launchd)

테스트가 정상이면 부팅 시 자동 실행되도록 launchd에 등록한다.

### 설치 스크립트 실행

```bash
sudo ~/.config/kanata/scripts/install-launchd.sh
```

이 스크립트가 하는 일:
1. plist 파일을 `/Library/LaunchDaemons/`에 복사
2. VirtualHID 드라이버 activate
3. `local.kanata.vhid` 데몬 등록 및 시작
4. `local.kanata` 데몬 등록 및 시작

### 등록 확인

```bash
sudo launchctl print system/local.kanata.vhid | head -20
sudo launchctl print system/local.kanata | head -20
```

`state = running`이면 정상.


## 7단계: Karabiner 설정 백업 (선택)

1단계에서 Karabiner-Elements는 이미 제거되었다. 기존 설정을 보관하고 싶다면:

```bash
# 백업
cp -r ~/.config/karabiner ~/.config/karabiner.bak

# 제거
rm -rf ~/.config/karabiner
```

System Settings → General → Login Items에서 Karabiner 관련 항목이 남아있으면 제거한다.


## 일상 운영

### 자주 쓰는 명령어

| 작업             | 명령어                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------- |
| 상태 확인          | `sudo launchctl print system/local.kanata \| head -20`                                          |
| kanata 재시작     | `sudo launchctl kickstart -k system/local.kanata`                                               |
| VirtualHID 재시작 | `sudo launchctl kickstart -k system/local.kanata.vhid`                                          |
| 전체 중지          | `sudo launchctl bootout system/local.kanata && sudo launchctl bootout system/local.kanata.vhid` |
| 전체 제거          | `sudo ~/.config/kanata/scripts/uninstall-launchd.sh`                                            |
| 설정 검증          | `kanata --check --cfg ~/.config/kanata/kanata.kbd`                                              |
| 설정 변경 후 적용     | 설정 파일 수정 → `sudo launchctl kickstart -k system/local.kanata`                                    |

### 로그 위치

```
/tmp/kanata.out.log        # kanata 표준 출력
/tmp/kanata.err.log        # kanata 에러 로그
/tmp/kanata-vhid.out.log   # VirtualHID 표준 출력
/tmp/kanata-vhid.err.log   # VirtualHID 에러 로그
```


## 트러블슈팅

### Permission denied (root-only 소켓)

```
Permission denied [/Library/Application Support/org.pqrs/tmp/rootonly/vhidd_server]
```

root 권한 없이 실행했을 때 발생. `sudo`를 붙이거나 launchd 서비스로 실행한다.

### exclusive access and device already open

```
exclusive access and device already open
```

kanata가 이미 실행 중. 중복 실행은 불가능하다.

```bash
# 기존 인스턴스 확인 및 정리
ps aux | grep kanata
sudo launchctl bootout system/local.kanata 2>/dev/null || true
sudo pkill -x kanata 2>/dev/null || true
```

### IOHIDDeviceOpen not permitted

```
IOHIDDeviceOpen error: (iokit/common) not permitted
```

**가장 흔한 원인: Karabiner 프로세스가 아직 키보드를 잡고 있음.** Karabiner를 완전히 제거하고 재부팅하면 해결된다.

재부팅 후에도 발생하면 macOS 권한 설정 필요:
- System Settings → Privacy & Security → **Input Monitoring** → kanata 추가
- System Settings → Privacy & Security → **Accessibility** → kanata 추가
- 파일 선택 창에서 `Cmd+Shift+G` → `/opt/homebrew/bin/kanata` 입력

### 잘 쓰던 kanata가 갑자기 안 먹힐 때 (재발 케이스)

> [!danger] 가장 흔한 재발 원인: Karabiner-Elements 자동 업데이트
> 멀쩡히 쓰던 리매핑(예: `a`홀드+HJKL 방향키)이 어느 날 안 먹힌다면, **Karabiner-Elements가 자동 업데이트되면서 `install-launchd.sh`가 꺼놨던 grabber 서비스가 되살아난 것**이다. 되살아난 grabber가 키보드를 선점 → kanata가 device를 못 잡는다. 동시에 kanata를 brew로 업데이트했다면 macOS 권한(Input Monitoring/Accessibility)까지 리셋된다. (2026-07 실제 발생: Karabiner 16.0.0 자동 업데이트가 원인.)

**증상별 로그** (`/tmp/kanata.out.log`, `/tmp/kanata.err.log`):

| 로그 | 의미 |
|------|------|
| `driver connected: true`↔`false` 반복 | VHID 데몬 2개 충돌 (Karabiner것 + local.kanata.vhid것) |
| `needs macOS Input Monitoring permission` | 입력 모니터링 권한 리셋 |
| `needs macOS Accessibility permission` | 접근성 권한 리셋 (Input Monitoring과 **둘 다** 필요) |
| `connect_failed asio.system:61` / `Waiting for DriverKit virtual keyboard...` | 데몬 연결 실패 |

**복구 (검증됨, 2026-07):**

```bash
# 정식 스크립트 한 방 = grabber 비활성화 + 데몬/kanata 재등록·시작까지 끝
sudo ~/.config/kanata/scripts/install-launchd.sh
```

권한이 리셋됐다면 System Settings에서 **낡은 `kanata` 항목을 삭제 후 재추가**한다 (brew 업데이트로 바이너리 경로 pin이 stale해지기 때문):
- Privacy & Security → **Input Monitoring**: 기존 kanata 삭제 → `+` → `Cmd+Shift+G` → `/opt/homebrew/bin/kanata` → ON
- Privacy & Security → **Accessibility**: 동일하게 재추가 → ON

> [!tip] 근본 재발 방지
> Karabiner-Elements를 실제로 안 쓴다면(복구 시점 rule 0개였음) 완전 제거 + 자동 업데이트 차단이 가장 확실하다. 위 "수동으로 제거하는 경우" 참고.

### compiled to never allow cmd

이것은 오류가 아니다. kanata의 외부 셸 명령 실행 기능(`cmd` action)이 비활성화된 빌드라는 의미. macOS의 Command 키(`lmet`) 매핑과는 무관하다.


## 참고 링크

- [kanata GitHub](https://github.com/jtroo/kanata)
- [kanata Configuration Guide](https://github.com/jtroo/kanata/wiki/Configuration-guide)
- [kanata Releases](https://github.com/jtroo/kanata/releases)
- [Karabiner DriverKit VirtualHIDDevice](https://github.com/pqrs-org/Karabiner-DriverKit-VirtualHIDDevice)
- [Homebrew kanata](https://formulae.brew.sh/formula/kanata)



## 트러블슈팅 (추가): VirtualHIDDevice가 너무 최신이라 안 붙을 때

> [!danger] 재발 케이스 2 — VHID driver 자동 업데이트로 IPC(protocol) 불일치 (2026-07-12)
> grabber/권한 문제가 아닌데도 리매핑이 안 먹고, 로그에 아래가 무한 반복된다.
> ```
> connect_failed asio.system:2
> Waiting for DriverKit virtual keyboard... (n.n s/10.0s)
> output backend unavailable — releasing input devices
> ```

**감별 (이 케이스 확정 조건):**
- kanata·VHID 데몬 프로세스 둘 다 정상 실행 중
- grabber 프로세스 없음 (`pgrep -fl "karabiner_console_user_server|Karabiner-Core-Service"` 비어있음)
- 권한 로그(`Input Monitoring`/`Accessibility`) 안 뜸
- 순수하게 kanata가 데몬 소켓에 못 붙음 (`asio.system:2` = ENOENT)

**근본원인:** Karabiner VirtualHIDDevice driver가 kanata 지원 버전보다 **최신으로 자동 업데이트**됨. kanata의 번들 `karabiner-driverkit` crate(1.11.0=0.2.0, 1.12.0=0.3.1)는 특정 driver 릴리스 IPC로 빌드되는데, pqrs가 minor 버전 사이에 protocol을 바꿔서 더 새 driver는 안 붙는다. (2026-07 사고: 7/10에 driver가 daemon version 8.0.0 / `client_protocol_version 7`로 올라감 → 재부팅으로 활성화되며 깨짐.)

> [!important] kanata 지원 driver 버전 확인처
> kanata `docs/setup-macos.md`에 명시. 2026-07 기준 **`v6.2.0`**.
> ```
> curl -fsSL https://raw.githubusercontent.com/jtroo/kanata/v1.12.0/docs/setup-macos.md | grep -i 'supported driver'
> ```

**진단 명령:**
```bash
tail /var/log/karabiner/virtual_hid_device_service.log   # version / driver_version / client_protocol_version
strings /opt/homebrew/bin/kanata | grep karabiner-driverkit   # kanata의 crate 버전
```

> [!warning] kanata 다운그레이드는 소용없다
> 1.12.0→1.11.0으로 내려도 동일하게 실패한다(crate 0.3.1/0.2.0 모두 v6.2.0 IPC 기대). **driver 쪽을 맞춰야** 한다.

**복구 — VHID를 지원버전(v6.2.0)으로 다운그레이드** (sudo 비번 + 시스템확장 GUI 승인 + 재부팅 필요):
```bash
# pkg: https://github.com/pqrs-org/Karabiner-DriverKit-VirtualHIDDevice/releases/tag/v6.2.0
sudo /Applications/.Karabiner-VirtualHIDDevice-Manager.app/Contents/MacOS/Karabiner-VirtualHIDDevice-Manager deactivate
sudo installer -pkg Karabiner-DriverKit-VirtualHIDDevice-6.2.0.pkg -target /
sudo /Applications/.Karabiner-VirtualHIDDevice-Manager.app/Contents/MacOS/Karabiner-VirtualHIDDevice-Manager forceActivate
# → System Settings > Privacy & Security에서 org.pqrs.Karabiner-DriverKit-VirtualHIDDevice 확장 승인 → 재부팅
```
재부팅 후 자동 실행. 안 되면 `sudo ~/.config/kanata/scripts/install-launchd.sh`.

**재발 방지:** VirtualHIDDevice 자동 업데이트가 원인. kanata 업그레이드/driver 업데이트 시 항상 버전 짝을 맞춘다.

> [!success] 검증 결과 (2026-07-12) — 위 복구 절차 정정
> 실제로는 **deactivate도 재부팅도 불필요**했다. 순서:
> 1. `sudo installer -pkg /tmp/Karabiner-DriverKit-VirtualHIDDevice-6.2.0.pkg -target /` (상위버전에서 다운그레이드도 upgrade로 처리)
> 2. `sudo /Applications/.Karabiner-VirtualHIDDevice-Manager.app/Contents/MacOS/Karabiner-VirtualHIDDevice-Manager forceActivate` — **반드시 한 줄**로 (경로가 줄바꿈되면 `forceActivate`가 별도 명령이 돼 `command not found`)
> 3. forceActivate 직후 데몬이 v6.2.0으로 재동작 (로그 `virtual_hid_keyboard_ready_ is changed: true`, 소켓이 `<hash>.sock`로 변경)
> 4. `sudo launchctl kickstart -k system/local.kanata` 만으로 즉시 복구
>
> 정상 로그: `driver connected: true` / `driver version matched: true` / `virtual_hid_keyboard_ready true` / `keyboard grabbed`.
>
> ⚠️ Claude Code의 `!` 프리픽스로는 sudo 비번 프롬프트를 못 받는다(TTY 없음). VHID 설치/activate는 **실제 터미널(Terminal.app/iTerm)** 에서 실행해야 한다.
