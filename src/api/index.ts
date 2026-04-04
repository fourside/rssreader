import { Hono } from "hono";

export type Bindings = {
	DB: D1Database;
	AI: Ai;
	VECTORIZE: VectorizeIndex;
	ASSETS: Fetcher;
};

export type AppEnv = { Bindings: Bindings };

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => {
	return c.json({ ok: true });
});

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
