// Cleans text that comes from other people (titles, channel names, captions) before it is shown or copied.

// The long dash character is a give-away of machine-written text, so it becomes a plain hyphen before
// anything downstream copies a title into your files.
const LONG_DASH = String.fromCharCode(8212);
export const plain = (s) => String(s || '').split(LONG_DASH).map(p => p.trim()).join(' - ');

export const clip = (s, n) => { const t = plain(s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '...' : t; };

// The first line of a caption, minus a leading "Follow me and DM me GUIDE 👇" call to action, which says nothing about the video.
export const captionTitle = (s) => {
  const line = String(s || '').split('\n').map(l => l.trim()).find(Boolean) || '';
  return line.replace(/^(follow me|dm me|comment|link in bio)\b[^\u{1F447}]{0,80}\u{1F447}\s*/iu, '') || line;
};
