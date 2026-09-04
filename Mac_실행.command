#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js가 필요합니다. https://nodejs.org 에서 LTS 버전을 설치해주세요."
  read -r -p "Enter를 누르면 종료합니다."
  exit 1
fi
node server.js
