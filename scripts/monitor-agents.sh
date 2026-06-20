#!/usr/bin/env bash
# Monitors three agent transcripts until all are "done" (stable + final assistant turn).
set -u

BASE="/Users/omeralfassi/.cursor/projects/Users-omeralfassi-ghst-rashi/agent-transcripts"
IDS=(1fbceb6a-0e1d-4c6f-a066-ff0cd3be2225 e7ea076a-77ea-4b98-aaeb-be3457c5dabd 18be6c90-a062-494a-99b5-144588e96a3b)
STABLE_SECS=90      # mtime must be older than this to count as quiet
POLL=30             # seconds between polls
MAX_MIN=180         # hard stop after this many minutes

now_epoch() { date +%s; }

# Returns: "done" / "working" / "stalled" for a given jsonl path
status_for() {
  local p="$1"
  python3 - "$p" "$STABLE_SECS" <<'PY'
import sys, json, os, time
p, stable = sys.argv[1], int(sys.argv[2])
if not os.path.exists(p):
    print("missing"); sys.exit(0)
age = time.time() - os.path.getmtime(p)
rows = [json.loads(l) for l in open(p) if l.strip()]
last = None
for r in rows:
    if r.get("role"):
        last = r
role = last.get("role") if last else None
m = last.get("message", {}) if last else {}
content = m.get("content") if isinstance(m, dict) else None
has_tool_use = False
if isinstance(content, list):
    for c in content:
        if isinstance(c, dict) and c.get("type") == "tool_use":
            has_tool_use = True
quiet = age > stable
# done: final turn = assistant text, no pending tool_use, and file quiet
if role == "assistant" and not has_tool_use and quiet:
    print("done")
elif quiet and age > 600:
    print("stalled")  # quiet > 10 min but not a clean assistant-text end
else:
    print("working")
PY
}

start=$(now_epoch)
while true; do
  all_done=1
  line="[$(date '+%H:%M:%S')]"
  for id in "${IDS[@]}"; do
    s=$(status_for "$BASE/$id/$id.jsonl")
    line="$line ${id:0:8}=$s"
    if [ "$s" != "done" ] && [ "$s" != "stalled" ]; then
      all_done=0
    fi
  done
  echo "$line"
  if [ "$all_done" -eq 1 ]; then
    echo "ALL_AGENTS_DONE"
    exit 0
  fi
  elapsed_min=$(( ( $(now_epoch) - start ) / 60 ))
  if [ "$elapsed_min" -ge "$MAX_MIN" ]; then
    echo "MONITOR_TIMEOUT"
    exit 1
  fi
  sleep "$POLL"
done
