# 试用版验收 · 2026-09-28

## 0.2.2 发布包

- 安装包：`dist/jianlan-0.2.2.apk`，`versionCode=4`，包名 `dev.peipei.jianlan`，最低 Android 8.0。
- 使用固定发布签名，关闭调试；大小为 1,009,379 字节。
- SHA256：`2f693881d88d86ab4f6541742301f1d588b61267c0a29638033d128a4bc8ba93`。
- 发布构建、Android Lint（0 错误）、APK v2 签名及 ZIP 对齐校验通过；过滤脚本 18 项测试通过。重复构建的 APK 哈希相同。
- 本次改变发布签名、版本与分发方式，四平台功能沿用 0.2.1。0.2.2 尚未重新安装到真机；下文的手机验证属于 0.2.1，不是新发布包的完整回归。
- 本地下载页在桌面和 390 / 320 像素宽屏幕检查通过，无横向溢出、图片缺失。

## 公开分发验证

- [GitHub 首页](https://github.com/xPeiPeix/jianlan)可匿名访问，显示项目介绍、四平台界面示意、APK 下载和反馈入口。
- [0.2.2 Release](https://github.com/xPeiPeix/jianlan/releases/tag/v0.2.2)已公开，标记为早期试用，附件包括 APK 与 `SHA256SUMS`。
- [下载页](https://xpeipeix.github.io/jianlan/)通过 HTTPS 返回 200；桌面和 390 像素手机宽度下的页面与图标正常，实际点击按钮触发下载。
- 从公开下载链接匿名重新获取 APK 和校验文件，`shasum -a 256 -c SHA256SUMS` 通过，与本机发布包哈希一致。
- GitHub Pages 从 `gh-pages` 根目录发布，[首次部署](https://github.com/xPeiPeix/jianlan/actions/runs/36400342392)成功。

## 0.2.1 真机验证版本

- 安装包：`dist/jianlan-0.2.1.apk`，`versionCode=3`，包名 `dev.peipei.jianlan`，调试签名。
- APK 为 1,319,321 字节；SHA256 `9aefc8415aca781965dde9bc1f1616b3966e73ee8ee1cefa817f1a1081289819`。构建、Android Lint、v2 签名及对齐校验通过。
- 四入口：抖音、哔哩哔哩、知乎、微博。
- 首页和网页菜单提供反馈填写、复制及系统分享；由用户自行选择接收人，不自动发送或上传。
- 脚本 1.1.1 增加知乎/微博 DOM 规则、B 站整张广告卡处理及知乎窄屏排版修正。

## 本轮已验证

设备为 realme RMX3366 / Android 14 / API 34 / WebView 117.0.5938.60。无线配对成功，最终 0.2.1 APK 覆盖安装及启动成功，设备读取版本为 0.2.1 / code 3。

- 首页四张卡片和反馈入口显示正常。
- 知乎发现页和问题详情可在未登录状态下打开。发现页固定宽度导致的横向溢出已修正；最终包的 viewport 和 document.scrollWidth 都为 360px，内容区元素未超出屏幕。
- 知乎详情页实测发现 `.zhihuAdvert-MBanner` 和 `.WeiboAd-wrap` 两种广告容器，已补入规则；最终包中两处横幅及一处推荐广告均隐藏。点击原生过滤开关后可恢复显示，再开启可重新隐藏。
- 微博首页内容加载正常，最终包单条视频播放达到 readyState=4、1068×480、currentTime=10.47、paused=false，无媒体错误。
- 首页与网页菜单的反馈对话框可打开，Android 分享面板正常显示。模板包含 0.2.1、机型、Android/WebView 版本、当前平台及过滤状态。本轮取消分享，没有向任何人发送反馈。
- 过滤脚本 18 项测试通过，覆盖正常内容、站点隔离、DOM 复用、关闭恢复及 fetch/XHR 响应契约。

## 尚未验证

- 反馈复制按钮及填写长文本后的操作。
- 知乎搜索、各网站登录后的体验及登录状态持久化。
- B 站播放、连续切换视频和跨机型兼容性。
- 全站真实广告命中率；已验证的广告样例不代表全面无广告。

## 既有播放证据

0.1.0 曾在同一手机抖音推荐页播放单条视频：readyState=4、960×720、currentTime=125.76、paused=false，无媒体错误。未登录也能播放当前内容。这不是 0.2.1 的完整回归结果。

## 复验

使用手机无线调试页显示的当前连接端口（与配对端口不同）：

```sh
adb connect <当前IP:连接端口>
adb -s <设备> install --no-streaming -r dist/jianlan-0.2.1.apk
```

截图与临时验收记录保存在被 Git 忽略的 `dist/qa/`，不记录配对码、Cookie 或账号凭证。
