#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"
if [[ -f .local/build-env.sh ]]; then source .local/build-env.sh; fi
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$project_root/.local/gradle}"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-$project_root/.local/android}"
gradle_bin="${GRADLE_BIN:-$project_root/gradlew}"
"$gradle_bin" --console=plain :app:assembleDebug :app:lintDebug "$@"
mkdir -p dist
cp app/build/outputs/apk/debug/app-debug.apk dist/jianlan-0.1.0.apk
shasum -a 256 dist/jianlan-0.1.0.apk
