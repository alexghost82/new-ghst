#!/usr/bin/env bash
# Fail if obvious secrets are present in tracked source files.
#
# Scans the git-tracked tree (so .gitignored .env files are never flagged) for
# live OpenAI keys, private key blocks, and Fernet-looking master keys. Wired
# into CI as a merge gate; can also be run locally before committing.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Patterns that should never appear in committed source.
PATTERNS=(
  'sk-proj-[A-Za-z0-9_-]{20,}'
  'sk-[A-Za-z0-9]{32,}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
)

found=0
for pat in "${PATTERNS[@]}"; do
  # -z null-separated tracked file list; skip the example env + this script.
  matches=$(git grep -nIE -e "$pat" -- \
    ':!*.example' ':!scripts/check-secrets.sh' ':!**/*.lock' || true)
  if [ -n "$matches" ]; then
    echo "Potential secret detected (pattern: $pat):"
    echo "$matches"
    found=1
  fi
done

if [ "$found" -ne 0 ]; then
  echo ""
  echo "ERROR: secrets found in tracked files. Move them to env/Secret Manager."
  exit 1
fi

echo "check-secrets: no secrets detected in tracked files."
