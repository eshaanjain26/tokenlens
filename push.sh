#!/usr/bin/env bash
# Run on your Mac from anywhere: bash push.sh
# Pushes the usage panel + prompt-caching changes to github.com/eshaanjain26/tokenlens
set -euo pipefail
cd "$(dirname "$0")"

rm -f .git/index.lock .git/HEAD.lock

# GitHub Pages files live at repo root (site/ is a separate local repo, so skip it)
mkdir -p .github/workflows
cp site/.github/workflows/pages.yml .github/workflows/pages.yml
cp site/index.html index.html
cp site/.nojekyll .nojekyll
printf 'site/\n' > .gitignore

git add -A
git commit -m "Add usage panel and prompt-caching model; GitHub Pages workflow"
git push origin main

echo "Repo:  https://github.com/eshaanjain26/tokenlens"
echo "Pages: https://eshaanjain26.github.io/tokenlens/"
echo "One-time: repo Settings > Pages > Source = GitHub Actions"
