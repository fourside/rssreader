import { Hono } from "hono";
import type { UserEnv } from "../middleware/auth";
import { requireUser } from "../middleware/auth";

export const searchRoutes = new Hono<UserEnv>();

searchRoutes.use(requireUser);

searchRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const query = c.req.query("q")?.trim();

  if (!query) {
    return c.json({ error: "Query is required" }, 400);
  }

  // FTS keyword search
  const ftsResults = await c.env.DB.prepare(
    `SELECT e.id, e.feed_id, e.url, e.title, e.summary, e.author, e.published_at,
            f.title AS feed_title,
            COALESCE(es.is_read, 0) AS is_read,
            COALESCE(es.is_starred, 0) AS is_starred
     FROM entries_fts fts
     JOIN entries e ON e.rowid = fts.rowid
     JOIN subscriptions s ON s.feed_id = e.feed_id AND s.user_id = ?
     JOIN feeds f ON f.id = e.feed_id
     LEFT JOIN entry_states es ON es.entry_id = e.id AND es.user_id = ?
     WHERE entries_fts MATCH ?
     ORDER BY rank
     LIMIT 30`,
  )
    .bind(userId, userId, query)
    .all();

  return c.json({ entries: ftsResults.results });
});
