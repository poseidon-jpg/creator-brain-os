// Source layer for Instagram, TikTok, X and LinkedIn outliers.
//
// scan-social.mjs asks this file for "the recent posts of these accounts" and gets back one shape,
// whichever service answered. The services are tried in the order set per platform in `order` below, or
// pass --provider on the command line. The comparison of every source we looked at (cost, risks, setup) is
// in the skill's references/social-sources.md.
//
//   scrapecreators  paid, one key (SCRAPECREATORS_API_KEY)     Instagram, TikTok, LinkedIn
//   apify           paid, one token (APIFY_API_TOKEN)           Instagram, TikTok, X, LinkedIn
//   xapi            paid, X's own API (X_BEARER_TOKEN)          X
//   ytdlp           free, no key, needs yt-dlp installed        TikTok
//   fxtwitter       free, no key, a public volunteer-run API    X
//
// Every provider returns the same thing:
//   { accounts: { <handle>: { posts: [Post], followers, displayName, error } }, abort }
//   Post = { id, url, caption, posted_at (ISO), duration_s, views, likes, comments, thumb }
// LinkedIn shows no view counts, so a LinkedIn Post's `views` holds its engagement instead:
// reactions + comments + reposts (see METRIC in social-db.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { DB_PATH } from './db.mjs';
import { PEERS_FILE, getKey } from './paths.mjs';

// =====================================================================================================
// DEFAULTS - the one block to edit to change how Instagram, TikTok, X and LinkedIn are scanned. File
// locations and where keys are read from live in paths.mjs.
// =====================================================================================================
export const SETTINGS = {
  peersFile: PEERS_FILE,              // { "youtube": [...], "instagram": [...], "tiktok": [...], "x": [...], "linkedin": [...] }
  dbFile: DB_PATH,                    // same database as the YouTube scan
  windowDays: 14,                     // how recent a post must be to count as an idea you can still ride
  perAccount: 30,                     // posts fetched per account: enough history to compute a baseline
  budgetUsd: 1,                       // a scan refuses to start if its estimate is over this
  // Services tried per platform, first to last. One without its key is skipped. The paid ones come first
  // because they hold up better; the free ones come last so TikTok and X still work with no key at all.
  order: {
    instagram: ['scrapecreators', 'apify'],
    tiktok: ['scrapecreators', 'apify', 'ytdlp'],
    x: ['apify', 'xapi', 'fxtwitter'],          // ScrapeCreators returns an account's 100 most popular posts, not its latest, so it can't give a normal
    linkedin: ['apify', 'scrapecreators'],      // Apify returns reposts too; ScrapeCreators counts reactions and comments only
  },
  scrapecreatorsUsdPerCredit: 47 / 25000,   // the $47 pack of 25,000 credits (scrapecreators.com), packs never expire
  apifyTier: 'FREE',                  // your Apify plan's discount tier: FREE, BRONZE (Starter), SILVER (Scale), GOLD (Business)
  xapiUsdPerPost: 0.005,              // X API pay-per-use, per post read (docs.x.com pricing)
  xapiUsdPerUser: 0.01,               // one account lookup per scan, priced as a read of the account
  ytdlpBin: process.env.YTDLP_BIN || 'yt-dlp',
};
// =====================================================================================================

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export { getKey };

class ProviderError extends Error {
  constructor(message, kind = 'other') { super(message); this.kind = kind; }   // kind: auth | credits | rate | other
}

async function httpJson(url, { headers = {}, method = 'GET', body = null, timeoutMs = 60000, retries = 2 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return await res.json();
      const text = (await res.text()).slice(0, 200);
      if (res.status === 401 || res.status === 403) throw new ProviderError(`HTTP ${res.status}: ${text}`, 'auth');
      if (res.status === 402) throw new ProviderError(`HTTP 402, out of credits: ${text}`, 'credits');
      if (res.status === 429 || res.status >= 500) { last = new ProviderError(`HTTP ${res.status}: ${text}`, 'rate'); await sleep(1500 * (attempt + 1)); continue; }
      throw new ProviderError(`HTTP ${res.status}: ${text}`, 'other');
    } catch (e) {
      if (e instanceof ProviderError && e.kind !== 'rate') throw e;
      last = e instanceof ProviderError ? e : new ProviderError(`network: ${e.message}`, 'rate');
      await sleep(1500 * (attempt + 1));
    }
  }
  throw last;
}

// ---------- small normalisers shared by the providers ----------

const toIso = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v)) ? Number(v) : null;
  const d = n != null ? new Date(n < 1e12 ? n * 1000 : n) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const intOrNull = (v) => (v == null || v === '' || Number.isNaN(Number(v)) || Number(v) < 0 ? null : Math.round(Number(v)));
const firstLine = (s) => String(s || '').split('\n')[0].trim();
const sum = (...xs) => xs.reduce((a, x) => a + (intOrNull(x) || 0), 0);

// One account key per platform. LinkedIn keys keep their kind ("in/name" or "company/name"), because a person
// and a company page live at different addresses; a bare name means a person.
function cleanHandle(h, platform = '') {
  let s = String(h || '').trim();
  if (platform === 'linkedin') {
    s = s.replace(/^https?:\/\/([a-z]+\.)?linkedin\.com\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (!/^(in|company|school)\//i.test(s)) s = `in/${s}`;
    return s.split('/').slice(0, 2).join('/').toLowerCase();
  }
  return s.replace(/^https?:\/\/(www\.)?(x|twitter|tiktok|instagram)\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '').toLowerCase();
}
const linkedinUrl = (key) => `https://www.linkedin.com/${key}/`;

function pickFixture(ctx, file) {
  const p = path.join(ctx.fixtures, file);
  if (!fs.existsSync(p)) throw new ProviderError(`fixture missing: ${p}`, 'other');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// =====================================================================================================
// ScrapeCreators - GET https://api.scrapecreators.com, header x-api-key, 1 credit per request.
// Docs: docs.scrapecreators.com (Instagram user posts v2, Instagram profile v1, TikTok profile videos v3).
// =====================================================================================================
const SC_BASE = 'https://api.scrapecreators.com';
const SC_IG_PAGE = 12;   // about 12 posts per Instagram request (their docs)
const SC_TT_PAGE = 10;   // page size is not stated in the docs we read, so estimates assume the small end

function scInstagramPost(raw0) {
  const raw = raw0?.media && typeof raw0.media === 'object' ? { ...raw0, ...raw0.media } : raw0;
  const caption = typeof raw.caption === 'object' && raw.caption ? raw.caption.text : raw.caption;
  const isVideo = raw.media_type === 2 || raw.media_type === 'VIDEO' || raw.product_type === 'clips'
    || raw.is_video === true || Number(raw.video_duration) > 0;
  if (!isVideo) return null;                                  // photos and carousels have no views
  const views = raw.play_count ?? raw.ig_play_count ?? raw.video_play_count ?? raw.video_view_count ?? raw.view_count;
  const posted = toIso(raw.created_at) || toIso(raw.taken_at);
  const code = raw.code || raw.shortcode;
  const id = String(raw.pk ?? raw.id ?? code ?? '');
  if (!id || views == null || !posted) return null;           // views hidden, or nothing to key on
  return {
    id, url: raw.url || (code ? `https://www.instagram.com/reel/${code}/` : ''), caption: caption || '',
    posted_at: posted, duration_s: intOrNull(raw.video_duration), views: intOrNull(views) ?? 0,
    likes: intOrNull(raw.like_count), comments: intOrNull(raw.comment_count),
    thumb: raw.display_uri || raw.thumbnail_url || raw.display_url || raw.image_versions2?.candidates?.[0]?.url || null,
  };
}

function scTikTokPost(raw, handle) {
  // aweme_type 0 is a normal video; photo slideshows have another type and a list of images (their docs: image_infos is null for video).
  if ((raw.aweme_type != null && raw.aweme_type !== 0) || (Array.isArray(raw.image_infos) && raw.image_infos.length) || raw.image_post_info) return null;
  const st = raw.statistics || {};
  const posted = toIso(raw.create_time);
  const id = String(raw.aweme_id || raw.id || '');
  if (!id || st.play_count == null || !posted) return null;
  const durMs = raw.video?.duration;
  return {
    id, url: raw.share_url ? raw.share_url.split('?')[0] : `https://www.tiktok.com/@${handle}/video/${id}`,
    caption: raw.desc || '', posted_at: posted, duration_s: durMs != null ? Math.round(durMs / 1000) : null,
    views: intOrNull(st.play_count) ?? 0, likes: intOrNull(st.digg_count), comments: intOrNull(st.comment_count),
    thumb: raw.video?.dynamic_cover?.url_list?.[0] || raw.video?.cover?.url_list?.[0] || raw.video?.origin_cover?.url_list?.[0] || null,
  };
}

// A LinkedIn post through ScrapeCreators: /v1/linkedin/post gives likeCount and commentCount, no reposts.
function scLinkedinPost(raw, link) {
  const p = raw?.data || raw || {};
  const posted = toIso(p.datePublished);
  const id = String(p.id || link.replace(/\/+$/, '').split(/[/:-]/).pop() || '');
  if (!id || !posted) return null;
  return {
    id, url: p.url || link, caption: p.description || p.headline || '', posted_at: posted, duration_s: null,
    views: sum(p.likeCount, p.commentCount), likes: intOrNull(p.likeCount), comments: intOrNull(p.commentCount),
    thumb: p.image || null, followers: intOrNull(p.author?.followers),
  };
}

const scrapecreators = {
  id: 'scrapecreators', label: 'ScrapeCreators', keyName: 'SCRAPECREATORS_API_KEY', platforms: ['instagram', 'tiktok', 'linkedin'],

  estimate(platform, n, limit) {
    const perCredit = SETTINGS.scrapecreatorsUsdPerCredit;
    if (platform === 'linkedin') {   // one profile call, then one call per post
      const calls = n * (1 + limit);
      return { requests: calls, expectedUsd: calls * perCredit, maxUsd: calls * perCredit };
    }
    const page = platform === 'instagram' ? SC_IG_PAGE : SC_TT_PAGE;
    const profile = platform === 'instagram' ? 1 : 0;           // Instagram needs one extra call for followers
    const expected = n * (Math.ceil(limit / page) + profile);
    const worst = n * (Math.ceil(limit / page) + 3 + profile);  // photos and retries can need more pages
    return { requests: expected, expectedUsd: expected * perCredit, maxUsd: worst * perCredit };
  },

  async fetch({ platform, handles, limit, ctx }) {
    const key = ctx.fixtures ? null : getKey(this.keyName);
    const fx = ctx.fixtures ? pickFixture(ctx, `scrapecreators-${platform}.json`) : null;
    const out = {};
    const call = async (pathAndQuery, fixtureValue) => {
      const res = fx ? fixtureValue : await httpJson(`${SC_BASE}${pathAndQuery}`, { headers: { 'x-api-key': key } });
      // Every response reports what it charged (credits_charged): 1 normally, 0 on a cache hit.
      ctx.requests++; ctx.spentUsd += Number(res?.credits_charged ?? 1) * SETTINGS.scrapecreatorsUsdPerCredit;
      return res;
    };
    let abort = null;
    for (const handle of handles) {
      if (abort) break;
      if (ctx.spentUsd >= ctx.budgetUsd) { out[handle] = { posts: [], error: 'stopped: budget reached' }; continue; }
      const acct = { posts: [], followers: null, displayName: null, error: null };
      const fxa = fx?.[handle] || {};
      try {
        if (platform === 'instagram') {
          try {
            const prof = await call(`/v1/instagram/profile?handle=${encodeURIComponent(handle)}`, fxa.profile);
            const u = prof?.data?.user || prof?.user || {};
            acct.followers = intOrNull(u.edge_followed_by?.count ?? u.follower_count);
            acct.displayName = u.full_name || null;
          } catch (e) { if (e.kind === 'auth' || e.kind === 'credits') throw e; }   // followers are a nice-to-have
          let cursor = null, pages = 0;
          const maxPages = Math.ceil(limit / SC_IG_PAGE) + 3;
          while (acct.posts.length < limit && pages < maxPages) {
            const q = `/v2/instagram/user/posts?handle=${encodeURIComponent(handle)}${cursor ? `&next_max_id=${encodeURIComponent(cursor)}` : ''}`;
            const page = await call(q, fxa.pages?.[pages]);
            pages++;
            const items = page?.items || page?.data?.items || page?.posts || [];
            for (const it of items) { const p = scInstagramPost(it); if (p) acct.posts.push(p); }
            cursor = page?.next_max_id ?? page?.paging_info?.max_id ?? page?.data?.next_max_id ?? null;
            const more = page?.more_available ?? page?.paging_info?.more_available ?? !!cursor;
            if (!more || !cursor || !items.length) break;
          }
        } else if (platform === 'linkedin') {
          // The public profile lists the person's recent posts as links only; each post is then read for its counts.
          const prof = await call(`/v1/linkedin/profile?url=${encodeURIComponent(linkedinUrl(handle))}`, fxa.profile);
          const p = prof?.data || prof || {};
          acct.displayName = p.name || null;
          acct.followers = intOrNull(p.followers);
          const links = [...new Set((p.recentPosts || []).map(r => r.link).filter(Boolean))].slice(0, limit);
          for (const link of links) {
            if (ctx.spentUsd >= ctx.budgetUsd) break;
            try {
              const post = scLinkedinPost(await call(`/v1/linkedin/post?url=${encodeURIComponent(link)}`, fxa.posts?.[link]), link);
              if (post) { acct.followers ??= post.followers; delete post.followers; acct.posts.push(post); }
            } catch (e) { if (e.kind === 'auth' || e.kind === 'credits') throw e; }
          }
        } else {
          let cursor = null, pages = 0, region = null;
          const maxPages = Math.ceil(limit / SC_TT_PAGE) + 2;
          while (acct.posts.length < limit && pages < maxPages) {
            let q = `/v3/tiktok/profile/videos?handle=${encodeURIComponent(handle)}&sort_by=latest`;
            if (cursor) q += `&max_cursor=${encodeURIComponent(cursor)}`;
            if (region) q += `&region=${region}`;
            const page = await call(q, fxa.pages?.[pages]);
            pages++;
            const items = page?.aweme_list || page?.data?.aweme_list || [];
            if (!items.length && pages === 1 && !region) { region = 'US'; pages--; continue; }   // their docs: try US if empty
            for (const it of items) {
              const p = scTikTokPost(it, handle);
              if (p) acct.posts.push(p);
              if (acct.followers == null) acct.followers = intOrNull(it.author?.follower_count);
              if (!acct.displayName) acct.displayName = it.author?.nickname || null;
            }
            cursor = page?.max_cursor ?? page?.data?.max_cursor ?? null;
            if (!(page?.has_more ?? !!cursor) || !cursor || !items.length) break;
          }
        }
        acct.posts = acct.posts.slice(0, limit);
        if (!acct.posts.length) acct.error = 'no posts returned (private, empty, or nothing public)';
      } catch (e) {
        if (e.kind === 'auth' || e.kind === 'credits') { abort = e; continue; }   // provider unusable: caller fails over for the rest
        acct.error = e.message;
      }
      out[handle] = acct;
    }
    return { accounts: out, abort };
  },
};

// =====================================================================================================
// Apify - runs a ready-made scraper (an "Actor") on Apify's servers, header Authorization: Bearer <token>.
//   Instagram: apify/instagram-reel-scraper   TikTok: clockworks/tiktok-scraper
//   X: kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest   LinkedIn: harvestapi/linkedin-profile-posts
// Prices per result by plan tier, from each Actor's public pricing record (Instagram and TikTok checked
// 2026-10-01, X and LinkedIn 2026-10-09).
// =====================================================================================================
const APIFY_BASE = 'https://api.apify.com/v2';
const APIFY_ACTORS = {
  instagram: 'apify~instagram-reel-scraper', tiktok: 'clockworks~tiktok-scraper',
  x: 'kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest', linkedin: 'harvestapi~linkedin-profile-posts',
};
const APIFY_PRICE = {   // USD per result
  instagram: { FREE: 0.0026, BRONZE: 0.0023, SILVER: 0.0014, GOLD: 0.001 },
  tiktok: { FREE: 0.0037, BRONZE: 0.003, SILVER: 0.0023, GOLD: 0.0017 },
  x: { FREE: 0.00025, BRONZE: 0.00022, SILVER: 0.0002, GOLD: 0.00018 },
  linkedin: { FREE: 0.002, BRONZE: 0.002, SILVER: 0.00175, GOLD: 0.0015 },
};
const APIFY_START_FEE = { instagram: 0.001, tiktok: 0, x: 0, linkedin: 0.00005 };   // some Actors charge a little per run
const APIFY_MIN_PER_QUERY = { x: 20 };   // the X Actor returns at least 20 posts for each account it is asked about

function apifyXPost(it) {
  if (it.isRetweet || it.isReply || it.type === 'retweet') return null;   // the account's own posts only
  const posted = toIso(it.createdAt);
  const id = String(it.id || '');
  if (!id || it.viewCount == null || !posted) return null;               // older posts have no view count
  return {
    id, url: it.url || it.twitterUrl || '', caption: it.text || '', posted_at: posted, duration_s: null,
    views: intOrNull(it.viewCount) ?? 0, likes: intOrNull(it.likeCount), comments: intOrNull(it.replyCount), thumb: null,
  };
}

function apifyLinkedinPost(it) {
  const posted = toIso(it.postedAt?.timestamp ?? it.postedAt?.date ?? it.postedAt);
  const id = String(it.id || it.entityId || '');
  if (!id || !posted || it.type === 'reaction' || it.type === 'comment') return null;
  const e = it.engagement || {};
  const reactions = e.likes ?? (Array.isArray(e.reactions) ? e.reactions.reduce((a, r) => a + (intOrNull(r.count) || 0), 0) : 0);
  return {
    id, url: it.linkedinUrl || it.url || '', caption: it.content || it.text || '', posted_at: posted, duration_s: null,
    views: sum(reactions, e.comments, e.shares), likes: intOrNull(reactions), comments: intOrNull(e.comments), thumb: null,
  };
}

// Which watched account a LinkedIn Actor row belongs to. The Actor's rows name the author in a few ways, so
// each is tried; with one account in the run, every row is that account's.
function linkedinOwner(it, keys) {
  const a = it.author || {};
  const tries = [it.query?.targetUrl, typeof it.query === 'string' ? it.query : null, it.inputUrl, a.linkedinUrl, a.url,
    a.publicIdentifier ? `in/${a.publicIdentifier}` : null, a.universalName ? `company/${a.universalName}` : null];
  for (const t of tries) { if (t) { const k = cleanHandle(t, 'linkedin'); if (keys.includes(k)) return k; } }
  return keys.length === 1 ? keys[0] : null;
}

function apifyInstagramPost(it) {
  const views = it.videoPlayCount ?? it.videoViewCount;
  const posted = toIso(it.timestamp);
  const id = String(it.id || it.shortCode || '');
  if (!id || views == null || !posted) return null;
  return {
    id, url: it.url || (it.shortCode ? `https://www.instagram.com/reel/${it.shortCode}/` : ''), caption: it.caption || '',
    posted_at: posted, duration_s: intOrNull(it.videoDuration), views: intOrNull(views) ?? 0,
    likes: intOrNull(it.likesCount), comments: intOrNull(it.commentsCount), thumb: it.displayUrl || null,
  };
}

function apifyTikTokPost(it) {
  if (it.isSlideshow) return null;                                  // photo slideshow
  const views = it.playCount;
  const posted = toIso(it.createTimeISO || it.createTime);
  const id = String(it.id || '');
  if (!id || views == null || !posted) return null;
  return {
    id, url: it.webVideoUrl || '', caption: it.text || '', posted_at: posted,
    duration_s: intOrNull(it.videoMeta?.duration ?? it['videoMeta.duration']), views: intOrNull(views) ?? 0,
    likes: intOrNull(it.diggCount), comments: intOrNull(it.commentCount),
    thumb: it.videoMeta?.coverUrl || it['videoMeta.coverUrl'] || null,
  };
}

const apify = {
  id: 'apify', label: 'Apify', keyName: 'APIFY_API_TOKEN', platforms: ['instagram', 'tiktok', 'x', 'linkedin'],

  estimate(platform, n, limit) {
    const price = APIFY_PRICE[platform][SETTINGS.apifyTier] ?? APIFY_PRICE[platform].FREE;
    const usd = n * Math.max(limit, APIFY_MIN_PER_QUERY[platform] || 0) * price + APIFY_START_FEE[platform];
    return { requests: 1, expectedUsd: usd, maxUsd: usd };       // one Actor run for all accounts, hard-capped below
  },

  async fetch({ platform, handles, limit, ctx }) {
    const token = ctx.fixtures ? null : getKey(this.keyName);
    const price = APIFY_PRICE[platform][SETTINGS.apifyTier] ?? APIFY_PRICE[platform].FREE;
    let items;
    if (ctx.fixtures) {
      const fx = pickFixture(ctx, `apify-${platform}.json`);
      items = Array.isArray(fx) ? fx : fx.items;
      ctx.requests++; ctx.spentUsd += items.length * price + APIFY_START_FEE[platform];
    } else {
      // Only the fields we need. Every add-on (transcripts, downloads, shares, date filter) stays off, because
      // each one is a separate charge.
      const input = {
        instagram: { username: handles, resultsLimit: limit },
        tiktok: { profiles: handles, resultsPerPage: limit, profileScrapeSections: ['videos'], profileSorting: 'latest' },
        x: { searchTerms: handles.map(h => `from:${h} -filter:replies -filter:nativeretweets`), queryType: 'Latest', maxItems: Math.max(limit, APIFY_MIN_PER_QUERY.x) },
        linkedin: { targetUrls: handles.map(linkedinUrl), maxPosts: limit, includeReposts: false, includeQuotePosts: true, scrapeReactions: false, scrapeComments: false },
      }[platform];
      const cap = Math.max(0.01, +(ctx.budgetUsd - ctx.spentUsd).toFixed(4));   // Apify stops the run at this charge
      const auth = { authorization: `Bearer ${token}` };
      const run = await httpJson(`${APIFY_BASE}/acts/${APIFY_ACTORS[platform]}/runs?maxTotalChargeUsd=${cap}`,
        { method: 'POST', headers: auth, body: input });
      let r = run.data;
      const started = Date.now();
      while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(r.status)) {
        if (Date.now() - started > 15 * 60 * 1000) throw new ProviderError('Apify run took over 15 minutes', 'other');
        r = (await httpJson(`${APIFY_BASE}/actor-runs/${r.id}?waitForFinish=60`, { headers: auth, timeoutMs: 90000 })).data;
      }
      ctx.requests++;
      ctx.spentUsd += Number(r.usageTotalUsd) || 0;
      if (r.status !== 'SUCCEEDED' && r.status !== 'TIMED-OUT') throw new ProviderError(`Apify run ${r.status}`, 'other');
      items = await httpJson(`${APIFY_BASE}/datasets/${r.defaultDatasetId}/items?format=json&clean=1`, { headers: auth, timeoutMs: 120000 });
    }
    const out = Object.fromEntries(handles.map(h => [h, { posts: [], followers: null, displayName: null, error: null }]));
    for (const it of items) {
      if (it.error || it.errorDescription) continue;             // Apify reports a missing or private profile as an error row
      const handle = platform === 'linkedin' ? linkedinOwner(it, handles)
        : cleanHandle(platform === 'instagram' ? it.ownerUsername : platform === 'x' ? it.author?.userName : (it.authorMeta?.name ?? it['authorMeta.name']));
      if (!handle || !out[handle]) continue;
      const post = { instagram: apifyInstagramPost, tiktok: apifyTikTokPost, x: apifyXPost, linkedin: apifyLinkedinPost }[platform](it);
      if (post) out[handle].posts.push(post);
      if (platform === 'tiktok') {
        out[handle].followers ??= intOrNull(it.authorMeta?.fans ?? it['authorMeta.fans']);
        out[handle].displayName ??= it.authorMeta?.nickName || null;
      } else if (platform === 'x') {
        out[handle].followers ??= intOrNull(it.author?.followers);
        out[handle].displayName ??= it.author?.name || null;
      } else if (platform === 'linkedin') {
        out[handle].followers ??= intOrNull(it.author?.followers ?? it.author?.followersCount);
        out[handle].displayName ??= it.author?.name || null;
      } else {
        out[handle].displayName ??= it.ownerFullName || null;
      }
    }
    for (const a of Object.values(out)) {
      a.posts.sort((x, y) => y.posted_at.localeCompare(x.posted_at));
      a.posts = a.posts.slice(0, limit);
      if (!a.posts.length) a.error = 'no posts returned (private, empty, or nothing public)';
    }
    return { accounts: out };
  },
};

// =====================================================================================================
// X API (X's own, pay per use) - header Authorization: Bearer <X_BEARER_TOKEN>. One account lookup, then the
// account's latest posts without replies or reposts. public_metrics.impression_count is the public view count.
// Docs: docs.x.com (users by username, user posts timeline, pay-per-use pricing).
// =====================================================================================================
const XAPI_BASE = 'https://api.x.com/2';

const xapi = {
  id: 'xapi', label: 'X API', keyName: 'X_BEARER_TOKEN', platforms: ['x'],
  estimate(platform, n, limit) {
    const usd = n * (SETTINGS.xapiUsdPerUser + limit * SETTINGS.xapiUsdPerPost);
    return { requests: n * 2, expectedUsd: usd, maxUsd: usd };
  },
  async fetch({ handles, limit, ctx }) {
    const fx = ctx.fixtures ? pickFixture(ctx, 'xapi-x.json') : null;
    const auth = fx ? null : { authorization: `Bearer ${getKey(this.keyName)}` };
    const get = async (pathAndQuery, fixtureValue) => { ctx.requests++; return fx ? fixtureValue : httpJson(`${XAPI_BASE}${pathAndQuery}`, { headers: auth }); };
    const out = {};
    let abort = null;
    for (const handle of handles) {
      if (abort) break;
      if (ctx.spentUsd >= ctx.budgetUsd) { out[handle] = { posts: [], error: 'stopped: budget reached' }; continue; }
      const acct = { posts: [], followers: null, displayName: null, error: null };
      try {
        const u = (await get(`/users/by/username/${encodeURIComponent(handle)}?user.fields=public_metrics`, fx?.[handle]?.user))?.data;
        ctx.spentUsd += SETTINGS.xapiUsdPerUser;
        if (!u?.id) throw new ProviderError('no account with that handle', 'other');
        acct.followers = intOrNull(u.public_metrics?.followers_count);
        acct.displayName = u.name || null;
        const max = Math.min(100, Math.max(5, limit));
        const r = await get(`/users/${u.id}/tweets?max_results=${max}&exclude=retweets,replies&tweet.fields=created_at,public_metrics`, fx?.[handle]?.tweets);
        for (const t of r?.data || []) {
          ctx.spentUsd += SETTINGS.xapiUsdPerPost;
          const m = t.public_metrics || {};
          const posted = toIso(t.created_at);
          if (!t.id || m.impression_count == null || !posted) continue;
          acct.posts.push({
            id: String(t.id), url: `https://x.com/${handle}/status/${t.id}`, caption: t.text || '', posted_at: posted, duration_s: null,
            views: intOrNull(m.impression_count) ?? 0, likes: intOrNull(m.like_count), comments: intOrNull(m.reply_count), thumb: null,
          });
        }
        acct.posts = acct.posts.slice(0, limit);
        if (!acct.posts.length) acct.error = 'no posts returned';
      } catch (e) {
        if (e.kind === 'auth' || e.kind === 'credits') { abort = e; continue; }
        acct.error = e.message;
      }
      out[handle] = acct;
    }
    return { accounts: out, abort };
  },
};

// =====================================================================================================
// FxTwitter - free, no key, no login. A public API run by the volunteers behind the fxtwitter.com link
// embeds: GET https://api.fxtwitter.com/2/profile/<handle>/statuses returns the latest 20 posts with views,
// and a cursor for the next 20. Tested 2026-10-09. It can slow down or stop at any time, so it is tried last
// and paced politely.
// =====================================================================================================
const FX_BASE = 'https://api.fxtwitter.com/2/profile';
const FX_PAGES = 4;   // 20 posts a page; replies and reposts are dropped, so a few pages find 30 of the account's own posts

const fxtwitter = {
  id: 'fxtwitter', label: 'FxTwitter (free)', keyName: null, platforms: ['x'],
  estimate(platform, n) { return { requests: n * 2, expectedUsd: 0, maxUsd: 0 }; },
  async fetch({ handles, limit, ctx }) {
    const fx = ctx.fixtures ? pickFixture(ctx, 'fxtwitter-x.json') : null;
    const out = {};
    for (const handle of handles) {
      const acct = { posts: [], followers: null, displayName: null, error: null };
      try {
        let cursor = null;
        for (let page = 0; page < FX_PAGES && acct.posts.length < limit; page++) {
          let j;
          if (fx) j = fx[handle]?.pages?.[page];
          else {
            j = await httpJson(`${FX_BASE}/${encodeURIComponent(handle)}/statuses${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
              { headers: { 'user-agent': 'outliers-skill/1.0 (peer outlier scan)' }, retries: 1 });
            await sleep(1500);   // be polite to a free service
          }
          ctx.requests++;
          const results = j?.results || [];
          for (const t of results) {
            acct.followers ??= intOrNull(t.author?.followers);
            acct.displayName ??= t.author?.name || null;
            if (t.replying_to || t.reposted_by || String(t.author?.screen_name || '').toLowerCase() !== handle) continue;
            const posted = toIso(t.created_timestamp ?? t.created_at);
            if (!t.id || t.views == null || !posted) continue;
            acct.posts.push({
              id: String(t.id), url: t.url || `https://x.com/${handle}/status/${t.id}`, caption: t.text || '', posted_at: posted, duration_s: null,
              views: intOrNull(t.views) ?? 0, likes: intOrNull(t.likes), comments: intOrNull(t.replies), thumb: null,
            });
          }
          cursor = j?.cursor?.bottom || null;
          if (!cursor || !results.length) break;
        }
        acct.posts = acct.posts.slice(0, limit);
        if (!acct.posts.length) acct.error = 'no posts returned (private, suspended, or the free service is down)';
      } catch (e) {
        acct.error = e.message;
      }
      out[handle] = acct;
    }
    return { accounts: out };
  },
};

// =====================================================================================================
// yt-dlp - free, TikTok only, no key. `yt-dlp --flat-playlist -J https://www.tiktok.com/@name` returns the
// profile's recent videos with views and dates. Tested 2026-10-01. Instagram does not work (yt-dlp marks its
// Instagram profile extractor as broken). TikTok can block it at any time; that is why it is opt-in.
// =====================================================================================================
function runYtdlp(args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    execFile(SETTINGS.ytdlpBin, args, { maxBuffer: 128 * 1024 * 1024, timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      if (err && err.code === 'ENOENT') return reject(new ProviderError('yt-dlp is not installed (pip install yt-dlp)', 'auth'));
      if (err) {
        const line = String(stderr || '').split('\n').find(l => /ERROR/.test(l)) || err.message;
        return reject(new ProviderError(line.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, '').slice(0, 160), 'other'));
      }
      resolve(stdout);
    });
  });
}

function ytdlpTikTokPost(e, handle) {
  const posted = toIso(e.timestamp);
  const id = String(e.id || '');
  if (!id || e.view_count == null || !posted) return null;
  if (e.duration != null && e.duration <= 0) return null;          // a photo slideshow has no duration
  return {
    id, url: `https://www.tiktok.com/@${handle}/video/${id}`, caption: e.description || e.title || '', posted_at: posted,
    duration_s: intOrNull(e.duration), views: intOrNull(e.view_count) ?? 0, likes: intOrNull(e.like_count),
    comments: intOrNull(e.comment_count),
    thumb: (e.thumbnails || []).find(t => t.id === 'cover')?.url || e.thumbnails?.[0]?.url || null,
  };
}

const ytdlp = {
  id: 'ytdlp', label: 'yt-dlp (free)', keyName: null, platforms: ['tiktok'],
  estimate(platform, n) { return { requests: n, expectedUsd: 0, maxUsd: 0 }; },
  async fetch({ platform, handles, limit, ctx }) {
    const fx = ctx.fixtures ? pickFixture(ctx, 'ytdlp-tiktok.json') : null;
    const out = {};
    let abort = null;
    for (const handle of handles) {
      if (abort) break;
      const acct = { posts: [], followers: null, displayName: null, error: null };
      try {
        let json;
        if (fx) json = fx[handle];
        else {
          json = JSON.parse(await runYtdlp(['--flat-playlist', '--playlist-end', String(limit), '-J', `https://www.tiktok.com/@${handle}`]));
          await sleep(1500);   // be polite between profiles
        }
        ctx.requests++;
        const entries = json?.entries || [];
        for (const e of entries) { const p = ytdlpTikTokPost(e, handle); if (p) acct.posts.push(p); }
        acct.displayName = entries[0]?.channel || null;
        acct.posts.sort((x, y) => y.posted_at.localeCompare(x.posted_at));
        acct.posts = acct.posts.slice(0, limit);
        if (!acct.posts.length) acct.error = 'no video posts returned';
      } catch (e) {
        if (e.kind === 'auth') { abort = e; continue; }   // yt-dlp missing: nothing more to try here
        acct.error = e.message;
      }
      out[handle] = acct;
    }
    return { accounts: out, abort };
  },
};

export const PROVIDERS = { scrapecreators, apify, xapi, ytdlp, fxtwitter };

// The providers that can serve this platform right now, best first. A provider with a key problem is skipped
// with a reason, so the caller can say exactly which key to add.
export function pickProviders(platform, { forced = null, fixtures = null } = {}) {
  const wanted = forced ? [forced] : (SETTINGS.order[platform] || []);
  const usable = [], skipped = [];
  for (const id of wanted) {
    const p = PROVIDERS[id];
    if (!p) { skipped.push(`${id}: unknown provider`); continue; }
    if (!p.platforms.includes(platform)) { skipped.push(`${p.label}: does not do ${platform}`); continue; }
    if (p.keyName && !fixtures && !getKey(p.keyName)) { skipped.push(`${p.label}: no ${p.keyName} set`); continue; }
    usable.push(p);
  }
  return { usable, skipped };
}

export { ProviderError, cleanHandle, firstLine };
