#!/usr/bin/env bash
# Run on your Mac. Needs git and the GitHub CLI (brew install gh; gh auth login).
set -euo pipefail
REPO="${1:-tokenlens}"
cd "$(dirname "$0")/site"
git init -q -b main
git add -A
git commit -q -m "TokenLens: usage panel, prompt-caching model, GitHub Pages"
gh repo create "$REPO" --public --source=. --remote=origin --push
gh api -X POST "repos/{owner}/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 || true
gh workflow run pages.yml >/dev/null 2>&1 || true
USER=$(gh api user -q .login)
echo "Repo:  https://github.com/$USER/$REPO"
echo "Pages: https://$USER.github.io/$REPO/  (first deploy takes ~1 minute)"
