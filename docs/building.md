# 构建简览

需要 JDK 17、Android SDK Platform 36、Build Tools 36.0.0，以及 Node.js（运行过滤规则测试）。Gradle Wrapper 会使用项目指定的 Gradle 版本。

设置 `JAVA_HOME` 和 `ANDROID_HOME` 后运行：

```bash
node --test tests/cleaner.test.cjs
bash scripts/build.sh
```

调试安装包生成在 `dist/jianlan-<版本>-debug.apk`，脚本同时运行 Android Lint。可以把本机环境变量放进 Git 忽略的 `.local/build-env.sh`；如需使用已有 Gradle 安装，可设置 `GRADLE_BIN`。

## 发布安装包

```bash
bash scripts/build-release.sh
```

脚本首次运行时，在 `~/.config/jianlan/release/` 生成固定的发布签名密钥 `jianlan-release.p12` 和 `signing.env`。密码随机生成，只保存在本机文件中，目录权限为 `700`，文件权限为 `600`。已有密钥不会被覆盖。后续构建会继续读取这份签名配置。

发布脚本运行 `assembleRelease`、`lintRelease`，并检查 APK 签名和 ZIP 对齐。输出为 `dist/jianlan-<版本>.apk` 与 `dist/SHA256SUMS`。发布包关闭调试功能，版本号取自 `app/build.gradle`。

发布前请备份整个 `~/.config/jianlan/release/` 目录，并妥善保存。后续覆盖升级必须使用同一签名；不要把密钥或 `signing.env` 提交到 Git、上传到 Releases 或放进网站。其他贡献者自行构建时会生成自己的签名，不能覆盖安装官方发布包。

如需直接调用 Gradle，先在本机 shell 中载入 `signing.env`。构建读取 `JIANLAN_STORE_FILE`、`JIANLAN_STORE_PASSWORD`、`JIANLAN_KEY_ALIAS` 和 `JIANLAN_KEY_PASSWORD`；未配置签名时，发布构建会报错，调试构建不受影响。

手机上已安装的 `0.2.1` 调试包与发布包签名不同，不能直接覆盖升级。首次改装发布包需要先卸载调试包，这会清除简览中的登录状态和设置；脚本不会替你操作手机。之后的正式发布包使用固定签名，可以正常覆盖升级。

签名和升级机制见 [Android 官方说明](https://developer.android.com/studio/publish/app-signing)。
