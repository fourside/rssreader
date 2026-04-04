import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createTestDb } from "../../test/d1-adapter";
import type { Bindings } from "../index";
import { fetchAllFeeds } from "./fetch-feeds";

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <link>https://example.com</link>
    <item>
      <title>Post 1</title>
      <link>https://example.com/post1</link>
      <guid>https://example.com/post1</guid>
      <description>Summary 1</description>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Post 2</title>
      <link>https://example.com/post2</link>
      <guid>https://example.com/post2</guid>
      <description>Summary 2</description>
      <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

let db: D1Database;
let env: Bindings;

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal("fetch", vi.fn(handler));
}

function insertFeed(
  id: string,
  url: string,
  opts?: { etag?: string; lastModified?: string },
) {
  return db
    .prepare(
      "INSERT INTO feeds (id, url, etag, last_modified) VALUES (?, ?, ?, ?)",
    )
    .bind(id, url, opts?.etag ?? null, opts?.lastModified ?? null)
    .run();
}

beforeEach(() => {
  db = createTestDb();
  env = {
    DB: db,
    AI: {} as Bindings["AI"],
    VECTORIZE: {} as Bindings["VECTORIZE"],
    ASSETS: {} as Bindings["ASSETS"],
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAllFeeds", () => {
  test("fetches feed and inserts entries", async () => {
    await insertFeed("feed-1", "https://example.com/feed.xml");
    mockFetch(() => new Response(RSS_XML, { status: 200 }));

    await fetchAllFeeds(env);

    const entries = await db
      .prepare("SELECT * FROM entries WHERE feed_id = ?")
      .bind("feed-1")
      .all();
    expect(entries.results).toHaveLength(2);
    const titles = entries.results.map((e) => e.title).sort();
    expect(titles).toEqual(["Post 1", "Post 2"]);
  });

  test("updates feed metadata after fetch", async () => {
    await insertFeed("feed-1", "https://example.com/feed.xml");
    mockFetch(
      () =>
        new Response(RSS_XML, {
          status: 200,
          headers: { ETag: '"abc123"', "Last-Modified": "Wed, 03 Jan 2024" },
        }),
    );

    await fetchAllFeeds(env);

    const feed = await db
      .prepare(
        "SELECT title, site_url, etag, last_modified, last_fetched_at FROM feeds WHERE id = ?",
      )
      .bind("feed-1")
      .first<Record<string, string>>();
    expect(feed?.title).toBe("Test Blog");
    expect(feed?.site_url).toBe("https://example.com");
    expect(feed?.etag).toBe('"abc123"');
    expect(feed?.last_modified).toBe("Wed, 03 Jan 2024");
    expect(feed?.last_fetched_at).toBeTruthy();
  });

  test("sends conditional request headers", async () => {
    await insertFeed("feed-1", "https://example.com/feed.xml", {
      etag: '"old-etag"',
      lastModified: "Mon, 01 Jan 2024",
    });
    const fetchSpy = vi.fn(() => new Response(RSS_XML, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await fetchAllFeeds(env);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.headers).toEqual({
      "If-None-Match": '"old-etag"',
      "If-Modified-Since": "Mon, 01 Jan 2024",
    });
  });

  test("handles 304 Not Modified", async () => {
    await insertFeed("feed-1", "https://example.com/feed.xml");
    mockFetch(() => new Response(null, { status: 304 }));

    await fetchAllFeeds(env);

    const entries = await db
      .prepare("SELECT * FROM entries WHERE feed_id = ?")
      .bind("feed-1")
      .all();
    expect(entries.results).toHaveLength(0);

    const feed = await db
      .prepare("SELECT last_fetched_at FROM feeds WHERE id = ?")
      .bind("feed-1")
      .first<{ last_fetched_at: string }>();
    expect(feed?.last_fetched_at).toBeTruthy();
  });

  test("handles non-OK response", async () => {
    await insertFeed("feed-1", "https://example.com/feed.xml");
    mockFetch(() => new Response("Not Found", { status: 404 }));

    await fetchAllFeeds(env);

    const entries = await db
      .prepare("SELECT * FROM entries WHERE feed_id = ?")
      .bind("feed-1")
      .all();
    expect(entries.results).toHaveLength(0);
  });

  test("handles malformed XML without crashing", async () => {
    await insertFeed("feed-1", "https://example.com/feed.xml");
    mockFetch(() => new Response("<html>not a feed</html>", { status: 200 }));

    await fetchAllFeeds(env);

    const entries = await db
      .prepare("SELECT * FROM entries WHERE feed_id = ?")
      .bind("feed-1")
      .all();
    expect(entries.results).toHaveLength(0);
  });

  test("deduplicates entries on repeated fetch", async () => {
    await insertFeed("feed-1", "https://example.com/feed.xml");
    mockFetch(() => new Response(RSS_XML, { status: 200 }));

    await fetchAllFeeds(env);
    await fetchAllFeeds(env);

    const entries = await db
      .prepare("SELECT * FROM entries WHERE feed_id = ?")
      .bind("feed-1")
      .all();
    expect(entries.results).toHaveLength(2);
  });

  test("processes multiple feeds", async () => {
    await insertFeed("feed-1", "https://example.com/feed1.xml");
    await insertFeed("feed-2", "https://example.com/feed2.xml");
    mockFetch(() => new Response(RSS_XML, { status: 200 }));

    await fetchAllFeeds(env);

    const entries1 = await db
      .prepare("SELECT * FROM entries WHERE feed_id = ?")
      .bind("feed-1")
      .all();
    const entries2 = await db
      .prepare("SELECT * FROM entries WHERE feed_id = ?")
      .bind("feed-2")
      .all();
    expect(entries1.results).toHaveLength(2);
    expect(entries2.results).toHaveLength(2);
  });

  test("does nothing when no feeds exist", async () => {
    mockFetch(() => new Response(RSS_XML, { status: 200 }));

    await fetchAllFeeds(env);

    const entries = await db.prepare("SELECT * FROM entries").all();
    expect(entries.results).toHaveLength(0);
  });
});
