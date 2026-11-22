/* Runs usage.compute() off the main thread so a big log parse can never stall the server. */
'use strict';
const { parentPort, workerData } = require('worker_threads');
try { parentPort.postMessage({ ok: true, data: require('./usage').compute(workerData.days) }); }
catch (e) { parentPort.postMessage({ ok: false, error: e.message }); }
