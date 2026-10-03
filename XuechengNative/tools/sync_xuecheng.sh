#!/bin/bash
set -euo pipefail

BRANCH="codex/native-codemagic-build"
REMOTE="origin"
export GIT_TERMINAL_PROMPT=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT="$REPO_DIR/XuechengNative/XuechengNative.xcodeproj"
SCHEME_DIR="$PROJECT/xcshareddata/xcschemes"

log() { printf '[Xuecheng sync] %s\n' "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || fail "Git is not installed."
command -v xcode-select >/dev/null 2>&1 || fail "Xcode command-line tools are unavailable."
command -v xcodebuild >/dev/null 2>&1 || fail "xcodebuild is unavailable."
[[ -d "$PROJECT" ]] || fail "Xcode project not found: $PROJECT"
[[ -d "$SCHEME_DIR" ]] || fail "Shared scheme directory not found: $SCHEME_DIR"

DEVELOPER_DIR="$(xcode-select -p)" || fail "Select Xcode with xcode-select first."
XCODE_APP="${DEVELOPER_DIR%/Contents/Developer}"
[[ "$XCODE_APP" == *.app && -d "$XCODE_APP" ]] || fail "Full Xcode.app is not selected: $DEVELOPER_DIR"

mapfile_schemes() {
  while IFS= read -r -d '' scheme_file; do
    printf '%s\n' "$(basename "$scheme_file" .xcscheme)"
  done < <(find "$SCHEME_DIR" -maxdepth 1 -type f -name '*.xcscheme' -print0)
}
SCHEMES="$(mapfile_schemes)"
[[ -n "$SCHEMES" ]] || fail "No shared Xcode scheme found."
if printf '%s\n' "$SCHEMES" | grep -Fxq 'XuechengNative'; then
  SCHEME='XuechengNative'
elif [[ "$(printf '%s\n' "$SCHEMES" | wc -l | tr -d ' ')" == '1' ]]; then
  SCHEME="$SCHEMES"
else
  fail "Multiple shared schemes found; choose one explicitly: $SCHEMES"
fi

git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null || fail "Not a Git checkout: $REPO_DIR"
CURRENT_BRANCH="$(git -C "$REPO_DIR" symbolic-ref --quiet --short HEAD)" || fail "Detached HEAD; switch to $BRANCH first."
[[ "$CURRENT_BRANCH" == "$BRANCH" ]] || fail "Current branch is $CURRENT_BRANCH; switch to $BRANCH first."
git -C "$REPO_DIR" remote get-url "$REMOTE" >/dev/null || fail "Git remote $REMOTE is missing."
git -C "$REPO_DIR" diff --quiet || fail "Uncommitted tracked changes; sync stopped."
git -C "$REPO_DIR" diff --cached --quiet || fail "Staged changes; sync stopped."

BEFORE="$(git -C "$REPO_DIR" rev-parse HEAD)"
git -C "$REPO_DIR" fetch --quiet "$REMOTE" "$BRANCH"
TARGET="$(git -C "$REPO_DIR" rev-parse FETCH_HEAD)"
if [[ "$BEFORE" != "$TARGET" ]]; then
  git -C "$REPO_DIR" merge-base --is-ancestor "$BEFORE" "$TARGET" || fail "Local and remote branches diverged; manual resolution required."
  git -C "$REPO_DIR" pull --ff-only "$REMOTE" "$BRANCH"
  log "Updated $BRANCH: $BEFORE -> $(git -C "$REPO_DIR" rev-parse HEAD)"
else
  log "Already current: $BEFORE"
fi

xcodebuild -list -project "$PROJECT" >/dev/null || fail "xcodebuild could not read the project or its schemes."
log "Xcode: $XCODE_APP"
log "Project: $PROJECT"
log "Scheme: $SCHEME"

# Open once after the first successful check, and again only when new code arrives.
STATE_DIR="${HOME}/Library/Application Support/XuechengNative"
STATE_FILE="$STATE_DIR/last-opened-commit"
mkdir -p "$STATE_DIR"
AFTER="$(git -C "$REPO_DIR" rev-parse HEAD)"
LAST_OPENED="$(test -f "$STATE_FILE" && cat "$STATE_FILE" || true)"
if [[ "$AFTER" != "$LAST_OPENED" ]]; then
  open -a "$XCODE_APP" "$PROJECT"
  printf '%s\n' "$AFTER" > "$STATE_FILE"
  log "Opened Xcode for $AFTER"
else
  log "Xcode already opened for this commit; no action."
fi
