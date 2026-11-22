// Inspo - save a YouTube video to your Inspos wall in one click.
//   Click the Inspo button in the toolbar while a video is open, or
//   right-click a video (a thumbnail, or anywhere on its page) and choose "/inspo".
// It sends the link to the local Inspo bridge (bridge/server.mjs), which runs the inspo helper script.
// If you change the bridge port, change BRIDGE here and the host_permissions line in manifest.json.

const BRIDGE = "http://127.0.0.1:5299";
const YT_VIDEO = /(?:v=|youtu\.be\/|\/shorts\/|\/live\/)([\w-]{11})/;
const YT_LINKS = [
  "*://www.youtube.com/watch*",
  "*://www.youtube.com/shorts/*",
  "*://www.youtube.com/live/*",
  "*://m.youtube.com/watch*",
  "*://m.youtube.com/shorts/*",
  "*://youtu.be/*"
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Right-click a video link (thumbnails on the home page, search results, related videos).
    chrome.contextMenus.create({
      id: "inspo-link",
      title: "⭐ /inspo → linked video",
      contexts: ["link"],
      targetUrlPatterns: YT_LINKS
    });
    // Right-click anywhere on a watch page, including the player.
    chrome.contextMenus.create({
      id: "inspo-page",
      title: "⭐ /inspo → this video",
      contexts: ["page", "video"],
      documentUrlPatterns: YT_LINKS
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "inspo-link") return saveVideo(info.linkUrl);
  if (info.menuItemId === "inspo-page") return saveVideo(info.pageUrl || (tab && tab.url));
});

// The toolbar button saves the video in the open tab.
chrome.action.onClicked.addListener(tab => saveVideo(tab && tab.url));

async function saveVideo(src) {
  const m = String(src || "").match(YT_VIDEO);
  if (!m) return notify("Inspo", "Open a YouTube video first, or right-click a video thumbnail and choose /inspo.");
  const url = "https://www.youtube.com/watch?v=" + m[1];
  try {
    const res = await fetch(BRIDGE + "/api/inspo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "bridge error");
    notify("⭐ Added to Inspos", (data.title || "Saved") + (data.detail ? "\n" + data.detail : ""));
    return data;
  } catch (e) {
    const msg = String((e && e.message) || e);
    // A fetch that never reached the bridge means it is not running.
    const down = /Failed to fetch|NetworkError|ERR_CONNECTION/i.test(msg);
    notify("Inspo failed", down
      ? "The Inspo bridge is not running. Start it with: node server.mjs (in the bridge folder)."
      : msg);
    return { error: msg };
  }
}

function notify(title, message) {
  chrome.notifications.create({ type: "basic", iconUrl: "icon128.png", title, message });
}
