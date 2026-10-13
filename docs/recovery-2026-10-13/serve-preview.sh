#!/bin/sh
exec python3 -m http.server 5313 --bind 0.0.0.0 --directory /workspace/shared/zeGame2/dist
