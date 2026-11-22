// RUBRIC References extension settings. Reload the extension in chrome://extensions after a change.
//
// bridge: where node server.js is listening. If you change PORT in env.local, change it here too,
//         and in the two host_permissions lines in manifest.json.
// token:  leave blank unless you set RUBRIC_TOKEN in env.local. Then put the same value here.
const RUBRIC_CONFIG = {
  bridge: "http://127.0.0.1:5298",
  token: ""
};
