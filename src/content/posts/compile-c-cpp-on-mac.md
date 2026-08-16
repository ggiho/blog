---
title: How to compile C & C++  in Mac OS
description: >-
  Mac에는 기본적으로 gcc(clang)가 설치되어 있다. shell gcc version Apple clang version 15.0.0
  (clang 1500.1.0.2.5) Target: arm64 apple…
pubDatetime: 2024-10-03T12:18:43.367Z
tags:
  - c
  - cpp
  - macos
---

## Introduction

Mac에는 기본적으로 gcc(clang)가 설치되어 있다.

```shell
❯ gcc --version
Apple clang version 15.0.0 (clang-1500.1.0.2.5)
Target: arm64-apple-darwin24.0.0
Thread model: posix
InstalledDir: /Library/Developer/CommandLineTools/usr/bin

# clang --version 명령어의 결과도 같다.
# 심볼릭 링크로 설정된 것은 아닌 걸로 보이는데 gcc 명령어가 clang과 연결되어 있다.
```

하지만 아래처럼 컴파일이 실패해서 homebrew로 gcc를 설치하고 컴파일까지 해보는 과정을 정리한다.

```shell
❯ gcc++ -o main main.cpp
main.cpp:1:10: fatal error: 'iostream' file not found
1 | #include <iostream>
|          ^~~~~~~~~~
1 error generated.
```

## Configuration

### Install

```shell
❯ brew install gcc
```

- symbolic link 설정

```shell
❯ ln -s gcc-14 gcc
❯ ln -s g++-14 g++
```

- PATH 설정

```shell
❯ echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
❯ source ~/.zshrc

❯ which gcc
/opt/homebrew/bin/gcc
```

### Example

```shell
/* main.cpp */
#include <iostream>

int main() {
    std::cout << "Hello World!";
    return 0;
}
```

### Error

맥북에서는 위 과정대로 설치를 진행했을 때 오류가 없었는데 맥 스튜디오에서 똑같이 설치를 했음에도 컴파일 과정에서 아래와 같은 에러가 발생했다.

```shell
❯ g++ -o main main.cpp
In file included from /opt/homebrew/Cellar/gcc/14.2.0/include/c++/14/bits/postypes.h:40,
                 from /opt/homebrew/Cellar/gcc/14.2.0/include/c++/14/iosfwd:42,
                 from /opt/homebrew/Cellar/gcc/14.2.0/include/c++/14/ios:40,
                 from /opt/homebrew/Cellar/gcc/14.2.0/include/c++/14/ostream:40,
                 from /opt/homebrew/Cellar/gcc/14.2.0/include/c++/14/iostream:41,
                 from main.cpp:1:
/opt/homebrew/Cellar/gcc/14.2.0/include/c++/14/cwchar:44:10: fatal error: wchar.h: No such file or directory
   44 | #include <wchar.h>
      |          ^~~~~~~~~
compilation terminated.
```

- 구글링에서 나오는 방법
1. xcode-select --install
1. brew reinstall gcc
위의 방법으로는 해결되지 않는다.

혹시나 해서 clang++(g++와 같다)로 컴파일 해봤다.

```shell
❯ clang++ -o main main.cpp
                                                                                                                                                                22:11:45
❯ ls
 main   main.cpp
```

컴파일에 성공하는 것을 볼 수 있다.

## Conclusion

애당초 homebrew로 gcc를 설치하지 않았어도 됐다.

왜 이런 차이를 보일까?

맥 스튜디오의 OS 버전을 이번에 Sequoia로 올리기는 했지만 이것이 C(C++)파일을 컴파일 하는데 유의미한 영향을 끼치지 않았을 것이라고 생각한다.

당장은 컴파일 환경을 구축한 것에 만족한다. 나중에 맥북의 OS 버전을 업그레이드 후 테스트를 해봐야겠다.
