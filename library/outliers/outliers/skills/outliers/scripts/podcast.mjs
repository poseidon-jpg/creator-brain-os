// Podcasts are skipped in keyword search: interviews and clips are not a format a solo creator can copy.
// A feed link is not enough: solo creators post audio copies of their tutorials to Spotify and
// Apple Podcasts ("listen to this video as a podcast"), and "episode" alone catches build series.
// A description that calls itself the podcast marks a real show; shows that never say so are
// named in keywords.json podcast_channels.
const FEED = /\b(the|this) podcast\b|podcast episodes?\b|\bfull episode\b/i;

export function isPodcast(v, cfg = {}) {
  const channel = String(v.channel_title || '').toLowerCase();
  const listed = (cfg.podcast_channels || []).map(s => String(s).toLowerCase());
  return listed.includes(channel)
    || /podcast/i.test(v.channel_title || '')
    || /podcast/i.test(v.title || '')
    || FEED.test(v.description || '');
}
