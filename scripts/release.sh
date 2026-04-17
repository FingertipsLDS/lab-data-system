#!/usr/bin/env bash
# 用法:
#   ./scripts/release.sh patch    # 0.5.3 → 0.5.4
#   ./scripts/release.sh minor    # 0.5.3 → 0.6.0
#   ./scripts/release.sh major    # 0.5.3 → 1.0.0
#   ./scripts/release.sh          # 不 bump, 用当前 package.json 的 version 直接构建

set -e

cd "$(dirname "$0")/.."

if [ -n "$1" ] && [ "$1" != "--no-bump" ]; then
  echo "==> bump version: $1"
  npm version "$1" --no-git-tag-version
fi

NEW_VER=$(node -p "require('./package.json').version")
echo "==> 目标版本: $NEW_VER"

echo "==> 同步 tauri.conf.json"
node -e "const f='src-tauri/tauri.conf.json';const j=JSON.parse(require('fs').readFileSync(f,'utf8'));j.version='$NEW_VER';require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n');"

echo "==> 同步 Cargo.toml"
sed -i '' "s/^version = .*/version = \"$NEW_VER\"/" src-tauri/Cargo.toml

echo "==> 验证三处版本号一致"
echo "  package.json     : $(node -p "require('./package.json').version")"
echo "  tauri.conf.json  : $(node -p "require('./src-tauri/tauri.conf.json').version")"
echo "  Cargo.toml       : $(grep '^version' src-tauri/Cargo.toml | head -1)"

echo "==> 开始构建 (npm run tauri build)"
npm run tauri build

echo ""
echo "==================================================="
echo "构建完成! 产物目录:"
echo "  src-tauri/target/release/bundle/dmg/       (.dmg)"
echo "  src-tauri/target/release/bundle/macos/     (.app)"
echo "==================================================="
echo ""
echo "下一步: 把这些文件传到 GitHub Releases:"
echo "  1. .dmg 安装包"
echo "  2. .dmg.sig 签名文件"
echo "  3. latest.json (可自动生成或手写)"
