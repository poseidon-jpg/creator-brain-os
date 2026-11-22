#!/bin/bash
# SubagentStop drift-bot: send a subagent back once if it skipped its END check.
input=$(cat)
atype=$(printf '%s' "$input" | jq -r '.agent_type // ""')
active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')
case "$atype" in ""|statusline-setup|claude-code-guide) exit 0;; esac
[ "$active" = "true" ] && exit 0
msg=$(printf '%s' "$input" | jq -r '.last_assistant_message // ""')
if printf '%s' "$msg" | grep -qi "drift check:"; then exit 0; fi
jq -n '{decision:"block",reason:"Drift-bot: before you finish, run the drift-guard END check (depth, vision, truth, complete, specific, focus, craft). Fix anything under 2, then end your final message with the line: Drift check: depth X, vision X, truth X, complete X, specific X, focus X, craft X (plus anything you could not fix)."}'
