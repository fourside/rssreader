import { Hono } from "hono";
import type { UserEnv } from "../middleware/auth";
import { requireUser } from "../middleware/auth";

export const entryRoutes = new Hono<UserEnv>();

entryRoutes.use(requireUser);

entryRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const feedId = c.req.query("feed_id");
  const starred = c.req.query("starred");
  const unread = c.req.query("unread");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const offset = Number(c.req.query("offset")) || 0;

  let sql = `
    SELECT e.id, e.feed_id, e.url, e.title, e.summary, e.author, e.published_at,
           f.title AS feed_title,
           COALESCE(es.is_read, 0) AS is_read,
           COALESCE(es.is_starred, 0) AS is_starred
    FROM entries e
    JOIN subscriptions s ON s.feed_id = e.feed_id AND s.user_id = ?
    JOIN feeds f ON f.id = e.feed_id
    LEFT JOIN entry_states es ON es.entry_id = e.id AND es.user_id = ?
    WHERE 1=1
  `;
  const params: unknown[] = [userId, userId];

  if (feedId) {
    sql += " AND e.feed_id = ?";
    params.push(feedId);
  }
  if (starred === "true") {
    sql += " AND COALESCE(es.is_starred, 0) = 1";
  }
  if (unread === "true") {
    sql += " AND COALESCE(es.is_read, 0) = 0";
  }

  sql += " ORDER BY e.published_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = await c.env.DB.prepare(sql)
    .bind(...params)
    .all();

  return c.json({ entries: rows.results });
});

entryRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const entryId = c.req.param("id");

  const entry = await c.env.DB.prepare(
    `SELECT e.*, f.title AS feed_title,
            COALESCE(es.is_read, 0) AS is_read,
            COALESCE(es.is_starred, 0) AS is_starred
     FROM entries e
     JOIN feeds f ON f.id = e.feed_id
     LEFT JOIN entry_states es ON es.entry_id = e.id AND es.user_id = ?
     WHERE e.id = ?`,
  )
    .bind(userId, entryId)
    .first();

  if (!entry) {
    return c.json({ error: "Entry not found" }, 404);
  }

  return c.json({ entry });
});

entryRoutes.patch("/:id/state", async (c) => {
  const userId = c.get("userId");
  const entryId = c.req.param("id");

  let body: { is_read?: boolean; is_starred?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const entry = await c.env.DB.prepare("SELECT id FROM entries WHERE id = ?")
    .bind(entryId)
    .first();
  if (!entry) {
    return c.json({ error: "Entry not found" }, 404);
  }

  const isRead = body.is_read !== undefined ? (body.is_read ? 1 : 0) : null;
  const isStarred =
    body.is_starred !== undefined ? (body.is_starred ? 1 : 0) : null;
  const readAt = body.is_read === true ? new Date().toISOString() : null;

  await c.env.DB.prepare(
    `INSERT INTO entry_states (user_id, entry_id, is_read, is_starred, read_at)
     VALUES (?, ?, COALESCE(?, 0), COALESCE(?, 0), ?)
     ON CONFLICT (user_id, entry_id) DO UPDATE SET
       is_read = COALESCE(?, is_read),
       is_starred = COALESCE(?, is_starred),
       read_at = CASE WHEN ? IS NOT NULL THEN ? ELSE read_at END,
       updated_at = datetime('now')`,
  )
    .bind(
      userId,
      entryId,
      isRead,
      isStarred,
      readAt,
      isRead,
      isStarred,
      readAt,
      readAt,
    )
    .run();

  return c.json({ ok: true });
});
