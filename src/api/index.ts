import { Hono } from "hono";
import { fetchAllFeeds } from "./cron/fetch-feeds";
import { auth } from "./middleware/auth";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { entryRoutes } from "./routes/entries";
import { feedRoutes } from "./routes/feeds";
import { searchRoutes } from "./routes/search";

export type Bindings = {
  DB: D1Database;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  ASSETS: Fetcher;
  API_TOKEN?: string;
};

export type AppEnv = { Bindings: Bindings };

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => {
  return c.json({ ok: true });
});
app.route("/api/auth", authRoutes);

app.use("/api/*", auth);

app.route("/api/feeds", feedRoutes);
app.route("/api/entries", entryRoutes);
app.route("/api/ai/entries", aiRoutes);
app.route("/api/search", searchRoutes);

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Bindings,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(fetchAllFeeds(env));
  },
};
