#!/usr/bin/env bash
set -euo pipefail
set +x
project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"
if [[ -f .local/build-env.sh ]]; then source .local/build-env.sh; fi
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$project_root/.local/gradle}"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-$project_root/.local/android}"
gradle_bin="${GRADLE_BIN:-$project_root/gradlew}"
keytool_bin="${JAVA_HOME:+$JAVA_HOME/bin/}keytool"
signing_dir="$HOME/.config/jianlan/release"
signing_env="$signing_dir/signing.env"

umask 077
mkdir -p "$signing_dir"
chmod 700 "$signing_dir"
if [[ ! -f "$signing_env" ]]; then
    if [[ -e "$signing_dir/jianlan-release.p12" ]]; then
        echo 'A release key already exists without signing.env. Restore its signing.env; the existing key will not be replaced.' >&2
        exit 1
    fi
    export JIANLAN_STORE_FILE="$signing_dir/jianlan-release.p12"
    export JIANLAN_STORE_PASSWORD="$(openssl rand -hex 32)"
    export JIANLAN_KEY_ALIAS='jianlan'
    export JIANLAN_KEY_PASSWORD="$JIANLAN_STORE_PASSWORD"
    (
        cd "$signing_dir"
        "$keytool_bin" -genkeypair -noprompt -storetype PKCS12 \
            -keystore jianlan-release.p12 -alias "$JIANLAN_KEY_ALIAS" \
            -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Jianlan,O=Jianlan' \
            -storepass:env JIANLAN_STORE_PASSWORD -keypass:env JIANLAN_KEY_PASSWORD
    )
    (
        set -o noclobber
        {
            printf 'export JIANLAN_STORE_FILE=%q\n' "$JIANLAN_STORE_FILE"
            printf 'export JIANLAN_STORE_PASSWORD=%q\n' "$JIANLAN_STORE_PASSWORD"
            printf 'export JIANLAN_KEY_ALIAS=%q\n' "$JIANLAN_KEY_ALIAS"
            printf 'export JIANLAN_KEY_PASSWORD=%q\n' "$JIANLAN_KEY_PASSWORD"
        } > "$signing_env"
    )
    chmod 600 "$JIANLAN_STORE_FILE" "$signing_env"
    echo 'Created the local release signing key. Back up the release signing directory before distributing updates.'
fi
source "$signing_env"
for signing_name in JIANLAN_STORE_FILE JIANLAN_STORE_PASSWORD JIANLAN_KEY_ALIAS JIANLAN_KEY_PASSWORD; do
    if [[ -z "${!signing_name:-}" ]]; then
        echo "Missing $signing_name in signing.env" >&2
        exit 1
    fi
    export "$signing_name"
done
if [[ ! -f "$JIANLAN_STORE_FILE" ]]; then echo 'The configured release keystore is missing.' >&2; exit 1; fi
: "${ANDROID_HOME:?Set ANDROID_HOME to the Android SDK directory}"
build_tools="$ANDROID_HOME/build-tools/36.0.0"

"$gradle_bin" --console=plain :app:assembleRelease :app:lintRelease "$@"
source_apk='app/build/outputs/apk/release/app-release.apk'
"$build_tools/apksigner" verify --verbose "$source_apk"
"$build_tools/zipalign" -c 4 "$source_apk"
version="$(sed -n "s/^[[:space:]]*versionName '\([^']*\)'.*/\1/p" app/build.gradle)"
if [[ -z "$version" ]]; then echo 'Missing versionName in app/build.gradle' >&2; exit 1; fi
mkdir -p dist
apk_name="jianlan-$version.apk"
cp "$source_apk" "dist/$apk_name"
(
    cd dist
    shasum -a 256 "$apk_name" > SHA256SUMS
    cat SHA256SUMS
)
