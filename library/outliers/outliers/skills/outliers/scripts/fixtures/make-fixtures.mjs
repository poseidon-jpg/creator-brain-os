#!/usr/bin/env node
// Writes saved service responses for the Instagram and TikTok scanners, so the whole pipeline can be tested
// with no key and no spend:  node make-fixtures.mjs <output-folder>
//
// IMPORTANT: these are SYNTHETIC. The field names follow each service's own documentation (ScrapeCreators docs,
// the Apify Actors' published output samples, yt-dlp's real JSON), but the accounts and numbers are made up and
// were NOT recorded from a live call. Dates are relative to today so the files never age out of the scan window.
// The accounts are named fixture_* so they can never be mistaken for real ones.
//
// What each account is built to test:
//   fixture_ig_one / fixture_tt_one / fixture_x_one / fixture-li-one   20 posts, one real outlier (about 8x) posted 3 days ago
//   fixture_ig_two / fixture_tt_two / fixture_x_two / fixture-li-two   20 posts, nothing unusual (must NOT show up)
//   fixture_ig_new / fixture_tt_new / fixture_x_new / fixture-li-new   only 4 posts, too thin for a baseline (must NOT show up)
//   fixture_ig_photo                  photos and carousels mixed with 6 reels (photos must be dropped)
//   X accounts also carry a reply and a repost with huge views, which must be dropped (only the account's own posts count).
//   LinkedIn counts engagement (reactions + comments + reposts), not views.

import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
if (!out) { console.error('Usage: make-fixtures.mjs <output-folder>'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

const NOW = Date.now();
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

// n posts, newest first, one every 36 hours starting 6 hours ago. `outlierAt` (index) gets 8x the normal views.
function makeSeries(n, base, outlierAt = -1) {
  return Array.from({ length: n }, (_, i) => ({
    ts: NOW - (i * 36 + 6) * 3600e3,
    views: Math.round(((r) => (i === outlierAt ? 8 : 0.7 + r * 0.6))(rnd()) * base),   // normal posts vary 0.7x to 1.3x; the outlier is exactly 8x
    id: `${Math.round(rnd() * 1e9)}${i}`,
  }));
}
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const igAccounts = {
  fixture_ig_one: makeSeries(20, 5000, 2), fixture_ig_two: makeSeries(20, 4000),
  fixture_ig_new: makeSeries(4, 6000), fixture_ig_photo: makeSeries(6, 3000),
};
const ttAccounts = {
  fixture_tt_one: makeSeries(20, 9000, 2), fixture_tt_two: makeSeries(20, 7000), fixture_tt_new: makeSeries(4, 8000),
};

const write = (file, data) => fs.writeFileSync(path.join(out, file), JSON.stringify(data, null, 1));

// ---- ScrapeCreators shapes ----
{
  const ig = {};
  for (const [h, series] of Object.entries(igAccounts)) {
    const posts = series.map((p, i) => ({
      id: p.id, code: `C${p.id}`, url: `https://www.instagram.com/${h}/p/C${p.id}/`, caption: { text: `Fixture reel ${i} by ${h}\nsecond line` },
      media_type: 2, product_type: 'clips', play_count: p.views, taken_at: Math.round(p.ts / 1000), created_at: new Date(p.ts).toISOString(),
      video_duration: 21.5 + i, like_count: Math.round(p.views / 20), comment_count: Math.round(p.views / 400),
      display_uri: `https://example.invalid/${p.id}.jpg`,
    }));
    if (h === 'fixture_ig_photo') {   // photos and a carousel between the reels: no views, must be skipped
      posts.splice(1, 0, { id: '9001', code: 'P9001', media_type: 1, product_type: 'feed', like_count: 40, taken_at: Math.round((NOW - 3600e3) / 1000), caption: { text: 'a photo' } });
      posts.splice(3, 0, { id: '9002', code: 'P9002', media_type: 8, product_type: 'carousel_container', like_count: 90, taken_at: Math.round((NOW - 7200e3) / 1000), caption: { text: 'a carousel' } });
    }
    const pages = chunk(posts, 12).map((items, i, all) => ({
      success: true, credits_charged: 1, num_results: items.length, more_available: i < all.length - 1, items, next_max_id: `cursor${i + 1}`,
    }));
    ig[h] = { profile: { data: { user: { full_name: `Fixture ${h}`, edge_followed_by: { count: 90000 } } } }, pages };
  }
  write('scrapecreators-instagram.json', ig);

  const tt = {};
  for (const [h, series] of Object.entries(ttAccounts)) {
    const list = series.map((p, i) => ({
      aweme_id: p.id, aweme_type: 0, image_infos: null, desc: `Fixture tiktok ${i} by ${h} #ai`, create_time: Math.round(p.ts / 1000),
      statistics: { play_count: p.views, digg_count: Math.round(p.views / 15), comment_count: Math.round(p.views / 300), share_count: 5 },
      video: { duration: (18 + i) * 1000, dynamic_cover: { url_list: [`https://example.invalid/${p.id}.jpg`] } },
      author: { unique_id: h, nickname: `Fixture ${h}`, follower_count: 120000 },
      share_url: `https://www.tiktok.com/@${h}/video/${p.id}?utm=x`,
    }));
    if (h === 'fixture_tt_one') {   // a photo slideshow with big views: must be skipped
      list.splice(1, 0, { aweme_id: '9004', aweme_type: 150, image_infos: [{ url: 'x' }], desc: 'a slideshow', create_time: Math.round((NOW - 3600e3) / 1000),
        statistics: { play_count: 90000 }, author: { unique_id: h, follower_count: 120000 } });
    }
    tt[h] = { pages: chunk(list, 10).map((aweme_list, i, all) => ({ success: true, credits_charged: 1, aweme_list, has_more: i < all.length - 1, max_cursor: `${i + 1}`, status_code: 0 })) };
  }
  write('scrapecreators-tiktok.json', tt);
}

// ---- Apify shapes (one dataset for all accounts, like a real run) ----
{
  const items = [];
  for (const [h, series] of Object.entries(igAccounts)) {
    for (const [i, p] of series.entries()) {
      items.push({
        id: p.id, shortCode: `C${p.id}`, url: `https://www.instagram.com/reel/C${p.id}/`, caption: `Fixture reel ${i} by ${h}`,
        timestamp: new Date(p.ts).toISOString(), ownerUsername: h, ownerFullName: `Fixture ${h}`, productType: 'clips',
        videoPlayCount: p.views, videoViewCount: Math.round(p.views / 4), likesCount: Math.round(p.views / 20),
        commentsCount: Math.round(p.views / 400), videoDuration: 21 + i, displayUrl: `https://example.invalid/${p.id}.jpg`,
      });
    }
  }
  items.push({ error: 'no_items', errorDescription: 'Fixture: the Actor reports a private or empty profile as an error row.' });
  write('apify-instagram.json', { _fixture_note: 'synthetic, shaped from the Actor docs', items });

  const tt = [];
  for (const [h, series] of Object.entries(ttAccounts)) {
    for (const [i, p] of series.entries()) {
      tt.push({
        id: p.id, text: `Fixture tiktok ${i} by ${h} #ai`, createTimeISO: new Date(p.ts).toISOString(),
        webVideoUrl: `https://www.tiktok.com/@${h}/video/${p.id}`, playCount: p.views, diggCount: Math.round(p.views / 15),
        commentCount: Math.round(p.views / 300), isSlideshow: false, videoMeta: { duration: 18 + i, coverUrl: `https://example.invalid/${p.id}.jpg` },
        authorMeta: { name: h, nickName: `Fixture ${h}`, fans: 120000 },
      });
    }
  }
  tt.push({ id: '9003', text: 'a photo slideshow', createTimeISO: new Date(NOW - 3600e3).toISOString(), playCount: 50000, isSlideshow: true, authorMeta: { name: 'fixture_tt_one', fans: 120000 } });
  write('apify-tiktok.json', { _fixture_note: 'synthetic, shaped from the Actor docs', items: tt });
}

// ---- yt-dlp shape (what `yt-dlp --flat-playlist -J https://www.tiktok.com/@name` prints) ----
{
  const y = {};
  for (const [h, series] of Object.entries(ttAccounts)) {
    y[h] = {
      _type: 'playlist',
      entries: series.map((p, i) => ({
        id: p.id, title: `Fixture tiktok ${i} by ${h}`, description: `Fixture tiktok ${i} by ${h} #ai`, timestamp: Math.round(p.ts / 1000),
        view_count: p.views, like_count: Math.round(p.views / 15), comment_count: Math.round(p.views / 300), duration: 18 + i,
        channel: `Fixture ${h}`, uploader: h, thumbnails: [{ id: 'cover', url: `https://example.invalid/${p.id}.jpg` }],
      })),
    };
  }
  write('ytdlp-tiktok.json', y);
}

// ---- X: three sources, the same accounts ----
{
  const xAccounts = { fixture_x_one: makeSeries(20, 5000, 2), fixture_x_two: makeSeries(20, 4000), fixture_x_new: makeSeries(4, 6000) };
  const iso = (ms) => new Date(ms).toISOString();
  const noise = (h) => [   // the account's reply and someone else's post it reposted, both with huge views
    { id: `${h}r1`, reply: true, views: 900000, ts: NOW - 30 * 3600e3 },
    { id: `${h}rt1`, repost: true, views: 800000, ts: NOW - 40 * 3600e3 },
  ];

  // FxTwitter: /2/profile/<handle>/statuses, 20 a page, newest first, cursor.bottom for the next page
  const fx = {};
  for (const [h, series] of Object.entries(xAccounts)) {
    const list = [...series.map((p, i) => ({ id: p.id, text: `Fixture post ${i} by ${h}`, views: p.views, likes: Math.round(p.views / 50), replies: 3, ts: p.ts })), ...noise(h)]
      .sort((a, b) => b.ts - a.ts)
      .map(t => ({
        type: 'status', id: t.id, url: `https://x.com/${h}/status/${t.id}`, text: t.text || 'noise', views: t.views, likes: t.likes || 1, replies: t.replies || 0,
        created_timestamp: Math.round(t.ts / 1000), replying_to: t.reply ? 'someone' : null,
        reposted_by: t.repost ? { screen_name: h } : undefined,
        author: { screen_name: t.repost ? 'someone_else' : h, name: `Fixture ${h}`, followers: 150000 },
      }));
    fx[h] = { pages: chunk(list, 20).map((results, i, all) => ({ code: 200, results, cursor: { bottom: i < all.length - 1 ? `c${i + 1}` : null } })) };
  }
  write('fxtwitter-x.json', fx);

  // X API: users/by/username, then users/:id/tweets (replies and reposts are already excluded by the request)
  const xa = {};
  for (const [h, series] of Object.entries(xAccounts)) {
    xa[h] = {
      user: { data: { id: `u_${h}`, name: `Fixture ${h}`, username: h, public_metrics: { followers_count: 150000 } } },
      tweets: { data: series.map((p, i) => ({ id: p.id, text: `Fixture post ${i} by ${h}`, created_at: iso(p.ts), public_metrics: { impression_count: p.views, like_count: Math.round(p.views / 50), reply_count: 3, retweet_count: 2, quote_count: 0 } })) },
    };
  }
  write('xapi-x.json', xa);

  // Apify X Actor: one dataset for every account
  const ax = [];
  for (const [h, series] of Object.entries(xAccounts)) {
    for (const [i, p] of series.entries()) {
      ax.push({ id: p.id, url: `https://x.com/${h}/status/${p.id}`, text: `Fixture post ${i} by ${h}`, createdAt: new Date(p.ts).toUTCString(), viewCount: p.views, likeCount: Math.round(p.views / 50), replyCount: 3, isReply: false, isRetweet: false, author: { userName: h, name: `Fixture ${h}`, followers: 150000 } });
    }
    for (const n of noise(h)) ax.push({ id: n.id, url: `https://x.com/${h}/status/${n.id}`, text: 'noise', createdAt: iso(n.ts), viewCount: n.views, likeCount: 10, replyCount: 1, isReply: !!n.reply, isRetweet: !!n.repost, author: { userName: h, followers: 150000 } });
  }
  write('apify-x.json', { _fixture_note: 'synthetic, shaped from the Actor docs', items: ax });
}

// ---- LinkedIn: engagement, not views ----
{
  const liAccounts = { 'fixture-li-one': makeSeries(20, 300, 2), 'fixture-li-two': makeSeries(20, 250), 'fixture-li-new': makeSeries(4, 400) };
  const split = (total) => { const comments = Math.round(total * 0.15), shares = Math.round(total * 0.05); return { likes: total - comments - shares, comments, shares }; };

  // Apify LinkedIn Actor (harvestapi/linkedin-profile-posts): one dataset, rows carry the author's public id
  const al = [];
  for (const [h, series] of Object.entries(liAccounts)) {
    for (const [i, p] of series.entries()) {
      const e = split(p.views);
      al.push({ type: 'post', id: p.id, linkedinUrl: `https://www.linkedin.com/posts/${h}_activity-${p.id}`, content: `Fixture LinkedIn post ${i} by ${h}`, postedAt: { timestamp: p.ts, date: new Date(p.ts).toISOString() }, engagement: { likes: e.likes, comments: e.comments, shares: e.shares }, author: { name: `Fixture ${h}`, publicIdentifier: h } });
    }
  }
  write('apify-linkedin.json', { _fixture_note: 'synthetic, shaped from the Actor docs', items: al });

  // ScrapeCreators: the profile lists post links, then one call per post gives likeCount and commentCount
  const sl = {};
  for (const [h, series] of Object.entries(liAccounts)) {
    const posts = {};
    const recentPosts = series.map((p, i) => {
      const link = `https://www.linkedin.com/posts/${h}_activity-${p.id}`;
      const e = split(p.views);
      posts[link] = { success: true, credits_charged: 1, id: p.id, url: link, datePublished: new Date(p.ts).toISOString(), description: `Fixture LinkedIn post ${i} by ${h}`, likeCount: e.likes + e.shares, commentCount: e.comments, author: { name: `Fixture ${h}`, followers: 40000 } };
      return { title: `Fixture LinkedIn post ${i}`, activityType: 'Posted', link };
    });
    sl[`in/${h}`] = { profile: { success: true, credits_charged: 1, name: `Fixture ${h}`, followers: 40000, recentPosts }, posts };
  }
  write('scrapecreators-linkedin.json', sl);
}

console.log(`Wrote synthetic fixtures to ${out}`);
