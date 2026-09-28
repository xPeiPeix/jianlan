# 第三方说明

简览在 WebView 中展示的网站、视频、图片和文字来自相应网站及内容作者。简览不是哔哩哔哩或抖音的官方应用。

`app/src/main/assets/cleaner.js` 是本项目独立编写的实现，不包含油猴运行时或复制的第三方脚本代码。开发时查阅了以下公开实现，确认网页广告字段和净化方法：

- [WhiteSevs / TamperMonkeyScript — 抖音优化](https://github.com/WhiteSevs/TamperMonkeyScript/tree/master/scripts-vite/抖音优化)，其脚本声明许可为 GPL-3.0-only。
- [YU-1021 / better-douyin](https://github.com/YU-1021/better-douyin)，许可为 MIT。

简览的净化规则只隐藏明确的广告、下载推广标记，或过滤网页响应中明确标记为广告的条目；不提供会员内容解锁、验证码绕过或服务器登录限制绕过。
