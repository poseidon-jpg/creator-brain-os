// RUBRIC References popup.
// Opening the popup = capture. It screenshots the visible tab, grabs the page's
// meta info, POSTs everything to the local bridge, then lets you tweak tags,
// title, and a note. Every tweak PATCHes the bridge straight away.

const CFG = (typeof RUBRIC_CONFIG === "object" && RUBRIC_CONFIG) || {};
const BRIDGE = String(CFG.bridge || "http://127.0.0.1:5298").replace(/\/+$/, "");
const TOKEN = String(CFG.token || "");
// Keep this list the same as TAGS in build.js.
const TAGS = ["Landing page", "Portfolio", "SaaS", "Dashboard", "Typography", "Motion",
              "Illustration", "3D", "Minimal", "Bold", "E-commerce", "Docs"];
const START_HINT = "Open a terminal in the rubric-references folder and run:";

const $ = (id) => document.getElementById(id);
let rec = null;          // the saved record from the bridge
let pollTimer = null;

function showError(title, body, code) {
  $("main").classList.add("hide");
  $("err").classList.remove("hide");
  $("errTitle").textContent = title;
  $("errBody").textContent = body;
  if (code === false) $("errCode").classList.add("hide");
  else { $("errCode").classList.remove("hide"); if (code) $("errCode").textContent = code; }
  $("status").textContent = "Stopped";
}

function setStatus(t, ok) { $("status").textContent = t; $("status").classList.toggle("ok", !!ok); }

// Runs INSIDE the page (via chrome.scripting). Must be self-contained.
function grabMeta() {
  const q = (s) => { const e = document.querySelector(s); return e ? String(e.content || e.getAttribute("href") || "").trim() : ""; };
  let fav = q('link[rel="icon"]') || q('link[rel="shortcut icon"]') || q('link[rel="apple-touch-icon"]') || "/favicon.ico";
  try { fav = new URL(fav, location.href).href; } catch (_) {}
  const text = ((document.body && document.body.innerText) || "").replace(/\s+/g, " ").slice(0, 1600);
  return {
    title: q('meta[property="og:title"]') || document.title || location.hostname,
    description: q('meta[name="description"]') || q('meta[property="og:description"]') || "",
    siteName: q('meta[property="og:site_name"]'),
    favicon: fav,
    text,
    w: window.innerWidth,
    h: window.innerHeight
  };
}

async function api(method, path, body) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (TOKEN) headers["x-rubric-token"] = TOKEN;
  const res = await fetch(BRIDGE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || ("bridge answered " + res.status)); e.status = res.status; throw e; }
  return data;
}

function bridgeError(e) {
  if (e && e.status === 401) return showError("Token doesn't match", "RUBRIC_TOKEN in env.local and token in the extension's config.js must be the same. Fix one, reload the extension, then click the icon again.", false);
  if (e && e.status) return showError("The bridge said no", String(e.message || e), false);
  showError("Bridge isn't running", "The small local server that saves your captures isn't answering at " + BRIDGE + ". " + START_HINT, "node server.js");
}

function renderChips() {
  const box = $("chips");
  box.innerHTML = "";
  for (const t of TAGS) {
    const b = document.createElement("button");
    b.className = "chip" + ((rec.tags || []).includes(t) ? " on" : "");
    b.textContent = t;
    b.addEventListener("click", () => {
      const set = new Set(rec.tags || []);
      set.has(t) ? set.delete(t) : set.add(t);
      rec.tags = TAGS.filter((x) => set.has(x));
      renderChips();
      save({ tags: rec.tags });
    });
    box.appendChild(b);
  }
}

function fill() {
  if (document.activeElement !== $("title")) $("title").value = rec.title || "";
  if (document.activeElement !== $("desc")) $("desc").value = rec.description || "";
  if (document.activeElement !== $("note")) $("note").value = rec.note || "";
  $("thinking").classList.toggle("hide", rec.status !== "describing");
  $("agentOff").classList.toggle("hide", rec.agent !== false);
  $("aiFailed").classList.toggle("hide", !rec.aiFailed);
  renderChips();
  $("dupe").classList.toggle("hide", !rec.dupe);
}

let saveTimer = null;
function save(patch) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { rec = Object.assign(rec, await api("PATCH", "/api/refs/" + rec.id, patch)); setStatus("Saved", true); }
    catch (e) { setStatus(e && e.status === 401 ? "Token mismatch" : "Save failed"); }
  }, 250);
}

function poll() {
  clearTimeout(pollTimer);
  if (!rec || rec.status !== "describing") return;
  pollTimer = setTimeout(async () => {
    try {
      const fresh = await api("GET", "/api/refs/" + rec.id);
      const wasDescribing = rec.status === "describing";
      rec = Object.assign(rec, fresh, { dupe: rec.dupe, agent: rec.agent });
      if (wasDescribing && rec.status !== "describing") fill();
    } catch (_) {}
    poll();
  }, 1500);
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = (tab && tab.url) || "";
  if (!/^https?:/i.test(url)) {
    return showError("Can't capture this page", "Chrome-internal pages, the Web Store, and local files are off limits to extensions. Open a normal website and try again.", false);
  }

  // 1. screenshot of what's on screen right now
  let shot;
  try { shot = await chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 82 }); }
  catch (e) { return showError("Screenshot failed", String(e && e.message || e), false); }
  $("shot").src = shot;

  // 2. page meta (title, description, favicon, a little text for the blurb)
  let meta = { title: tab.title || url, description: "", favicon: "", text: "", w: 0, h: 0 };
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: grabMeta });
    if (r && r.result) meta = r.result;
  } catch (_) { /* some pages block scripts; the tab title is enough */ }
  $("title").value = meta.title;

  // 3. send to the bridge
  setStatus("Saving");
  try {
    rec = await api("POST", "/api/capture", { url, ...meta, image: shot });
  } catch (e) {
    return bridgeError(e);
  }
  setStatus("Saved", true);
  fill();
  poll();

  $("title").addEventListener("input", () => { rec.title = $("title").value; save({ title: rec.title }); });
  $("desc").addEventListener("input", () => { rec.description = $("desc").value; save({ description: rec.description }); });
  $("note").addEventListener("input", () => { rec.note = $("note").value; save({ note: rec.note }); });
  $("openWall").addEventListener("click", () => chrome.tabs.create({ url: BRIDGE + "/" }));
  $("remove").addEventListener("click", async () => {
    try { await api("DELETE", "/api/refs/" + rec.id); }
    catch (e) { return setStatus("Remove failed"); }
    showError("Removed", "This site is off the wall. Click the icon again to re-add it.", false);
  });
}

// The wall button lives in the top bar, outside the capture/error panels, so it
// works on every page. It opens the live wall when the bridge answers.
$("wallBtn").addEventListener("click", async () => {
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 800);
    const headers = TOKEN ? { "x-rubric-token": TOKEN } : {};
    const r = await fetch(BRIDGE + "/api/health", { signal: ctl.signal, headers });
    if (r.ok) return chrome.tabs.create({ url: BRIDGE + "/" });
    if (r.status === 401) return bridgeError({ status: 401 });
  } catch (_) {}
  showError("Bridge isn't running", "Start it to see the live wall. You can also open data/index.html in the rubric-references folder, read only. " + START_HINT, "node server.js");
});

main().catch((e) => showError("Something broke", String(e && e.message || e), false));
