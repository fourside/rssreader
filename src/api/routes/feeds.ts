import { Hono } from "hono";
import type { UserEnv } from "../middleware/auth";
import { requireUser } from "../middleware/auth";

export const feedRoutes = new Hono<UserEnv>();

feedRoutes.use(requireUser);

feedRoutes.get("/", async (c) => {
	const userId = c.get("userId");

	const rows = await c.env.DB.prepare(
		`SELECT f.id, f.url, f.title, f.site_url, s.category, s.created_at AS subscribed_at
		 FROM subscriptions s
		 JOIN feeds f ON f.id = s.feed_id
		 WHERE s.user_id = ?
		 ORDER BY f.title`,
	)
		.bind(userId)
		.all();

	return c.json({ feeds: rows.results });
});

feedRoutes.post("/", async (c) => {
	const userId = c.get("userId");

	let body: { url: string; category?: string };
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: "Invalid request body" }, 400);
	}
	if (!body.url) {
		return c.json({ error: "URL is required" }, 400);
	}

	const feedId = crypto.randomUUID();
	const [, selectFeed] = await c.env.DB.batch([
		c.env.DB.prepare(
			"INSERT INTO feeds (id, url) VALUES (?, ?) ON CONFLICT (url) DO NOTHING",
		).bind(feedId, body.url),
		c.env.DB.prepare("SELECT id FROM feeds WHERE url = ?").bind(body.url),
	]);

	const feed = (selectFeed as D1Result<{ id: string }>).results[0];
	const actualFeedId = feed.id;

	const subResult = await c.env.DB.prepare(
		"INSERT INTO subscriptions (user_id, feed_id, category) VALUES (?, ?, ?) ON CONFLICT (user_id, feed_id) DO NOTHING",
	)
		.bind(userId, actualFeedId, body.category ?? null)
		.run();

	if (!subResult.meta.changes) {
		return c.json({ error: "Already subscribed" }, 409);
	}

	return c.json({ id: actualFeedId }, 201);
});

feedRoutes.patch("/:id", async (c) => {
	const userId = c.get("userId");
	const feedId = c.req.param("id");

	let body: { category?: string | null };
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: "Invalid request body" }, 400);
	}

	const result = await c.env.DB.prepare(
		"UPDATE subscriptions SET category = ? WHERE user_id = ? AND feed_id = ?",
	)
		.bind(body.category ?? null, userId, feedId)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: "Subscription not found" }, 404);
	}

	return c.json({ ok: true });
});

feedRoutes.delete("/:id", async (c) => {
	const userId = c.get("userId");
	const feedId = c.req.param("id");

	const result = await c.env.DB.prepare(
		"DELETE FROM subscriptions WHERE user_id = ? AND feed_id = ?",
	)
		.bind(userId, feedId)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: "Subscription not found" }, 404);
	}

	return c.json({ ok: true });
});
