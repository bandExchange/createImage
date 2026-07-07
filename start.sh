#!/bin/bash
cd "$(dirname "$0")"

find_free_port() {
  local port=$1
  while lsof -i ":$port" >/dev/null 2>&1; do
    port=$((port + 1))
  done
  echo "$port"
}

PORT=$(find_free_port 8766)

if [ "$PORT" != "8766" ]; then
  echo "8766 포트가 사용 중이라 ${PORT} 포트로 실행합니다."
fi

echo "http://localhost:${PORT} 에서 실행 중... (종료: Ctrl+C)"
python3 -m http.server "$PORT"
