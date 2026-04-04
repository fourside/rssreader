import { Hono } from "hono";
import { beforeEach, describe, expect, test } from "vitest";
import type { TestContext } from "../../test/helpers";
import { setupTest } from "../../test/helpers";
import type { AuthEnv } from "../middleware/auth";
import { auth } from "../middleware/auth";
import { feedRoutes } from "./feeds";

type FeedItem = { id: string; url: string; category: string | null };
type FeedsResponse = { feeds: FeedItem[] };
type CreateResponse = { id: string };

let ctx: TestContext;
let app: Hono<AuthEnv>;

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

beforeEach(async () => {
  ctx = await setupTest();
  app = new Hono<AuthEnv>();
  app.use("/api/*", auth);
  app.route("/api/feeds", feedRoutes);
});

describe("GET /api/feeds", () => {
  test("returns empty list initially", async () => {
    const res = await authedRequest("/api/feeds");

    expect(res.status).toBe(200);
    const body = (await res.json()) as FeedsResponse;
    expect(body.feeds).toEqual([]);
  });

  test("returns subscribed feeds", async () => {
    await authedRequest("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/feed.xml",
        category: "tech",
      }),
    });

    const res = await authedRequest("/api/feeds");
    const body = (await res.json()) as FeedsResponse;
    expect(body.feeds).toHaveLength(1);
    expect(body.feeds[0].url).toBe("https://example.com/feed.xml");
    expect(body.feeds[0].category).toBe("tech");
  });
});

describe("POST /api/feeds", () => {
  test("creates feed and subscription", async () => {
    const res = await authedRequest("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as CreateResponse;
    expect(body.id).toBeDefined();
  });

  test("reuses existing feed for same URL", async () => {
    const res1 = await authedRequest("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });
    const body1 = (await res1.json()) as CreateResponse;

    const userId2 = crypto.randomUUID();
    await ctx.db
      .prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
      .bind(userId2, "other@example.com", "hash")
      .run();
    const token2 = crypto.randomUUID();
    await ctx.db
      .prepare(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
      )
      .bind(token2, userId2, new Date(Date.now() + 86400000).toISOString())
      .run();

    const res2 = await app.request(
      "/api/feeds",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${token2}`,
        },
        body: JSON.stringify({ url: "https://example.com/feed.xml" }),
      },
      ctx.env,
    );
    const body2 = (await res2.json()) as CreateResponse;

    expect(res2.status).toBe(201);
    expect(body2.id).toBe(body1.id);
  });

  test("returns 409 on duplicate subscription", async () => {
    await authedRequest("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });

    const res = await authedRequest("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });

    expect(res.status).toBe(409);
  });

  test("returns 400 on missing URL", async () => {
    const res = await authedRequest("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/feeds/:id", () => {
  test("updates category", async () => {
    const createRes = await authedRequest("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/feed.xml",
        category: "tech",
      }),
    });
    const { id } = (await createRes.json()) as CreateResponse;

    const res = await authedRequest(`/api/feeds/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "news" }),
    });

    expect(res.status).toBe(200);

    const listRes = await authedRequest("/api/feeds");
    const body = (await listRes.json()) as FeedsResponse;
    expect(body.feeds[0].category).toBe("news");
  });

  test("returns 404 for non-existent subscription", async () => {
    const res = await authedRequest("/api/feeds/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "news" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/feeds/:id", () => {
  test("removes subscription", async () => {
    const createRes = await authedRequest("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });
    const { id } = (await createRes.json()) as CreateResponse;

    const res = await authedRequest(`/api/feeds/${id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);

    const listRes = await authedRequest("/api/feeds");
    const body = (await listRes.json()) as FeedsResponse;
    expect(body.feeds).toHaveLength(0);
  });

  test("returns 404 for non-existent subscription", async () => {
    const res = await authedRequest("/api/feeds/nonexistent", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });
});
