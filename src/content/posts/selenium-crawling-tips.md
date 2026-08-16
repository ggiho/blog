---
title: selenium 크롤링 팁 몇 가지
description: "Overview 웹페이지 마다 구성이 다르기 때문에 크롤링을 하다가 간혹 브레이크가 걸릴 때가 있습니다. 몇 가지 사항에 대해서 해결 방법을 공유하려고 합니다. selenium: 3.141.0 버전 정보는 pip…"
pubDatetime: 2023-03-31T05:27:47.594Z
tags:
  - python
  - selenium
  - crawling
---
## Overview

웹페이지 마다 구성이 다르기 때문에 크롤링을 하다가 간혹 브레이크가 걸릴 때가 있습니다. 몇 가지 사항에 대해서 해결 방법을 공유하려고 합니다.

> selenium: 3.141.0

버전 정보는 pip list 명령어로 확인할 수 있습니다.

![](/notion/selenium-crawling-tips/img-1.png)

## Body

1. clickable 하지 않는 object

1. mouse over(hover)

1. iframe(frame) 전환

```python
# 
iframe = driver.find_element_by_css_selector('#MainFrm')
driver.switch_to.frame(iframe)

# iframe 태그 내 구분자가 없을 경우 (id, name 등..)
iframe = driver.find_element_by_tag_name('iframe')
```

## Conclusion
