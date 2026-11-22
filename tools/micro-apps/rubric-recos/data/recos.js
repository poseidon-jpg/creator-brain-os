// RUBRIC Recos data: every reco on the page at http://localhost:50013/
// Your agent writes this file when it runs /recos. The app reads it on every page load, so a change needs no restart.
// It ships empty. Run /recos once and your own recos show up here.
//
// File shape:
//   built     the date of this refresh, shown in the stats line ("20 Oct 2026").
//   footer    one line under the page: when it was built and how to refresh it.
//   letters   the four ARMS pillars and their names. Keep the letters A, R, M and S.
//   items     the recos, one object each (shape below).
//
// Reco shape:
//   id        short and unique: letters, numbers and dashes (s-hooks, m-trim-memory). Never change it on a refresh,
//             because your skips and done marks in state.json point at it.
//   letter    A, R, M or S (Apps, Routines, Memory, Skills).
//   pri       high, mid or low. "high" recos also show under Priority, in rank order.
//   rank      1, 2, 3... only on high-priority recos: their order in the Priority group.
//   effort    low, mid or high: how much work it is. No times.
//   saves     low, mid or high, only on recos that cut token use once done (less loaded every session, smaller files
//             read on every run). It shows as the green Token Savings bar. Leave it out otherwise.
//   savesNote one line on where the saving comes from. Required when saves is set.
//   touches   the skills or files the work changes, 3 at most, real names.
//   title     what to do, verb first.
//   benefit   "What's the benefit": the gain for you, then the evidence. Not the problem alone.
//   action    "What I can do": the agent speaking, first person ("I write...").
//   source    the evidence and exact paths. Only the agent needs it (it rides along in the cart).
//   svg       a small line drawing of THIS reco on a 48x48 grid: path, circle, rect, line, polyline, polygon or ellipse.
//             Strokes only. class="a" draws in the pillar's colour. Anything else in it is dropped by the page.
//
// Example reco (copy the shape, not the words):
//   { id: "s-split-big-skill", letter: "S", pri: "high", rank: 1, effort: "mid",
//     saves: "mid", savesNote: "The long reference loads only on the step that needs it.",
//     touches: ["skills/write-posts/SKILL.md"],
//     title: "Split the posts skill into a short core and a reference",
//     benefit: "Every post job loads less text, so it starts faster and costs less. The skill is 900 lines today.",
//     action: "I move the examples into a reference file and keep the steps in the skill.",
//     source: "skills/write-posts/SKILL.md is 900 lines; 600 of them are examples.",
//     svg: '<rect x="10" y="8" width="20" height="30" rx="2"/><path class="a" d="M34 16h6M34 24h6M34 32h6"/>' }
window.RECOS = {
  "built": "",
  "footer": "Run /recos in Claude Code to fill this page with ways to improve your setup.",
  "letters": { "A": { "name": "Apps" }, "R": { "name": "Routines" }, "M": { "name": "Memory" }, "S": { "name": "Skills" } },
  "items": []
};
