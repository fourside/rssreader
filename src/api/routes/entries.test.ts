import { Hono } from "hono";
import { beforeEach, describe, expect, test } from "vitest";
import type { TestContext } from "../../test/helpers";
import { setupTest } from "../../test/helpers";
import type { AuthEnv } from "../middleware/auth";
import { auth } from "../middleware/auth";
import { entryRoutes } from "./entries";

type EntryItem = {
  id: string;
  title: string;
  is_read: number;
  is_starred: number;
};
type EntriesResponse = { entries: EntryItem[] };
type EntryResponse = { entry: EntryItem };

let ctx: TestContext;
let app: Hono<AuthEnv>;
let feedId: string;

function authedRequest(path: string, init?: RequestInit) {
  return app.request(
    path,
    {
      ...init,
      headers: {
        ...init?.headers,
        Cookie: `session=${ctx.sessionToken}`,
      },
    },
    ctx.env,
  );
}

async function seedFeedAndEntries() {
  feedId = crypto.randomUUID();
  await ctx.db
    .prepare("INSERT INTO feeds (id, url, title) VALUES (?, ?, ?)")
    .bind(feedId, "https://example.com/feed.xml", "Test Blog")
    .run();
  await ctx.db
    .prepare("INSERT INTO subscriptions (user_id, feed_id) VALUES (?, ?)")
    .bind(ctx.userId, feedId)
    .run();
  await ctx.db
    .prepare(
      "INSERT INTO entries (id, feed_id, guid, url, title, summary, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      "e1",
      feedId,
      "g1",
      "https://example.com/1",
      "Post 1",
      "Summary 1",
      "2024-01-02T00:00:00Z",
    )
    .run();
  await ctx.db
    .prepare(
      "INSERT INTO entries (id, feed_id, guid, url, title, summary, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      "e2",
      feedId,
      "g2",
      "https://example.com/2",
      "Post 2",
      "Summary 2",
      "2024-01-01T00:00:00Z",
    )
    .run();
}

beforeEach(async () => {
  ctx = await setupTest();
  app = new Hono<AuthEnv>();
  app.use("/api/*", auth);
  app.route("/api/entries", entryRoutes);
  await seedFeedAndEntries();
});

describe("GET /api/entries", () => {
  test("returns entries for subscribed feeds", async () => {
    const res = await authedRequest("/api/entries");
    expect(res.status).toBe(200);
    const body = (await res.json()) as EntriesResponse;
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].title).toBe("Post 1");
    expect(body.entries[1].title).toBe("Post 2");
  });

  test("filters by feed_id", async () => {
    const res = await authedRequest(`/api/entries?feed_id=${feedId}`);
    const body = (await res.json()) as EntriesResponse;
    expect(body.entries).toHaveLength(2);
  });

  test("filters by starred", async () => {
    await ctx.db
      .prepare(
        "INSERT INTO entry_states (user_id, entry_id, is_starred) VALUES (?, ?, 1)",
      )
      .bind(ctx.userId, "e1")
      .run();

    const res = await authedRequest("/api/entries?starred=true");
    const body = (await res.json()) as EntriesResponse;
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].id).toBe("e1");
  });

  test("filters by unread", async () => {
    await ctx.db
      .prepare(
        "INSERT INTO entry_states (user_id, entry_id, is_read) VALUES (?, ?, 1)",
      )
      .bind(ctx.userId, "e1")
      .run();

    const res = await authedRequest("/api/entries?unread=true");
    const body = (await res.json()) as EntriesResponse;
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].id).toBe("e2");
  });

  test("does not return entries from unsubscribed feeds", async () => {
    const otherFeedId = crypto.randomUUID();
    await ctx.db
      .prepare("INSERT INTO feeds (id, url) VALUES (?, ?)")
      .bind(otherFeedId, "https://other.com/feed.xml")
      .run();
    await ctx.db
      .prepare(
        "INSERT INTO entries (id, feed_id, guid, title) VALUES (?, ?, ?, ?)",
      )
      .bind("e3", otherFeedId, "g3", "Other Post")
      .run();

    const res = await authedRequest("/api/entries");
    const body = (await res.json()) as EntriesResponse;
    expect(body.entries).toHaveLength(2);
  });
});

describe("GET /api/entries/:id", () => {
  test("returns single entry with content", async () => {
    const res = await authedRequest("/api/entries/e1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as EntryResponse;
    expect(body.entry.title).toBe("Post 1");
    expect(body.entry.id).toBe("e1");
  });

  test("returns 404 for non-existent entry", async () => {
    const res = await authedRequest("/api/entries/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/entries/:id/state", () => {
  test("marks entry as read", async () => {
    const res = await authedRequest("/api/entries/e1/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: true }),
    });
    expect(res.status).toBe(200);

    const listRes = await authedRequest("/api/entries?unread=true");
    const body = (await listRes.json()) as EntriesResponse;
    const ids = body.entries.map((e) => e.id);
    expect(ids).not.toContain("e1");
  });

  test("stars entry", async () => {
    const res = await authedRequest("/api/entries/e1/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_starred: true }),
    });
    expect(res.status).toBe(200);

    const listRes = await authedRequest("/api/entries?starred=true");
    const body = (await listRes.json()) as EntriesResponse;
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].id).toBe("e1");
  });

  test("returns 404 for non-existent entry", async () => {
    const res = await authedRequest("/api/entries/nonexistent/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: true }),
    });
    expect(res.status).toBe(404);
  });
});
