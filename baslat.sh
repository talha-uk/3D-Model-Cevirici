#!/bin/bash
cd "$(dirname "$0")"
if [ -x "$HOME/.local/node-v22.23.4/bin/node" ]; then
  export PATH="$HOME/.local/node-v22.23.4/bin:$PATH"
fi
exec node sunucu.js
