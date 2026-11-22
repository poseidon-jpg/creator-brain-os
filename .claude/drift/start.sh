#!/bin/bash
# SubagentStart drift-bot: inject the drift guard into every real subagent.
input=$(cat)
atype=$(printf '%s' "$input" | jq -r '.agent_type // ""')
case "$atype" in ""|statusline-setup) exit 0;; esac
jq -Rs '{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:.}}' "$(dirname "$0")/guard.md"
