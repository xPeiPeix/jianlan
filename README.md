# 简览

一个 Android 应用，集中打开抖音和哔哩哔哩网页版，并过滤已识别的广告和下载推广。

## 使用

安装 `dist/jianlan-0.1.0.apk`，在首页选择网站。页面顶部提供返回、首页和过滤开关；右上角菜单可以刷新和切换手机／电脑版网页。登录直接使用网站自己的页面，登录状态保留在应用本地。

这是早期体验版，使用系统 Android WebView。推荐、搜索、关注、视频质量和账号权限取决于对应网站；未知广告格式可能漏过，视频中的创作者口播不会跳过。关闭过滤后刷新页面，可恢复被过滤的条目。

## 构建

需要 JDK 17、Android SDK Platform 36、Build Tools 36.0.0，支持 Android 8.0 及以上。

```sh
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=/path/to/android-sdk
bash scripts/build.sh
node --test tests/cleaner.test.cjs
```

脚本调用 Gradle Wrapper，输出调试 APK 到 `dist/`，同时运行 Android Lint。机器专用环境变量可放在被 Git 忽略的 `.local/build-env.sh`；构建缓存默认保存在本项目 `.local/`。

当前真机结果与未验证事项见 [原型验收](docs/verification.md)。

网页及其内容归对应网站和创作者所有，项目与这些网站没有官方关联。实现与参考来源见 [第三方说明](THIRD_PARTY_NOTICES.md)。
