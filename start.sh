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
  echo "Using ${PORT}"
fi

echo "http://localhost:${PORT}"
python3 -m http.server "$PORT"
