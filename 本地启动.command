#!/bin/zsh
cd "${0:A:h}"
PVZ_GAME_DIR=dist
[[ -f dist/index.html ]] || PVZ_GAME_DIR=.
python3 - "$PVZ_GAME_DIR" >/tmp/pvz-local.log 2>&1 <<'PY' &
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys

class LocalServer(ThreadingHTTPServer):
    # A battle loads many small images and sounds together.
    request_queue_size = 128

handler = partial(SimpleHTTPRequestHandler, directory=sys.argv[1])
LocalServer(('127.0.0.1', 8080), handler).serve_forever()
PY
PVZ_SERVER_PID=$!
trap 'kill "$PVZ_SERVER_PID" 2>/dev/null' EXIT INT TERM
sleep 1
if kill -0 "$PVZ_SERVER_PID" 2>/dev/null; then
 open "http://127.0.0.1:8080"
 print '游戏已打开。关闭这个窗口可停止本地服务。'
 wait "$PVZ_SERVER_PID"
else
 print '8080 端口已被占用，请关闭原来的游戏服务后重试。'
 read
fi
