import type { Bindings } from "../index";
import type { FeedEntry } from "./parse-feed";
import { parseFeed } from "./parse-feed";

const CONCURRENCY = 10;

type Feed = {
  id: string;
  url: string;
  etag: string | null;
  last_modified: string | null;
};

export async function fetchAllFeeds(env: Bindings): Promise<void> {
  const feeds = await env.DB.prepare(
    "SELECT id, url, etag, last_modified FROM feeds",
  ).all<Feed>();

  for (let i = 0; i < feeds.results.length; i += CONCURRENCY) {
    const chunk = feeds.results.slice(i, i + CONCURRENCY);
    await Promise.allSettled(chunk.map((feed) => fetchSingleFeed(env, feed)));
  }
}

async function fetchSingleFeed(env: Bindings, feed: Feed): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    if (feed.etag) headers["If-None-Match"] = feed.etag;
    if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;

    const res = await fetch(feed.url, { headers });

    if (res.status === 304) {
      await env.DB.prepare(
        "UPDATE feeds SET last_fetched_at = datetime('now') WHERE id = ?",
      )
        .bind(feed.id)
        .run();
      return;
    }

    if (!res.ok) {
      console.error(`Feed fetch failed: ${feed.url} (${res.status})`);
      return;
    }

    const xml = await res.text();
    const parsed = parseFeed(xml);

    const stmts: D1PreparedStatement[] = [];

    stmts.push(
      env.DB.prepare(
        `UPDATE feeds SET title = ?, site_url = ?, etag = ?, last_modified = ?, last_fetched_at = datetime('now')
				 WHERE id = ?`,
      ).bind(
        parsed.meta.title || null,
        parsed.meta.siteUrl || null,
        res.headers.get("ETag"),
        res.headers.get("Last-Modified"),
        feed.id,
      ),
    );

    for (const entry of parsed.entries) {
      stmts.push(buildEntryInsert(env, feed.id, entry));
    }

    await env.DB.batch(stmts);
  } catch (e) {
    console.error(`Feed processing failed: ${feed.url}`, e);
  }
}

function buildEntryInsert(
  env: Bindings,
  feedId: string,
  entry: FeedEntry,
): D1PreparedStatement {
  const id = crypto.randomUUID();
  const guid = entry.guid || entry.url;

  return env.DB.prepare(
    `INSERT INTO entries (id, feed_id, guid, url, title, content, summary, author, published_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (feed_id, guid) DO NOTHING`,
  ).bind(
    id,
    feedId,
    guid,
    entry.url || null,
    entry.title || null,
    entry.content || null,
    entry.summary || null,
    entry.author || null,
    entry.publishedAt || null,
  );
}
