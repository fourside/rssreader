import { Hono } from "hono";
import { auth } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { feedRoutes } from "./routes/feeds";

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

export default {
	fetch: app.fetch,
	async scheduled(
		_event: ScheduledEvent,
		_env: Bindings,
		ctx: ExecutionContext,
	): Promise<void> {
		ctx.waitUntil(Promise.resolve());
	},
};
