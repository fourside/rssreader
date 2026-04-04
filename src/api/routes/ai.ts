import type { Context } from "hono";
import { Hono } from "hono";
import type { UserEnv } from "../middleware/auth";
import { requireUser } from "../middleware/auth";

// Model not in @cloudflare/workers-types yet, but available at runtime
const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct" as Parameters<Ai["run"]>[0];

export const aiRoutes = new Hono<UserEnv>();

aiRoutes.use(requireUser);

aiRoutes.post("/:id/summarize", async (c) => {
  const entry = await getSubscribedEntry(c);
  if (!entry) return c.json({ error: "Entry not found" }, 404);

  if (entry.ai_summary) {
    return c.json({ summary: entry.ai_summary });
  }

  const source = entry.content ?? entry.summary ?? "";
  if (!source) return c.json({ error: "No content to summarize" }, 400);

  const aiSummary = await runAi(
    c,
    "You are a helpful assistant. Summarize the following article in Japanese in 2-3 sentences. Be concise.",
    source,
  );

  if (aiSummary) {
    await c.env.DB.prepare("UPDATE entries SET ai_summary = ? WHERE id = ?")
      .bind(aiSummary, entry.id)
      .run();
  }

  return c.json({ summary: aiSummary });
});

aiRoutes.post("/:id/translate", async (c) => {
  const entry = await getSubscribedEntry(c);
  if (!entry) return c.json({ error: "Entry not found" }, 404);

  let body: { lang?: string };
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const lang = body.lang ?? "ja";

  if (entry.ai_translation && entry.translation_lang === lang) {
    return c.json({ translation: entry.ai_translation, lang });
  }

  const source = entry.content ?? entry.summary ?? "";
  if (!source) return c.json({ error: "No content to translate" }, 400);

  const translation = await runAi(
    c,
    `You are a translator. Translate the following text to ${lang}. Output only the translation, no explanation.`,
    source,
  );

  if (translation) {
    await c.env.DB.prepare(
      "UPDATE entries SET ai_translation = ?, translation_lang = ? WHERE id = ?",
    )
      .bind(translation, lang, entry.id)
      .run();
  }

  return c.json({ translation, lang });
});

type EntryRow = {
  id: string;
  content: string | null;
  summary: string | null;
  ai_summary: string | null;
  ai_translation: string | null;
  translation_lang: string | null;
};

async function getSubscribedEntry(
  c: Context<UserEnv>,
): Promise<EntryRow | null> {
  const userId = c.get("userId");
  const entryId = c.req.param("id");

  return c.env.DB.prepare(
    `SELECT e.id, e.content, e.summary, e.ai_summary, e.ai_translation, e.translation_lang
     FROM entries e
     JOIN subscriptions s ON s.feed_id = e.feed_id AND s.user_id = ?
     WHERE e.id = ?`,
  )
    .bind(userId, entryId)
    .first<EntryRow>();
}

async function runAi(
  c: Context<UserEnv>,
  systemPrompt: string,
  content: string,
): Promise<string> {
  const result = await c.env.AI.run(TEXT_MODEL, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: content.slice(0, 4000) },
    ],
  });

  if (typeof result === "object" && result !== null && "response" in result) {
    return String(result.response);
  }
  return "";
}
