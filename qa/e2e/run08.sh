#!/bin/bash
cd "$(dirname "$0")"
for th in light dark; do
 TL_URL=http://localhost:4196/ timeout 900 npx playwright test tests/08-layout-matrix.spec.js -g " $th\$| $th " --timeout 40000 --reporter=json > /tmp/tl-r-08-$th.json 2>/dev/null
 echo "done $th" >> /tmp/tl-08-progress.txt
done
