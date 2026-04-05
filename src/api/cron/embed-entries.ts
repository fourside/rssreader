import { runEmbeddingModel } from "../ai-model";
import type { Bindings } from "../index";
import { stripHtml } from "./strip-html";

const BATCH_SIZE = 20;
const MAX_TEXT_LENGTH = 2000;

type EntryRow = {
  id: string;
  feed_id: string;
  title: string | null;
  content: string | null;
  summary: string | null;
};

export async function embedNewEntries(env: Bindings): Promise<void> {
  // Embed entries fetched since last cron cycle (7h > 6h interval)
  const entries = await env.DB.prepare(
    `SELECT id, feed_id, title, content, summary
     FROM entries
     WHERE fetched_at > datetime('now', '-7 hours')
     ORDER BY fetched_at DESC
     LIMIT 200`,
  ).all<EntryRow>();

  for (let i = 0; i < entries.results.length; i += BATCH_SIZE) {
    const batch = entries.results.slice(i, i + BATCH_SIZE);
    try {
      await embedBatch(env, batch);
    } catch (e) {
      console.error("Embedding batch failed", e);
    }
  }
}

async function embedBatch(env: Bindings, entries: EntryRow[]): Promise<void> {
  const withText = entries
    .map((e) => ({ entry: e, text: buildEmbeddingText(e) }))
    .filter(
      (item): item is { entry: EntryRow; text: string } => item.text !== null,
    );

  if (withText.length === 0) return;

  const texts = withText.map((item) => item.text);

  const data = await runEmbeddingModel(env.AI, texts);

  if (!data || data.length !== withText.length) {
    console.error("Embedding result mismatch", {
      expected: withText.length,
      got: data?.length,
    });
    return;
  }

  const vectors: VectorizeVector[] = [];
  for (const [idx, { entry }] of withText.entries()) {
    const values = data[idx];
    if (values) {
      vectors.push({
        id: entry.id,
        values,
        metadata: {
          entry_id: entry.id,
          feed_id: entry.feed_id,
          title: entry.title ?? "",
        },
      });
    }
  }

  await env.VECTORIZE.upsert(vectors);
}

function buildEmbeddingText(entry: EntryRow): string | null {
  const title = entry.title ?? "";
  const body = stripHtml(entry.content ?? entry.summary ?? "");
  const text = `${title}\n${body}`.trim().slice(0, MAX_TEXT_LENGTH);
  return text || null;
}
