import { Hono } from "hono";
import { runEmbeddingModel } from "../ai-model";
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

  // Run FTS and semantic search in parallel
  const [ftsResults, semanticIds] = await Promise.all([
    ftsSearch(c.env, userId, query),
    semanticSearch(c.env, query),
  ]);

  // Merge: FTS results first, then semantic results not already in FTS
  const ftsIdSet = new Set(ftsResults.map((e) => e.id));
  const newSemanticIds = semanticIds.filter((id) => !ftsIdSet.has(id));

  let semanticEntries: EntryRow[] = [];
  if (newSemanticIds.length > 0) {
    const placeholders = newSemanticIds.map(() => "?").join(",");
    semanticEntries = (
      await c.env.DB.prepare(
        `SELECT e.id, e.feed_id, e.url, e.title, e.summary, e.author, e.published_at,
                f.title AS feed_title,
                COALESCE(es.is_read, 0) AS is_read,
                COALESCE(es.is_starred, 0) AS is_starred
         FROM entries e
         JOIN subscriptions s ON s.feed_id = e.feed_id AND s.user_id = ?
         JOIN feeds f ON f.id = e.feed_id
         LEFT JOIN entry_states es ON es.entry_id = e.id AND es.user_id = ?
         WHERE e.id IN (${placeholders})`,
      )
        .bind(userId, userId, ...newSemanticIds)
        .all<EntryRow>()
    ).results;
  }

  return c.json({ entries: [...ftsResults, ...semanticEntries] });
});

type EntryRow = {
  id: string;
  feed_id: string;
  url: string | null;
  title: string | null;
  summary: string | null;
  author: string | null;
  published_at: string | null;
  feed_title: string | null;
  is_read: number;
  is_starred: number;
};

async function ftsSearch(
  env: UserEnv["Bindings"],
  userId: string,
  query: string,
): Promise<EntryRow[]> {
  try {
    const result = await env.DB.prepare(
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
       LIMIT 20`,
    )
      .bind(userId, userId, query)
      .all<EntryRow>();
    return result.results;
  } catch {
    // FTS MATCH can fail on invalid syntax
    return [];
  }
}

async function semanticSearch(
  env: UserEnv["Bindings"],
  query: string,
): Promise<string[]> {
  try {
    const data = await runEmbeddingModel(env.AI, [query]);
    if (!data?.[0]) return [];

    const vectorResult = await env.VECTORIZE.query(data[0], {
      topK: 20,
    });

    return vectorResult.matches.map((m) => m.id);
  } catch {
    return [];
  }
}
